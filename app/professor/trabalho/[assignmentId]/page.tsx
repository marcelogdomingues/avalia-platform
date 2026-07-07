import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { aprovar, reavaliar, apagarTrabalho } from "@/lib/actions";
import { temLLM } from "@/lib/evaluate";

export const dynamic = "force-dynamic";

function gradeClass(n: number | null | undefined) {
  if (n == null) return "g-mid";
  if (n >= 14) return "g-high";
  if (n >= 9.5) return "g-mid";
  return "g-low";
}

export default async function TrabalhoPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { professorId: prof.id } },
    include: {
      course: true,
      submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!a) notFound();

  const rubrica = a.rubrica as any[];
  const aprovadas = a.submissions.filter((s) => s.evaluation?.estado === "APROVADO").length;

  return (
    <>
      <div className="breadcrumb">
        <a href="/professor">Cadeiras</a> <span>/</span>
        <a href={`/professor/cadeira/${a.courseId}`}>{a.course.nome}</a> <span>/</span>
        <span>{a.titulo}</span>
      </div>

      <div className="row-between">
        <h1 className="page-title" style={{ margin: 0 }}>{a.titulo}</h1>
        <form action={apagarTrabalho}>
          <input type="hidden" name="assignmentId" value={a.id} />
          <button className="btn danger sm" type="submit">Apagar trabalho</button>
        </form>
      </div>
      <p className="page-sub">{a.enunciado}</p>

      {!temLLM && (
        <div className="demo-banner">
          <span>⚠️</span>
          <span>Modo demo — notas por heurística. Define <code>LLM_API_KEY</code> no <code>.env</code> para avaliação real.</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="eyebrow">Link de submissão do aluno</span>
            <div style={{ marginTop: 6 }}>
              <span className="submit-link">🔗 <code>/submeter/{a.submitToken}</code></span>
            </div>
          </div>
          <div className="btn-row">
            <a className="btn secondary sm" href={`/submeter/${a.submitToken}`} target="_blank">Abrir página do aluno ↗</a>
            <a className="btn sm" href={`/professor/trabalho/${a.id}/export`}>⬇ Exportar CSV ({aprovadas} aprovadas)</a>
          </div>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 className="section-title">Submissões ({a.submissions.length})</h2>
      </div>

      {a.submissions.length === 0 ? (
        <div className="card empty-state">
          <div className="big">📥</div>
          <p>Ainda sem submissões. Partilha o link do aluno acima.</p>
        </div>
      ) : (
        a.submissions.map((s) => {
          const ev = s.evaluation;
          const criterios = (ev?.porCriterio as any[]) ?? [];
          const estado = (ev?.estado ?? "PENDENTE").toLowerCase();
          const aprovado = ev?.estado === "APROVADO";
          const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA : ev?.notaIA;
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
                  <span className={`grade ${gradeClass(nota)}`}>{nota ?? "—"}<span className="max">/20</span></span>
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

              <hr className="hr" />
              <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
                {ev && !aprovado ? (
                  <form action={aprovar} className="btn-row" style={{ alignItems: "end" }}>
                    <input type="hidden" name="evaluationId" value={ev.id} />
                    <div className="field" style={{ margin: 0, width: 96 }}>
                      <label>Nota final</label>
                      <input name="notaFinal" type="number" step="0.1" min="0" max="20" defaultValue={ev.notaIA ?? undefined} />
                    </div>
                    <button className="btn" type="submit">Aprovar</button>
                  </form>
                ) : (
                  <span className="muted" style={{ fontSize: 14 }}>
                    {aprovado ? `✓ Aprovado — nota final ${ev?.notaFinal ?? ev?.notaIA}/20` : "Sem avaliação"}
                  </span>
                )}
                <form action={reavaliar}>
                  <input type="hidden" name="submissionId" value={s.id} />
                  <button className="btn ghost sm" type="submit">↻ Re-avaliar</button>
                </form>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
