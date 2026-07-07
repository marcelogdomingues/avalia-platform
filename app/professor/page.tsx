import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarCadeira, apagarCadeira } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const prof = await requireProfessor();
  const cursos = await db.course.findMany({
    where: { professorId: prof.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <>
      <h1 className="page-title">As minhas cadeiras</h1>
      <p className="page-sub">Organiza os teus trabalhos por cadeira.</p>

      <div className="card" style={{ marginBottom: 28 }}>
        <span className="eyebrow">Criar cadeira</span>
        <form action={criarCadeira} style={{ marginTop: 12 }}>
          <div className="row-between" style={{ alignItems: "end", gap: 12 }}>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label>Nome da cadeira</label>
              <input name="nome" placeholder="ex: Algoritmos e Estruturas de Dados" required />
            </div>
            <div className="field" style={{ width: 140, margin: 0 }}>
              <label>Ano letivo</label>
              <input name="ano" placeholder="2025/2026" />
            </div>
            <button className="btn" type="submit">Criar</button>
          </div>
        </form>
      </div>

      {cursos.length === 0 ? (
        <div className="card empty-state">
          <div className="big">📚</div>
          <p>Ainda não tens cadeiras. Cria a primeira acima.</p>
        </div>
      ) : (
        <div className="grid cols-2">
          {cursos.map((c) => (
            <div key={c.id} className="card hover tile">
              <div className="row-between">
                <a href={`/professor/cadeira/${c.id}`} style={{ color: "inherit" }}>
                  <span className="eyebrow">{c.ano ?? "—"}</span>
                  <h3>{c.nome}</h3>
                  <div className="count">{c._count.assignments} trabalho(s)</div>
                </a>
                <form action={apagarCadeira}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <button className="btn ghost sm" type="submit" title="Apagar">🗑</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
