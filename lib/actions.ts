"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "./db";
import { processarSubmissao, aprovarAvaliacao } from "./pipeline";
import { runTests, avaliarGate, extrairCodigo, collectTests, runnerAtivo, LANG_LABELS, EXT, type Lang, type TestFile, type GateResult } from "./runner";
import {
  avaliarSubmissao,
  gerarRespostaIA,
  analisarResistenciaIA,
  gerarRubrica,
  gerarEnunciado,
  gerarInsightsTurma,
  melhorarFeedback,
  tutorSocratico,
  avaliarDefesa,
  gerarTestes,
  type MensagemTutor,
  type DefesaAvaliacao,
  type Criterio,
  type AnaliseEnunciado,
  type CriterioSugerido,
  type InsightsTurma,
  type TomFeedback,
} from "./evaluate";
import {
  hashPassword,
  verifyPassword,
  setSession,
  clearSession,
  requireProfessor,
  setStudentSession,
  clearStudentSession,
  getCurrentStudent,
  requireStudent,
} from "./auth";

// ── Idioma ───────────────────────────────────────────────────────────────────
export async function setLocale(locale: string) {
  const val = locale === "en" ? "en" : "pt";
  (await cookies()).set("locale", val, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function registar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!nome || !email || password.length < 6) redirect("/registo?erro=campos");

  const existe = await db.professor.findUnique({ where: { email } });
  if (existe) redirect("/registo?erro=email");

  const prof = await db.professor.create({
    data: { nome, email, password: hashPassword(password) },
  });
  await setSession(prof.id);
  redirect("/professor");
}

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const prof = await db.professor.findUnique({ where: { email } });
  if (!prof || !verifyPassword(password, prof.password)) redirect("/login?erro=1");
  await setSession(prof.id);
  redirect("/professor");
}

export async function sair() {
  await clearSession();
  redirect("/login");
}

// ── Auth do aluno ────────────────────────────────────────────────────────────
export async function registarAluno(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const numero = String(formData.get("numero") ?? "").trim() || undefined;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/aluno");
  if (!nome || !email || password.length < 6) redirect(`/aluno/registo?erro=campos&next=${encodeURIComponent(next)}`);
  if (await db.student.findUnique({ where: { email } }))
    redirect(`/aluno/registo?erro=email&next=${encodeURIComponent(next)}`);
  const aluno = await db.student.create({
    data: { nome, numero, email, password: hashPassword(password) },
  });
  await setStudentSession(aluno.id);
  redirect(next);
}

export async function entrarAluno(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/aluno");
  const aluno = await db.student.findUnique({ where: { email } });
  if (!aluno || !verifyPassword(password, aluno.password))
    redirect(`/aluno/login?erro=1&next=${encodeURIComponent(next)}`);
  await setStudentSession(aluno.id);
  redirect(next);
}

export async function sairAluno() {
  await clearStudentSession();
  redirect("/aluno/login");
}

// ── Cadeiras ─────────────────────────────────────────────────────────────────
export async function criarCadeira(formData: FormData) {
  const prof = await requireProfessor();
  const nome = String(formData.get("nome") ?? "").trim();
  const ano = String(formData.get("ano") ?? "").trim() || undefined;
  if (!nome) redirect("/professor?erro=nome");
  await db.course.create({ data: { professorId: prof.id, nome, ano } });
  revalidatePath("/professor");
  redirect("/professor");
}

export async function apagarCadeira(formData: FormData) {
  const prof = await requireProfessor();
  const id = String(formData.get("courseId"));
  await db.course.deleteMany({ where: { id, professorId: prof.id } });
  revalidatePath("/professor");
}

// ── Trabalhos (com rubric builder) ───────────────────────────────────────────
function parseTestSuite(formData: FormData): object | null {
  const raw = String(formData.get("testSuite") ?? "").trim();
  if (!raw) return null;
  try {
    const ts = JSON.parse(raw) as { lang?: string; testFiles?: { content?: string }[] };
    if (ts?.lang && Array.isArray(ts.testFiles) && ts.testFiles.length && ts.testFiles.every((f) => f.content?.trim())) return ts as object;
  } catch {
    /* ignora suite inválida */
  }
  return null;
}

export async function criarTrabalho(formData: FormData) {
  const prof = await requireProfessor();
  const courseId = String(formData.get("courseId"));
  const course = await db.course.findFirst({ where: { id: courseId, professorId: prof.id } });
  if (!course) redirect("/professor");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const enunciado = String(formData.get("enunciado") ?? "").trim();
  const instrucoes = String(formData.get("instrucoes") ?? "").trim() || null;
  const solucaoModelo = String(formData.get("solucaoModelo") ?? "").trim() || null;
  const feedbackImediato = formData.get("feedbackImediato") === "on";
  const tiposFicheiro = formData.getAll("tiposFicheiro").map(String);

  let rubrica: Criterio[] = [];
  try {
    rubrica = JSON.parse(String(formData.get("rubrica") ?? "[]"));
  } catch {
    rubrica = [];
  }
  // normaliza ids e números
  rubrica = rubrica
    .filter((c) => c.nome?.trim())
    .map((c, i) => ({
      id: `c${i + 1}`,
      nome: String(c.nome).trim(),
      descricao: String(c.descricao ?? "").trim(),
      peso: Number(c.peso) || 0,
      pontosMax: Number(c.pontosMax) || 20,
    }));

  if (!titulo || !enunciado || rubrica.length === 0) {
    redirect(`/professor/cadeira/${courseId}?erro=campos`);
  }

  const a = await db.assignment.create({
    data: {
      courseId,
      titulo,
      enunciado,
      instrucoes,
      solucaoModelo,
      feedbackImediato,
      tiposFicheiro: tiposFicheiro.length ? tiposFicheiro : ["pdf", "docx", "txt"],
      rubrica: rubrica as any,
      testSuite: parseTestSuite(formData) as any,
    },
  });

  // Linha-base de IA (best-effort: não bloqueia a criação se o LLM falhar).
  try {
    const respostaIA = await gerarRespostaIA({ enunciado, instrucoes, rubrica });
    if (respostaIA) await db.assignment.update({ where: { id: a.id }, data: { respostaIA } });
  } catch {
    /* segue sem linha-base; pode gerar-se depois na página do trabalho */
  }

  redirect(`/professor/trabalho/${a.id}`);
}

// Analisa a resistência do enunciado à IA (chamada pelo builder, antes de criar).
export async function analisarEnunciadoAction(
  enunciado: string,
  instrucoes?: string,
): Promise<AnaliseEnunciado | null> {
  await requireProfessor();
  if (!enunciado.trim()) return null;
  return analisarResistenciaIA({ enunciado, instrucoes: instrucoes || null });
}

// Gera uma rubrica sugerida a partir do enunciado (chamada pelo builder).
export async function gerarRubricaAction(enunciado: string, instrucoes?: string): Promise<CriterioSugerido[] | null> {
  await requireProfessor();
  if (!enunciado.trim()) return null;
  return gerarRubrica({ enunciado, instrucoes: instrucoes || null });
}

// Sugere um enunciado a partir de um título (chamada pelo builder).
export async function gerarEnunciadoAction(titulo: string, cadeira?: string): Promise<string | null> {
  await requireProfessor();
  if (!titulo.trim()) return null;
  return gerarEnunciado({ titulo, cadeira });
}

// Insights da turma: resumo IA dos erros comuns a partir dos feedbacks.
export async function gerarInsightsAction(assignmentId: string): Promise<InsightsTurma | null> {
  const prof = await requireProfessor();
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { professorId: prof.id } },
    include: { submissions: { include: { evaluation: true } } },
  });
  if (!a) return null;
  const submissoes = a.submissions
    .map((s) => ({ nome: s.alunoNome, nota: s.evaluation?.notaFinal ?? s.evaluation?.notaIA ?? null, feedback: s.evaluation?.feedbackGlobal ?? null }))
    .filter((s) => s.feedback);
  return gerarInsightsTurma({ enunciado: a.enunciado, submissoes });
}

// Reescreve o feedback com outro tom (chamado no painel de revisão).
export async function melhorarFeedbackAction(feedback: string, tom: TomFeedback): Promise<string | null> {
  await requireProfessor();
  if (!feedback.trim()) return null;
  return melhorarFeedback({ feedback, tom });
}

// ── Tutor socrático (aluno) ───────────────────────────────────────────────────
// Guia o aluno a melhorar sem dar a resposta. Carrega o contexto da submissão.
export async function tutorAction(submissionId: string, historico: MensagemTutor[]): Promise<string | null> {
  const aluno = await getCurrentStudent();
  if (!aluno) return null;
  const sub = await db.submission.findFirst({
    where: { id: submissionId, studentId: aluno.id },
    include: { assignment: true, evaluation: true },
  });
  if (!sub) return null;
  const aprovado = sub.evaluation?.estado === "APROVADO";
  const released = aprovado || sub.assignment.feedbackImediato;
  return tutorSocratico({
    enunciado: sub.assignment.enunciado,
    feedback: released ? sub.evaluation?.feedbackGlobal ?? null : null,
    criterios: released ? ((sub.evaluation?.porCriterio as { nome: string; pontos: number; pontosMax: number }[] | null) ?? []) : [],
    historico: historico.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 1500) })),
  });
}

// ── Recurso / pedido de revisão ───────────────────────────────────────────────
export interface Recurso { pedido: string; criadoEm: string; estado: "aberto" | "respondido"; resposta?: string; respondidoEm?: string }

// Aluno pede uma revisão da nota (vai para o professor, não para a IA).
export async function pedirRevisao(submissionId: string, texto: string): Promise<{ ok: boolean }> {
  const aluno = await getCurrentStudent();
  if (!aluno) return { ok: false };
  const t = texto.trim();
  if (!t) return { ok: false };
  const sub = await db.submission.findFirst({ where: { id: submissionId, studentId: aluno.id } });
  if (!sub) return { ok: false };
  const recurso: Recurso = { pedido: t.slice(0, 2000), criadoEm: new Date().toISOString(), estado: "aberto" };
  await db.submission.update({ where: { id: sub.id }, data: { recurso: recurso as object } });
  revalidatePath("/aluno");
  return { ok: true };
}

// Professor responde a um recurso.
export async function responderRecurso(submissionId: string, resposta: string): Promise<{ ok: boolean }> {
  const prof = await requireProfessor();
  const t = resposta.trim();
  if (!t) return { ok: false };
  const sub = await db.submission.findFirst({
    where: { id: submissionId, assignment: { course: { professorId: prof.id } } },
  });
  const atual = sub?.recurso as Recurso | null;
  if (!sub || !atual) return { ok: false };
  const recurso: Recurso = { ...atual, estado: "respondido", resposta: t.slice(0, 2000), respondidoEm: new Date().toISOString() };
  await db.submission.update({ where: { id: sub.id }, data: { recurso: recurso as object } });
  revalidatePath(`/professor/trabalho/${sub.assignmentId}`);
  return { ok: true };
}

// ── Entrevista de defesa ──────────────────────────────────────────────────────
// Aluno responde às perguntas de defesa geradas pela IA para a sua submissão.
export async function responderDefesa(submissionId: string, respostas: string[]): Promise<{ ok: boolean }> {
  const aluno = await getCurrentStudent();
  if (!aluno) return { ok: false };
  const sub = await db.submission.findFirst({
    where: { id: submissionId, studentId: aluno.id },
    include: { evaluation: true },
  });
  if (!sub) return { ok: false };
  const perguntas = (sub.evaluation?.perguntasDefesa as string[] | null) ?? [];
  if (perguntas.length === 0) return { ok: false };
  const qa = perguntas.map((pergunta, i) => ({ pergunta, resposta: String(respostas[i] ?? "").slice(0, 2000) }));
  await db.submission.update({ where: { id: sub.id }, data: { respostasDefesa: qa as object } });
  revalidatePath("/aluno");
  return { ok: true };
}

// Professor pede à IA para avaliar a consistência das respostas de defesa.
export async function avaliarDefesaAction(submissionId: string): Promise<DefesaAvaliacao | null> {
  const prof = await requireProfessor();
  const sub = await db.submission.findFirst({
    where: { id: submissionId, assignment: { course: { professorId: prof.id } } },
    include: { assignment: true, evaluation: true },
  });
  if (!sub || !sub.evaluation) return null;
  const qa = (sub.respostasDefesa as { pergunta: string; resposta: string }[] | null) ?? [];
  if (qa.length === 0) return null;
  const res = await avaliarDefesa({ enunciado: sub.assignment.enunciado, trabalho: sub.conteudoExtraido, qa });
  if (res) {
    await db.evaluation.update({ where: { id: sub.evaluation.id }, data: { defesaAvaliacao: res as object } });
    revalidatePath(`/professor/trabalho/${sub.assignmentId}`);
  }
  return res;
}

// ── Banco de comentários (snippets reutilizáveis do professor) ────────────────
export interface Snippet { id: string; atalho: string; texto: string; usos: number }

export async function listarSnippets(): Promise<Snippet[]> {
  const prof = await requireProfessor();
  return db.commentSnippet.findMany({
    where: { professorId: prof.id },
    orderBy: [{ usos: "desc" }, { createdAt: "desc" }],
    select: { id: true, atalho: true, texto: true, usos: true },
  });
}

export async function criarSnippet(atalho: string, texto: string): Promise<Snippet | null> {
  const prof = await requireProfessor();
  const a = atalho.trim(), t = texto.trim();
  if (!a || !t) return null;
  return db.commentSnippet.create({
    data: { professorId: prof.id, atalho: a.slice(0, 40), texto: t.slice(0, 2000) },
    select: { id: true, atalho: true, texto: true, usos: true },
  });
}

export async function apagarSnippet(id: string): Promise<void> {
  const prof = await requireProfessor();
  await db.commentSnippet.deleteMany({ where: { id, professorId: prof.id } });
}

// Incrementa o contador de usos (fire-and-forget ao inserir no feedback).
export async function usarSnippet(id: string): Promise<void> {
  const prof = await requireProfessor();
  await db.commentSnippet.updateMany({ where: { id, professorId: prof.id }, data: { usos: { increment: 1 } } });
}

// Re-corre o autograder de uma submissão (ex.: depois de editar os testes).
export async function recorrerTestesAction(submissionId: string): Promise<GateResult | null> {
  const prof = await requireProfessor();
  const sub = await db.submission.findFirst({
    where: { id: submissionId, assignment: { course: { professorId: prof.id } } },
    include: { assignment: true },
  });
  if (!sub || !sub.conteudoExtraido) return null;
  const suite = sub.assignment.testSuite as { lang: Lang; testFiles: TestFile[]; obrigatorios: "todos" | string[] } | null;
  if (!runnerAtivo || !suite?.testFiles?.length) return null;
  const filename = (sub.ficheiros as { nome?: string }[] | null)?.[0]?.nome ?? `solution.${EXT[suite.lang][0].replace(".", "")}`;
  const run = await runTests(suite.lang, [{ path: filename, content: sub.conteudoExtraido }], suite.testFiles);
  const gate = avaliarGate(run, suite.obrigatorios);
  await db.submission.update({ where: { id: sub.id }, data: { testResult: gate as object } });
  revalidatePath(`/professor/trabalho/${sub.assignmentId}`);
  return gate;
}

// Gera um ficheiro de testes com IA para a linguagem escolhida (autograder).
export async function gerarTestesAction(enunciado: string, lang: Lang, instrucoes?: string): Promise<string | null> {
  await requireProfessor();
  if (!enunciado.trim()) return null;
  return gerarTestes({ enunciado, lang, instrucoes });
}

// Deteção exata dos nomes de teste — corre a coleção do runner (ex.: pytest
// --collect-only). Devolve os nomes reais; o editor usa-os em vez do regex.
export async function detetarTestesAction(lang: Lang, conteudo: string): Promise<{ nomes: string[]; erro?: string }> {
  await requireProfessor();
  if (!conteudo.trim()) return { nomes: [] };
  const path = ({
    python: "test_trabalho.py", javascript: "solution.test.js", typescript: "solution.test.ts",
    go: "solution_test.go", ruby: "solution_test.rb", c: "tests.c", cpp: "tests.cpp", dart: "trabalho_test.dart", kotlin: "TrabalhoTest.kt", java: "TrabalhoTest.java",
  } as Record<Lang, string>)[lang];
  return collectTests(lang, [{ path, content: conteudo }]);
}

// (Re)gera a linha-base de IA de um trabalho existente.
export async function gerarLinhaBase(formData: FormData) {
  const prof = await requireProfessor();
  const id = String(formData.get("assignmentId"));
  const a = await db.assignment.findUnique({ where: { id }, include: { course: true } });
  if (!a || a.course.professorId !== prof.id) redirect("/professor");

  const respostaIA = await gerarRespostaIA({
    enunciado: a.enunciado,
    instrucoes: a.instrucoes,
    rubrica: a.rubrica as unknown as Criterio[],
  });
  if (respostaIA) await db.assignment.update({ where: { id }, data: { respostaIA } });
  revalidatePath(`/professor/trabalho/${id}`);
}

export async function apagarTrabalho(formData: FormData) {
  const prof = await requireProfessor();
  const id = String(formData.get("assignmentId"));
  const a = await db.assignment.findUnique({ where: { id }, include: { course: true } });
  if (a && a.course.professorId === prof.id) {
    await db.assignment.delete({ where: { id } });
    redirect(`/professor/cadeira/${a.courseId}`);
  }
  redirect("/professor");
}

// ── Aluno submete (link público) ─────────────────────────────────────────────
export type SubmeterResultado =
  | { ok: true; submissionId: string; gate?: GateResult }
  | { ok: false; gate?: GateResult; erro: string };

export async function submeterTrabalho(token: string, formData: FormData): Promise<SubmeterResultado> {
  const assignment = await db.assignment.findUnique({ where: { submitToken: token } });
  if (!assignment) return { ok: false, erro: "Link de submissão inválido." };

  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Nenhum ficheiro submetido." };

  const aluno = await getCurrentStudent();
  const alunoNome = aluno?.nome ?? (String(formData.get("alunoNome") ?? "").trim() || "Anónimo");
  const alunoNumero = aluno?.numero ?? (String(formData.get("alunoNumero") ?? "").trim() || undefined);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Autograder: se o trabalho tem testes, correm ANTES de aceitar a submissão.
  let gate: GateResult | undefined;
  const suite = assignment.testSuite as { lang: Lang; testFiles: TestFile[]; obrigatorios: "todos" | string[] } | null;
  if (runnerAtivo && suite && Array.isArray(suite.testFiles) && suite.testFiles.length) {
    const codigo = extrairCodigo(buffer, file.name, suite.lang);
    if (!codigo.length) {
      return { ok: false, erro: `Não encontrei ficheiros de ${LANG_LABELS[suite.lang]} no upload — submete um .zip de código ou um ficheiro ${EXT[suite.lang].join("/")}.` };
    }
    const run = await runTests(suite.lang, codigo, suite.testFiles);
    gate = avaliarGate(run, suite.obrigatorios);
    if (!gate.gateMet) {
      // BLOQUEIA — a submissão não é criada.
      return { ok: false, gate, erro: run.erro ?? `Passaste ${gate.obrigatoriosPassed}/${gate.obrigatoriosTotal} testes obrigatórios. Tens de passar todos para submeter.` };
    }
  }

  const { submissionId } = await processarSubmissao({
    assignmentId: assignment.id,
    studentId: aluno?.id,
    alunoNome,
    alunoEmail: aluno?.email,
    alunoNumero,
    ficheiros: [{ nome: file.name, mime: file.type, buffer }],
    testResult: gate,
  });

  revalidatePath(`/professor/trabalho/${assignment.id}`);
  return { ok: true, submissionId, gate };
}

// ── Editar trabalho ──────────────────────────────────────────────────────────
export async function editarTrabalho(formData: FormData) {
  const prof = await requireProfessor();
  const id = String(formData.get("assignmentId"));
  const a = await db.assignment.findUnique({ where: { id }, include: { course: true } });
  if (!a || a.course.professorId !== prof.id) redirect("/professor");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const enunciado = String(formData.get("enunciado") ?? "").trim();
  const instrucoes = String(formData.get("instrucoes") ?? "").trim() || null;
  const solucaoModelo = String(formData.get("solucaoModelo") ?? "").trim() || null;
  const feedbackImediato = formData.get("feedbackImediato") === "on";
  const tiposFicheiro = formData.getAll("tiposFicheiro").map(String);

  let rubrica: Criterio[] = [];
  try { rubrica = JSON.parse(String(formData.get("rubrica") ?? "[]")); } catch { rubrica = []; }
  rubrica = rubrica
    .filter((c) => c.nome?.trim())
    .map((c, i) => ({
      id: `c${i + 1}`,
      nome: String(c.nome).trim(),
      descricao: String(c.descricao ?? "").trim(),
      peso: Number(c.peso) || 0,
      pontosMax: Number(c.pontosMax) || 20,
    }));
  if (!titulo || !enunciado || rubrica.length === 0)
    redirect(`/professor/trabalho/${id}/editar?erro=campos`);

  await db.assignment.update({
    where: { id },
    data: {
      titulo, enunciado, instrucoes, solucaoModelo, feedbackImediato,
      tiposFicheiro: tiposFicheiro.length ? tiposFicheiro : ["pdf", "docx", "txt"],
      rubrica: rubrica as any,
      testSuite: parseTestSuite(formData) as any,
    },
  });
  redirect(`/professor/trabalho/${id}`);
}

// ── Ações em lote ────────────────────────────────────────────────────────────
export async function aprovarTodas(formData: FormData) {
  await requireProfessor();
  const assignmentId = String(formData.get("assignmentId"));
  const evals = await db.evaluation.findMany({
    where: { estado: "RASCUNHO", submission: { assignmentId } },
  });
  for (const ev of evals) {
    await db.evaluation.update({
      where: { id: ev.id },
      data: { estado: "APROVADO", notaFinal: ev.notaIA, aprovadoEm: new Date() },
    });
  }
  revalidatePath(`/professor/trabalho/${assignmentId}`);
}

// ── Professor valida / re-avalia ─────────────────────────────────────────────
export async function aprovar(formData: FormData) {
  await requireProfessor();
  const evaluationId = String(formData.get("evaluationId"));
  const notaRaw = String(formData.get("notaFinal") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();
  const notaFinal = notaRaw ? Number(notaRaw) : undefined;
  await aprovarAvaliacao(evaluationId, notaFinal);
  if (feedback) {
    await db.evaluation.update({ where: { id: evaluationId }, data: { feedbackGlobal: feedback } });
  }
  const ev = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: { submission: true },
  });
  if (ev) revalidatePath(`/professor/trabalho/${ev.submission.assignmentId}`);
}

export async function reavaliar(formData: FormData) {
  await requireProfessor();
  const submissionId = String(formData.get("submissionId"));
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true, evaluation: true },
  });
  if (!sub) return;

  const r = await avaliarSubmissao({
    enunciado: sub.assignment.enunciado,
    instrucoes: sub.assignment.instrucoes,
    solucaoModelo: sub.assignment.solucaoModelo,
    rubrica: sub.assignment.rubrica as unknown as Criterio[],
    conteudoExtraido: sub.conteudoExtraido ?? "",
  });

  await db.evaluation.update({
    where: { submissionId },
    data: {
      estado: "RASCUNHO",
      porCriterio: r.porCriterio as any,
      perguntasDefesa: r.perguntasDefesa as any,
      deteccaoIA: r.deteccaoIA as any,
      feedbackGlobal: r.feedbackGlobal,
      notaIA: r.notaIA,
      notaFinal: null,
      modelo: r.modelo,
      tokensInput: r.tokensInput,
      tokensOutput: r.tokensOutput,
      avaliadoEm: new Date(),
      aprovadoEm: null,
    },
  });
  revalidatePath(`/professor/trabalho/${sub.assignmentId}`);
}
