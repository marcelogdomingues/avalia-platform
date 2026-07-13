// Deteção de similaridade entre submissões (indício de plágio/cópia).
// Offline: shingles de palavras (n-gramas) + índice de Jaccard. Sem serviços externos.

function palavras(texto: string): string[] {
  return (texto || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(texto: string, n = 5): Set<string> {
  const ps = palavras(texto);
  const set = new Set<string>();
  for (let i = 0; i + n <= ps.length; i++) {
    set.add(ps.slice(i, i + n).join(" "));
  }
  return set;
}

// Frases exatas partilhadas por dois textos (n-gramas comuns fundidos em
// sequências mais longas). Base da vista "comparar lado a lado".
export function frasesComuns(a: string, b: string, n = 5, max = 10): string[] {
  const wa = palavras(a);
  const shB = shingles(b, n);
  const frases: string[] = [];
  let i = 0;
  while (i + n <= wa.length) {
    if (shB.has(wa.slice(i, i + n).join(" "))) {
      let fim = i + n;
      while (fim < wa.length && shB.has(wa.slice(fim - n + 1, fim + 1).join(" "))) fim++;
      frases.push(wa.slice(i, fim).join(" "));
      i = fim;
    } else i++;
  }
  return frases.sort((x, y) => y.length - x.length).slice(0, max);
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

// ── Plágio entre edições: comparação com um arquivo de entregas passadas ──────

export interface AlertaArquivo {
  score: number;      // 0..1
  alunoNome: string;  // autor da entrega arquivada mais parecida
  origem: string;     // ex: "Relatório de Ordenação · 2024/2025"
}

// Para cada submissão atual, a entrega mais parecida no arquivo (outras edições).
// Só reporta acima de `limiar`. O arquivo já vem "shinglado" fora se necessário;
// aqui recalcula-se para manter a API simples (escala POC).
export function compararComArquivo(
  subs: { id: string; conteudoExtraido: string | null }[],
  arquivo: { alunoNome: string; conteudoExtraido: string | null; origem: string }[],
  limiar = 0.2,
): Map<string, AlertaArquivo | null> {
  const arq = arquivo
    .filter((a) => a.conteudoExtraido)
    .map((a) => ({ ...a, sh: shingles(a.conteudoExtraido ?? "") }));
  const out = new Map<string, AlertaArquivo | null>();
  for (const s of subs) {
    if (!s.conteudoExtraido) { out.set(s.id, null); continue; }
    const sh = shingles(s.conteudoExtraido);
    let melhor: AlertaArquivo | null = null;
    for (const a of arq) {
      const score = jaccard(sh, a.sh);
      if (!melhor || score > melhor.score) melhor = { score, alunoNome: a.alunoNome, origem: a.origem };
    }
    out.set(s.id, melhor && melhor.score >= limiar ? melhor : null);
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
