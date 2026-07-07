import { db } from "@/lib/db";
import { aprovar } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ProfessorPage() {
  const assignments = await db.assignment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      course: true,
      submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <main style={{ maxWidth: 820, margin: "3rem auto", fontFamily: "system-ui", padding: "0 1rem" }}>
      <h1>Painel do professor</h1>
      {assignments.length === 0 && <p>Sem trabalhos. Corre <code>npm run seed</code>.</p>}

      {assignments.map((a) => (
        <section key={a.id} style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: 0 }}>{a.titulo}</h2>
          <p style={{ color: "#666", marginTop: 4 }}>{a.course.nome}</p>
          <p>
            Link de submissão do aluno:{" "}
            <a href={`/submeter/${a.submitToken}`}>/submeter/{a.submitToken}</a>
          </p>

          {a.submissions.length === 0 && <p style={{ color: "#999" }}>Ainda sem submissões.</p>}

          {a.submissions.map((s) => {
            const ev = s.evaluation;
            const criterios = (ev?.porCriterio as any[]) ?? [];
            const aprovado = ev?.estado === "APROVADO";
            return (
              <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginTop: "1rem" }}>
                <strong>{s.alunoNome}</strong>
                {s.alunoNumero ? ` (nº ${s.alunoNumero})` : ""}
                {" — "}
                <span>
                  Nota IA: <b>{ev?.notaIA ?? "—"}/20</b>
                  {aprovado && ev?.notaFinal != null && (
                    <> · Nota final: <b>{ev.notaFinal}/20</b></>
                  )}
                  {" "}
                  <em style={{ color: aprovado ? "green" : "#b26a00" }}>[{ev?.estado}]</em>
                  {" "}<span style={{ color: "#999" }}>({ev?.modelo})</span>
                </span>

                <ul>
                  {criterios.map((c) => (
                    <li key={c.criterioId}>
                      <b>{c.nome}: {c.pontos}/{c.pontosMax}</b> — {c.justificacao}
                    </li>
                  ))}
                </ul>
                {ev?.feedbackGlobal && <p style={{ fontStyle: "italic" }}>{ev.feedbackGlobal}</p>}

                {!aprovado && ev && (
                  <form action={aprovar} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="hidden" name="evaluationId" value={ev.id} />
                    <label>
                      Nota final:{" "}
                      <input name="notaFinal" type="number" step="0.1" min="0" max="20"
                        defaultValue={ev.notaIA ?? undefined} style={{ width: 70 }} />
                    </label>
                    <button type="submit">Aprovar</button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
