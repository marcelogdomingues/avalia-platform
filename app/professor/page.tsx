import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { criarCadeira, apagarCadeira, alternarArquivada } from "@/lib/actions";
import ProfShell from "@/components/ProfShell";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const prof = await requireProfessor();

  const assignmentWhere = { course: cadeiraAcesso(prof.id) };
  const [cursos, porAprovar, evals] = await Promise.all([
    db.course.findMany({
      where: cadeiraAcesso(prof.id),
      orderBy: { createdAt: "desc" },
      include: { assignments: { select: { id: true, _count: { select: { submissions: true } } } }, coDocentes: { select: { professorId: true } } },
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

  // "Precisa de atenção": trabalhos com revisões por aprovar ou recursos abertos.
  const trabalhosAtencao = await db.assignment.findMany({
    where: { course: cadeiraAcesso(prof.id) },
    select: {
      id: true, titulo: true, course: { select: { nome: true } },
      submissions: { select: { recurso: true, evaluation: { select: { estado: true } } } },
    },
  });
  const atencao = trabalhosAtencao.map((a) => {
    const porAprovar = a.submissions.filter((s) => s.evaluation?.estado === "RASCUNHO").length;
    const recursos = a.submissions.filter((s) => (s.recurso as { estado?: string } | null)?.estado === "aberto").length;
    return { id: a.id, titulo: a.titulo, cadeira: a.course.nome, porAprovar, recursos };
  }).filter((a) => a.porAprovar > 0 || a.recursos > 0)
    .sort((x, y) => (y.recursos - x.recursos) || (y.porAprovar - x.porAprovar));

  return (
    <ProfShell>
      <h1 className="page-title">Painel</h1>
      <p className="page-sub">Olá, {prof.nome.split(/\s+/)[0]} — aqui está o resumo das tuas cadeiras.</p>

      {atencao.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: "rgba(180,83,9,0.25)" }}>
          <span className="eyebrow" style={{ color: "var(--amber)" }}>Precisa da tua atenção</span>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {atencao.slice(0, 8).map((a) => (
              <a key={a.id} href={`/professor/trabalho/${a.id}`} className="row-between" style={{ color: "inherit", fontSize: 14, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)" }}>
                <span><b>{a.titulo}</b> <span className="faint">· {a.cadeira}</span></span>
                <span style={{ display: "flex", gap: 8 }}>
                  {a.porAprovar > 0 && <span className="badge s-rascunho">{a.porAprovar} por aprovar</span>}
                  {a.recursos > 0 && <span className="badge" style={{ background: "rgba(180,83,9,0.12)", color: "var(--amber)", fontWeight: 600 }}>⚖️ {a.recursos}</span>}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

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

      {cursos.length === 0 ? (
        <div className="card empty-state">
          <div className="big">📚</div>
          <p>Ainda não tens cadeiras. Cria a primeira em baixo.</p>
        </div>
      ) : (
        <>
        <div className="grid cols-2">
          {cursos.filter((c) => !c.arquivada).map((c) => {
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
                  <div style={{ display: "flex", gap: 4 }}>
                    <form action={alternarArquivada}>
                      <input type="hidden" name="courseId" value={c.id} />
                      <button className="btn ghost sm" type="submit" title="Arquivar">🗄</button>
                    </form>
                    <form action={apagarCadeira}>
                      <input type="hidden" name="courseId" value={c.id} />
                      <button className="btn ghost sm" type="submit" title="Apagar">🗑</button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {cursos.some((c) => c.arquivada) && (
          <details className="disclosure card" style={{ marginTop: 20 }}>
            <summary style={{ fontSize: 14 }}>🗄 Cadeiras arquivadas ({cursos.filter((c) => c.arquivada).length})</summary>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {cursos.filter((c) => c.arquivada).map((c) => (
                <div key={c.id} className="row-between" style={{ fontSize: 14 }}>
                  <a href={`/professor/cadeira/${c.id}`} style={{ color: "var(--muted)" }}>{c.nome} <span className="faint">· {c.ano ?? "—"}</span></a>
                  <form action={alternarArquivada}>
                    <input type="hidden" name="courseId" value={c.id} />
                    <button className="btn ghost sm" type="submit" title="Desarquivar">↩ Desarquivar</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
        </>
      )}

      <details className="disclosure card" style={{ marginTop: 28 }} open={cursos.length === 0}>
        <summary style={{ fontSize: 15 }}>＋ Nova cadeira</summary>
        <form action={criarCadeira} style={{ marginTop: 16, maxWidth: 520 }}>
          <div className="field">
            <label>Nome da cadeira</label>
            <input name="nome" placeholder="ex: Algoritmos e Estruturas de Dados" required />
          </div>
          <div className="field">
            <label>Ano letivo <span className="help">(opcional)</span></label>
            <input name="ano" placeholder="2025/2026" />
          </div>
          <button className="btn" type="submit">Criar cadeira</button>
        </form>
      </details>
    </ProfShell>
  );
}
