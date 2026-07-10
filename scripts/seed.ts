// Seed rico: 1 professor, 5 cadeiras, vários trabalhos, 6 alunos e submissões
// que cobrem todos os cenários (nota alta/baixa, plágio, alta deteção de IA,
// pendente, aprovado). As avaliações são semeadas diretamente (sem chamar o
// LLM), para ser rápido, determinístico e demonstrar todos os sinais.
//
// Logins (todos: demo1234):
//   Professor: prof@exemplo.pt
//   Alunos:    aluno@exemplo.pt (Ana) + outros abaixo

import { randomBytes, scryptSync } from "crypto";
import { db } from "../lib/db";
import { runTests, avaliarGate, runnerAtivo } from "../lib/runner";
import { avaliarSubmissao, temLLM } from "../lib/evaluate";

function hash(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

type Crit = { id: string; nome: string; descricao: string; peso: number; pontosMax: number };

function mkEval(
  rubrica: Crit[],
  fracs: number[],
  o: {
    estado?: "RASCUNHO" | "APROVADO" | "PENDENTE" | "ERRO";
    fb: string;
    perguntas?: string[];
    det?: { probabilidade: number; indicadores: string[] } | null;
    notaFinal?: number;
    just?: string[];
  }
) {
  const porCriterio = rubrica.map((c, i) => ({
    criterioId: c.id,
    nome: c.nome,
    pontos: Math.round(c.pontosMax * fracs[i] * 10) / 10,
    pontosMax: c.pontosMax,
    justificacao: o.just?.[i] ?? "Avaliação por critério segundo a rubrica.",
  }));
  const pesoTot = rubrica.reduce((s, c) => s + c.peso, 0) || 1;
  const notaIA =
    Math.round(
      porCriterio.reduce((s, nc) => {
        const cr = rubrica.find((c) => c.id === nc.criterioId)!;
        return s + (nc.pontos / nc.pontosMax) * 20 * (cr.peso / pesoTot);
      }, 0) * 100
    ) / 100;
  const estado = o.estado ?? "RASCUNHO";
  return {
    estado,
    porCriterio: porCriterio as unknown as object,
    perguntasDefesa: (o.perguntas ?? []) as unknown as object,
    deteccaoIA: (o.det ?? null) as unknown as object,
    feedbackGlobal: o.fb,
    notaIA,
    notaFinal: estado === "APROVADO" ? o.notaFinal ?? notaIA : null,
    modelo: "llama-3.3-70b-versatile",
    avaliadoEm: new Date(),
    aprovadoEm: estado === "APROVADO" ? new Date() : null,
    revisorNome: estado === "APROVADO" ? "Prof. Marcelo Domingues" : null,
  };
}

const RUB_ENSAIO: Crit[] = [
  { id: "c1", nome: "Tese e argumento", descricao: "Ideia central clara e defendida.", peso: 40, pontosMax: 20 },
  { id: "c2", nome: "Evidência e fontes", descricao: "Suporte relevante e bem integrado.", peso: 35, pontosMax: 20 },
  { id: "c3", nome: "Estrutura e clareza", descricao: "Organização lógica e prosa legível.", peso: 25, pontosMax: 20 },
];

async function main() {
  const password = hash("demo1234");

  // reset (mantém o professor; recria tudo o resto de forma rica)
  await db.course.deleteMany({});
  await db.student.deleteMany({});

  const professor = await db.professor.upsert({
    where: { email: "prof@exemplo.pt" },
    update: { password, nome: "Prof. Elena Ramos" },
    create: { email: "prof@exemplo.pt", nome: "Prof. Elena Ramos", password },
  });

  // ── Alunos ──────────────────────────────────────────────
  const alunosDef = [
    { email: "aluno@exemplo.pt", nome: "Ana Silva", numero: "20211234" },
    { email: "rui@exemplo.pt", nome: "Rui Costa", numero: "20215678" },
    { email: "beatriz@exemplo.pt", nome: "Beatriz Nunes", numero: "20219012" },
    { email: "carlos@exemplo.pt", nome: "Carlos Mendes", numero: "20213456" },
    { email: "diana@exemplo.pt", nome: "Diana Faria", numero: "20217890" },
    { email: "eduardo@exemplo.pt", nome: "Eduardo Pinto", numero: "20211122" },
  ];
  const alunos: Record<string, { id: string; nome: string; numero: string }> = {};
  for (const a of alunosDef) {
    const s = await db.student.create({ data: { email: a.email, nome: a.nome, numero: a.numero, password } });
    alunos[a.nome] = { id: s.id, nome: a.nome, numero: a.numero };
  }

  async function submeter(
    assignmentId: string,
    nome: string,
    texto: string,
    ev?: ReturnType<typeof mkEval>,
    testResult?: object,
    quando?: Date,
    respostasDefesa?: string[]
  ) {
    const al = alunos[nome];
    const perguntas = (ev?.perguntasDefesa as string[] | undefined) ?? [];
    const qa = respostasDefesa && perguntas.length
      ? perguntas.map((pergunta, i) => ({ pergunta, resposta: respostasDefesa[i] ?? "" }))
      : undefined;
    const sub = await db.submission.create({
      data: {
        assignmentId,
        studentId: al?.id,
        alunoNome: nome,
        alunoNumero: al?.numero,
        ficheiros: [{ nome: "trabalho.txt", mime: "text/plain", tamanho: texto.length }] as unknown as object,
        conteudoExtraido: texto,
        testResult: testResult as object | undefined,
        respostasDefesa: qa as object | undefined,
        ...(quando ? { createdAt: quando } : {}),
      },
    });
    await db.evaluation.create({
      data: ev ? { submissionId: sub.id, ...ev } : { submissionId: sub.id, estado: "PENDENTE" },
    });
    return sub;
  }

  // Submissão de CÓDIGO com autograder + IA REAIS: corre os testes do professor
  // contra o código do aluno e, se passar o gate, corre a avaliação LLM.
  // Reflete o app: gate não cumprido = submissão bloqueada (não é criada).
  type SuiteInfo = { lang: "python" | "java"; testFiles: { path: string; content: string }[]; obrigatorios: "todos" | string[] };
  async function submeterCodigo(
    assignment: { id: string; enunciado: string; instrucoes: string | null; solucaoModelo: string | null; rubrica: unknown; testSuite: unknown },
    nome: string, codigo: string, filename: string,
  ) {
    const al = alunos[nome];
    const suite = assignment.testSuite as SuiteInfo;
    const run = await runTests(suite.lang, [{ path: filename, content: codigo }], suite.testFiles);
    const gate = avaliarGate(run, suite.obrigatorios);
    if (!gate.gateMet) {
      console.log(`    ⛔ ${nome}: bloqueado — ${gate.obrigatoriosPassed}/${gate.obrigatoriosTotal} obrigatórios${run.erro ? ` (${run.erro.slice(0, 60)})` : ""}`);
      return; // no app, a submissão nem seria criada
    }
    const sub = await db.submission.create({
      data: {
        assignmentId: assignment.id, studentId: al?.id, alunoNome: nome, alunoNumero: al?.numero,
        ficheiros: [{ nome: filename, mime: "text/plain", tamanho: codigo.length }] as unknown as object,
        conteudoExtraido: codigo,
        testResult: gate as unknown as object,
      },
    });
    let evData: Record<string, unknown> = { submissionId: sub.id, estado: "PENDENTE" };
    if (temLLM) {
      try {
        const res = await avaliarSubmissao({
          enunciado: assignment.enunciado, instrucoes: assignment.instrucoes, solucaoModelo: assignment.solucaoModelo,
          rubrica: assignment.rubrica as Crit[], conteudoExtraido: codigo,
        });
        evData = {
          submissionId: sub.id, estado: "RASCUNHO",
          porCriterio: res.porCriterio as unknown as object,
          perguntasDefesa: res.perguntasDefesa as unknown as object,
          deteccaoIA: res.deteccaoIA as unknown as object,
          feedbackGlobal: res.feedbackGlobal, notaIA: res.notaIA, modelo: res.modelo,
          tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, avaliadoEm: new Date(),
        };
      } catch (e) {
        console.log(`    ! IA falhou para ${nome}: ${String((e as Error).message).slice(0, 60)}`);
      }
    }
    await db.evaluation.create({ data: evData as never });
    const passRate = `${gate.passed}/${gate.total} testes`;
    const tempo = gate.duracaoMs != null ? ` · ${(gate.duracaoMs / 1000).toFixed(1)}s` : "";
    console.log(`    ✓ ${nome}: ${passRate}${tempo}${temLLM && evData.notaIA != null ? ` · IA ${evData.notaIA}/20` : ""}${(evData.deteccaoIA as { probabilidade?: number })?.probabilidade != null ? ` · IA-uso ${(evData.deteccaoIA as { probabilidade: number }).probabilidade}%` : ""}`);
    return sub;
  }

  // ── Cadeira 1: AED (a vitrine, com todos os cenários) ────
  const aed = await db.course.create({ data: { professorId: professor.id, nome: "Algoritmos e Estruturas de Dados", ano: "2025/2026" } });

  const rubMerge: Crit[] = [
    { id: "c1", nome: "Correção técnica", descricao: "Algoritmo e análise de complexidade corretos.", peso: 50, pontosMax: 20 },
    { id: "c2", nome: "Clareza e estrutura", descricao: "Texto claro e organizado.", peso: 30, pontosMax: 20 },
    { id: "c3", nome: "Exemplo", descricao: "Inclui um exemplo concreto e correto.", peso: 20, pontosMax: 20 },
  ];
  const respostaIA_merge =
    "O merge sort é um algoritmo de ordenação eficiente baseado no paradigma de divisão e conquista. " +
    "O algoritmo divide recursivamente a lista em duas metades até obter sublistas de um único elemento, " +
    "e em seguida combina essas sublistas de forma ordenada através da operação de merge. A complexidade " +
    "temporal é O(n log n) tanto no melhor caso como no pior caso, uma vez que a árvore de recursão tem " +
    "altura logarítmica e cada nível processa todos os n elementos. A complexidade espacial é O(n) devido " +
    "aos arrays auxiliares utilizados durante a combinação. Trata-se de um algoritmo estável e previsível.";

  const merge = await db.assignment.create({
    data: {
      courseId: aed.id,
      titulo: "Relatório: Ordenação em O(n log n)",
      enunciado: "Explica um algoritmo de ordenação O(n log n) (ex: merge sort), com a ideia central, a análise de complexidade e um exemplo.",
      tiposFicheiro: ["pdf", "docx", "txt"],
      rubrica: rubMerge as unknown as object,
      instrucoes: "Penaliza afirmações incorretas sobre a complexidade.",
      respostaIA: respostaIA_merge,
    },
  });

  // texto base para o par de plágio
  const plagBase =
    "O merge sort divide a lista ao meio repetidamente até chegar a elementos isolados. " +
    "Depois junta os pedaços por ordem, comparando elemento a elemento. A complexidade é O(n log n) " +
    "porque a divisão dá log n níveis e cada nível faz n comparações no total. Usa memória extra O(n).";

  await submeter(
    merge.id,
    "Ana Silva",
    "Merge Sort — Relatório. O merge sort é um algoritmo de ordenação por divisão e conquista: divide o array ao meio recursivamente até subarrays de tamanho 1 e depois combina (merge) de forma ordenada. Complexidade: a altura da recursão é log2(n) e cada nível percorre n elementos no merge, logo O(n log n) no pior e no caso médio; espaço O(n). Exemplo: [5,2,4,1] divide em [5,2] e [4,1], que ordenam para [2,5] e [1,4], e o merge final dá [1,2,4,5]. Reparei que a estabilidade importa quando há chaves repetidas.",
    mkEval(rubMerge, [0.95, 0.9, 0.95], {
      estado: "APROVADO",
      fb: "Excelente relatório, tecnicamente correto e com um exemplo bem escolhido. A nota da estabilidade mostra compreensão real. Muito bom.",
      perguntas: ["Porque é que a altura da recursão é log₂(n)?", "O que muda no caso de listas já ordenadas?"],
      det: { probabilidade: 12, indicadores: ["Voz pessoal presente ('reparei que...')", "Exemplo concreto próprio"] },
      just: ["Algoritmo e complexidade corretos.", "Bem organizado.", "Exemplo correto e ilustrativo."],
    })
  );

  await submeter(
    merge.id,
    "Rui Costa",
    "o merge sort ordena coisas. é rápido. acho que é O(n). divide e junta as partes.",
    mkEval(rubMerge, [0.1, 0.15, 0.0], {
      estado: "RASCUNHO",
      fb: "O trabalho é demasiado curto e contém um erro grave: o merge sort é O(n log n), não O(n). Falta a análise e um exemplo.",
      perguntas: ["Porque é que dizes que é O(n)? Qual é a complexidade correta e porquê?", "Como dividirias [5,2,4,1] passo a passo?"],
      det: { probabilidade: 8, indicadores: ["Frases curtas e informais", "Erros conceptuais típicos de escrita humana apressada"] },
    })
  );
  // Rui pede revisão da nota (recurso aberto — demo do fluxo aluno→professor)
  {
    const rui = alunos["Rui Costa"];
    const sub = await db.submission.findFirst({ where: { assignmentId: merge.id, studentId: rui?.id }, orderBy: { createdAt: "desc" } });
    if (sub) await db.submission.update({
      where: { id: sub.id },
      data: { recurso: { pedido: "Acho que a minha nota está baixa demais. Eu percebi a ideia do merge sort, só não tive tempo de escrever tudo. Podia rever, por favor?", criadoEm: new Date().toISOString(), estado: "aberto" } as object },
    });
  }

  // submissão claramente "gerada por IA": texto ≈ respostaIA + alta deteção
  await submeter(
    merge.id,
    "Carlos Mendes",
    respostaIA_merge + " Em suma, o merge sort é uma escolha robusta para ordenação de grandes conjuntos de dados.",
    mkEval(rubMerge, [0.85, 0.9, 0.4], {
      estado: "RASCUNHO",
      fb: "Tecnicamente correto e bem escrito, mas o texto é genérico e não apresenta exemplo próprio nem posição pessoal.",
      perguntas: ["Dá um exemplo teu, passo a passo, de merge sort numa lista de 4 elementos.", "Onde é que este algoritmo seria uma má escolha, e porquê?"],
      det: { probabilidade: 88, indicadores: ["Fraseado genérico e uniforme", "Ausência total de voz pessoal ou exemplo próprio", "Estrutura de resposta típica de IA", "Sem hesitações ou erros humanos"] },
      just: ["Correto mas sem originalidade.", "Muito bem escrito (uniforme demais).", "Sem exemplo concreto próprio."],
    }),
    undefined, undefined,
    // Respostas evasivas/genéricas — não demonstram domínio (mau sinal na defesa)
    ["Basicamente divide a lista e depois junta tudo ordenado, como está no meu relatório.", "Em geral é sempre uma boa escolha para ordenar dados."],
  );

  // par de plágio: Diana e Eduardo com texto quase idêntico
  await submeter(
    merge.id,
    "Diana Faria",
    plagBase + " Concluindo, é um método fiável.",
    mkEval(rubMerge, [0.7, 0.65, 0.5], {
      estado: "RASCUNHO",
      fb: "Explicação correta na sua essência. Aprofunda a operação de merge e melhora o exemplo.",
      perguntas: ["Explica por palavras tuas o passo de merge.", "Quantas comparações faz o merge de duas listas de tamanho n/2?"],
      det: { probabilidade: 35, indicadores: ["Fraseado moderadamente genérico"] },
    }),
    undefined, undefined,
    // Respostas específicas e corretas — demonstram domínio (bom sinal na defesa)
    ["Comparo o primeiro elemento de cada metade e coloco o menor no resultado, avançando nessa metade; repito até esvaziar as duas.", "No pior caso n-1 comparações, porque cada comparação coloca pelo menos um elemento e o último entra sem comparar."],
  );
  await submeter(
    merge.id,
    "Eduardo Pinto",
    plagBase + " Em conclusão, é um algoritmo fiável e usado na prática.",
    mkEval(rubMerge, [0.7, 0.6, 0.5], {
      estado: "RASCUNHO",
      fb: "Muito semelhante a outra submissão da turma — confirma a autoria. Conteúdo correto mas pouco desenvolvido.",
      perguntas: ["Explica o passo de merge sem consultar nada.", "Que memória extra usa e porquê?"],
      det: { probabilidade: 38, indicadores: ["Fraseado moderadamente genérico"] },
    })
  );

  // Beatriz: ressubmissão — 1ª tentativa fraca, depois versão melhorada (mostra o diff)
  await submeter(
    merge.id, "Beatriz Nunes",
    "O merge sort ordena uma lista dividindo-a e depois juntando as partes. A complexidade é boa. Não pus exemplo.",
    mkEval(rubMerge, [0.5, 0.5, 0.2], { estado: "RASCUNHO", fb: "Ideia geral certa, mas falta a análise de complexidade e um exemplo concreto.", perguntas: ["Porque é que a complexidade é O(n log n)?"] }),
    undefined,
    new Date("2026-07-06T10:00:00"),
  );
  await submeter(
    merge.id, "Beatriz Nunes",
    "O merge sort ordena uma lista dividindo-a recursivamente ao meio até sublistas de um elemento e depois juntando as partes por ordem. A complexidade é O(n log n) porque a recursão tem log n níveis e cada nível processa n elementos. Exemplo: para [5,2,4,1] divide em [5,2] e [4,1], ordena cada par e faz merge para [1,2,4,5].",
    undefined, undefined,
    new Date("2026-07-08T09:00:00"),
  );

  // segundo trabalho de AED
  const rubComplex: Crit[] = [
    { id: "c1", nome: "Rigor da análise", descricao: "Notação assintótica e casos corretos.", peso: 60, pontosMax: 20 },
    { id: "c2", nome: "Comparação", descricao: "Compara algoritmos de forma justa.", peso: 40, pontosMax: 20 },
  ];
  const complex = await db.assignment.create({
    data: {
      courseId: aed.id,
      titulo: "Análise de complexidade: comparação de algoritmos de pesquisa",
      enunciado: "Compara pesquisa linear e binária: complexidade, pré-condições e quando usar cada uma.",
      tiposFicheiro: ["pdf", "docx", "txt"],
      rubrica: rubComplex as unknown as object,
      feedbackImediato: true,
    },
  });
  await submeter(complex.id, "Ana Silva", "Pesquisa linear é O(n) e não exige ordenação; binária é O(log n) mas exige lista ordenada. Uso binária em dados estáticos ordenados; linear em listas pequenas ou não ordenadas. Fiz um teste com 1000 elementos e a binária ganhou claramente.", mkEval(rubComplex, [0.9, 0.85], { estado: "APROVADO", fb: "Análise correta e com um teste próprio. Bom.", perguntas: ["Qual o custo de manter a lista ordenada para poderes usar binária?"], det: { probabilidade: 15, indicadores: ["Teste próprio mencionado"] } }));
  await submeter(complex.id, "Rui Costa", "binaria é sempre melhor que linear porque é mais rápida.", mkEval(rubComplex, [0.2, 0.15], { estado: "RASCUNHO", fb: "Afirmação incorreta: a binária exige lista ordenada. Falta rigor e comparação justa.", perguntas: ["Quando é que a pesquisa linear é preferível à binária?"], det: { probabilidade: 10, indicadores: ["Generalização incorreta"] } }));

  // ── Cadeira 2: Bases de Dados ───────────────────────────
  const bd = await db.course.create({ data: { professorId: professor.id, nome: "Bases de Dados", ano: "2025/2026" } });
  const rubER: Crit[] = [
    { id: "c1", nome: "Modelação", descricao: "Entidades, relações e cardinalidades corretas.", peso: 50, pontosMax: 20 },
    { id: "c2", nome: "Normalização", descricao: "Sem redundância; chaves bem definidas.", peso: 30, pontosMax: 20 },
    { id: "c3", nome: "Clareza do diagrama", descricao: "Diagrama legível e bem legendado.", peso: 20, pontosMax: 20 },
  ];
  const er = await db.assignment.create({
    data: {
      courseId: bd.id,
      titulo: "Modelo ER de uma biblioteca",
      enunciado: "Desenha o modelo entidade-relação de uma biblioteca (livros, exemplares, sócios, empréstimos). Justifica cardinalidades e chaves.",
      tiposFicheiro: ["pdf", "png", "jpg"],
      rubrica: rubER as unknown as object,
    },
  });
  await submeter(er.id, "Beatriz Nunes", "Entidades: Livro (ISBN), Exemplar (código), Socio (nº), Emprestimo. Um Livro tem N Exemplares (1:N). Um Socio faz N Emprestimos, cada Emprestimo é de 1 Exemplar. Separei Livro de Exemplar para não repetir dados do livro em cada cópia — evita redundância.", mkEval(rubER, [0.9, 0.9, 0.8], { estado: "APROVADO", fb: "Excelente separação Livro/Exemplar e justificação da normalização. Muito bom.", perguntas: ["Que atributo chave usas no Emprestimo?"], det: { probabilidade: 18, indicadores: ["Justificação de decisão de modelação própria"] } }));
  await submeter(er.id, "Diana Faria", "Fiz o diagrama com as entidades pedidas e as relações entre elas, com as cardinalidades indicadas no diagrama em anexo.", mkEval(rubER, [0.6, 0.55, 0.7], { estado: "RASCUNHO", fb: "Diagrama razoável mas a resposta escrita é vaga. Justifica as cardinalidades por palavras tuas.", perguntas: ["Porque é que a relação Socio-Emprestimo é 1:N e não N:M?"], det: { probabilidade: 45, indicadores: ["Descrição vaga e genérica", "Sem justificação específica"] } }));
  await submeter(er.id, "Carlos Mendes", "Modelo ER da biblioteca com Livro, Exemplar, Socio e Emprestimo, relacionados de forma a garantir a integridade referencial e a normalização adequada dos dados.", mkEval(rubER, [0.7, 0.7, 0.6], { estado: "RASCUNHO", fb: "Correto mas genérico. Mostra o diagrama e explica escolhas concretas.", perguntas: ["Dá um exemplo de dado que ficaria redundante se juntasses Livro e Exemplar."], det: { probabilidade: 70, indicadores: ["Fraseado genérico ('garantir a integridade...')", "Sem especificidade própria"] } }));

  // ── Cadeira 3: Programação Orientada a Objetos ──────────
  const poo = await db.course.create({ data: { professorId: professor.id, nome: "Programação Orientada a Objetos", ano: "2025/2026" } });
  const rubPoo: Crit[] = [
    { id: "c1", nome: "Design OO", descricao: "Encapsulamento, herança e polimorfismo bem aplicados.", peso: 45, pontosMax: 20 },
    { id: "c2", nome: "Correção", descricao: "O código compila e resolve o problema.", peso: 35, pontosMax: 20 },
    { id: "c3", nome: "Qualidade", descricao: "Legibilidade, nomes e organização.", peso: 20, pontosMax: 20 },
  ];
  const pooA = await db.assignment.create({
    data: {
      courseId: poo.id,
      titulo: "Sistema de gestão de biblioteca (Java)",
      enunciado: "Implementa em Java um pequeno sistema de biblioteca com classes Livro, Socio e Emprestimo. Usa encapsulamento e pelo menos uma relação de herança justificada.",
      tiposFicheiro: ["zip", "pdf"],
      rubrica: rubPoo as unknown as object,
      instrucoes: "Valoriza justificação das escolhas de design.",
    },
  });
  await submeter(pooA.id, "Ana Silva", "Criei classes Livro, Socio e Emprestimo com atributos privados e getters/setters. Fiz Socio abstrato com subclasses SocioEstudante e SocioProfessor porque os limites de empréstimo diferem — usei polimorfismo no método limiteEmprestimos(). O código está no zip.", mkEval(rubPoo, [0.9, 0.85, 0.8], { estado: "RASCUNHO", fb: "Muito boa justificação da herança (limites diferentes). Design sólido.", perguntas: ["Porque escolheste tornar Socio abstrato em vez de usar um enum de tipo?"], det: { probabilidade: 14, indicadores: ["Decisão de design justificada pessoalmente"] } }));
  await submeter(pooA.id, "Eduardo Pinto", "Fiz as três classes pedidas com encapsulamento e uma herança. O código funciona e está organizado.", mkEval(rubPoo, [0.55, 0.7, 0.6], { estado: "RASCUNHO", fb: "Funciona, mas a resposta não explica as escolhas de design. Justifica a herança.", perguntas: ["Que relação de herança usaste e porquê?"], det: { probabilidade: 40, indicadores: ["Descrição vaga sem detalhes específicos"] } }));

  // Trabalho com AUTOGRADER (Python) — testes automáticos que gateiam a submissão
  const pyTests = `from solution import soma, media

def test_soma_positivos(): assert soma(2, 3) == 5
def test_soma_negativos(): assert soma(-2, -3) == -5
def test_soma_zero(): assert soma(0, 7) == 7
def test_media_basica(): assert media([2, 4, 6]) == 4
def test_media_vazia():
    import pytest
    with pytest.raises(ValueError):
        media([])
`;
  const rubPy: Crit[] = [
    { id: "c1", nome: "Testes automáticos", descricao: "Passa nos testes do professor.", peso: 60, pontosMax: 20 },
    { id: "c2", nome: "Qualidade do código", descricao: "Legibilidade, nomes e simplicidade.", peso: 40, pontosMax: 20 },
  ];
  const pyA = await db.assignment.create({
    data: {
      courseId: poo.id,
      titulo: "Funções: soma e média (Python, com testes)",
      enunciado: "Cria solution.py com soma(a, b) e media(lista) — média dos elementos; levanta ValueError se a lista for vazia. Ao submeter, os testes automáticos correm contra o teu código: tens de passar todos os obrigatórios para submeter.",
      tiposFicheiro: ["zip", "py"],
      rubrica: rubPy as unknown as object,
      testSuite: {
        lang: "python",
        testFiles: [{ path: "test_funcoes.py", content: pyTests }],
        obrigatorios: ["test_soma_positivos", "test_soma_negativos", "test_soma_zero", "test_media_basica"],
      } as unknown as object,
    },
  });
  const mk = (ok5: boolean) => ({
    total: 5, passed: ok5 ? 5 : 4, obrigatoriosTotal: 4, obrigatoriosPassed: 4, gateMet: true,
    tests: [
      { nome: "test_soma_positivos", ok: true, obrigatorio: true },
      { nome: "test_soma_negativos", ok: true, obrigatorio: true },
      { nome: "test_soma_zero", ok: true, obrigatorio: true },
      { nome: "test_media_basica", ok: true, obrigatorio: true },
      { nome: "test_media_vazia", ok: ok5, obrigatorio: false },
    ],
  });
  await submeter(pyA.id, "Ana Silva", "def soma(a,b): return a+b\ndef media(l):\n  if not l: raise ValueError('vazia')\n  return sum(l)/len(l)",
    mkEval(rubPy, [1.0, 0.9], { estado: "APROVADO", fb: "Passou todos os testes (5/5) e o código está limpo. Excelente.", perguntas: ["Porque levantas ValueError em vez de devolver 0?"], det: { probabilidade: 12, indicadores: ["Tratamento de erro pensado"] } }),
    mk(true));
  await submeter(pyA.id, "Rui Costa", "def soma(a,b): return a+b\ndef media(l): return sum(l)/len(l)",
    mkEval(rubPy, [0.8, 0.7], { estado: "RASCUNHO", fb: "Passou os 4 obrigatórios mas falha o teste (opcional) da lista vazia — não tratas o erro. Corrige para robustez.", perguntas: ["O que acontece se chamares media([])?"], det: { probabilidade: 15, indicadores: ["Falta tratamento de caso limite"] } }),
    mk(false));

  // ── Cadeira 4: Inteligência Artificial ──────────────────
  const ia = await db.course.create({ data: { professorId: professor.id, nome: "Inteligência Artificial", ano: "2025/2026" } });
  const iaA = await db.assignment.create({
    data: {
      courseId: ia.id,
      titulo: "Ensaio: o impacto ético da IA na avaliação académica",
      enunciado: "Escreve um ensaio argumentativo (600-800 palavras) sobre os riscos e oportunidades éticas de usar IA para avaliar trabalhos. Toma uma posição e defende-a com exemplos concretos.",
      tiposFicheiro: ["pdf", "docx"],
      rubrica: RUB_ENSAIO as unknown as object,
      instrucoes: "Premeia posição pessoal fundamentada e exemplos originais.",
    },
  });
  await submeter(iaA.id, "Beatriz Nunes", "Defendo que a IA deve assistir, nunca substituir, o docente. No meu estágio vi como um feedback automático mal calibrado desmotivou colegas — o problema não foi a velocidade mas a falta de contexto humano. A oportunidade está em libertar tempo para o que a máquina não faz: a conversa. O risco é a delegação silenciosa do juízo.", mkEval(RUB_ENSAIO, [0.9, 0.8, 0.85], { estado: "APROVADO", fb: "Posição clara e um exemplo pessoal forte (o estágio). Exatamente o tipo de argumento que a rubrica premeia.", perguntas: ["Como distingues 'assistir' de 'substituir' na prática?"], det: { probabilidade: 10, indicadores: ["Exemplo pessoal específico (estágio)", "Posição própria fundamentada"] } }));
  await submeter(iaA.id, "Carlos Mendes", "A inteligência artificial na avaliação académica apresenta tanto oportunidades significativas como riscos consideráveis. Por um lado, permite maior rapidez e consistência. Por outro lado, levanta questões éticas relativas à privacidade, ao viés algorítmico e à transparência. É fundamental encontrar um equilíbrio adequado que maximize os benefícios enquanto mitiga os riscos, garantindo sempre a supervisão humana no processo.", mkEval(RUB_ENSAIO, [0.55, 0.4, 0.7], { estado: "RASCUNHO", fb: "Bem escrito mas genérico e sem posição própria nem exemplos concretos — lê-se como uma resposta padrão de IA.", perguntas: ["Qual é a TUA posição, e que experiência concreta a sustenta?", "Dá um exemplo real, não hipotético."], det: { probabilidade: 92, indicadores: ["Estrutura 'por um lado / por outro lado' genérica", "Sem posição pessoal nem exemplos concretos", "Vocabulário uniforme e polido de IA", "Conclusão vaga tipo 'encontrar o equilíbrio'"] } }));
  await submeter(iaA.id, "Diana Faria", "Ensaio sobre ética da IA na avaliação em anexo.");

  // ── Cadeira 5: Sistemas Operativos (ano anterior) ───────
  const so = await db.course.create({ data: { professorId: professor.id, nome: "Sistemas Operativos", ano: "2024/2025" } });
  const soA = await db.assignment.create({
    data: {
      courseId: so.id,
      titulo: "Escalonamento de processos: Round Robin vs. SJF",
      enunciado: "Compara Round Robin e Shortest Job First: tempo médio de espera, justiça e cenários de uso. Usa um exemplo com 4 processos.",
      tiposFicheiro: ["pdf", "txt"],
      rubrica: rubComplex as unknown as object,
    },
  });
  await submeter(soA.id, "Rui Costa", "Round Robin é justo mas pode ter tempo de espera maior; SJF minimiza o tempo médio de espera mas pode causar starvation dos processos longos. Com P1=8,P2=4,P3=2,P4=1, o SJF (ordem P4,P3,P2,P1) dá espera média menor que o RR com quantum 2.", mkEval(rubComplex, [0.85, 0.8], { estado: "APROVADO", fb: "Boa comparação e o exemplo com 4 processos está correto. Menção certeira à starvation.", perguntas: ["Calcula o tempo médio de espera do teu exemplo para RR com quantum 2."], det: { probabilidade: 20, indicadores: ["Exemplo numérico próprio"] } }));

  // ── Cadeira 6: Projetos de Código (autograder + IA REAIS) ──────────────────
  // Corre os testes de verdade contra o código e avalia com o LLM, para ver o
  // comportamento real. Requer Docker + imagens; se off, salta (dados restantes ok).
  if (runnerAtivo) {
    console.log("\n  Projetos de código (autograder + IA reais)…");
    const proj = await db.course.create({ data: { professorId: professor.id, nome: "Projetos de Código", ano: "2025/2026" } });
    const rubCod: Crit[] = [
      { id: "c1", nome: "Correção (testes)", descricao: "Passa nos testes automáticos do professor.", peso: 55, pontosMax: 20 },
      { id: "c2", nome: "Qualidade do código", descricao: "Legibilidade, nomes, simplicidade.", peso: 30, pontosMax: 20 },
      { id: "c3", nome: "Robustez", descricao: "Trata casos-limite e erros.", peso: 15, pontosMax: 20 },
    ];

    // — Projeto 1: Pilha (Python) —
    const pilhaTests = `from solution import Pilha
def test_push_pop():
    p = Pilha(); p.push(1); p.push(2)
    assert p.pop() == 2 and p.pop() == 1
def test_peek():
    p = Pilha(); p.push(5); assert p.peek() == 5
def test_is_empty():
    p = Pilha(); assert p.is_empty(); p.push(1); assert not p.is_empty()
def test_size():
    p = Pilha(); p.push(1); p.push(2); assert p.size() == 2
def test_pop_vazia_erro():
    import pytest
    with pytest.raises(Exception):
        Pilha().pop()
`;
    const pilha = await db.assignment.create({ data: {
      courseId: proj.id, escala: "cem", titulo: "Pilha (Stack) em Python",
      enunciado: "Implementa a classe Pilha em solution.py com push(x), pop() (LIFO), peek(), is_empty() e size(). pop() numa pilha vazia deve levantar um erro. Os testes obrigatórios têm de passar para submeteres.",
      tiposFicheiro: ["py", "zip"], rubrica: rubCod as unknown as object,
      instrucoes: "Valoriza tratamento do caso da pilha vazia.",
      testSuite: { lang: "python", testFiles: [{ path: "test_pilha.py", content: pilhaTests }],
        obrigatorios: ["test_push_pop", "test_peek", "test_is_empty"] } as unknown as object,
    } });
    // correta e limpa (passa tudo)
    await submeterCodigo(pilha, "Ana Silva", `class Pilha:
    def __init__(self): self._itens = []
    def push(self, x): self._itens.append(x)
    def pop(self):
        if self.is_empty(): raise IndexError("pilha vazia")
        return self._itens.pop()
    def peek(self): return self._itens[-1]
    def is_empty(self): return len(self._itens) == 0
    def size(self): return len(self._itens)
`, "solution.py");
    // passa obrigatórios mas falha opcional (size existe, mas pop vazio não levanta)
    await submeterCodigo(pilha, "Rui Costa", `class Pilha:
    def __init__(self): self.d = []
    def push(self, x): self.d.append(x)
    def pop(self): return self.d.pop() if self.d else None
    def peek(self): return self.d[-1]
    def is_empty(self): return not self.d
    def size(self): return len(self.d)
`, "solution.py");
    // "gerada por IA": correta, muito polida, docstrings/typing uniformes
    await submeterCodigo(pilha, "Carlos Mendes", `from typing import Any, List

class Pilha:
    """Implementação de uma estrutura de dados Pilha (LIFO).

    Esta classe fornece as operações fundamentais de uma pilha, garantindo
    a integridade dos dados e o tratamento adequado de casos excecionais.
    """
    def __init__(self) -> None:
        self._elementos: List[Any] = []
    def push(self, elemento: Any) -> None:
        """Adiciona um elemento ao topo da pilha."""
        self._elementos.append(elemento)
    def pop(self) -> Any:
        """Remove e devolve o elemento do topo da pilha."""
        if self.is_empty():
            raise IndexError("Não é possível remover de uma pilha vazia.")
        return self._elementos.pop()
    def peek(self) -> Any:
        """Devolve o elemento do topo sem o remover."""
        return self._elementos[-1]
    def is_empty(self) -> bool:
        """Verifica se a pilha está vazia."""
        return len(self._elementos) == 0
    def size(self) -> int:
        """Devolve o número de elementos na pilha."""
        return len(self._elementos)
`, "solution.py");
    // BLOQUEADA: pop devolve o fundo (FIFO) → falha o obrigatório test_push_pop
    await submeterCodigo(pilha, "Diana Faria", `class Pilha:
    def __init__(self): self.d = []
    def push(self, x): self.d.append(x)
    def pop(self): return self.d.pop(0)
    def peek(self): return self.d[0]
    def is_empty(self): return len(self.d) == 0
    def size(self): return len(self.d)
`, "solution.py");

    // — Projeto 2: Números primos (Python) —
    const primoTests = `from solution import eh_primo, primos_ate
def test_eh_primo_basico():
    assert eh_primo(2) and eh_primo(13) and not eh_primo(1) and not eh_primo(9)
def test_eh_primo_negativos():
    assert not eh_primo(-7) and not eh_primo(0)
def test_primos_ate():
    assert primos_ate(10) == [2, 3, 5, 7]
def test_primos_ate_limite():
    assert primos_ate(2) == [2] and primos_ate(1) == []
`;
    const primos = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Números primos (Python)",
      enunciado: "Em solution.py, implementa eh_primo(n) (bool) e primos_ate(n) (lista de primos ≤ n, crescente). Cuidado com 0, 1 e negativos.",
      tiposFicheiro: ["py"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "python", testFiles: [{ path: "test_primos.py", content: primoTests }],
        obrigatorios: ["test_eh_primo_basico", "test_primos_ate"] } as unknown as object,
    } });
    // correta
    await submeterCodigo(primos, "Beatriz Nunes", `def eh_primo(n):
    if n < 2: return False
    i = 2
    while i * i <= n:
        if n % i == 0: return False
        i += 1
    return True

def primos_ate(n):
    return [x for x in range(2, n + 1) if eh_primo(x)]
`, "solution.py");
    // passa obrigatórios, falha o dos negativos (opcional) — não trata < 2 em eh_primo? trata; mas falha limite?
    await submeterCodigo(primos, "Eduardo Pinto", `def eh_primo(n):
    if n < 2: return False
    for i in range(2, n):
        if n % i == 0: return False
    return True
def primos_ate(n):
    r = []
    for x in range(2, n + 1):
        if eh_primo(x): r.append(x)
    return r
`, "solution.py");

    // — Projeto 3: StringUtils (Java, JUnit) —
    const javaTests = `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class StringUtilsTest {
    @Test void testReverse() { assertEquals("ola", StringUtils.reverse("alo")); }
    @Test void testReverseVazio() { assertEquals("", StringUtils.reverse("")); }
    @Test void testPalindromo() {
        assertTrue(StringUtils.isPalindrome("ana"));
        assertFalse(StringUtils.isPalindrome("casa"));
    }
    @Test void testContarVogais() { assertEquals(3, StringUtils.countVowels("banana")); }
}
`;
    const javaA = await db.assignment.create({ data: {
      courseId: proj.id, escala: "letra", titulo: "StringUtils (Java, JUnit)",
      enunciado: "Cria StringUtils.java com métodos estáticos: String reverse(String s), boolean isPalindrome(String s) e int countVowels(String s). Os testes JUnit obrigatórios têm de passar.",
      tiposFicheiro: ["java", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "java", testFiles: [{ path: "StringUtilsTest.java", content: javaTests }],
        obrigatorios: ["testReverse", "testPalindromo"] } as unknown as object,
    } });
    // correta
    await submeterCodigo(javaA, "Ana Silva", `public class StringUtils {
    public static String reverse(String s) {
        return new StringBuilder(s).reverse().toString();
    }
    public static boolean isPalindrome(String s) {
        return s.equals(reverse(s));
    }
    public static int countVowels(String s) {
        int c = 0;
        for (char ch : s.toLowerCase().toCharArray())
            if ("aeiou".indexOf(ch) >= 0) c++;
        return c;
    }
}
`, "StringUtils.java");
    // passa obrigatórios, countVowels com bug (conta só 'a') → falha opcional
    await submeterCodigo(javaA, "Carlos Mendes", `public class StringUtils {
    public static String reverse(String s) {
        String r = "";
        for (int i = s.length() - 1; i >= 0; i--) r += s.charAt(i);
        return r;
    }
    public static boolean isPalindrome(String s) { return s.equals(reverse(s)); }
    public static int countVowels(String s) {
        int c = 0;
        for (char ch : s.toCharArray()) if (ch == 'a') c++;
        return c;
    }
}
`, "StringUtils.java");
    // BLOQUEADA: reverse não inverte (devolve igual) → falha testReverse obrigatório
    await submeterCodigo(javaA, "Rui Costa", `public class StringUtils {
    public static String reverse(String s) { return s; }
    public static boolean isPalindrome(String s) { return true; }
    public static int countVowels(String s) { return 0; }
}
`, "StringUtils.java");

    // — Projeto 4: Utilitários (JavaScript, node:test) —
    const jsTests = `const test = require('node:test');
const assert = require('node:assert');
const { soma, maior } = require('./solution');

test('soma', () => { assert.strictEqual(soma(2, 3), 5); assert.strictEqual(soma(-1, 1), 0); });
test('maior', () => { assert.strictEqual(maior([3, 7, 2]), 7); assert.strictEqual(maior([5]), 5); });
test('maior_vazio', () => { assert.throws(() => maior([])); });
`;
    const jsA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (JavaScript)",
      enunciado: "Em solution.js, exporta soma(a, b) e maior(arr) (maior elemento do array). maior([]) deve lançar um erro. module.exports = { soma, maior }.",
      tiposFicheiro: ["js", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "javascript", testFiles: [{ path: "solution.test.js", content: jsTests }],
        obrigatorios: ["soma", "maior"] } as unknown as object,
    } });
    // correto (lança em vazio)
    await submeterCodigo(jsA, "Ana Silva", `function soma(a, b) { return a + b; }
function maior(arr) {
  if (arr.length === 0) throw new Error("array vazio");
  return Math.max(...arr);
}
module.exports = { soma, maior };
`, "solution.js");
    // passa obrigatórios, falha o opcional (maior([]) devolve -Infinity em vez de lançar)
    await submeterCodigo(jsA, "Diana Faria", `function soma(a, b) { return a + b; }
function maior(arr) { return Math.max(...arr); }
module.exports = { soma, maior };
`, "solution.js");
    // BLOQUEADA: soma faz subtração → falha obrigatório
    await submeterCodigo(jsA, "Rui Costa", `function soma(a, b) { return a - b; }
function maior(arr) { return Math.max(...arr); }
module.exports = { soma, maior };
`, "solution.js");

    // — Projeto 5: Utilitários (Go) —
    const goTests = `package main
import "testing"
func TestSoma(t *testing.T) { if Soma(2, 3) != 5 { t.Fatal("soma") } }
func TestMaior(t *testing.T) { if Maior([]int{3, 7, 2}) != 7 { t.Fatal("maior") } }
`;
    const goA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (Go)",
      enunciado: "Em solution.go (package main), implementa Soma(a, b int) int e Maior(xs []int) int.",
      tiposFicheiro: ["go", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "go", testFiles: [{ path: "solution_test.go", content: goTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(goA, "Ana Silva", `package main
func Soma(a, b int) int { return a + b }
func Maior(xs []int) int {
    m := xs[0]
    for _, x := range xs { if x > m { m = x } }
    return m
}
`, "solution.go");

    // — Projeto 6: Utilitários (Ruby) —
    const rbTests = `require 'minitest/autorun'
require_relative 'solution'
class UtilTest < Minitest::Test
  def test_soma; assert_equal 5, soma(2, 3); end
  def test_maior; assert_equal 7, maior([3, 7, 2]); end
end
`;
    const rbA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (Ruby)",
      enunciado: "Em solution.rb, define soma(a, b) e maior(arr).",
      tiposFicheiro: ["rb", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "ruby", testFiles: [{ path: "solution_test.rb", content: rbTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(rbA, "Eduardo Pinto", `def soma(a, b)
  a + b
end

def maior(arr)
  arr.max
end
`, "solution.rb");

    // — Projeto 7: Utilitários (TypeScript) —
    const tsTests = `import { test } from 'node:test';
import assert from 'node:assert';
import { soma, maior } from './solution.ts';
test('soma', () => { assert.strictEqual(soma(2, 3), 5); });
test('maior', () => { assert.strictEqual(maior([3, 7, 2]), 7); });
`;
    const tsA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (TypeScript)",
      enunciado: "Em solution.ts, exporta soma(a: number, b: number): number e maior(arr: number[]): number.",
      tiposFicheiro: ["ts", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "typescript", testFiles: [{ path: "solution.test.ts", content: tsTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(tsA, "Beatriz Nunes", `export function soma(a: number, b: number): number {
  return a + b;
}
export function maior(arr: number[]): number {
  return Math.max(...arr);
}
`, "solution.ts");

    // — Projeto 8: Utilitários (C, convenção TAP) —
    const cTests = `#include <stdio.h>
int soma(int, int);
int maior(int*, int);
int main() {
    printf(soma(2, 3) == 5 ? "ok 1 - soma\\n" : "not ok 1 - soma\\n");
    int a[] = {3, 7, 2};
    printf(maior(a, 3) == 7 ? "ok 2 - maior\\n" : "not ok 2 - maior\\n");
    return 0;
}
`;
    const cA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (C)",
      enunciado: "Em solution.c, implementa int soma(int a, int b) e int maior(int* xs, int n) (maior de n inteiros).",
      tiposFicheiro: ["c", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "c", testFiles: [{ path: "tests.c", content: cTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(cA, "Carlos Mendes", `int soma(int a, int b) { return a + b; }
int maior(int* xs, int n) {
    int m = xs[0];
    for (int i = 1; i < n; i++) if (xs[i] > m) m = xs[i];
    return m;
}
`, "solution.c");

    // — Projeto 9: Utilitários (Dart) —
    const dartTests = `import 'solution.dart';
void main() {
  print(soma(2, 3) == 5 ? "ok 1 - soma" : "not ok 1 - soma");
  print(maior([3, 7, 2]) == 7 ? "ok 2 - maior" : "not ok 2 - maior");
}
`;
    const dartA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (Dart)",
      enunciado: "Em solution.dart, define int soma(int a, int b) e int maior(List<int> xs).",
      tiposFicheiro: ["dart", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "dart", testFiles: [{ path: "tests.dart", content: dartTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(dartA, "Ana Silva", `int soma(int a, int b) => a + b;
int maior(List<int> xs) => xs.reduce((a, b) => a > b ? a : b);
`, "solution.dart");

    // — Projeto 10: Utilitários (Kotlin) —
    const ktTests = `fun main() {
    println(if (soma(2, 3) == 5) "ok 1 - soma" else "not ok 1 - soma")
    println(if (maior(listOf(3, 7, 2)) == 7) "ok 2 - maior" else "not ok 2 - maior")
}
`;
    const ktA = await db.assignment.create({ data: {
      courseId: proj.id, titulo: "Utilitários (Kotlin)",
      enunciado: "Em solution.kt, define fun soma(a: Int, b: Int): Int e fun maior(xs: List<Int>): Int.",
      tiposFicheiro: ["kt", "zip"], rubrica: rubCod as unknown as object,
      testSuite: { lang: "kotlin", testFiles: [{ path: "tests.kt", content: ktTests }], obrigatorios: "todos" } as unknown as object,
    } });
    await submeterCodigo(ktA, "Eduardo Pinto", `fun soma(a: Int, b: Int) = a + b
fun maior(xs: List<Int>) = xs.max()
`, "solution.kt");

    // — Cenários de sandbox: crash e loop infinito (demonstram a proteção) —
    console.log("  Cenários de sandbox (esperado: bloqueados):");
    // erro de sintaxe → não importa → nenhum teste corre
    await submeterCodigo(pilha, "Eduardo Pinto", `class Pilha
    def __init__(self): self.d = []
`, "solution.py");
    // loop infinito → o timeout do sandbox mata (≈20s)
    await submeterCodigo(pilha, "Rui Costa", `class Pilha:
    def __init__(self): self.d = []
    def push(self, x):
        while True: pass
    def pop(self): return self.d.pop()
    def peek(self): return self.d[-1]
    def is_empty(self): return not self.d
    def size(self): return len(self.d)
`, "solution.py");
    // fork storm → --pids-limit 128 impede (fork rebenta) → import falha → bloqueado
    await submeterCodigo(pilha, "Diana Faria", `import os, time
for _ in range(500):
    if os.fork() == 0:
        time.sleep(1); os._exit(0)
class Pilha:
    def __init__(self): self.d = []
`, "solution.py");
    // memory bomb → --memory 512m → OOM kill → sem resultado → bloqueado
    await submeterCodigo(pilha, "Carlos Mendes", `_ = bytearray(2_000_000_000)
class Pilha:
    def __init__(self): self.d = []
`, "solution.py");
    // acesso à rede → --network none → falha → bloqueado
    await submeterCodigo(pilha, "Beatriz Nunes", `import urllib.request
urllib.request.urlopen("http://example.com", timeout=3)
class Pilha:
    def __init__(self): self.d = []
`, "solution.py");
  } else {
    console.log("  (Projetos de código saltados — RUNNER_MODE=off ou Docker indisponível)");
  }

  // ── Showcase das features cross-faculdade (configura entidades já criadas) ──
  {
    // AED "Ordenação": prazo passado + penalização, grupo, avaliação por pares, turmas.
    const ord = await db.assignment.findFirst({ where: { titulo: { contains: "Ordena" } } });
    if (ord) {
      await db.assignment.update({
        where: { id: ord.id },
        data: { prazo: new Date(Date.now() - 3 * 86400000), politicaAtraso: "aceitar", penalizacaoAtraso: 10, grupo: true, avaliacaoPares: true },
      });
      const sords = await db.submission.findMany({ where: { assignmentId: ord.id }, orderBy: { createdAt: "asc" } });
      // turmas PL1/PL2 alternadas
      for (const [i, s] of sords.entries()) await db.submission.update({ where: { id: s.id }, data: { turma: i % 2 ? "PL2" : "PL1" } });
      // Rui: fora de prazo há 3 dias
      const rui = sords.find((s) => s.alunoNome.includes("Rui"));
      if (rui) await db.submission.update({ where: { id: rui.id }, data: { atrasada: true, diasAtraso: 3 } });
      // Ana: grupo com membros
      const ana = sords.find((s) => s.alunoNome.includes("Ana"));
      if (ana) await db.submission.update({ where: { id: ana.id }, data: { membros: [{ nome: "João Dias", numero: "20219999" }, { nome: "Marta Reis", numero: "20218888" }] as object } });
      // pares: 3 colegas avaliam o Carlos
      const carlos = sords.find((s) => s.alunoNome.includes("Carlos"));
      const revs = sords.filter((s) => ["Ana", "Diana", "Eduardo"].some((n) => s.alunoNome.includes(n)));
      if (carlos) for (const [i, r] of revs.entries()) {
        if (r.id === carlos.id) continue;
        await db.peerReview.upsert({
          where: { revisorSubId_alvoSubId: { revisorSubId: r.id, alvoSubId: carlos.id } }, update: {},
          create: { assignmentId: ord.id, revisorSubId: r.id, alvoSubId: carlos.id, nota: [14, 16, 15][i], comentario: ["Boa análise, mas faltou o exemplo.", "Muito claro e bem estruturado.", "Correto; podia aprofundar a fase de merge."][i] },
        });
      }
      // Plágio entre edições: edição do ano anterior (cadeira arquivada) com o
      // mesmo trabalho e uma entrega quase idêntica à da Ana — dispara o alerta 🗄.
      const anaSub = sords.find((s) => s.alunoNome.includes("Ana"));
      if (anaSub?.conteudoExtraido) {
        const cursoAnterior = await db.course.create({ data: { professorId: professor.id, nome: `${(await db.course.findUnique({ where: { id: ord.courseId } }))?.nome ?? "AED"} (2023/2024)`, ano: "2023/2024", arquivada: true } });
        const ordAnterior = await db.assignment.create({ data: { courseId: cursoAnterior.id, titulo: ord.titulo, enunciado: ord.enunciado, tiposFicheiro: [] as object, rubrica: ord.rubrica as object, instrucoes: ord.instrucoes } });
        await db.submission.create({ data: { assignmentId: ordAnterior.id, alunoNome: "Tiago Ferreira", alunoNumero: "20191234", ficheiros: [] as object, conteudoExtraido: anaSub.conteudoExtraido } });
      }
    }
    // Modelo de rubrica reutilizável.
    await db.rubricaTemplate.create({ data: { professorId: professor.id, nome: "Ensaio argumentativo", criterios: [
      { nome: "Tese e argumento", descricao: "Ideia central clara e defendida", peso: 40, pontosMax: 20 },
      { nome: "Evidência", descricao: "Suporte relevante e integrado", peso: 35, pontosMax: 20 },
      { nome: "Estrutura e clareza", descricao: "Organização lógica e prosa legível", peso: 25, pontosMax: 20 },
    ] as object } });
    // Cadeira arquivada (exemplo).
    await db.course.updateMany({ where: { nome: { contains: "Sistemas" } }, data: { arquivada: true } });
    console.log("  Showcase configurado: prazos, grupo, pares, turmas, modelo de rubrica, cadeira arquivada, plágio entre edições.");
  }

  const [nSubs, nCad, nTrab] = await Promise.all([db.submission.count(), db.course.count(), db.assignment.count()]);
  console.log("\nSeed rico criado.");
  console.log(`  Professor: prof@exemplo.pt / demo1234 (${professor.nome})`);
  console.log("  Alunos:", alunosDef.map((a) => a.email).join(", "), "(password: demo1234)");
  console.log(`  ${nCad} cadeiras, ${nTrab} trabalhos, ${nSubs} submissões (com plágio, deteção de IA, autograder real, aprovados e pendentes).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
