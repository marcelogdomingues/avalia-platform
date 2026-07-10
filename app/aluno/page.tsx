import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { temLLM } from "@/lib/evaluate";
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

  // Avaliação por pares: para cada trabalho com pares ativos, um colega por avaliar.
  const jaAvaliei = new Set(
    (await db.peerReview.findMany({ where: { revisorSubId: { in: subs.map((s) => s.id) } }, select: { alvoSubId: true } })).map((r) => r.alvoSubId),
  );
  const paresPorTrabalho = new Map<string, { id: string; excerto: string }>();
  for (const s of subs) {
    if (!s.assignment.avaliacaoPares) continue;
    const colega = await db.submission.findFirst({
      where: { assignmentId: s.assignmentId, studentId: { not: aluno.id }, id: { notIn: [...jaAvaliei] }, conteudoExtraido: { not: null } },
      orderBy: { createdAt: "asc" },
    });
    if (colega) paresPorTrabalho.set(s.id, { id: colega.id, excerto: (colega.conteudoExtraido ?? "").slice(0, 600) });
  }

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
      defesaPerguntas: (ev?.perguntasDefesa as string[] | null) ?? [],
      defesaRespostas: (s.respostasDefesa as { pergunta: string; resposta: string }[] | null) ?? [],
      escala: (s.assignment.escala ?? "vinte") as any,
      parPorAvaliar: paresPorTrabalho.get(s.id) ?? null,
      recurso: (s.recurso as { pedido: string; estado: "aberto" | "respondido"; resposta?: string } | null) ?? null,
      testResult: (s.testResult as { total: number; passed: number; gateMet: boolean; duracaoMs?: number; tests: { nome: string; ok: boolean; obrigatorio: boolean; ms?: number }[] } | null) ?? null,
    };
  });

  const courses = Array.from(new Set(works.map((w) => w.course)));
  const newCount = works.filter((w) => w.released).length;

  return <StudentPortal works={works} studentName={aluno.nome} courses={courses} newCount={newCount} temLLM={temLLM} />;
}
