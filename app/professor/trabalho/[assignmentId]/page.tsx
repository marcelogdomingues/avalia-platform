import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { temLLM } from "@/lib/evaluate";
import { calcularStats } from "@/lib/stats";
import { calcularSimilaridades, similaridadeComTexto, analisarIntegridade } from "@/lib/similaridade";
import ProfessorPortal, { type Sub } from "@/components/ProfessorPortal";

export const dynamic = "force-dynamic";

const iniciais = (nome: string) => nome.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
const round1 = (n: number | null | undefined) => (n != null ? Math.round(n * 10) / 10 : null);

export default async function TrabalhoPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;

  const [a, courses, snippets] = await Promise.all([
    db.assignment.findFirst({
      where: { id: assignmentId, course: { professorId: prof.id } },
      include: { course: true, submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } } },
    }),
    db.course.findMany({ where: { professorId: prof.id }, orderBy: { createdAt: "desc" }, select: { id: true, nome: true } }),
    db.commentSnippet.findMany({ where: { professorId: prof.id }, orderBy: [{ usos: "desc" }, { createdAt: "desc" }], select: { id: true, atalho: true, texto: true, usos: true } }),
  ]);
  if (!a) notFound();

  const stats = calcularStats(a.submissions.map((s) => s.evaluation ?? { estado: "PENDENTE", notaIA: null, notaFinal: null }));
  const infoSubs = a.submissions.map((s) => ({ id: s.id, alunoNome: s.alunoNome, conteudoExtraido: s.conteudoExtraido }));
  const sims = calcularSimilaridades(infoSubs);
  const integridade = analisarIntegridade(infoSubs, a.respostaIA);

  const subs: Sub[] = a.submissions.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null;
    const sim = sims.get(s.id);
    return {
      id: s.id,
      evaluationId: ev?.id ?? null,
      alunoNome: s.alunoNome,
      alunoNumero: s.alunoNumero,
      initials: iniciais(s.alunoNome),
      date: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(s.createdAt),
      estado: ev?.estado ?? "PENDENTE",
      aprovado,
      nota: round1(nota),
      notaIA: round1(ev?.notaIA),
      criterios: ((ev?.porCriterio as { nome: string; pontos: number; pontosMax: number; justificacao: string }[] | null) ?? []).map((c) => ({
        nome: c.nome, pontos: c.pontos, pontosMax: c.pontosMax, justificacao: c.justificacao,
      })),
      feedback: ev?.feedbackGlobal ?? null,
      perguntas: (ev?.perguntasDefesa as string[] | null) ?? [],
      deteccaoIA: (ev?.deteccaoIA as { probabilidade: number; indicadores: string[] } | null) ?? null,
      testResult: (s.testResult as Sub["testResult"]) ?? null,
      simIA: similaridadeComTexto(s.conteudoExtraido, a.respostaIA),
      simNome: sim?.outroNome ?? null,
      simScore: sim?.score ?? 0,
      modelo: ev?.modelo ?? null,
    };
  });

  const rubrica = ((a.rubrica as { nome: string; peso: number; pontosMax: number; descricao: string }[]) ?? []).map((c) => ({
    nome: c.nome, peso: c.peso, pontosMax: c.pontosMax, descricao: c.descricao,
  }));

  return (
    <ProfessorPortal
      prof={{ nome: prof.nome, initials: iniciais(prof.nome) }}
      courses={courses}
      assignment={{
        id: a.id, titulo: a.titulo, courseId: a.courseId, courseNome: a.course.nome,
        submitToken: a.submitToken, temBaseline: !!a.respostaIA, rubrica,
      }}
      subs={subs}
      stats={stats}
      integridade={integridade}
      snippets={snippets}
      temLLM={temLLM}
    />
  );
}
