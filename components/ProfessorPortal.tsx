"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { aprovar, reavaliar, gerarLinhaBase, sair, gerarInsightsAction, melhorarFeedbackAction, criarSnippet, apagarSnippet, usarSnippet, avaliarDefesaAction, responderRecurso, recorrerTestesAction, recorrerTodosAction, type Snippet } from "@/lib/actions";
import type { DefesaAvaliacao } from "@/lib/evaluate";
import type { InsightsTurma, TomFeedback } from "@/lib/evaluate";
import type { AnaliseIntegridade } from "@/lib/similaridade";
import { notaTexto, escalaLabel, type Escala } from "@/lib/escala";

const TEAL = "#0f766e";
const INK = "#1d1a13";
const LANG_NOME: Record<string, string> = {
  python: "Python", java: "Java", javascript: "JavaScript", typescript: "TypeScript",
  go: "Go", ruby: "Ruby", c: "C", cpp: "C++", php: "PHP", rust: "Rust",
};
const CREAM = "#faf7f1";
const SAND = "#efe8da";
const AMBER = "#b45309";

type Crit = { nome: string; pontos: number; pontosMax: number; justificacao: string };
export type Sub = {
  id: string;
  evaluationId: string | null;
  alunoNome: string;
  alunoNumero: string | null;
  initials: string;
  date: string;
  estado: string; // PENDENTE|RASCUNHO|APROVADO|ERRO
  aprovado: boolean;
  nota: number | null;
  notaIA: number | null;
  criterios: Crit[];
  feedback: string | null;
  perguntas: string[];
  respostasDefesa: { pergunta: string; resposta: string }[];
  defesaAvaliacao: { consistencia: number; veredicto: string; observacoes: string[] } | null;
  deteccaoIA: { probabilidade: number; indicadores: string[] } | null;
  testResult: {
    total: number; passed: number; obrigatoriosTotal: number; obrigatoriosPassed: number; gateMet: boolean; duracaoMs?: number;
    tests: { nome: string; ok: boolean; obrigatorio: boolean; ms?: number }[];
  } | null;
  simIA: number;
  simNome: string | null;
  simScore: number;
  modelo: string | null;
  ressubmissao: { anteriorData: string; adicionadas: number; removidas: number; segs: { tipo: "igual" | "add" | "rem"; texto: string }[] } | null;
  recurso: { pedido: string; estado: "aberto" | "respondido"; resposta?: string } | null;
};
export type PortalProps = {
  prof: { nome: string; initials: string };
  courses: { id: string; nome: string }[];
  assignment: {
    id: string; titulo: string; courseId: string; courseNome: string;
    submitToken: string; temBaseline: boolean; temAutograder?: boolean; autograderLang?: string | null; escala?: string;
    rubrica: { nome: string; peso: number; pontosMax: number; descricao: string }[];
  };
  subs: Sub[];
  stats: { total: number; media: number | null; min: number | null; max: number | null; aprovadas: number; distribuicao: { faixa: string; n: number }[] };
  integridade: AnaliseIntegridade;
  snippets: Snippet[];
  temLLM: boolean;
};

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" stroke={TEAL} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 84 L48 14 L80 84" /><path d="M28 54 L42 68 L64 40" />
    </svg>
  );
}

function SubmitBtn({
  className, style, pendingLabel, children,
}: {
  className: string; style?: React.CSSProperties; pendingLabel: string; children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function statusOf(s: Sub): { label: string; color: string } {
  if (s.aprovado) return { label: "Publicado", color: TEAL };
  if (s.estado === "RASCUNHO") return { label: "Por rever", color: AMBER };
  if (s.estado === "ERRO") return { label: "Erro", color: "#9f1d1d" };
  return { label: "Pendente", color: "rgba(29,26,19,0.55)" };
}

export default function ProfessorPortal({ prof, courses, assignment, subs, stats, integridade, snippets: snippetsIniciais, temLLM }: PortalProps) {
  const [view, setView] = useState<"queue" | "rubrics" | "analytics" | "integrity">("queue");
  const [filtro, setFiltro] = useState<"todas" | "rever" | "publicadas" | "recursos">("todas");
  const [selId, setSelId] = useState<string | null>(subs[0]?.id ?? null);
  const [diffOpen, setDiffOpen] = useState(false);

  // Features de IA no portal
  const [insights, setInsights] = useState<InsightsTurma | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const [melhorarLoading, setMelhorarLoading] = useState(false);

  // Re-correr o autograder em todas as submissões (lote)
  const [rerunAllLoading, setRerunAllLoading] = useState(false);
  const [rerunAllMsg, setRerunAllMsg] = useState<string | null>(null);
  async function recorrerTodos() {
    if (rerunAllLoading) return;
    setRerunAllLoading(true);
    setRerunAllMsg(null);
    try {
      const r = await recorrerTodosAction(assignment.id);
      setRerunAllMsg(`${r.corridas} submissões re-corridas`);
    } finally {
      setRerunAllLoading(false);
    }
  }

  // Re-correr o autograder (por submissão; sobrepõe o testResult localmente)
  const [rerunTR, setRerunTR] = useState<Record<string, Sub["testResult"]>>({});
  const [rerunLoading, setRerunLoading] = useState(false);
  async function recorrerTestes(id: string) {
    if (rerunLoading) return;
    setRerunLoading(true);
    try {
      const r = await recorrerTestesAction(id);
      if (r) setRerunTR((m) => ({ ...m, [id]: r as Sub["testResult"] }));
    } finally {
      setRerunLoading(false);
    }
  }

  // Resposta a recurso (por submissão)
  const [recursoTexto, setRecursoTexto] = useState("");
  const [recursoLoading, setRecursoLoading] = useState(false);
  const [recursoRespondido, setRecursoRespondido] = useState<Record<string, string>>({});
  async function responder(id: string) {
    if (recursoLoading || !recursoTexto.trim()) return;
    setRecursoLoading(true);
    try {
      const r = await responderRecurso(id, recursoTexto);
      if (r.ok) { setRecursoRespondido((m) => ({ ...m, [id]: recursoTexto })); setRecursoTexto(""); }
    } finally {
      setRecursoLoading(false);
    }
  }

  // Avaliação da defesa (por submissão; sobrepõe a que veio do servidor)
  const [defesaLocal, setDefesaLocal] = useState<Record<string, DefesaAvaliacao>>({});
  const [defesaLoading, setDefesaLoading] = useState(false);
  async function avaliarDefesa(id: string) {
    if (defesaLoading) return;
    setDefesaLoading(true);
    try {
      const r = await avaliarDefesaAction(id);
      if (r) setDefesaLocal((m) => ({ ...m, [id]: r }));
    } finally {
      setDefesaLoading(false);
    }
  }

  async function gerarInsights() {
    if (insightsLoading) return;
    setInsightsLoading(true);
    try {
      setInsights(await gerarInsightsAction(assignment.id));
    } finally {
      setInsightsLoading(false);
    }
  }
  async function melhorar(tom: TomFeedback) {
    const ta = feedbackRef.current;
    if (!ta || melhorarLoading || !ta.value.trim()) return;
    setMelhorarLoading(true);
    try {
      const novo = await melhorarFeedbackAction(ta.value, tom);
      if (novo) setFeedbackValor(novo);
    } finally {
      setMelhorarLoading(false);
    }
  }

  // Escreve no textarea de feedback disparando o onChange do React.
  function setFeedbackValor(v: string) {
    const ta = feedbackRef.current;
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(ta, v);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }

  // ── Banco de comentários ───────────────────────────────────────────────────
  const [snippets, setSnippets] = useState<Snippet[]>(snippetsIniciais);
  const [novoAtalho, setNovoAtalho] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [, startSnippet] = useTransition();

  function inserirSnippet(s: Snippet) {
    const ta = feedbackRef.current;
    const atual = ta?.value ?? "";
    setFeedbackValor(atual.trim() ? `${atual.trim()} ${s.texto}` : s.texto);
    setSnippets((ss) => ss.map((x) => (x.id === s.id ? { ...x, usos: x.usos + 1 } : x)).sort((a, b) => b.usos - a.usos));
    startSnippet(() => { usarSnippet(s.id); });
  }

  function guardarSnippet() {
    const ta = feedbackRef.current;
    const texto = ta?.value?.trim() ?? "";
    const atalho = novoAtalho.trim();
    if (!texto || !atalho) return;
    startSnippet(async () => {
      const criado = await criarSnippet(atalho, texto);
      if (criado) setSnippets((ss) => [criado, ...ss]);
      setNovoAtalho("");
      setAGuardar(false);
    });
  }

  function removerSnippet(id: string) {
    setSnippets((ss) => ss.filter((s) => s.id !== id));
    startSnippet(() => { apagarSnippet(id); });
  }

  const visiveis = subs.filter((s) =>
    filtro === "todas" ? true : filtro === "rever" ? !s.aprovado : filtro === "recursos" ? s.recurso?.estado === "aberto" : s.aprovado
  );
  const recursosAbertos = subs.filter((s) => s.recurso?.estado === "aberto").length;
  const sel = subs.find((s) => s.id === selId) ?? null;

  // ── Analytics profundos (computados dos subs) ──────────────────────────────
  // Calibração: onde o professor publicou, quão longe estava a nota da IA.
  const calibPares = subs.filter((s) => s.aprovado && s.notaIA != null && s.nota != null);
  const calibDelta = calibPares.length ? calibPares.reduce((a, s) => a + (s.notaIA! - s.nota!), 0) / calibPares.length : null;
  const calibAjustadas = calibPares.filter((s) => Math.abs(s.notaIA! - s.nota!) >= 0.1).length;

  // Critérios mais fracos: média (em /20) de cada critério na turma.
  const critAgg = new Map<string, { soma: number; n: number }>();
  for (const s of subs) for (const c of s.criterios) {
    if (!c.pontosMax) continue;
    const v = (c.pontos / c.pontosMax) * 20;
    const cur = critAgg.get(c.nome) ?? { soma: 0, n: 0 };
    critAgg.set(c.nome, { soma: cur.soma + v, n: cur.n + 1 });
  }
  const criteriosFracos = [...critAgg.entries()]
    .map(([nome, { soma, n }]) => ({ nome, media: soma / n, n }))
    .sort((a, b) => a.media - b.media);

  // Autograder: testes mais falhados + duração média (dos que têm testResult).
  const comTestes = subs.filter((s) => s.testResult && s.testResult.tests.length);
  const testAgg = new Map<string, { falhas: number; total: number; obrig: boolean }>();
  let somaDur = 0, nDur = 0;
  for (const s of comTestes) {
    if (s.testResult!.duracaoMs != null) { somaDur += s.testResult!.duracaoMs; nDur++; }
    for (const t of s.testResult!.tests) {
      const cur = testAgg.get(t.nome) ?? { falhas: 0, total: 0, obrig: t.obrigatorio };
      cur.total++; if (!t.ok) cur.falhas++; cur.obrig = cur.obrig || t.obrigatorio;
      testAgg.set(t.nome, cur);
    }
  }
  const testesFalhados = [...testAgg.entries()]
    .map(([nome, v]) => ({ nome, ...v, taxa: v.total ? v.falhas / v.total : 0 }))
    .filter((t) => t.falhas > 0)
    .sort((a, b) => b.taxa - a.taxa);
  const durMedia = nDur ? somaDur / nDur : null;

  // Heatmap aluno×critério: matriz de desempenho (em /20) por critério.
  const heatCols = assignment.rubrica.map((c) => c.nome);
  const heatRows = subs
    .filter((s) => s.criterios.length > 0)
    .map((s) => ({
      id: s.id,
      nome: s.alunoNome,
      initials: s.initials,
      celulas: heatCols.map((col) => {
        const c = s.criterios.find((x) => x.nome === col);
        return c && c.pontosMax ? (c.pontos / c.pontosMax) * 20 : null;
      }),
    }));

  // Alunos em risco: motivos acumulados por submissão.
  const emRisco = subs
    .map((s) => {
      const motivos: string[] = [];
      if (s.nota != null && s.nota < 9.5) motivos.push("nota baixa");
      if ((s.deteccaoIA?.probabilidade ?? 0) >= 60) motivos.push("sinal de IA");
      if (s.simScore >= 0.35) motivos.push(`semelhante a ${s.simNome ?? "outro"}`);
      if (s.simIA >= 0.12) motivos.push("perto da resposta-tipo IA");
      if (s.testResult && !s.testResult.gateMet) motivos.push("chumbou nos testes");
      return { s, motivos };
    })
    .filter((x) => x.motivos.length > 0)
    .sort((a, b) => b.motivos.length - a.motivos.length);
  const porRever = subs.filter((s) => s.estado === "RASCUNHO").length;

  // fecha o diff / limpa a resposta ao trocar de submissão
  useEffect(() => { setDiffOpen(false); setRecursoTexto(""); }, [selId]);

  // teclado J/K na fila
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view !== "queue") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      const ids = visiveis.map((s) => s.id);
      const i = ids.indexOf(selId ?? "");
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSelId(ids[Math.min(ids.length - 1, i + 1)] ?? selId); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSelId(ids[Math.max(0, i - 1)] ?? selId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, visiveis, selId]);

  const navBtn = (v: typeof view, icon: string, label: string) => {
    const on = view === v;
    return (
      <button onClick={() => setView(v)} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: on ? "rgba(15,118,110,0.12)" : "none", border: "none", fontFamily: "inherit", fontSize: 14, color: on ? TEAL : "rgba(29,26,19,0.7)", fontWeight: on ? 600 : 400, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}>
        <span className="mono" style={{ width: 16 }}>{icon}</span>{label}
      </button>
    );
  };

  const crumb = view === "rubrics" ? "Rubrica" : view === "analytics" ? "Análises" : view === "integrity" ? "Integridade" : "Fila de revisão";

  return (
    <div className="portal">
      {/* SIDEBAR */}
      <aside className="portal-side">
        <a href="/professor" style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 10px 22px", color: INK }}>
          <Mark /><span className="serif" style={{ fontSize: 22, color: INK }}>Avalia</span>
        </a>
        <div className="mono portal-sec">Ensino</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {navBtn("queue", "≡", "Fila de revisão")}
          {navBtn("rubrics", "§", "Rubrica")}
          {navBtn("analytics", "▤", "Análises")}
          {navBtn("integrity", "◈", "Integridade")}
        </nav>
        <div className="mono portal-sec" style={{ paddingTop: 22 }}>Cadeiras</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {courses.map((c) => (
            <a key={c.id} href={`/professor/cadeira/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: "rgba(29,26,19,0.7)", padding: "10px 12px", borderRadius: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.id === assignment.courseId ? TEAL : "rgba(29,26,19,0.3)", marginLeft: 4 }} />{c.nome}
            </a>
          ))}
        </nav>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11, padding: 12, borderTop: "1px solid rgba(29,26,19,0.1)" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: TEAL, color: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{prof.initials}</div>
          <div style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prof.nome}</div>
            <div style={{ fontSize: 11.5, color: "rgba(29,26,19,0.55)" }}>Docente</div>
          </div>
          <form action={sair}><button type="submit" title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,26,19,0.5)", fontSize: 15 }}>↪</button></form>
        </div>
      </aside>

      {/* MAIN */}
      <main className="portal-main">
        <header className="portal-top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="serif" style={{ fontSize: 22, color: INK }}>{crumb}</span>
            <span className="mono" style={{ fontSize: 12, color: "rgba(29,26,19,0.5)", background: SAND, padding: "4px 9px", borderRadius: 6 }}>{assignment.courseNome} · {assignment.titulo}</span>
            {assignment.autograderLang && <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: "rgba(15,118,110,0.12)", padding: "4px 9px", borderRadius: 6 }}>🧪 {LANG_NOME[assignment.autograderLang] ?? assignment.autograderLang}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {temLLM && (
              <form action={gerarLinhaBase}>
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <SubmitBtn className="btn secondary sm" pendingLabel="A gerar…">{assignment.temBaseline ? "↻ Linha-base" : "Gerar linha-base"}</SubmitBtn>
              </form>
            )}
            {assignment.temAutograder && (
              <button type="button" className="btn secondary sm" onClick={recorrerTodos} disabled={rerunAllLoading} title="Corre os testes atuais contra todas as submissões">
                {rerunAllLoading ? "↻ a correr…" : rerunAllMsg ? `✓ ${rerunAllMsg}` : "↻ Re-correr testes"}
              </button>
            )}
            <a className="btn secondary sm" href={`/professor/trabalho/${assignment.id}/relatorio`}>▤ Relatório</a>
            <a className="btn sm" href={`/professor/trabalho/${assignment.id}/export`}>⬇ Exportar CSV</a>
          </div>
        </header>

        <div className="portal-scroll">
          {view === "queue" && (
            <div className="pwork-grid">
              {/* LISTA */}
              <div className="pwork-list">
                <div style={{ padding: "18px 22px 14px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.6)" }}><strong style={{ color: INK }}>{stats.aprovadas}</strong> de {subs.length} publicadas</div>
                    <div className="mono" style={{ fontSize: 11, color: "rgba(29,26,19,0.45)" }}>J / K para navegar</div>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    {([["todas", "Todas"], ["rever", `Por rever ${porRever}`], ["publicadas", "Publicadas"], ...(recursosAbertos > 0 ? [["recursos", `⚖️ Recursos ${recursosAbertos}`] as const] : [])] as const).map(([k, label]) => {
                      const on = filtro === k;
                      return (
                        <button key={k} onClick={() => setFiltro(k)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "6px 11px", borderRadius: 99, border: `1px solid ${on ? TEAL : "rgba(29,26,19,0.18)"}`, background: on ? TEAL : "#fff", color: on ? CREAM : "rgba(29,26,19,0.7)", cursor: "pointer" }}>{label}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
                  {visiveis.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: "rgba(29,26,19,0.5)", fontSize: 13.5 }}>Nenhuma submissão neste filtro.</div>
                  ) : visiveis.map((s) => {
                    const on = s.id === selId; const st = statusOf(s);
                    return (
                      <button key={s.id} onClick={() => setSelId(s.id)} className="prow" style={{ background: on ? "#fff" : "none", boxShadow: on ? `inset 3px 0 0 ${TEAL}, 0 1px 3px rgba(29,26,19,0.06)` : "none" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: SAND, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600, color: "rgba(29,26,19,0.7)", flex: "none" }}>{s.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                            {s.alunoNome}
                            {(s.simIA >= 0.12 || (s.deteccaoIA?.probabilidade ?? 0) >= 60) && <span title="Sinal de uso de IA" style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER }} />}
                            {s.recurso?.estado === "aberto" && <span title="Pedido de revisão por responder" style={{ fontSize: 11 }}>⚖️</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)" }}>{s.date}</div>
                        </div>
                        <div style={{ textAlign: "right", flex: "none" }}>
                          <div className="serif" style={{ fontSize: 17, fontWeight: 500 }}>{s.nota ?? "—"}</div>
                          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.04em", textTransform: "uppercase", color: st.color }}>{st.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DETALHE */}
              <div style={{ overflowY: "auto", padding: "32px 40px 40px" }}>
                {sel ? (() => {
                  const st = statusOf(sel);
                  const altaIA = sel.simIA >= 0.3;
                  return (
                    <div style={{ maxWidth: 640 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
                        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)" }}>Submissão · {sel.date}{sel.alunoNumero ? ` · nº ${sel.alunoNumero}` : ""}</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${st.color}22`, color: st.color, fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 999 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color }} />{st.label}</div>
                      </div>
                      <h2 className="serif" style={{ fontWeight: 500, fontSize: 32, margin: "0 0 20px", color: INK }}>{sel.alunoNome}</h2>

                      {/* Recurso / pedido de revisão do aluno */}
                      {sel.recurso && (() => {
                        const respondido = sel.recurso.estado === "respondido" || recursoRespondido[sel.id];
                        const resposta = recursoRespondido[sel.id] ?? sel.recurso.resposta;
                        return (
                          <div style={{ marginBottom: 22, background: respondido ? "var(--surface-2)" : "rgba(180,83,9,0.08)", border: `1px solid ${respondido ? "rgba(29,26,19,0.12)" : "rgba(180,83,9,0.28)"}`, borderRadius: 14, padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 15 }}>⚖️</span>
                              <span style={{ fontSize: 14, fontWeight: 600, color: respondido ? INK : AMBER }}>Pedido de revisão do aluno{respondido ? " · respondido" : ""}</span>
                            </div>
                            <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(29,26,19,0.8)", paddingLeft: 12, borderLeft: `2px solid ${AMBER}55`, marginBottom: respondido ? 12 : 14 }}>{sel.recurso.pedido}</div>
                            {respondido ? (
                              <div>
                                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,26,19,0.45)", marginBottom: 4 }}>A tua resposta</div>
                                <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.78)", lineHeight: 1.55 }}>{resposta}</div>
                              </div>
                            ) : (
                              <div>
                                <textarea value={recursoTexto} onChange={(e) => setRecursoTexto(e.target.value)} placeholder="Responde ao aluno (ou reavalia primeiro, e depois explica a alteração)…" style={{ width: "100%", minHeight: 70 }} />
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                                  <button type="button" className="btn sm" onClick={() => responder(sel.id)} disabled={recursoLoading || !recursoTexto.trim()}>{recursoLoading ? "A enviar…" : "Responder ao aluno"}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 24, flexWrap: "wrap" }}>
                        <div>
                          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 5 }}>Nota da IA</div>
                          <div className="serif" style={{ fontSize: 52, fontWeight: 500, lineHeight: 1 }}>{sel.notaIA ?? "—"}<span style={{ fontSize: 24, color: "rgba(29,26,19,0.4)" }}> / 20</span></div>
                          {assignment.escala && assignment.escala !== "vinte" && sel.notaIA != null && (
                            <div className="mono" style={{ fontSize: 11, color: TEAL, marginTop: 4 }}>= {notaTexto(sel.notaIA, assignment.escala as Escala)} <span style={{ color: "rgba(29,26,19,0.4)" }}>({escalaLabel(assignment.escala as Escala)})</span></div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 11, paddingBottom: 6 }}>
                          {sel.criterios.map((c) => {
                            const pct = c.pontosMax > 0 ? Math.round((c.pontos / c.pontosMax) * 100) : 0;
                            return (
                              <div key={c.nome}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}><span style={{ color: "rgba(29,26,19,0.7)" }}>{c.nome}</span><span className="mono" style={{ color: "rgba(29,26,19,0.5)" }}>{c.pontos}/{c.pontosMax}</span></div>
                                <div style={{ height: 7, background: "rgba(29,26,19,0.08)", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: TEAL, borderRadius: 99, transition: "width .7s cubic-bezier(.22,.61,.36,1)" }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Testes automáticos (autograder) */}
                      {(rerunTR[sel.id] ?? sel.testResult) && (() => {
                        const tr = rerunTR[sel.id] ?? sel.testResult!;
                        const cor = tr.gateMet ? TEAL : "#9f1d1d";
                        const pct = tr.total ? Math.round((tr.passed / tr.total) * 100) : 0;
                        return (
                          <div style={{ background: `${cor}12`, border: `1px solid ${cor}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.55)" }}>🧪 Testes automáticos</span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: cor }}>{tr.passed}/{tr.total} · obrigatórios {tr.obrigatoriosPassed}/{tr.obrigatoriosTotal}{tr.duracaoMs != null ? ` · ${(tr.duracaoMs / 1000).toFixed(1)}s` : ""}</span>
                            </div>
                            <div className="mbar"><span style={{ width: `${pct}%`, background: cor }} /></div>
                            <div className="row-between" style={{ marginTop: 8 }}>
                              <details className="disclosure" style={{ flex: 1 }}>
                                <summary>Ver testes</summary>
                              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 3, fontSize: 12.5 }}>
                                {tr.tests.map((t, i) => (
                                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: t.ok ? TEAL : "#9f1d1d" }}>
                                    <span>{t.ok ? "✓" : "✗"}</span><span style={{ color: INK }}>{t.nome}</span>
                                    {t.obrigatorio && <span className="mono" style={{ fontSize: 10, color: "rgba(29,26,19,0.45)" }}>obrigatório</span>}
                                    {t.ms != null && <span className="mono" style={{ fontSize: 10, color: "rgba(29,26,19,0.35)", marginLeft: "auto" }}>{t.ms < 1 ? "<1" : t.ms}ms</span>}
                                  </li>
                                ))}
                              </ul>
                              </details>
                              <button type="button" className="btn ghost sm" onClick={() => recorrerTestes(sel.id)} disabled={rerunLoading} title="Corre os testes atuais contra este código" style={{ marginLeft: 12, whiteSpace: "nowrap" }}>
                                {rerunLoading ? "↻ a correr…" : "↻ Re-correr"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Deteção de uso de IA (sinal, não veredicto) */}
                      {sel.deteccaoIA && (() => {
                        const p = sel.deteccaoIA.probabilidade;
                        const cor = p >= 70 ? "#9f1d1d" : p >= 40 ? AMBER : TEAL;
                        const nivel = p >= 70 ? "alta" : p >= 40 ? "moderada" : "baixa";
                        return (
                          <div style={{ background: `${cor}0f`, border: `1px solid ${cor}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.55)" }}>Deteção de uso de IA</span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: cor }}>{p}% · probabilidade {nivel}</span>
                            </div>
                            <div className="mbar"><span style={{ width: `${p}%`, background: cor }} /></div>
                            {sel.deteccaoIA.indicadores.length > 0 && (
                              <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "rgba(29,26,19,0.72)" }}>
                                {sel.deteccaoIA.indicadores.map((ind, i) => <li key={i} style={{ marginBottom: 3 }}>{ind}</li>)}
                              </ul>
                            )}
                            <div style={{ marginTop: 10, fontSize: 11.5, color: "rgba(29,26,19,0.5)", lineHeight: 1.5 }}>
                              Sinal probabilístico, não um veredicto — pode ter falsos positivos. Confirma com as perguntas de defesa antes de decidir.
                            </div>
                          </div>
                        );
                      })()}

                      {/* Sinais anti-IA / plágio */}
                      {(sel.simIA >= 0.12 || sel.simScore >= 0.35) && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "rgba(180,83,9,0.09)", border: "1px solid rgba(180,83,9,0.22)", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                          <span className="mono" style={{ color: AMBER, fontSize: 14, marginTop: 1 }}>!</span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: AMBER, marginBottom: 3 }}>Sinal de integridade para reveres</div>
                            <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(29,26,19,0.72)" }}>
                              {sel.simIA >= 0.12 && <>Proximidade de {Math.round(sel.simIA * 100)}% com a resposta-tipo da IA{altaIA ? " (alta)" : ""}. </>}
                              {sel.simScore >= 0.35 && <>Semelhança de {Math.round(sel.simScore * 100)}% com a submissão de {sel.simNome}. </>}
                              É contexto, não um veredicto — confirma com as perguntas de defesa.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Perguntas de defesa + respostas do aluno + veredicto da IA */}
                      {sel.perguntas.length > 0 && (() => {
                        const respMap = new Map(sel.respostasDefesa.map((r) => [r.pergunta, r.resposta]));
                        const respondeu = sel.respostasDefesa.some((r) => r.resposta.trim());
                        const defesa = defesaLocal[sel.id] ?? sel.defesaAvaliacao;
                        return (
                          <details className="disclosure" style={{ marginBottom: 20 }} open={respondeu}>
                            <summary>🎤 Defesa ({sel.perguntas.length} perguntas{respondeu ? " · respondida" : " · sem resposta"})</summary>
                            <div style={{ marginTop: 10 }}>
                              {sel.perguntas.map((q, i) => {
                                const r = respMap.get(q);
                                return (
                                  <div key={i} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(29,26,19,0.8)" }}>{i + 1}. {q}</div>
                                    {r?.trim() ? (
                                      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(29,26,19,0.7)", marginTop: 3, paddingLeft: 12, borderLeft: `2px solid ${TEAL}55` }}>{r}</div>
                                    ) : (
                                      <div style={{ fontSize: 12.5, color: "rgba(29,26,19,0.4)", marginTop: 3, paddingLeft: 12 }}>— sem resposta —</div>
                                    )}
                                  </div>
                                );
                              })}

                              {respondeu && temLLM && (
                                <div style={{ marginTop: 12 }}>
                                  {defesa ? (
                                    (() => {
                                      const cor = defesa.consistencia >= 66 ? TEAL : defesa.consistencia >= 40 ? AMBER : "#9f1d1d";
                                      return (
                                        <div style={{ background: `${cor}0f`, border: `1px solid ${cor}33`, borderRadius: 12, padding: "14px 16px" }}>
                                          <div className="row-between" style={{ marginBottom: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: cor }}>Consistência da defesa</span>
                                            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: cor }}>{defesa.consistencia}%</span>
                                          </div>
                                          <div className="bar" style={{ marginBottom: 10 }}><span style={{ width: `${defesa.consistencia}%`, background: cor }} /></div>
                                          <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.8)", marginBottom: defesa.observacoes.length ? 8 : 0 }}>{defesa.veredicto}</div>
                                          {defesa.observacoes.length > 0 && (
                                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "rgba(29,26,19,0.68)" }}>
                                              {defesa.observacoes.map((o, i) => <li key={i} style={{ marginBottom: 3 }}>{o}</li>)}
                                            </ul>
                                          )}
                                          <div className="mono" style={{ fontSize: 10.5, color: "rgba(29,26,19,0.4)", marginTop: 10 }}>Sinal da IA sobre as respostas — não substitui o teu juízo.</div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <button type="button" className="btn secondary sm" onClick={() => avaliarDefesa(sel.id)} disabled={defesaLoading}>
                                      {defesaLoading ? "A avaliar a defesa…" : "🔎 Avaliar consistência das respostas"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })()}

                      {/* Ressubmissão: o que mudou desde a versão anterior */}
                      {sel.ressubmissao && (
                        <div style={{ marginBottom: 20, background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 12, padding: "14px 16px" }}>
                          <button type="button" onClick={() => setDiffOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600 }}>
                              ♺ Ressubmissão · alterações desde {sel.ressubmissao.anteriorData}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                              <span style={{ color: TEAL }}>+{sel.ressubmissao.adicionadas}</span>
                              <span style={{ color: "#9f1d1d" }}>−{sel.ressubmissao.removidas}</span>
                              <span style={{ color: "rgba(29,26,19,0.4)" }}>{diffOpen ? "▲" : "▼"}</span>
                            </span>
                          </button>
                          {diffOpen && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(29,26,19,0.08)", fontSize: 13.5, lineHeight: 1.7, maxHeight: 280, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                              {sel.ressubmissao.segs.map((s, i) => (
                                <span key={i} style={
                                  s.tipo === "add" ? { background: "rgba(15,118,110,0.16)", color: "#0b5a54", borderRadius: 3 }
                                  : s.tipo === "rem" ? { background: "rgba(159,29,29,0.12)", color: "#9f1d1d", textDecoration: "line-through", borderRadius: 3 }
                                  : { color: "rgba(29,26,19,0.72)" }
                                }>{s.texto}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Aprovar (feedback editável + nota) */}
                      {sel.evaluationId && !sel.aprovado ? (
                        <form action={aprovar}>
                          <input type="hidden" name="evaluationId" value={sel.evaluationId} />
                          <div style={{ marginBottom: 18 }}>
                            <div className="row-between" style={{ alignItems: "baseline", marginBottom: 9 }}>
                              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)" }}>Feedback rascunhado · editável</span>
                              {temLLM && (
                                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <span className="faint" style={{ fontSize: 11 }}>{melhorarLoading ? "✨ a melhorar…" : "✨ melhorar:"}</span>
                                  {(["encorajador", "direto", "conciso"] as const).map((t) => (
                                    <button key={t} type="button" className="btn ghost sm" disabled={melhorarLoading} onClick={() => melhorar(t)} style={{ padding: "3px 9px", fontSize: 11.5 }}>{t}</button>
                                  ))}
                                </span>
                              )}
                            </div>
                            <textarea key={sel.id} ref={feedbackRef} name="feedback" defaultValue={sel.feedback ?? ""} style={{ width: "100%", minHeight: 110 }} />

                            {/* Banco de comentários reutilizáveis */}
                            <div style={{ marginTop: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,26,19,0.4)" }}>Banco de comentários</span>
                                {snippets.map((s) => (
                                  <span key={s.id} title={s.texto} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: "1px solid rgba(29,26,19,0.12)", borderRadius: 999, padding: "3px 4px 3px 10px", fontSize: 12 }}>
                                    <button type="button" onClick={() => inserirSnippet(s)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: INK, padding: 0 }}>
                                      {s.atalho}{s.usos > 0 && <span style={{ color: "rgba(29,26,19,0.35)", marginLeft: 5 }}>{s.usos}</span>}
                                    </button>
                                    <button type="button" title="Remover atalho" onClick={() => removerSnippet(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,26,19,0.35)", fontSize: 13, lineHeight: 1, padding: "0 2px" }}>×</button>
                                  </span>
                                ))}
                                {!aGuardar && (
                                  <button type="button" className="btn ghost sm" onClick={() => setAGuardar(true)} style={{ padding: "3px 9px", fontSize: 11.5 }} title="Guarda o feedback atual como atalho reutilizável">＋ guardar atalho</button>
                                )}
                              </div>
                              {aGuardar && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                  <input value={novoAtalho} onChange={(e) => setNovoAtalho(e.target.value)} placeholder="etiqueta (ex.: falta exemplo)" autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarSnippet(); } }}
                                    style={{ flex: 1, maxWidth: 260, fontSize: 13, padding: "6px 10px" }} />
                                  <button type="button" className="btn secondary sm" onClick={guardarSnippet} disabled={!novoAtalho.trim()}>Guardar</button>
                                  <button type="button" className="btn ghost sm" onClick={() => { setAGuardar(false); setNovoAtalho(""); }}>Cancelar</button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                            <div className="field" style={{ margin: 0, width: 100 }}>
                              <label>Nota final</label>
                              <input name="notaFinal" type="number" step="0.1" min="0" max="20" defaultValue={sel.notaIA ?? undefined} />
                            </div>
                            <SubmitBtn className="btn" style={{ padding: "13px 22px" }} pendingLabel="A publicar…">Aprovar &amp; publicar</SubmitBtn>
                          </div>
                        </form>
                      ) : (
                        <div style={{ fontSize: 14, color: "rgba(29,26,19,0.6)", fontWeight: 500 }}>
                          {sel.aprovado ? `✓ Publicado — nota final ${sel.nota}/20` : "Sem avaliação. Corre a re-avaliação."}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
                        <form action={reavaliar}>
                          <input type="hidden" name="submissionId" value={sel.id} />
                          <SubmitBtn className="btn ghost sm" pendingLabel="↻ A re-avaliar…">↻ Re-avaliar</SubmitBtn>
                        </form>
                        <a className="btn ghost sm" href={`/recibo/${sel.id}`} target="_blank">Ver recibo ↗</a>
                        <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "rgba(29,26,19,0.45)" }}>{sel.modelo ?? ""}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12, color: "rgba(29,26,19,0.5)" }}>
                        <span style={{ width: 15, height: 15, border: "1.5px solid rgba(29,26,19,0.35)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
                        Nada é enviado ao aluno até aprovares · registo de auditoria guardado
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ padding: 40, color: "rgba(29,26,19,0.5)" }}>Ainda sem submissões. Partilha o link: <code>/submeter/{assignment.submitToken}</code></div>
                )}
              </div>
            </div>
          )}

          {view === "analytics" && (
            <div style={{ padding: "34px 40px 48px", maxWidth: 1000 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 32 }}>
                {[["Submissões", `${stats.total}`], ["Média /20", stats.media != null ? `${stats.media}` : "—"], ["Publicadas", `${stats.aprovadas}`], ["Mín–Máx", `${stats.min ?? "—"}–${stats.max ?? "—"}`]].map(([l, n]) => (
                  <div key={l} style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: 22 }}>
                    <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 12 }}>{l}</div>
                    <div className="serif" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}>{n}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 22 }}>Distribuição de notas</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 180 }}>
                  {stats.distribuicao.map((d) => {
                    const max = Math.max(1, ...stats.distribuicao.map((x) => x.n));
                    return (
                      <div key={d.faixa} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9, height: "100%", justifyContent: "flex-end" }}>
                        <div style={{ width: "100%", height: `${(d.n / max) * 90 + 2}%`, background: TEAL, borderRadius: "7px 7px 0 0", transition: "height .6s cubic-bezier(.22,.61,.36,1)" }} />
                        <span style={{ fontSize: 11.5, color: "rgba(29,26,19,0.5)" }}>{d.faixa}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Autograder: testes mais falhados */}
              {comTestes.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div className="row-between" style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>🧪 Autograder · testes mais falhados</div>
                    {durMedia != null && <span className="mono" style={{ fontSize: 12, color: "rgba(29,26,19,0.5)" }}>{(durMedia / 1000).toFixed(1)}s em média</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>Onde os alunos mais tropeçam ({comTestes.length} submissões com testes). Bloqueadas pelo gate não aparecem.</div>
                  {testesFalhados.length === 0 ? (
                    <div style={{ fontSize: 14, color: TEAL }}>✓ Toda a gente passou todos os testes que correram.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {testesFalhados.slice(0, 10).map((t) => {
                        const cor = t.taxa >= 0.6 ? "#9f1d1d" : t.taxa >= 0.3 ? AMBER : TEAL;
                        return (
                          <div key={t.nome} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 230, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {t.nome} {t.obrig && <span className="mono" style={{ fontSize: 9.5, color: "rgba(29,26,19,0.4)" }}>obrig.</span>}
                            </div>
                            <div className="bar" style={{ flex: 1 }}><span style={{ width: `${Math.round(t.taxa * 100)}%`, background: cor }} /></div>
                            <div className="mono" style={{ width: 74, textAlign: "right", fontSize: 12.5, color: cor, fontWeight: 600 }}>{t.falhas}/{t.total} falhou</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Calibração IA vs professor */}
              {calibPares.length > 0 && calibDelta != null && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Calibração da IA</div>
                  <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>Diferença entre a nota da IA e a nota que publicaste, nas {calibPares.length} submissões já publicadas.</div>
                  {(() => {
                    const abs = Math.abs(calibDelta);
                    const sentido = abs < 0.1 ? "alinhada com as tuas notas" : calibDelta > 0 ? "otimista (dá mais que tu)" : "pessimista (dá menos que tu)";
                    const cor = abs < 0.3 ? TEAL : abs < 0.8 ? AMBER : "#9f1d1d";
                    return (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                        <span className="serif" style={{ fontSize: 40, fontWeight: 500, color: cor, lineHeight: 1 }}>{calibDelta > 0 ? "+" : ""}{calibDelta.toFixed(1)}</span>
                        <span style={{ fontSize: 14, color: "rgba(29,26,19,0.7)" }}>pontos em média — a IA está {sentido}.</span>
                        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "rgba(29,26,19,0.5)" }}>{calibAjustadas} de {calibPares.length} ajustadas por ti</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Critérios mais fracos */}
              {criteriosFracos.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Critérios mais fracos da turma</div>
                  <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>Média por critério (em /20) — onde a turma precisa de mais apoio.</div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {criteriosFracos.map((c) => {
                      const cor = c.media < 9.5 ? "#9f1d1d" : c.media < 14 ? AMBER : TEAL;
                      return (
                        <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 220, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                          <div className="bar" style={{ flex: 1 }}><span style={{ width: `${(c.media / 20) * 100}%`, background: cor }} /></div>
                          <div className="mono" style={{ width: 52, textAlign: "right", fontSize: 13, color: cor, fontWeight: 600 }}>{c.media.toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Heatmap aluno × critério */}
              {heatRows.length > 0 && heatCols.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Mapa de calor · aluno × critério</div>
                  <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>Desempenho de cada aluno em cada critério (/20). Vermelho = fraco, verde = forte — vê padrões num relance.</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 10px 4px 0", fontWeight: 500, color: "rgba(29,26,19,0.5)" }}></th>
                          {heatCols.map((c) => (
                            <th key={c} style={{ padding: "0 4px", fontWeight: 500, color: "rgba(29,26,19,0.55)", writingMode: "horizontal-tb", maxWidth: 90, verticalAlign: "bottom", fontSize: 11.5, lineHeight: 1.2 }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatRows.map((r) => (
                          <tr key={r.id}>
                            <td style={{ padding: "0 10px 0 0", whiteSpace: "nowrap", color: "rgba(29,26,19,0.8)" }}>
                              <button onClick={() => { setView("queue"); setSelId(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: INK, padding: 0 }}>{r.nome}</button>
                            </td>
                            {r.celulas.map((v, j) => {
                              const cor = v == null ? "rgba(29,26,19,0.05)" : v < 9.5 ? "#9f1d1d" : v < 14 ? AMBER : TEAL;
                              const alpha = v == null ? 1 : 0.28 + (v / 20) * 0.55;
                              return (
                                <td key={j} title={v == null ? "sem dados" : `${r.nome} · ${heatCols[j]}: ${v.toFixed(1)}/20`}
                                  style={{ width: 46, height: 34, textAlign: "center", borderRadius: 6, color: v == null ? "rgba(29,26,19,0.3)" : v >= 14 ? "#fff" : v >= 9.5 ? "#3d2a06" : "#fff",
                                    background: v == null ? "rgba(29,26,19,0.05)" : cor === TEAL ? `rgba(15,118,110,${alpha})` : cor === AMBER ? `rgba(180,83,9,${alpha})` : `rgba(159,29,29,${alpha})`, fontWeight: 600 }}>
                                  {v == null ? "—" : v.toFixed(0)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Alunos em risco */}
              {emRisco.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Alunos a acompanhar</div>
                  <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>{emRisco.length} submissões com sinais de alerta — nota baixa, indício de IA, semelhança ou testes falhados.</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {emRisco.map(({ s, motivos }) => (
                      <button key={s.id} onClick={() => { setView("queue"); setSelId(s.id); }}
                        style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid rgba(29,26,19,0.08)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: SAND, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>{s.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{s.alunoNome}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {motivos.map((m) => (
                              <span key={m} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(159,29,29,0.09)", color: "#9f1d1d" }}>{m}</span>
                            ))}
                          </div>
                        </div>
                        {s.nota != null && <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: s.nota < 9.5 ? "#9f1d1d" : "rgba(29,26,19,0.6)" }}>{s.nota}</span>}
                        <span style={{ color: "rgba(29,26,19,0.35)" }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights da turma (IA) */}
              {temLLM && (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "26px 28px", marginTop: 24 }}>
                  <div className="row-between" style={{ marginBottom: insights ? 18 : 0 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>✨ Insights da turma</div>
                      <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>Resumo dos erros comuns e o que rever, a partir dos feedbacks.</div>
                    </div>
                    <button className="btn secondary sm" onClick={gerarInsights} disabled={insightsLoading}>
                      {insightsLoading ? "A analisar a turma…" : insights ? "↻ Regenerar" : "Gerar insights"}
                    </button>
                  </div>
                  {insights && (
                    <div style={{ display: "grid", gap: 18 }}>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--text)" }}>{insights.resumo}</p>
                      {insights.errosComuns.length > 0 && (
                        <div>
                          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 8 }}>Erros mais comuns</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
                            {insights.errosComuns.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                      {insights.sugestoes.length > 0 && (
                        <div>
                          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0f766e", marginBottom: 8 }}>Sugestões de revisão</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
                            {insights.sugestoes.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === "integrity" && (
            <div style={{ padding: "34px 40px 48px", maxWidth: 1000 }}>
              <h2 className="serif" style={{ fontWeight: 500, fontSize: 26, margin: "0 0 4px", color: INK }}>Integridade da turma</h2>
              <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.55)", marginBottom: 22 }}>
                Semelhança entre submissões (indício de cópia) e proximidade à resposta-tipo de uma IA. Sinal, não veredicto — confirma com as perguntas de defesa.
              </div>

              {/* resumo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 28 }}>
                {[
                  ["Pares suspeitos", `${integridade.pares.length}`, `≥ ${Math.round(integridade.limiar * 100)}% semelhança`],
                  ["Grupos de cópia", `${integridade.clusters.length}`, "submissões ligadas entre si"],
                  ["Perto da IA", `${integridade.proximidadeIA.filter((p) => p.score >= 0.12).length}`, "acima do limiar de alerta"],
                ].map(([l, n, sub]) => (
                  <div key={l} style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: 22 }}>
                    <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 12 }}>{l}</div>
                    <div className="serif" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)", marginTop: 6 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {integridade.pares.length === 0 && integridade.clusters.length === 0 && integridade.proximidadeIA.filter((p) => p.score >= 0.12).length === 0 ? (
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "40px 28px", textAlign: "center", color: "rgba(29,26,19,0.6)" }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
                  Sem sinais de cópia ou de proximidade à IA nesta turma.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 24 }}>
                  {/* grupos de cópia */}
                  {integridade.clusters.length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "24px 26px" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>◈ Grupos de submissões parecidas</div>
                      <div style={{ fontSize: 12.5, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>Cada grupo liga alunos cujas submissões se parecem acima do limiar — bom ponto de partida para investigar.</div>
                      <div style={{ display: "grid", gap: 12 }}>
                        {integridade.clusters.map((c, i) => {
                          const cor = c.scoreMax >= 0.6 ? "#9f1d1d" : c.scoreMax >= 0.4 ? AMBER : TEAL;
                          return (
                            <a key={i} href={`/professor/trabalho/${assignment.id}/comparar?a=${c.ids[0]}&b=${c.ids[1]}`}
                              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)", border: `1px solid ${cor}22`, color: "inherit" }} title="Comparar lado a lado">
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nomes.join(" · ")}</div>
                                <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)", marginTop: 2 }}>{c.ids.length} submissões · semelhança média {Math.round(c.scoreMedio * 100)}%</div>
                              </div>
                              <span className="badge" style={{ background: `${cor}18`, color: cor, fontWeight: 600 }}>máx {Math.round(c.scoreMax * 100)}% →</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ranking de pares */}
                  {integridade.pares.length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "24px 26px" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Pares mais parecidos</div>
                      <div style={{ display: "grid", gap: 12 }}>
                        {integridade.pares.slice(0, 12).map((p, i) => {
                          const cor = p.score >= 0.6 ? "#9f1d1d" : p.score >= 0.4 ? AMBER : TEAL;
                          return (
                            <a key={i} href={`/professor/trabalho/${assignment.id}/comparar?a=${p.aId}&b=${p.bId}`}
                              style={{ display: "flex", alignItems: "center", gap: 14, color: "inherit", padding: "4px 6px", margin: "-4px -6px", borderRadius: 8 }} title="Comparar lado a lado">
                              <div style={{ width: 250, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.aNome} <span style={{ color: "rgba(29,26,19,0.4)" }}>↔</span> {p.bNome}</div>
                              <div className="bar" style={{ flex: 1 }}><span style={{ width: `${Math.round(p.score * 100)}%`, background: cor }} /></div>
                              <div className="mono" style={{ width: 56, textAlign: "right", fontSize: 13, color: cor, fontWeight: 600 }}>{Math.round(p.score * 100)}% →</div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* proximidade à IA */}
                  {integridade.proximidadeIA.filter((p) => p.score >= 0.08).length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "24px 26px" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Proximidade à resposta-tipo de IA</div>
                      <div style={{ fontSize: 12.5, color: "rgba(29,26,19,0.5)", marginBottom: 18 }}>
                        {assignment.temBaseline ? "Comparado com a linha-base de IA gerada para este enunciado." : "Gera a linha-base de IA (botão ↻ Linha-base) para ativar esta comparação."}
                      </div>
                      <div style={{ display: "grid", gap: 12 }}>
                        {integridade.proximidadeIA.filter((p) => p.score >= 0.08).slice(0, 12).map((p) => {
                          const cor = p.score >= 0.25 ? "#9f1d1d" : p.score >= 0.12 ? AMBER : "rgba(29,26,19,0.5)";
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ width: 200, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                              <div className="bar" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, Math.round(p.score * 100))}%`, background: cor }} /></div>
                              <div className="mono" style={{ width: 44, textAlign: "right", fontSize: 13, color: cor, fontWeight: 600 }}>{Math.round(p.score * 100)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === "rubrics" && (
            <div style={{ padding: "34px 40px 48px", maxWidth: 760 }}>
              <h2 className="serif" style={{ fontWeight: 500, fontSize: 26, margin: "0 0 4px", color: INK }}>Rubrica · {assignment.titulo}</h2>
              <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.55)", marginBottom: 22 }}>{assignment.rubrica.length} critérios</div>
              <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, overflow: "hidden" }}>
                {assignment.rubrica.map((c, i) => (
                  <div key={c.nome} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: i < assignment.rubrica.length - 1 ? "1px solid rgba(29,26,19,0.08)" : "none" }}>
                    <div><div style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>{c.nome} <span className="mono" style={{ fontSize: 12, color: "rgba(29,26,19,0.45)" }}>· peso {c.peso}%</span></div><div style={{ fontSize: 13, color: "rgba(29,26,19,0.55)" }}>{c.descricao || "—"}</div></div>
                    <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: TEAL }}>{c.pontosMax}</div>
                  </div>
                ))}
              </div>
              <a href={`/professor/trabalho/${assignment.id}/editar`} className="btn secondary sm" style={{ marginTop: 16 }}>Editar rubrica</a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
