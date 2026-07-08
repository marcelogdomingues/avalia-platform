import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import StudentPortal, { type Work } from "@/components/StudentPortal";

export const dynamic = "force-dynamic";

function qualitativo(n: number): string {
  if (n >= 16) return "Muito Bom";
  if (n >= 14) return "Bom";
  if (n >= 9.5) return "Suficiente";
  return "Insuficiente";
}

export default async function AlunoDashboard() {
  const aluno = await requireStudent();
  const subs = await db.submission.findMany({
    where: { studentId: aluno.id },
    orderBy: { createdAt: "desc" },
    include: {
      assignment: { include: { course: { include: { professor: true } } } },
      evaluation: true,
    },
  });

  const works: Work[] = subs.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const released = aprovado || s.assignment.feedbackImediato;
    const score = released ? (aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null) : null;
    const criterios = (ev?.porCriterio as { nome: string; pontos: number; pontosMax: number }[] | null) ?? [];
    return {
      id: s.id,
      name: s.assignment.titulo,
      course: s.assignment.course.nome,
      date: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(s.createdAt),
      released,
      score: score != null ? Math.round(score * 10) / 10 : null,
      qual: score != null ? qualitativo(score) : "",
      statusLabel: released ? "Publicado" : "A aguardar",
      statusColor: released ? "#0f766e" : "#b45309",
      bars: released ? criterios.map((c) => ({ label: c.nome, v: c.pontos, max: c.pontosMax })) : [],
      feedback: released ? ev?.feedbackGlobal ?? null : null,
      approvedBy: aprovado ? s.assignment.course.professor?.nome ?? null : null,
    };
  });

  const courses = Array.from(new Set(works.map((w) => w.course)));
  const newCount = works.filter((w) => w.released).length;

  return <StudentPortal works={works} studentName={aluno.nome} courses={courses} newCount={newCount} />;
}
