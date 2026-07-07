// Cria dados de exemplo: professor (com login), cadeira, trabalho e 2 submissões
// já avaliadas. Corre com: npm run seed
//
// Login criado:  prof@exemplo.pt  /  demo1234

import { randomBytes, scryptSync } from "crypto";
import { db } from "../lib/db";
import { processarSubmissao } from "../lib/pipeline";

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

const BOM = `Merge Sort — Relatório
O merge sort é um algoritmo de ordenação por divisão e conquista: divide o array ao meio
recursivamente até subarrays de tamanho 1 e depois combina (merge) de forma ordenada.
Complexidade: altura da recursão log2(n); cada nível percorre n elementos no merge; logo
O(n log n) no pior e no caso médio. Espaço O(n).
Exemplo: [5,2,4,1] → [5,2] e [4,1] → [2,5] e [1,4] → merge → [1,2,4,5].`;

const FRACO = `o merge sort ordena coisas. é rápido. acho que é O(n). divide e junta.`;

async function main() {
  const password = hashPassword("demo1234");
  const professor = await db.professor.upsert({
    where: { email: "prof@exemplo.pt" },
    update: { password },
    create: { email: "prof@exemplo.pt", nome: "Prof. Exemplo", password },
  });

  const course = await db.course.create({
    data: { professorId: professor.id, nome: "Algoritmos e Estruturas de Dados", ano: "2025/2026" },
  });

  const assignment = await db.assignment.create({
    data: {
      courseId: course.id,
      titulo: "Relatório: Ordenação em O(n log n)",
      enunciado:
        "Explica um algoritmo de ordenação O(n log n) (ex: merge sort), com a ideia " +
        "central, a análise de complexidade e um exemplo.",
      tiposFicheiro: ["pdf", "docx", "txt"],
      rubrica: [
        { id: "c1", nome: "Correção técnica", descricao: "Algoritmo e análise de complexidade corretos.", peso: 50, pontosMax: 20 },
        { id: "c2", nome: "Clareza e estrutura", descricao: "Texto claro e organizado.", peso: 30, pontosMax: 20 },
        { id: "c3", nome: "Exemplo", descricao: "Inclui um exemplo concreto.", peso: 20, pontosMax: 20 },
      ],
      instrucoes: "Penaliza afirmações incorretas sobre a complexidade.",
    },
  });

  for (const s of [
    { alunoNome: "Ana Silva", alunoNumero: "20211234", texto: BOM },
    { alunoNome: "Rui Costa", alunoNumero: "20215678", texto: FRACO },
  ]) {
    await processarSubmissao({
      assignmentId: assignment.id,
      alunoNome: s.alunoNome,
      alunoNumero: s.alunoNumero,
      ficheiros: [{ nome: "relatorio.txt", buffer: Buffer.from(s.texto, "utf-8") }],
    });
  }

  console.log("Seed criado. Login: prof@exemplo.pt / demo1234");
  console.log("Cadeira:", course.nome, "| Trabalho:", assignment.titulo);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
