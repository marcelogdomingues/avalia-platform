import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { notFound } from "next/navigation";
import CriarTrabalho from "@/components/CriarTrabalho";
import CoDocentes from "@/components/CoDocentes";
import ProfShell from "@/components/ProfShell";

export const dynamic = "force-dynamic";

const ACAO_LABEL: Record<string, { txt: string; cor: string }> = {
  aprovou: { txt: "aprovou", cor: "#0f766e" },
  reavaliou: { txt: "re-avaliou", cor: "#b45309" },
  "avaliacao-manual": { txt: "avaliou manualmente", cor: "#0f766e" },
  "criou-trabalho": { txt: "criou o trabalho", cor: "var(--ink)" },
  abriu: { txt: "abriu submissões de", cor: "#0f766e" },
  fechou: { txt: "fechou submissões de", cor: "#9f1d1d" },
  convidou: { txt: "convidou", cor: "var(--ink)" },
  removeu: { txt: "removeu", cor: "#9f1d1d" },
};

export default async function CadeiraPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const prof = await requireProfessor();
  const { courseId } = await params;
  const course = await db.course.findFirst({
    where: { id: courseId, ...cadeiraAcesso(prof.id) },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
            select: {
              studentId: true, alunoNome: true, alunoNumero: true, createdAt: true,
              evaluation: { select: { estado: true, notaIA: true, notaFinal: true, deteccaoIA: true } },
            },
          },
        },
      },
      coDocentes: { include: { professor: { select: { id: true, nome: true, email: true } } } },
    },
  });
  if (!course) notFound();
  const isOwner = course.professorId === prof.id;

  const atividade = await db.activityLog.findMany({
    where: { courseId: course.id },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });

  const todasNotas: number[] = [];
  let totalSubs = 0;
  let totalPend = 0;
  const LANG_LABEL: Record<string, string> = {
    python: "Python", java: "Java", javascript: "JavaScript", typescript: "TypeScript",
    go: "Go", ruby: "Ruby", c: "C", cpp: "C++", php: "PHP", rust: "Rust",
  };
  const trabalhos = course.assignments.map((a) => {
    const suite = a.testSuite as { lang?: string } | null;
    const autograder = suite?.lang ? LANG_LABEL[suite.lang] ?? suite.lang : null;
    const subs = a.submissions.length;
    const pend = a.submissions.filter((s) => s.evaluation?.estado === "RASCUNHO").length;
    const notas = a.submissions
      .map((s) => {
        const ev = s.evaluation;
        return ev?.estado === "APROVADO" ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null;
      })
      .filter((n): n is number => n != null);
    notas.forEach((n) => todasNotas.push(n));
    totalSubs += subs;
    totalPend += pend;
    const media = notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : null;
    return { a, subs, pend, media, autograder, fechado: !a.aberto };
  });
  const mediaCurso = todasNotas.length
    ? todasNotas.reduce((x, y) => x + y, 0) / todasNotas.length
    : null;

  const temTrabalhos = course.assignments.length > 0;

  // ── Analytics ao nível da cadeira: matriz aluno × trabalho ──────────────────
  // Colunas = trabalhos por ordem cronológica (mais antigo → mais recente).
  const cols = [...course.assignments].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
  const notaDe = (ev: { estado: string; notaIA: number | null; notaFinal: number | null } | null) =>
    ev == null ? null : ev.estado === "APROVADO" ? ev.notaFinal ?? ev.notaIA ?? null : ev.notaIA ?? null;

  type Cel = { nota: number | null; sinalIA: boolean };
  const alunos = new Map<string, { nome: string; numero: string | null; cel: Map<string, Cel> }>();
  for (const a of cols) {
    const vistos = new Set<string>(); // 1ª submissão (mais recente) por aluno neste trabalho
    for (const s of a.submissions) {
      const chave = s.studentId ?? s.alunoNumero ?? s.alunoNome;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const reg = alunos.get(chave) ?? { nome: s.alunoNome, numero: s.alunoNumero, cel: new Map() };
      reg.cel.set(a.id, { nota: notaDe(s.evaluation), sinalIA: ((s.evaluation?.deteccaoIA as { probabilidade?: number } | null)?.probabilidade ?? 0) >= 60 });
      alunos.set(chave, reg);
    }
  }
  const linhasAluno = [...alunos.values()].map((al) => {
    const notas = [...al.cel.values()].map((c) => c.nota).filter((n): n is number => n != null);
    const media = notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : null;
    // tendência: última nota vs primeira (na ordem dos trabalhos)
    const ordenadas = cols.map((a) => al.cel.get(a.id)?.nota).filter((n): n is number => n != null);
    const tendencia = ordenadas.length >= 2 ? ordenadas[ordenadas.length - 1] - ordenadas[0] : 0;
    const risco = (media != null && media < 9.5) || [...al.cel.values()].some((c) => c.sinalIA);
    return { ...al, media, tendencia, risco };
  }).sort((a, b) => (a.media ?? 99) - (b.media ?? 99));

  const corNota = (n: number | null) => (n == null ? "rgba(29,26,19,0.28)" : n < 9.5 ? "#9f1d1d" : n < 14 ? "#b45309" : "#0f766e");

  // ── Vista de risco: consolida os sinais por aluno numa lista acionável ────────
  const emRisco = linhasAluno.map((al) => {
    const submetidos = al.cel.size;
    const emFalta = cols.length - submetidos;
    const sinaisIA = [...al.cel.values()].filter((c) => c.sinalIA).length;
    const reprovado = al.media != null && al.media < 9.5;
    const razoes: { txt: string; cor: string }[] = [];
    if (reprovado) razoes.push({ txt: `média ${al.media!.toFixed(1)} (< 9,5)`, cor: "#9f1d1d" });
    if (al.tendencia < -1.5) razoes.push({ txt: `notas a descer (${al.tendencia.toFixed(1)})`, cor: "#b45309" });
    if (sinaisIA > 0) razoes.push({ txt: `${sinaisIA} sinal${sinaisIA > 1 ? "is" : ""} de IA`, cor: "#b45309" });
    if (emFalta > 0 && cols.length > 1) razoes.push({ txt: `${emFalta} entrega${emFalta > 1 ? "s" : ""} em falta`, cor: "var(--muted)" });
    const score = (reprovado ? 3 : 0) + sinaisIA * 2 + (al.tendencia < -1.5 ? 1 : 0) + emFalta;
    return { nome: al.nome, media: al.media, razoes, score };
  }).filter((x) => x.razoes.length > 0).sort((a, b) => b.score - a.score);

  return (
    <ProfShell>
      <div className="breadcrumb">
        <a href="/professor">Cadeiras</a> <span>/</span> <span>{course.nome}</span>
      </div>
      <h1 className="page-title">{course.nome}</h1>
      <p className="page-sub">{course.ano ?? "Sem ano definido"}</p>

      {temTrabalhos && (
        <div className="card" style={{ marginBottom: 24 }}>
          <span className="eyebrow">Visão geral da cadeira</span>
          <div className="statgrid" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="stat-n">{course.assignments.length}</div>
              <div className="stat-l">Trabalhos</div>
            </div>
            <div className="stat">
              <div className="stat-n">{totalSubs}</div>
              <div className="stat-l">Submissões</div>
            </div>
            <div className="stat">
              <div className="stat-n" style={totalPend > 0 ? { color: "var(--amber)" } : undefined}>
                {totalPend}
              </div>
              <div className="stat-l">Por aprovar</div>
            </div>
            <div className="stat">
              <div className="stat-n">{mediaCurso != null ? mediaCurso.toFixed(1) : "—"}</div>
              <div className="stat-l">Média /20</div>
            </div>
          </div>
        </div>
      )}

      {emRisco.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: "rgba(159,29,29,0.22)" }}>
          <span className="eyebrow" style={{ color: "#9f1d1d" }}>🚩 Alunos em risco · {emRisco.length}</span>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {emRisco.map((al, i) => (
              <div key={i} className="row-between" style={{ fontSize: 14, padding: "9px 12px", borderRadius: 8, background: "var(--surface-2)", gap: 12, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 140 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: al.score >= 4 ? "#9f1d1d" : "#b45309", flex: "none" }} />
                  <b style={{ fontWeight: 600 }}>{al.nome}</b>
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {al.razoes.map((r, j) => (
                    <span key={j} className="badge" style={{ background: `${r.cor === "var(--muted)" ? "rgba(29,26,19,0.06)" : r.cor + "18"}`, color: r.cor, fontWeight: 500, fontSize: 12 }}>{r.txt}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>Sinais para intervenção pedagógica — não são veredictos. Combina com as perguntas de defesa e o registo de atividade.</p>
        </div>
      )}

      {linhasAluno.length > 0 && cols.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="row-between">
            <span className="eyebrow">Progresso dos alunos · {linhasAluno.length} alunos × {cols.length} trabalhos</span>
            <a href={`/professor/cadeira/${course.id}/pauta`} className="btn ghost sm" title="Descarregar pauta consolidada (CSV)">⬇ Pauta (CSV)</a>
          </div>
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 13, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 10px 8px 0", color: "var(--muted)", fontWeight: 500, fontSize: 11.5 }}>Aluno</th>
                  {cols.map((a, i) => (
                    <th key={a.id} title={a.titulo} style={{ padding: "0 4px 8px", color: "var(--muted)", fontWeight: 500, fontSize: 11.5, textAlign: "center", minWidth: 38 }}>T{i + 1}</th>
                  ))}
                  <th style={{ padding: "0 6px 8px 12px", color: "var(--muted)", fontWeight: 600, fontSize: 11.5, textAlign: "right" }}>Média</th>
                  <th style={{ padding: "0 0 8px 6px", color: "var(--muted)", fontWeight: 500, fontSize: 11.5, textAlign: "center" }}>Tend.</th>
                </tr>
              </thead>
              <tbody>
                {linhasAluno.map((al, r) => (
                  <tr key={r}>
                    <td style={{ padding: "0 10px 0 0", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {al.risco && <span title="Em risco (média baixa ou sinal de IA)" style={{ width: 7, height: 7, borderRadius: "50%", background: "#9f1d1d", flex: "none" }} />}
                        <span style={{ fontWeight: al.risco ? 600 : 400 }}>{al.nome}</span>
                      </span>
                    </td>
                    {cols.map((a) => {
                      const c = al.cel.get(a.id);
                      const n = c?.nota ?? null;
                      const cor = corNota(n);
                      const alpha = n == null ? 0 : 0.22 + (n / 20) * 0.5;
                      return (
                        <td key={a.id} title={c ? `${al.nome} · ${a.titulo}: ${n != null ? n.toFixed(1) : "s/nota"}` : "sem submissão"}
                          style={{ textAlign: "center", padding: "7px 4px", borderRadius: 6, fontWeight: 600, minWidth: 34,
                            background: !c ? "transparent" : n == null ? "rgba(29,26,19,0.05)" : cor === "#0f766e" ? `rgba(15,118,110,${alpha})` : cor === "#b45309" ? `rgba(180,83,9,${alpha})` : `rgba(159,29,29,${alpha})`,
                            color: !c ? "rgba(29,26,19,0.2)" : n == null ? "rgba(29,26,19,0.4)" : n >= 14 ? "#fff" : n >= 9.5 ? "#3d2a06" : "#fff" }}>
                          {!c ? "·" : n == null ? "—" : n.toFixed(0)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "right", padding: "0 6px 0 12px", fontWeight: 700, color: corNota(al.media) }}>{al.media != null ? al.media.toFixed(1) : "—"}</td>
                    <td style={{ textAlign: "center", padding: "0 0 0 6px", color: al.tendencia > 0.3 ? "#0f766e" : al.tendencia < -0.3 ? "#9f1d1d" : "rgba(29,26,19,0.4)", fontWeight: 600 }}>
                      {al.tendencia > 0.3 ? "↑" : al.tendencia < -0.3 ? "↓" : "→"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {cols.map((a, i) => <span key={a.id}><strong style={{ fontWeight: 600 }}>T{i + 1}</strong> {a.titulo}</span>)}
          </div>
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title">Trabalhos</h2>
      </div>

      {!temTrabalhos ? (
        <div className="card empty-state">
          <div className="big">📝</div>
          <p>Ainda não há trabalhos nesta cadeira. Cria o primeiro em baixo.</p>
        </div>
      ) : (
        <div className="grid cols-2">
          {trabalhos.map(({ a, subs, pend, media, autograder, fechado }) => (
            <a
              key={a.id}
              href={`/professor/trabalho/${a.id}`}
              className="card hover tile"
              style={{ color: "inherit" }}
            >
              <div className="row-between" style={{ alignItems: "start" }}>
                <span className="eyebrow">{(a.tiposFicheiro as string[]).join(" · ")}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {fechado && <span className="badge" style={{ background: "rgba(159,29,29,0.1)", color: "#9f1d1d", fontWeight: 600 }}>🔒 Fechado</span>}
                  {autograder && <span className="badge" style={{ background: "rgba(15,118,110,0.12)", color: "#0f766e", fontWeight: 600 }}>🧪 {autograder}</span>}
                  {pend > 0 && <span className="badge s-rascunho">{pend} por aprovar</span>}
                </span>
              </div>
              <h3>{a.titulo}</h3>
              <div className="count">
                {subs} submissão(ões)
                {media != null ? ` · média ${media.toFixed(1)}/20` : ""}
              </div>
            </a>
          ))}
        </div>
      )}

      <details className="disclosure card" style={{ marginTop: 28 }} open={!temTrabalhos}>
        <summary style={{ fontSize: 15 }}>＋ Novo trabalho e rubrica</summary>
        <div style={{ marginTop: 18 }}>
          <CriarTrabalho courseId={course.id} modelos={(await db.rubricaTemplate.findMany({ where: { professorId: prof.id }, orderBy: { createdAt: "desc" }, select: { id: true, nome: true, criterios: true } })).map((m) => ({ id: m.id, nome: m.nome, criterios: m.criterios as any }))} />
        </div>
      </details>

      {atividade.length > 0 && (
        <details className="disclosure card" style={{ marginTop: 20 }}>
          <summary style={{ fontSize: 15 }}>🕘 Registo de atividade ({atividade.length})</summary>
          <div style={{ display: "grid", gap: 2, marginTop: 14 }}>
            {atividade.map((ev) => {
              const acao = ACAO_LABEL[ev.acao] ?? { txt: ev.acao, cor: "var(--muted)" };
              const quando = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(ev.criadoEm);
              return (
                <div key={ev.id} className="row-between" style={{ fontSize: 13.5, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>
                    <b style={{ fontWeight: 600 }}>{ev.actorNome}</b>{" "}
                    <span style={{ color: acao.cor }}>{acao.txt}</span>
                    {ev.alvo ? <span className="faint"> · {ev.alvo}</span> : null}
                  </span>
                  <span className="faint mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{quando}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <CoDocentes courseId={course.id} isOwner={isOwner} iniciais={course.coDocentes.map((cd) => ({ id: cd.professor.id, nome: cd.professor.nome, email: cd.professor.email }))} />
    </ProfShell>
  );
}
