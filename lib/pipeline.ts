import { db } from "./db";
import { extrairConteudo, type FicheiroSubmissao } from "./extract";
import { avaliarSubmissao, type Criterio } from "./evaluate";

// Orquestra o ciclo completo de uma submissão:
//   ficheiros → extrair conteúdo → gravar Submission → avaliar → gravar Evaluation
// No MVP corre inline; em produção a parte de avaliação deve ir para uma fila.

export async function processarSubmissao(params: {
  assignmentId: string;
  alunoNome: string;
  alunoEmail?: string;
  alunoNumero?: string;
  studentId?: string;
  ficheiros: FicheiroSubmissao[];
}): Promise<{ submissionId: string; evaluationId: string }> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: params.assignmentId },
  });

  const { texto: conteudoExtraido, imagens } = await extrairConteudo(params.ficheiros);

  const submission = await db.submission.create({
    data: {
      assignmentId: assignment.id,
      studentId: params.studentId,
      alunoNome: params.alunoNome,
      alunoEmail: params.alunoEmail,
      alunoNumero: params.alunoNumero,
      ficheiros: params.ficheiros.map((f) => ({
        nome: f.nome,
        mime: f.mime ?? null,
        tamanho: f.buffer.length,
      })),
      conteudoExtraido,
    },
  });

  // Cria a avaliação em PENDENTE e corre o avaliador.
  const evaluation = await db.evaluation.create({
    data: { submissionId: submission.id, estado: "PENDENTE" },
  });

  try {
    const resultado = await avaliarSubmissao({
      enunciado: assignment.enunciado,
      instrucoes: assignment.instrucoes,
      solucaoModelo: assignment.solucaoModelo,
      rubrica: assignment.rubrica as unknown as Criterio[],
      conteudoExtraido,
      imagens,
    });

    await db.evaluation.update({
      where: { id: evaluation.id },
      data: {
        estado: "RASCUNHO", // à espera de validação do professor
        porCriterio: resultado.porCriterio as any,
        perguntasDefesa: resultado.perguntasDefesa as any,
        deteccaoIA: resultado.deteccaoIA as any,
        feedbackGlobal: resultado.feedbackGlobal,
        notaIA: resultado.notaIA,
        modelo: resultado.modelo,
        tokensInput: resultado.tokensInput,
        tokensOutput: resultado.tokensOutput,
        avaliadoEm: new Date(),
      },
    });
  } catch (err) {
    await db.evaluation.update({
      where: { id: evaluation.id },
      data: { estado: "ERRO", feedbackGlobal: `Falha: ${(err as Error).message}` },
    });
    throw err;
  }

  return { submissionId: submission.id, evaluationId: evaluation.id };
}

// Professor aprova (opcionalmente ajustando a nota final).
export async function aprovarAvaliacao(evaluationId: string, notaFinal?: number) {
  const ev = await db.evaluation.findUniqueOrThrow({ where: { id: evaluationId } });
  return db.evaluation.update({
    where: { id: evaluationId },
    data: {
      estado: "APROVADO",
      notaFinal: notaFinal ?? ev.notaIA,
      aprovadoEm: new Date(),
    },
  });
}
