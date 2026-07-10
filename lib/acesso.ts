// Controlo de acesso a cadeiras com co-docência.
// Uma cadeira é acessível pelo DONO (professorId) ou por um CO-DOCENTE.
// Operações destrutivas/pessoais (apagar/arquivar cadeira, snippets, modelos)
// continuam restritas ao dono — ver as actions respetivas.

// where-clause reutilizável para "cadeiras a que este professor tem acesso".
export function cadeiraAcesso(professorId: string) {
  return { OR: [{ professorId }, { coDocentes: { some: { professorId } } }] };
}
