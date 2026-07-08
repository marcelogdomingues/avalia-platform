import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarCadeira, apagarCadeira } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const prof = await requireProfessor();

  const assignmentWhere = { course: { professorId: prof.id } };
  const [cursos, porAprovar, evals] = await Promise.all([
    db.course.findMany({
      where: { professorId: prof.id },
      orderBy: { createdAt: "desc" },
      include: { assignments: { select: { id: true, _count: { select: { submissions: true } } } } },
    }),
    db.evaluation.count({ where: { estado: "RASCUNHO", submission: { assignment: assignmentWhere } } }),
    db.evaluation.findMany({
      where: { submission: { assignment: assignmentWhere } },
      select: { notaFinal: true, notaIA: true },
    }),
  ]);

  const notas = evals
    .map((e) => e.notaFinal ?? e.notaIA)
    .filter((n): n is number => n != null);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const totalTrabalhos = cursos.reduce((a, c) => a + c.assignments.length, 0);
  const totalSubs = cursos.reduce(
    (a, c) => a + c.assignments.reduce((x, as) => x + as._count.submissions, 0),
    0
  );

  return (
    <>
      <h1 className="page-title">Painel</h1>
      <p className="page-sub">Olá, {prof.nome.split(/\s+/)[0]} — aqui está o resumo das tuas cadeiras.</p>

      {cursos.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <span className="eyebrow">Visão geral</span>
          <div className="statgrid" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="stat-n">{cursos.length}</div>
              <div className="stat-l">Cadeiras</div>
            </div>
            <div className="stat">
              <div className="stat-n">{totalTrabalhos}</div>
              <div className="stat-l">Trabalhos</div>
            </div>
            <div className="stat">
              <div className="stat-n">{totalSubs}</div>
              <div className="stat-l">Submissões</div>
            </div>
            <div className="stat">
              <div className="stat-n" style={porAprovar > 0 ? { color: "var(--amber)" } : undefined}>
                {porAprovar}
              </div>
              <div className="stat-l">Por aprovar</div>
            </div>
            <div className="stat">
              <div className="stat-n">{media != null ? media.toFixed(1) : "—"}</div>
              <div className="stat-l">Média /20</div>
            </div>
          </div>
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 14 }}>
        <span className="section-title">As minhas cadeiras</span>
      </div>

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
          {cursos.map((c) => {
            const subsC = c.assignments.reduce((x, as) => x + as._count.submissions, 0);
            return (
              <div key={c.id} className="card hover tile">
                <div className="row-between">
                  <a href={`/professor/cadeira/${c.id}`} style={{ color: "inherit" }}>
                    <span className="eyebrow">{c.ano ?? "—"}</span>
                    <h3>{c.nome}</h3>
                    <div className="count">
                      {c.assignments.length} trabalho(s) · {subsC} submissão(ões)
                    </div>
                  </a>
                  <form action={apagarCadeira}>
                    <input type="hidden" name="courseId" value={c.id} />
                    <button className="btn ghost sm" type="submit" title="Apagar">🗑</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
