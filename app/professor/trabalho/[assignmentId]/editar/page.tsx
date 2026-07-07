import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import EditarTrabalho from "@/components/EditarTrabalho";

export const dynamic = "force-dynamic";

export default async function EditarPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { professorId: prof.id } },
    include: { course: true },
  });
  if (!a) notFound();

  return (
    <>
      <div className="breadcrumb">
        <a href="/professor">Cadeiras</a> <span>/</span>
        <a href={`/professor/cadeira/${a.courseId}`}>{a.course.nome}</a> <span>/</span>
        <a href={`/professor/trabalho/${a.id}`}>{a.titulo}</a> <span>/</span>
        <span>Editar</span>
      </div>
      <h1 className="page-title">Editar trabalho</h1>
      <p className="page-sub">Altera o enunciado, a rubrica ou as opções. Re-avalia depois para aplicar a nova rubrica.</p>

      <div className="card">
        <EditarTrabalho
          assignmentId={a.id}
          titulo={a.titulo}
          enunciado={a.enunciado}
          tipos={a.tiposFicheiro as string[]}
          instrucoes={a.instrucoes ?? ""}
          solucaoModelo={a.solucaoModelo ?? ""}
          feedbackImediato={a.feedbackImediato}
          rubrica={a.rubrica as any}
        />
      </div>
    </>
  );
}
