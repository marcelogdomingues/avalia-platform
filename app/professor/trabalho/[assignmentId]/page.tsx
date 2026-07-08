import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { temLLM } from "@/lib/evaluate";
import { calcularStats } from "@/lib/stats";
import { calcularSimilaridades, similaridadeComTexto, analisarIntegridade } from "@/lib/similaridade";
import { diffPalavras } from "@/lib/diff";
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

  // Ressubmissões: para cada submissão, a anterior do mesmo aluno (submissions vêm desc).
  const identidade = (s: (typeof a.submissions)[number]) => s.studentId ?? s.alunoNumero ?? s.alunoNome;
  const anteriorDe = new Map<string, (typeof a.submissions)[number]>();
  const grupos = new Map<string, (typeof a.submissions)[number][]>();
  for (const s of a.submissions) {
    const k = identidade(s);
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(s);
  }
  for (const lista of grupos.values()) {
    for (let i = 0; i < lista.length - 1; i++) anteriorDe.set(lista[i].id, lista[i + 1]); // lista[i+1] é mais antiga
  }

  const subs: Sub[] = a.submissions.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null;
    const sim = sims.get(s.id);
    const ant = anteriorDe.get(s.id);
    let ressubmissao: Sub["ressubmissao"] = null;
    if (ant && s.conteudoExtraido && ant.conteudoExtraido) {
      const d = diffPalavras(ant.conteudoExtraido, s.conteudoExtraido);
      ressubmissao = {
        anteriorData: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(ant.createdAt),
        adicionadas: d.adicionadas,
        removidas: d.removidas,
        segs: d.segs,
      };
    }
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
      respostasDefesa: (s.respostasDefesa as { pergunta: string; resposta: string }[] | null) ?? [],
      defesaAvaliacao: (ev?.defesaAvaliacao as { consistencia: number; veredicto: string; observacoes: string[] } | null) ?? null,
      deteccaoIA: (ev?.deteccaoIA as { probabilidade: number; indicadores: string[] } | null) ?? null,
      testResult: (s.testResult as Sub["testResult"]) ?? null,
      simIA: similaridadeComTexto(s.conteudoExtraido, a.respostaIA),
      simNome: sim?.outroNome ?? null,
      simScore: sim?.score ?? 0,
      modelo: ev?.modelo ?? null,
      ressubmissao,
      recurso: (s.recurso as Sub["recurso"]) ?? null,
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
