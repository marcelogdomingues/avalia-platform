"use client";

import { useState } from "react";
import { sairAluno, tutorAction, responderDefesa, pedirRevisao, explicarFalhaAction } from "@/lib/actions";
import type { MensagemTutor } from "@/lib/evaluate";

type Bar = { label: string; v: number; max: number };
export type Work = {
  id: string;
  name: string;
  course: string;
  date: string;
  released: boolean;
  score: number | null; // 0–20
  qual: string; // qualitativo (Muito Bom, Bom…)
  statusLabel: string;
  statusColor: string;
  bars: Bar[];
  feedback: string | null;
  approvedBy: string | null;
  defesaPerguntas: string[];
  defesaRespostas: { pergunta: string; resposta: string }[];
  recurso: { pedido: string; estado: "aberto" | "respondido"; resposta?: string } | null;
  testResult: { total: number; passed: number; gateMet: boolean; duracaoMs?: number; tests: { nome: string; ok: boolean; obrigatorio: boolean; ms?: number }[] } | null;
};

const TEAL = "#0f766e";
const INK = "#1d1a13";
const CREAM = "#faf7f1";
const SAND = "#efe8da";

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" stroke={TEAL} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 84 L48 14 L80 84" />
      <path d="M28 54 L42 68 L64 40" />
    </svg>
  );
}

export default function StudentPortal({
  works,
  studentName,
  courses,
  newCount,
  temLLM,
}: {
  works: Work[];
  studentName: string;
  courses: string[];
  newCount: number;
  temLLM: boolean;
}) {
  const [view, setView] = useState<"work" | "grades">("work");
  const [selId, setSelId] = useState<string | null>(works[0]?.id ?? null);
  const [askOpen, setAskOpen] = useState(false);
  const sel = works.find((w) => w.id === selId) ?? null;
  const initials = studentName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  // Tutor socrático — conversa por submissão (não persiste; ajuda a estudar).
  const [tutorMsgs, setTutorMsgs] = useState<Record<string, MensagemTutor[]>>({});
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const msgs = sel ? tutorMsgs[sel.id] ?? [] : [];

  async function enviarTutor() {
    const pergunta = tutorInput.trim();
    if (!pergunta || !sel || tutorLoading) return;
    const historico: MensagemTutor[] = [...msgs, { role: "user", content: pergunta }];
    setTutorMsgs((m) => ({ ...m, [sel.id]: historico }));
    setTutorInput("");
    setTutorLoading(true);
    try {
      const resp = await tutorAction(sel.id, historico);
      setTutorMsgs((m) => ({ ...m, [sel.id]: [...historico, { role: "assistant", content: resp ?? "Não consegui responder agora. Tenta reformular a tua dúvida." }] }));
    } finally {
      setTutorLoading(false);
    }
  }

  // Entrevista de defesa — respostas do aluno às perguntas geradas pela IA
  const [defRascunho, setDefRascunho] = useState<Record<string, string[]>>({});
  const [defLoading, setDefLoading] = useState(false);
  const [defEnviada, setDefEnviada] = useState<Record<string, boolean>>({});

  async function enviarDefesa(w: Work) {
    if (defLoading) return;
    const respostas = defRascunho[w.id] ?? w.defesaPerguntas.map(() => "");
    if (!respostas.some((r) => r.trim())) return;
    setDefLoading(true);
    try {
      const r = await responderDefesa(w.id, respostas);
      if (r.ok) setDefEnviada((m) => ({ ...m, [w.id]: true }));
    } finally {
      setDefLoading(false);
    }
  }

  // Recurso / pedido de revisão
  const [askText, setAskText] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askEnviado, setAskEnviado] = useState<Record<string, boolean>>({});

  async function enviarRecurso(w: Work) {
    if (askLoading || !askText.trim()) return;
    setAskLoading(true);
    try {
      const r = await pedirRevisao(w.id, askText);
      if (r.ok) { setAskEnviado((m) => ({ ...m, [w.id]: true })); setAskOpen(false); setAskText(""); }
    } finally {
      setAskLoading(false);
    }
  }

  // Explicação de teste falhado (IA), por (submissão, teste)
  const [explic, setExplic] = useState<Record<string, string>>({});
  const [explicLoading, setExplicLoading] = useState<string | null>(null);
  async function explicarTeste(subId: string, nome: string) {
    const chave = `${subId}:${nome}`;
    if (explicLoading || explic[chave]) return;
    setExplicLoading(chave);
    try {
      const t = await explicarFalhaAction(subId, nome);
      setExplic((m) => ({ ...m, [chave]: t ?? "Não consegui explicar agora." }));
    } finally {
      setExplicLoading(null);
    }
  }

  function pick(id: string) {
    setSelId(id);
    setAskOpen(false);
    setTutorInput("");
    setAskText("");
  }

  const navBtn = (v: "work" | "grades", icon: string, label: string) => {
    const on = view === v;
    return (
      <button
        onClick={() => setView(v)}
        style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: on ? "rgba(15,118,110,0.12)" : "none", border: "none", fontFamily: "inherit", fontSize: 14, color: on ? TEAL : "rgba(29,26,19,0.7)", fontWeight: on ? 600 : 400, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}
      >
        <span className="mono" style={{ width: 16 }}>{icon}</span>{label}
      </button>
    );
  };

  return (
    <div className="portal">
      {/* SIDEBAR */}
      <aside className="portal-side">
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 10px 22px", color: INK }}>
          <Mark />
          <span className="serif" style={{ fontSize: 22, color: INK }}>Avalia</span>
        </a>

        <div className="mono portal-sec">Os meus estudos</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {navBtn("work", "≡", "Os meus trabalhos")}
          {navBtn("grades", "▤", "Notas")}
        </nav>

        <div className="mono portal-sec" style={{ paddingTop: 22 }}>Cadeiras</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {courses.map((c, i) => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: "rgba(29,26,19,0.7)", padding: "10px 12px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? TEAL : "rgba(29,26,19,0.3)", marginLeft: 4 }} />{c}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11, padding: 12, borderTop: "1px solid rgba(29,26,19,0.1)" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: TEAL, color: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{initials}</div>
          <div style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{studentName}</div>
            <div style={{ fontSize: 11.5, color: "rgba(29,26,19,0.55)" }}>Aluno</div>
          </div>
          <form action={sairAluno}>
            <button type="submit" title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,26,19,0.5)", fontSize: 15 }}>↪</button>
          </form>
        </div>
      </aside>

      {/* MAIN */}
      <main className="portal-main">
        <header className="portal-top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="serif" style={{ fontSize: 22, color: INK }}>{view === "grades" ? "Notas" : "Os meus trabalhos"}</span>
            <span className="mono" style={{ fontSize: 12, color: "rgba(29,26,19,0.5)", background: SAND, padding: "4px 9px", borderRadius: 6 }}>2025/2026</span>
          </div>
          {newCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(29,26,19,0.6)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL }} />
              {newCount} {newCount === 1 ? "novo resultado" : "novos resultados"}
            </div>
          )}
        </header>

        <div className="portal-scroll">
          {view === "work" ? (
            works.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "rgba(29,26,19,0.6)" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                Ainda não tens trabalhos devolvidos. Usa o link que o teu professor partilhou para submeter.
              </div>
            ) : (
              <div className="pwork-grid">
                {/* LISTA */}
                <div className="pwork-list">
                  <div style={{ padding: "20px 22px 12px", fontSize: 13.5, color: "rgba(29,26,19,0.6)" }}>Trabalhos devolvidos</div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
                    {works.map((w) => {
                      const on = w.id === selId;
                      return (
                        <button
                          key={w.id}
                          onClick={() => pick(w.id)}
                          className="prow"
                          style={{ background: on ? "#fff" : "none", boxShadow: on ? `inset 3px 0 0 ${TEAL}, 0 1px 3px rgba(29,26,19,0.06)` : "none" }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{w.name}</div>
                            <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)" }}>{w.course} · {w.date}</div>
                          </div>
                          <div style={{ textAlign: "right", flex: "none" }}>
                            <div className="serif" style={{ fontSize: 18, color: w.released ? INK : "rgba(29,26,19,0.4)" }}>
                              {w.released && w.score != null ? w.score : "—"}
                            </div>
                            <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.04em", textTransform: "uppercase", color: w.statusColor }}>{w.statusLabel}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DETALHE */}
                <div style={{ overflowY: "auto", padding: "32px 40px 48px" }}>
                  {sel && (
                    <div style={{ maxWidth: 640 }}>
                      <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 6 }}>{sel.course} · {sel.date}</div>
                      <h2 className="serif" style={{ fontWeight: 500, fontSize: 32, margin: "0 0 22px", color: INK }}>{sel.name}</h2>

                      {/* Testes automáticos (autograder) */}
                      {sel.testResult && (
                        <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: "16px 20px", marginBottom: 26 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                            <span style={{ fontSize: 14.5, fontWeight: 600 }}>🧪 Testes automáticos</span>
                            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: TEAL }}>
                              {sel.testResult.passed}/{sel.testResult.total} passaram{sel.testResult.duracaoMs != null ? ` · ${(sel.testResult.duracaoMs / 1000).toFixed(1)}s` : ""}
                            </span>
                          </div>
                          <div style={{ display: "grid", gap: 5, fontSize: 13 }}>
                            {sel.testResult.tests.map((t, i) => {
                              const chave = `${sel.id}:${t.nome}`;
                              return (
                                <div key={i}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.ok ? TEAL : "#9f1d1d" }}>
                                    <span>{t.ok ? "✓" : "✗"}</span>
                                    <span style={{ color: "rgba(29,26,19,0.8)" }}>{t.nome}</span>
                                    {!t.obrigatorio && <span className="mono" style={{ fontSize: 10, color: "rgba(29,26,19,0.4)" }}>opcional</span>}
                                    {temLLM && !t.ok && !explic[chave] && (
                                      <button type="button" onClick={() => explicarTeste(sel.id, t.nome)} disabled={explicLoading === chave} style={{ background: "none", border: "none", cursor: "pointer", color: TEAL, fontSize: 11.5, fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
                                        {explicLoading === chave ? "…" : "porquê?"}
                                      </button>
                                    )}
                                    {t.ms != null && <span className="mono" style={{ fontSize: 10, color: "rgba(29,26,19,0.35)", marginLeft: "auto" }}>{t.ms < 1 ? "<1" : t.ms}ms</span>}
                                  </div>
                                  {explic[chave] && (
                                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(29,26,19,0.7)", background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px", marginTop: 4, marginLeft: 20 }}>💡 {explic[chave]}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Entrevista de defesa */}
                      {sel.defesaPerguntas.length > 0 && (() => {
                        const jaRespondeu = defEnviada[sel.id] || sel.defesaRespostas.some((r) => r.resposta.trim());
                        const respMap = new Map(sel.defesaRespostas.map((r) => [r.pergunta, r.resposta]));
                        const rascunho = defRascunho[sel.id] ?? sel.defesaPerguntas.map(() => "");
                        return (
                          <div style={{ background: jaRespondeu ? "rgba(15,118,110,0.06)" : "#fff", border: `1px solid ${jaRespondeu ? "rgba(15,118,110,0.22)" : "rgba(29,26,19,0.12)"}`, borderRadius: 16, padding: "20px 22px", marginBottom: 26 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                              <span style={{ fontSize: 16 }}>🎤</span>
                              <span style={{ fontSize: 14.5, fontWeight: 600 }}>Defesa do trabalho</span>
                              {jaRespondeu && <span style={{ fontSize: 12, color: TEAL, fontWeight: 600 }}>· entregue ✓</span>}
                            </div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(29,26,19,0.65)", marginBottom: 16 }}>
                              {jaRespondeu
                                ? "Já respondeste. As tuas respostas ajudam o professor a confirmar a autoria do teu trabalho."
                                : "Responde por palavras tuas — mostra que dominas o que entregaste. Ajuda o professor a confirmar a autoria."}
                            </div>
                            {sel.defesaPerguntas.map((q, i) => (
                              <div key={i} style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>{i + 1}. {q}</div>
                                {jaRespondeu ? (
                                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(29,26,19,0.72)", paddingLeft: 12, borderLeft: `2px solid ${TEAL}55` }}>{respMap.get(q) || rascunho[i] || "—"}</div>
                                ) : (
                                  <textarea
                                    value={rascunho[i]}
                                    onChange={(e) => setDefRascunho((m) => { const arr = [...(m[sel.id] ?? sel.defesaPerguntas.map(() => ""))]; arr[i] = e.target.value; return { ...m, [sel.id]: arr }; })}
                                    placeholder="A tua resposta…" style={{ width: "100%", minHeight: 60 }} />
                                )}
                              </div>
                            ))}
                            {!jaRespondeu && (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <span className="mono" style={{ fontSize: 11.5, color: "rgba(29,26,19,0.45)" }}>Escreve por palavras tuas · sem copiar</span>
                                <button type="button" className="btn" onClick={() => enviarDefesa(sel)} disabled={defLoading || !(rascunho.some((r) => r.trim()))} style={{ padding: "11px 20px" }}>
                                  {defLoading ? "A enviar…" : "Entregar defesa"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {sel.released ? (
                        <>
                          {/* Nota + supervisão */}
                          <div style={{ display: "flex", gap: 24, alignItems: "stretch", marginBottom: 26, flexWrap: "wrap" }}>
                            <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, padding: "22px 26px", display: "flex", alignItems: "center", gap: 22 }}>
                              <div>
                                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 5 }}>A tua nota</div>
                                <div className="serif" style={{ fontSize: 52, fontWeight: 500, lineHeight: 1 }}>{sel.score}<span style={{ fontSize: 24, color: "rgba(29,26,19,0.4)" }}> / 20</span></div>
                              </div>
                              <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: TEAL, paddingLeft: 22, borderLeft: "1px solid rgba(29,26,19,0.12)", maxWidth: 120, lineHeight: 1.15 }}>{sel.qual}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 240, background: "rgba(15,118,110,0.07)", border: "1px solid rgba(15,118,110,0.2)", borderRadius: 16, padding: "18px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600, color: TEAL, marginBottom: 6 }}>
                                <span style={{ width: 16, height: 16, border: `1.5px solid ${TEAL}`, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
                                Revisto e publicado{sel.approvedBy ? ` por ${sel.approvedBy}` : " pelo professor"}
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(29,26,19,0.72)" }}>A IA fez uma primeira passagem. O teu professor reviu-a e publicou esta nota — a decisão final foi de um humano.</div>
                            </div>
                          </div>

                          {/* Linha do tempo */}
                          <div style={{ display: "flex", alignItems: "center", marginBottom: 30, fontSize: 11.5 }}>
                            {["Submetido", "Revisão com IA", "Validação humana", "Publicado"].map((step, i) => (
                              <div key={step} style={{ display: "contents" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: i >= 2 ? TEAL : "rgba(29,26,19,0.5)", fontWeight: i >= 2 ? 500 : 400, whiteSpace: "nowrap" }}>
                                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: i >= 2 ? TEAL : "rgba(29,26,19,0.3)" }} />{step}
                                </div>
                                {i < 3 && <div style={{ flex: 1, height: 1, background: i >= 2 ? TEAL : "rgba(29,26,19,0.15)", margin: "0 10px" }} />}
                              </div>
                            ))}
                          </div>

                          {/* Rubrica */}
                          {sel.bars.length > 0 && (
                            <>
                              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 14 }}>Como a tua nota se reparte</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 30 }}>
                                {sel.bars.map((b) => {
                                  const pct = b.max > 0 ? Math.round((b.v / b.max) * 100) : 0;
                                  return (
                                    <div key={b.label}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
                                        <span>{b.label}</span>
                                        <span className="mono" style={{ color: "rgba(29,26,19,0.5)" }}>{b.v}/{b.max}</span>
                                      </div>
                                      <div style={{ height: 8, background: "rgba(29,26,19,0.08)", borderRadius: 99, overflow: "hidden" }}>
                                        <div style={{ width: `${pct}%`, height: "100%", background: TEAL, borderRadius: 99, transition: "width .7s cubic-bezier(.22,.61,.36,1)" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {/* Feedback */}
                          {sel.feedback && (
                            <>
                              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 10 }}>Feedback do teu professor</div>
                              <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: "20px 22px", fontSize: 15, lineHeight: 1.65, color: "rgba(29,26,19,0.82)", marginBottom: 28 }}>{sel.feedback}</div>
                            </>
                          )}

                          {/* Tutor socrático (IA) */}
                          {temLLM && (
                            <div style={{ marginBottom: 28 }}>
                              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 10 }}>Tutor de estudo · IA</div>
                              <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: "18px 20px" }}>
                                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(29,26,19,0.65)", marginBottom: msgs.length ? 16 : 12 }}>
                                  Faz perguntas para perceberes como melhorar. O tutor <strong>orienta-te com pistas — nunca faz o trabalho por ti</strong>.
                                </div>

                                {msgs.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                                    {msgs.map((m, i) => (
                                      <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                        <div style={{ maxWidth: "82%", fontSize: 14, lineHeight: 1.55, padding: "10px 14px", borderRadius: 14,
                                          background: m.role === "user" ? TEAL : "var(--surface-2)",
                                          color: m.role === "user" ? CREAM : "rgba(29,26,19,0.85)",
                                          borderBottomRightRadius: m.role === "user" ? 4 : 14, borderBottomLeftRadius: m.role === "user" ? 14 : 4 }}>
                                          {m.content}
                                        </div>
                                      </div>
                                    ))}
                                    {tutorLoading && (
                                      <div style={{ fontSize: 13, color: "rgba(29,26,19,0.5)" }}>o tutor está a pensar…</div>
                                    )}
                                  </div>
                                )}

                                {msgs.length === 0 && (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                                    {["Como posso melhorar este trabalho?", "Que conceitos devo rever?", "Por onde começo a estudar isto?"].map((q) => (
                                      <button key={q} type="button" onClick={() => setTutorInput(q)} className="btn ghost sm" style={{ fontSize: 12, padding: "5px 11px" }}>{q}</button>
                                    ))}
                                  </div>
                                )}

                                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                                  <textarea value={tutorInput} onChange={(e) => setTutorInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarTutor(); } }}
                                    placeholder="Escreve a tua dúvida…" style={{ flex: 1, minHeight: 44, resize: "none" }} />
                                  <button type="button" className="btn" onClick={enviarTutor} disabled={tutorLoading || !tutorInput.trim()} style={{ padding: "11px 18px" }}>
                                    {tutorLoading ? "…" : "Perguntar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recurso / pedido de revisão */}
                          <div style={{ borderTop: "1px solid rgba(29,26,19,0.1)", paddingTop: 22 }}>
                            {sel.recurso?.estado === "respondido" ? (
                              <div>
                                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 10 }}>Pedido de revisão · respondido</div>
                                <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                                  <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)", marginBottom: 4 }}>O teu pedido</div>
                                  <div style={{ fontSize: 14, color: "rgba(29,26,19,0.8)" }}>{sel.recurso.pedido}</div>
                                </div>
                                <div style={{ background: "rgba(15,118,110,0.07)", border: "1px solid rgba(15,118,110,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                                  <div style={{ fontSize: 12, color: TEAL, fontWeight: 600, marginBottom: 4 }}>Resposta do professor</div>
                                  <div style={{ fontSize: 14, color: "rgba(29,26,19,0.82)", lineHeight: 1.55 }}>{sel.recurso.resposta}</div>
                                </div>
                              </div>
                            ) : sel.recurso?.estado === "aberto" || askEnviado[sel.id] ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                                <span style={{ fontSize: 20 }}>⏳</span>
                                <div style={{ fontSize: 13.5, color: "rgba(29,26,19,0.75)" }}>Pedido de revisão enviado ao professor. Recebes a resposta aqui quando ele responder.</div>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: 14, color: "rgba(29,26,19,0.7)", maxWidth: 380 }}>Tens uma dúvida sobre esta nota, ou achas que algo merece uma segunda vista? O teu professor responde.</div>
                                  <button onClick={() => setAskOpen((o) => !o)} className="btn" style={{ padding: "12px 20px" }}>
                                    {askOpen ? "Cancelar" : "Pedir revisão"}
                                  </button>
                                </div>
                                <div className={`auth2-expand ${askOpen ? "open" : ""}`} style={{ maxHeight: askOpen ? 240 : 0 }}>
                                  <textarea value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="Explica porque achas que a nota deve ser revista…" style={{ marginTop: 16, minHeight: 90 }} />
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                                    <span className="mono" style={{ fontSize: 11.5, color: "rgba(29,26,19,0.45)" }}>Vai para o teu professor · não para a IA</span>
                                    <button className="btn" onClick={() => enviarRecurso(sel)} disabled={askLoading || !askText.trim()} style={{ padding: "11px 20px" }}>{askLoading ? "A enviar…" : "Enviar"}</button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.18)", borderRadius: 16, padding: "24px 26px", display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ fontSize: 34 }}>⏳</div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>A aguardar validação do professor</div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(29,26,19,0.7)" }}>O teu trabalho foi recebido e a IA fez uma primeira passagem. A nota só aparece quando o teu professor a rever e publicar.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* GRADES VIEW */
            <div style={{ padding: "34px 40px 48px" }}>
              <div style={{ maxWidth: 900 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 30 }}>
                  {(() => {
                    const graded = works.filter((w) => w.released && w.score != null);
                    const media = graded.length ? (graded.reduce((a, w) => a + (w.score ?? 0), 0) / graded.length).toFixed(1) : "—";
                    const cards = [
                      ["Média geral", `${media}`, "/ 20"],
                      ["Trabalhos devolvidos", `${works.length}`, ""],
                      ["Publicados", `${graded.length}`, ""],
                    ];
                    return cards.map(([label, n, suf]) => (
                      <div key={label} style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 14, padding: 22 }}>
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,26,19,0.5)", marginBottom: 12 }}>{label}</div>
                        <div className="serif" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}>{n}<span style={{ fontSize: 17, color: "rgba(29,26,19,0.45)" }}> {suf}</span></div>
                      </div>
                    ));
                  })()}
                </div>
                <div style={{ background: "#fff", border: "1px solid rgba(29,26,19,0.1)", borderRadius: 16, overflow: "hidden" }}>
                  {works.map((w, i) => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 22px", borderBottom: i < works.length - 1 ? "1px solid rgba(29,26,19,0.08)" : "none" }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{w.name}</div>
                        <div style={{ fontSize: 12.5, color: "rgba(29,26,19,0.5)" }}>{w.course} · {w.date}</div>
                      </div>
                      <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: w.released ? INK : "rgba(29,26,19,0.4)" }}>{w.released && w.score != null ? w.score : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
