import { db } from "@/lib/db";
import { aprovar } from "@/lib/actions";
import { temLLM } from "@/lib/evaluate";

export const dynamic = "force-dynamic";

function gradeClass(nota: number | null | undefined) {
  if (nota == null) return "g-mid";
  if (nota >= 14) return "g-high";
  if (nota >= 9.5) return "g-mid";
  return "g-low";
}

export default async function ProfessorPage() {
  const assignments = await db.assignment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      course: true,
      submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <main className="container">
      <h1 className="page-title">Painel do professor</h1>
      <p className="page-sub">Revê as pré-avaliações da IA e aprova as notas finais.</p>

      {!temLLM && (
        <div className="demo-banner">
          <span>⚠️</span>
          <span>
            Modo demo — notas geradas por heurística, só para demonstrar o fluxo.
            Define <code>LLM_API_KEY</code> no <code>.env</code> para avaliação real.
          </span>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="card">
          <p className="empty">Ainda não há trabalhos. Corre <code>npm run seed</code> para criar exemplos.</p>
        </div>
      )}

      {assignments.map((a) => (
        <section key={a.id} className="assignment">
          <div className="card-head">
            <span className="eyebrow">{a.course.nome}</span>
            <h2 className="section-title">{a.titulo}</h2>
            <span className="submit-link">
              🔗 Link do aluno: <code>/submeter/{a.submitToken}</code>
            </span>
          </div>

          {a.submissions.length === 0 && <p className="empty">Ainda sem submissões.</p>}

          {a.submissions.map((s) => {
            const ev = s.evaluation;
            const criterios = (ev?.porCriterio as any[]) ?? [];
            const estado = (ev?.estado ?? "PENDENTE").toLowerCase();
            const aprovado = ev?.estado === "APROVADO";
            return (
              <div key={s.id} className="card submission">
                <div className="submission-head">
                  <div>
                    <div className="student">
                      {s.alunoNome}
                      {s.alunoNumero ? <span className="num"> · nº {s.alunoNumero}</span> : null}
                    </div>
                    <span className="model-tag">{ev?.modelo ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`badge s-${estado}`}>{ev?.estado ?? "PENDENTE"}</span>
                    <span className={`grade ${gradeClass(aprovado ? ev?.notaFinal : ev?.notaIA)}`}>
                      {aprovado ? ev?.notaFinal ?? ev?.notaIA : ev?.notaIA ?? "—"}
                      <span className="max">/20</span>
                    </span>
                  </div>
                </div>

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

                {!aprovado && ev && (
                  <>
                    <hr className="hr" />
                    <form action={aprovar} className="approve-row">
                      <input type="hidden" name="evaluationId" value={ev.id} />
                      <div className="field">
                        <label>Nota final</label>
                        <input className="input" name="notaFinal" type="number" step="0.1" min="0" max="20"
                          defaultValue={ev.notaIA ?? undefined} />
                      </div>
                      <button className="btn" type="submit">Aprovar nota</button>
                    </form>
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
