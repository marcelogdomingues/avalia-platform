// Deteção de similaridade entre submissões (indício de plágio/cópia).
// Offline: shingles de palavras (n-gramas) + índice de Jaccard. Sem serviços externos.

function shingles(texto: string, n = 5): Set<string> {
  const palavras = (texto || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + n <= palavras.length; i++) {
    set.add(palavras.slice(i, i + n).join(" "));
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [menor, maior] = a.size < b.size ? [a, b] : [b, a];
  for (const s of menor) if (maior.has(s)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface AlertaSimilaridade {
  outroId: string;
  outroNome: string;
  score: number; // 0..1
}

// Similaridade de uma submissão com um texto de referência (ex: linha-base de IA).
// Score 0..1 por índice de Jaccard sobre shingles de palavras.
export function similaridadeComTexto(conteudo: string | null, referencia: string | null): number {
  if (!conteudo || !referencia) return 0;
  return jaccard(shingles(conteudo), shingles(referencia));
}

// Para cada submissão, o par mais parecido com ela (dentro do mesmo conjunto).
export function calcularSimilaridades(
  subs: { id: string; alunoNome: string; conteudoExtraido: string | null }[],
): Map<string, AlertaSimilaridade | null> {
  const shings = subs.map((s) => ({ ...s, sh: shingles(s.conteudoExtraido ?? "") }));
  const out = new Map<string, AlertaSimilaridade | null>();

  for (let i = 0; i < shings.length; i++) {
    let melhor: AlertaSimilaridade | null = null;
    for (let j = 0; j < shings.length; j++) {
      if (i === j) continue;
      const score = jaccard(shings[i].sh, shings[j].sh);
      if (!melhor || score > melhor.score) {
        melhor = { outroId: shings[j].id, outroNome: shings[j].alunoNome, score };
      }
    }
    // só reporta se houver semelhança relevante
    out.set(shings[i].id, melhor && melhor.score >= 0.15 ? melhor : null);
  }
  return out;
}

// ── Análise de integridade da turma (grafo + clusters) ────────────────────────

export interface SubInfo { id: string; alunoNome: string; conteudoExtraido: string | null }
export interface Par { aId: string; aNome: string; bId: string; bNome: string; score: number }
export interface Cluster { ids: string[]; nomes: string[]; scoreMedio: number; scoreMax: number }
export interface AnaliseIntegridade {
  pares: Par[];              // todos os pares acima do limiar, do mais parecido ao menos
  clusters: Cluster[];       // grupos de 2+ submissões ligadas por semelhança
  proximidadeIA: { id: string; nome: string; score: number }[]; // proximidade à linha-base de IA, desc
  limiar: number;
}

// Calcula todos os pares acima de `limiar`, agrupa em clusters (componentes ligados)
// e ordena a proximidade à resposta-tipo de IA. Base da vista "Integridade".
export function analisarIntegridade(subs: SubInfo[], respostaIA: string | null, limiar = 0.25): AnaliseIntegridade {
  const shings = subs.map((s) => ({ ...s, sh: shingles(s.conteudoExtraido ?? "") }));

  const pares: Par[] = [];
  for (let i = 0; i < shings.length; i++) {
    for (let j = i + 1; j < shings.length; j++) {
      const score = jaccard(shings[i].sh, shings[j].sh);
      if (score >= limiar) {
        pares.push({ aId: shings[i].id, aNome: shings[i].alunoNome, bId: shings[j].id, bNome: shings[j].alunoNome, score });
      }
    }
  }
  pares.sort((x, y) => y.score - x.score);

  // Union-find: componentes ligados pelos pares acima do limiar = clusters de cópia.
  const pai = new Map<string, string>(subs.map((s) => [s.id, s.id]));
  const find = (x: string): string => (pai.get(x) === x ? x : (pai.set(x, find(pai.get(x)!)), pai.get(x)!));
  const une = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) pai.set(ra, rb); };
  for (const p of pares) une(p.aId, p.bId);

  const grupos = new Map<string, string[]>();
  for (const s of subs) { const r = find(s.id); (grupos.get(r) ?? grupos.set(r, []).get(r)!).push(s.id); }
  const nomeDe = new Map(subs.map((s) => [s.id, s.alunoNome]));

  const clusters: Cluster[] = [];
  for (const ids of grupos.values()) {
    if (ids.length < 2) continue;
    const dentro = pares.filter((p) => ids.includes(p.aId) && ids.includes(p.bId));
    const scores = dentro.map((p) => p.score);
    clusters.push({
      ids,
      nomes: ids.map((id) => nomeDe.get(id) ?? "—"),
      scoreMedio: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      scoreMax: scores.length ? Math.max(...scores) : 0,
    });
  }
  clusters.sort((a, b) => b.scoreMax - a.scoreMax);

  const proximidadeIA = subs
    .map((s) => ({ id: s.id, nome: s.alunoNome, score: similaridadeComTexto(s.conteudoExtraido, respostaIA) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return { pares, clusters, proximidadeIA, limiar };
}
