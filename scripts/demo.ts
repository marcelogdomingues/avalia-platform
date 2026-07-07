// Demonstração ponta-a-ponta: pega no trabalho do seed, cria duas submissões de
// exemplo (uma boa, uma fraca), corre o pipeline e imprime as avaliações.
// Corre com: npm run demo   (depois de: npm run db:push && npm run seed)

import { db } from "../lib/db";
import { processarSubmissao } from "../lib/pipeline";
import { temLLM } from "../lib/evaluate";

const TRABALHO_BOM = `Merge Sort — Relatório

O merge sort é um algoritmo de ordenação por divisão e conquista. A ideia central
é dividir recursivamente o array ao meio até termos subarrays de tamanho 1, e depois
combinar (merge) esses subarrays de forma ordenada.

Análise de complexidade: a árvore de recursão tem altura log2(n) porque a cada nível
dividimos o tamanho a metade. Em cada nível, o merge de todos os subarrays percorre no
total n elementos. Logo o custo é O(n) por nível × O(log n) níveis = O(n log n), tanto
no pior como no caso médio. O espaço adicional é O(n) para os arrays temporários.

Exemplo: para [5, 2, 4, 1] dividimos em [5, 2] e [4, 1], ordenamos para [2, 5] e [1, 4],
e fazemos merge comparando as cabeças: 1, 2, 4, 5. Resultado: [1, 2, 4, 5].`;

const TRABALHO_FRACO = `o merge sort ordena coisas. é rápido. acho que é O(n) ou assim.
divide e depois junta. não sei bem a complexidade mas funciona.`;

async function main() {
  console.log(temLLM ? "Modo: LLM real\n" : "Modo: DEMO offline (sem LLM_API_KEY)\n");

  const assignment = await db.assignment.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  console.log(`Trabalho: ${assignment.titulo}\n`);

  const submissoes = [
    { alunoNome: "Ana (trabalho bom)", texto: TRABALHO_BOM },
    { alunoNome: "Rui (trabalho fraco)", texto: TRABALHO_FRACO },
  ];

  for (const s of submissoes) {
    const { evaluationId } = await processarSubmissao({
      assignmentId: assignment.id,
      alunoNome: s.alunoNome,
      ficheiros: [{ nome: "relatorio.txt", buffer: Buffer.from(s.texto, "utf-8") }],
    });

    const ev = await db.evaluation.findUniqueOrThrow({ where: { id: evaluationId } });
    const criterios = ev.porCriterio as any[];

    console.log("═".repeat(70));
    console.log(`Aluno: ${s.alunoNome}`);
    console.log(`Nota IA: ${ev.notaIA}/20   (modelo: ${ev.modelo}, estado: ${ev.estado})`);
    for (const c of criterios) {
      console.log(`  • ${c.nome}: ${c.pontos}/${c.pontosMax}`);
      console.log(`      ${c.justificacao}`);
    }
    console.log(`  Feedback: ${ev.feedbackGlobal}\n`);
  }

  console.log("═".repeat(70));
  console.log("Fluxo completo: submissão → extração → avaliação → gravação. ✅");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
