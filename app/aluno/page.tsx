import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function gradeClass(n: number | null | undefined) {
  if (n == null) return "g-mid";
  if (n >= 14) return "g-high";
  if (n >= 9.5) return "g-mid";
  return "g-low";
}

export default async function AlunoDashboard() {
  const aluno = await requireStudent();
  const subs = await db.submission.findMany({
    where: { studentId: aluno.id },
    orderBy: { createdAt: "desc" },
    include: { assignment: { include: { course: true } }, evaluation: true },
  });

  return (
    <>
      <h1 className="page-title">As minhas submissões</h1>
      <p className="page-sub">Estado e notas dos teus trabalhos.</p>

      {subs.length === 0 ? (
        <div className="card empty-state">
          <div className="big">📭</div>
          <p>Ainda não submeteste nada. Usa o link que o teu professor partilhou.</p>
        </div>
      ) : (
        <div className="stack">
          {subs.map((s) => {
            const ev = s.evaluation;
            const aprovado = ev?.estado === "APROVADO";
            const mostrar = aprovado || s.assignment.feedbackImediato;
            const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA : ev?.notaIA;
            const estado = (ev?.estado ?? "PENDENTE").toLowerCase();
            return (
              <a key={s.id} href={`/recibo/${s.id}`} className="card hover" style={{ color: "inherit", display: "block" }}>
                <div className="row-between">
                  <div>
                    <span className="eyebrow">{s.assignment.course.nome}</span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 16 }}>{s.assignment.titulo}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`badge s-${estado}`}>{aprovado ? "APROVADO" : ev?.estado ?? "PENDENTE"}</span>
                    {mostrar && <span className={`grade ${gradeClass(nota)}`}>{nota ?? "—"}<span className="max">/20</span></span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
