// Controlo de acesso a cadeiras com co-docência.
// Uma cadeira é acessível pelo DONO (professorId) ou por um CO-DOCENTE.
// Operações destrutivas/pessoais (apagar/arquivar cadeira, snippets, modelos)
// continuam restritas ao dono — ver as actions respetivas.

// where-clause reutilizável para "cadeiras a que este professor tem acesso".
export function cadeiraAcesso(professorId: string) {
  return { OR: [{ professorId }, { coDocentes: { some: { professorId } } }] };
}

import { db } from "./db";

// Regista uma ação no histórico da cadeira. Best-effort: nunca deve
// derrubar a operação principal, por isso engole erros silenciosamente.
export async function registarAtividade(
  courseId: string | null | undefined,
  actorNome: string,
  acao: string,
  alvo?: string | null,
) {
  if (!courseId) return;
  try {
    await db.activityLog.create({ data: { courseId, actorNome, acao, alvo: alvo ?? null } });
  } catch {
    // histórico é acessório — não interrompe a ação
  }
}
