// Escalas de notação configuráveis — para qualquer faculdade/país.
// Internamente TUDO é avaliado em 0–20 (a rubrica usa pontosMax=20); a escala
// afeta apenas a APRESENTAÇÃO. Assim a IA/rubrica não muda entre instituições.

export type Escala = "vinte" | "cem" | "letra" | "ects" | "passa";

export const ESCALAS: { v: Escala; l: string; ex: string }[] = [
  { v: "vinte", l: "0–20 (Portugal)", ex: "16,5 / 20" },
  { v: "cem", l: "0–100", ex: "83 / 100" },
  { v: "letra", l: "Letra (A–F)", ex: "B" },
  { v: "ects", l: "ECTS (A–F)", ex: "B" },
  { v: "passa", l: "Aprovado / Reprovado", ex: "Aprovado" },
];

export const APROVACAO_20 = 9.5; // limiar de aprovação em escala 0–20

// Nota interna (0–20) → texto na escala escolhida.
export function notaTexto(n20: number | null | undefined, escala: Escala = "vinte"): string {
  if (n20 == null) return "—";
  switch (escala) {
    case "cem":
      return String(Math.round(n20 * 5));
    case "letra": {
      // A–F ao estilo norte-americano (a partir de 0–20).
      if (n20 >= 16) return "A";
      if (n20 >= 14) return "B";
      if (n20 >= 12) return "C";
      if (n20 >= 10) return "D";
      return "F";
    }
    case "ects": {
      // ECTS: A–E aprovado, F reprovado.
      if (n20 >= 17) return "A";
      if (n20 >= 15) return "B";
      if (n20 >= 13) return "C";
      if (n20 >= 11) return "D";
      if (n20 >= APROVACAO_20) return "E";
      return "F";
    }
    case "passa":
      return n20 >= APROVACAO_20 ? "Aprovado" : "Reprovado";
    case "vinte":
    default:
      return String(Math.round(n20 * 10) / 10).replace(".", ",");
  }
}

// Sufixo a mostrar a seguir ao valor (ex.: "/20", "/100", ou vazio).
export function escalaSufixo(escala: Escala = "vinte"): string {
  return escala === "vinte" ? "/20" : escala === "cem" ? "/100" : "";
}

// Rótulo curto da escala.
export function escalaLabel(escala: Escala = "vinte"): string {
  return ESCALAS.find((e) => e.v === escala)?.l ?? "0–20";
}

// Aprovado? (independente da escala, a partir do 0–20 interno.)
export function aprovado20(n20: number | null | undefined): boolean {
  return n20 != null && n20 >= APROVACAO_20;
}
