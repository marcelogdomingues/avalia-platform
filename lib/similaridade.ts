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
