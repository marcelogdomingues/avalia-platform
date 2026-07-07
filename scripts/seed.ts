// Cria dados de exemplo: um professor, uma cadeira e um trabalho com rubrica.
// Corre com: npm run seed

import { db } from "../lib/db";

async function main() {
  const professor = await db.professor.upsert({
    where: { email: "prof@exemplo.pt" },
    update: {},
    create: { email: "prof@exemplo.pt", nome: "Prof. Exemplo" },
  });

  const course = await db.course.create({
    data: { professorId: professor.id, nome: "Algoritmos e Estruturas de Dados", ano: "2025/2026" },
  });

  const assignment = await db.assignment.create({
    data: {
      courseId: course.id,
      titulo: "Relatório: Ordenação em O(n log n)",
      enunciado:
        "Escreve um relatório curto que explique um algoritmo de ordenação com " +
        "complexidade O(n log n) (ex: merge sort ou heap sort), incluindo a ideia " +
        "central, a análise de complexidade e um exemplo.",
      tiposFicheiro: ["pdf", "docx", "txt"],
      rubrica: [
        { id: "c1", nome: "Correção técnica", descricao: "O algoritmo e a análise de complexidade estão corretos.", peso: 50, pontosMax: 20 },
        { id: "c2", nome: "Clareza e estrutura", descricao: "O texto é claro, organizado e fácil de seguir.", peso: 30, pontosMax: 20 },
        { id: "c3", nome: "Exemplo", descricao: "Inclui um exemplo concreto que ilustra o funcionamento.", peso: 20, pontosMax: 20 },
      ],
      instrucoes: "Penaliza afirmações incorretas sobre a complexidade. Valoriza exemplos concretos.",
    },
  });

  console.log("Seed criado:");
  console.log("  professor:", professor.id, professor.email);
  console.log("  cadeira:  ", course.id, course.nome);
  console.log("  trabalho: ", assignment.id, assignment.titulo);
  console.log("  submitToken (link do aluno):", assignment.submitToken);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
