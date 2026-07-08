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
    quando?: Date
  ) {
    const al = alunos[nome];
    const sub = await db.submission.create({
      data: {
        assignmentId,
        studentId: al?.id,
        alunoNome: nome,
        alunoNumero: al?.numero,
        ficheiros: [{ nome: "trabalho.txt", mime: "text/plain", tamanho: texto.length }] as unknown as object,
        conteudoExtraido: texto,
        testResult: testResult as object | undefined,
        ...(quando ? { createdAt: quando } : {}),
      },
    });
    await db.evaluation.create({
      data: ev ? { submissionId: sub.id, ...ev } : { submissionId: sub.id, estado: "PENDENTE" },
    });
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
    })
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
    })
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

  const nSubs = await db.submission.count();
  console.log("Seed rico criado.");
  console.log(`  Professor: prof@exemplo.pt / demo1234 (${professor.nome})`);
  console.log("  Alunos:", alunosDef.map((a) => a.email).join(", "), "(password: demo1234)");
  console.log(`  5 cadeiras, 6 trabalhos, ${nSubs} submissões (com plágio, alta deteção de IA, aprovados e pendentes).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
