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
        include: { _count: { select: { submissions: true } } },
      },
    },
  });
  if (!course) notFound();

  return (
    <>
      <div className="breadcrumb">
        <a href="/professor">Cadeiras</a> <span>/</span> <span>{course.nome}</span>
      </div>
      <h1 className="page-title">{course.nome}</h1>
      <p className="page-sub">{course.ano ?? "Sem ano definido"}</p>

      <div className="stack">
        <h2 className="section-title">Trabalhos</h2>
        {course.assignments.length === 0 ? (
          <div className="card empty-state">
            <div className="big">📝</div>
            <p>Ainda não há trabalhos nesta cadeira. Cria o primeiro em baixo.</p>
          </div>
        ) : (
          <div className="grid cols-2">
            {course.assignments.map((a) => (
              <a key={a.id} href={`/professor/trabalho/${a.id}`} className="card hover tile" style={{ color: "inherit" }}>
                <span className="eyebrow">{(a.tiposFicheiro as string[]).join(" · ")}</span>
                <h3>{a.titulo}</h3>
                <div className="count">{a._count.submissions} submissão(ões)</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <span className="eyebrow">Novo trabalho</span>
        <h2 className="section-title" style={{ margin: "6px 0 18px" }}>Definir trabalho e rubrica</h2>
        <CriarTrabalho courseId={course.id} />
      </div>
    </>
  );
}
