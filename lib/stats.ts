// Estatísticas de um conjunto de avaliações.

export interface Stats {
  total: number;
  avaliadas: number;
  aprovadas: number;
  porAvaliar: number;
  media: number | null;
  min: number | null;
  max: number | null;
  // distribuição em intervalos de 0–20 (5 baldes de 4 pontos)
  distribuicao: { faixa: string; n: number }[];
}

export function calcularStats(
  evals: { estado: string; notaIA: number | null; notaFinal: number | null }[],
): Stats {
  const total = evals.length;
  const comNota = evals
    .map((e) => e.notaFinal ?? e.notaIA)
    .filter((n): n is number => n != null);
  const aprovadas = evals.filter((e) => e.estado === "APROVADO").length;
  const avaliadas = evals.filter((e) => e.estado === "RASCUNHO" || e.estado === "APROVADO").length;

  const media = comNota.length ? comNota.reduce((a, b) => a + b, 0) / comNota.length : null;

  const baldes = [
    { faixa: "0–4", lo: 0, hi: 4 },
    { faixa: "4–8", lo: 4, hi: 8 },
    { faixa: "8–12", lo: 8, hi: 12 },
    { faixa: "12–16", lo: 12, hi: 16 },
    { faixa: "16–20", lo: 16, hi: 20.01 },
  ];
  const distribuicao = baldes.map((b) => ({
    faixa: b.faixa,
    n: comNota.filter((n) => n >= b.lo && n < b.hi).length,
  }));

  return {
    total,
    avaliadas,
    aprovadas,
    porAvaliar: total - avaliadas,
    media: media != null ? Math.round(media * 100) / 100 : null,
    min: comNota.length ? Math.min(...comNota) : null,
    max: comNota.length ? Math.max(...comNota) : null,
    distribuicao,
  };
}
