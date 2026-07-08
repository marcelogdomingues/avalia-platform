// Diff palavra-a-palavra entre duas versões de um texto (ressubmissões).
// LCS clássico; devolve segmentos {tipo, texto} para render. Sem dependências.

export type SegTipo = "igual" | "add" | "rem";
export interface Seg { tipo: SegTipo; texto: string }
export interface ResumoDiff { segs: Seg[]; adicionadas: number; removidas: number; iguais: number }

function tokens(t: string): string[] {
  // mantém a palavra + o espaço/pontuação que a segue, para reconstruir o texto
  return (t || "").match(/\S+\s*/g) ?? [];
}

// LCS por programação dinâmica (comprimento). Textos de trabalho são curtos o
// suficiente (relatórios), por isso O(n·m) é aceitável.
export function diffPalavras(antes: string, depois: string): ResumoDiff {
  const a = tokens(antes);
  const b = tokens(depois);
  const n = a.length, m = b.length;

  // matriz de LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i].trim() === b[j].trim() && a[i].trim() !== ""
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const segs: Seg[] = [];
  const push = (tipo: SegTipo, texto: string) => {
    const ult = segs[segs.length - 1];
    if (ult && ult.tipo === tipo) ult.texto += texto;
    else segs.push({ tipo, texto });
  };

  let i = 0, j = 0, adicionadas = 0, removidas = 0, iguais = 0;
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim() && a[i].trim() !== "") {
      push("igual", b[j]); iguais++; i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("rem", a[i]); removidas++; i++;
    } else {
      push("add", b[j]); adicionadas++; j++;
    }
  }
  while (i < n) { push("rem", a[i]); removidas++; i++; }
  while (j < m) { push("add", b[j]); adicionadas++; j++; }

  return { segs, adicionadas, removidas, iguais };
}
