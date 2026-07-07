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

  return wrapper(
    <>
      <span className="eyebrow">{s.assignment.course.nome}</span>
      <h1 className="page-title" style={{ marginTop: 4 }}>{s.assignment.titulo}</h1>
      <p className="page-sub">Submetido por {s.alunoNome}{s.alunoNumero ? ` · nº ${s.alunoNumero}` : ""}</p>

      <div className="card">
        <div className="row-between">
          <span className={`badge ${aprovado ? "s-aprovado" : "s-rascunho"}`}>
            {aprovado ? "Nota final" : "Pré-avaliação (provisória)"}
          </span>
          {mostrar ? (
            <span className={`grade ${gradeClass(nota)}`}>{nota ?? "—"}<span className="max">/20</span></span>
          ) : (
            <span className="badge s-pendente">Aguarda validação do professor</span>
          )}
        </div>

        {mostrar && (
          <>
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
            {!aprovado && <p className="hint" style={{ marginTop: 12 }}>Nota provisória, sujeita a validação do professor.</p>}
          </>
        )}

        {!mostrar && (
          <p className="muted" style={{ marginTop: 12 }}>
            O teu trabalho foi recebido e está a ser avaliado. Volta a este link para ver a nota quando o professor a publicar.
          </p>
        )}
      </div>
    </>,
  );
}
