import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import CriarTrabalho from "@/components/CriarTrabalho";

export const dynamic = "force-dynamic";

export default async function CadeiraPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const prof = await requireProfessor();
  const { courseId } = await params;
  const course = await db.course.findFirst({
    where: { id: courseId, professorId: prof.id },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          submissions: {
            select: { evaluation: { select: { estado: true, notaIA: true, notaFinal: true } } },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const todasNotas: number[] = [];
  let totalSubs = 0;
  let totalPend = 0;
  const trabalhos = course.assignments.map((a) => {
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
    return { a, subs, pend, media };
  });
  const mediaCurso = todasNotas.length
    ? todasNotas.reduce((x, y) => x + y, 0) / todasNotas.length
    : null;

  const temTrabalhos = course.assignments.length > 0;

  return (
    <>
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
          {trabalhos.map(({ a, subs, pend, media }) => (
            <a
              key={a.id}
              href={`/professor/trabalho/${a.id}`}
              className="card hover tile"
              style={{ color: "inherit" }}
            >
              <div className="row-between" style={{ alignItems: "start" }}>
                <span className="eyebrow">{(a.tiposFicheiro as string[]).join(" · ")}</span>
                {pend > 0 && <span className="badge s-rascunho">{pend} por aprovar</span>}
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
          <CriarTrabalho courseId={course.id} />
        </div>
      </details>
    </>
  );
}
