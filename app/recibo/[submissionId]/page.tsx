import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function gradeClass(n: number | null | undefined) {
  if (n == null) return "g-mid";
  if (n >= 14) return "g-high";
  if (n >= 9.5) return "g-mid";
  return "g-low";
}

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const s = await db.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { course: true } }, evaluation: true },
  });

  const wrapper = (children: React.ReactNode) => (
    <div className="public">
      <div className="public-bar"><span className="brand"><span className="logo">A</span> Avalia</span></div>
      <div className="centered" style={{ alignItems: "start" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
      </div>
    </div>
  );

  if (!s) return wrapper(<div className="card">Recibo não encontrado.</div>);

  const ev = s.evaluation;
  const aprovado = ev?.estado === "APROVADO";
  const mostrar = aprovado || s.assignment.feedbackImediato;
  const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA : ev?.notaIA;
  const criterios = (ev?.porCriterio as any[]) ?? [];
  const tr = s.testResult as { passed: number; total: number; duracaoMs?: number; tests: { nome: string; ok: boolean; obrigatorio: boolean }[] } | null;

  return wrapper(
    <>
      <span className="eyebrow">{s.assignment.course.nome}</span>
      <h1 className="page-title" style={{ marginTop: 4 }}>{s.assignment.titulo}</h1>
      <p className="page-sub">Submetido por {s.alunoNome}{s.alunoNumero ? ` · nº ${s.alunoNumero}` : ""}</p>

      {/* Herói de resultado */}
      <div className="card result-hero">
        {mostrar ? (
          <>
            <span className={`badge ${aprovado ? "s-aprovado" : "s-rascunho"}`}>
              {aprovado ? "Nota final" : "Pré-avaliação provisória"}
            </span>
            <div className={`result-grade ${gradeClass(nota)}`}>
              {nota ?? "—"}<span className="max">/20</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {aprovado ? "Validada pelo professor" : "Ainda sujeita a validação do professor"}
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 42, marginBottom: 8 }}>⏳</div>
            <span className="badge s-pendente">Aguarda validação do professor</span>
            <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>
              O teu trabalho foi recebido e está a ser avaliado. Volta a este link para ver a nota quando o professor a publicar.
            </p>
          </>
        )}
      </div>

      {/* Testes automáticos (sempre visível — corre na submissão) */}
      {tr && tr.tests.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row-between">
            <span className="eyebrow">🧪 Testes automáticos</span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
              {tr.passed}/{tr.total} passaram{tr.duracaoMs != null ? ` · ${(tr.duracaoMs / 1000).toFixed(1)}s` : ""}
            </span>
          </div>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 4, fontSize: 13.5 }}>
            {tr.tests.map((t, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: t.ok ? "var(--green)" : "var(--red)" }}>
                <span>{t.ok ? "✓" : "✗"}</span><span style={{ color: "var(--text)" }}>{t.nome}</span>
                {!t.obrigatorio && <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>opcional</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalhe por critério */}
      {mostrar && criterios.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="eyebrow">Por critério</span>
          <ul className="criteria">
            {criterios.map((c) => {
              const pct = c.pontosMax > 0 ? Math.round((c.pontos / c.pontosMax) * 100) : 0;
              return (
                <li key={c.criterioId} className="criterion">
                  <div className="criterion-top">
                    <span className="criterion-name">{c.nome}</span>
                    <span className="criterion-score">{c.pontos}/{c.pontosMax}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                  <p className="justif">{c.justificacao}</p>
                </li>
              );
            })}
          </ul>
          {ev?.feedbackGlobal && <div className="feedback">{ev.feedbackGlobal}</div>}
        </div>
      )}
    </>,
  );
}
