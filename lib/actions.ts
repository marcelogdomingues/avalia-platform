"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "./db";
import { cadeiraAcesso, registarAtividade } from "./acesso";
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
  explicarFalha,
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

// ── Co-docência (só o dono da cadeira gere) ───────────────────────────────────
export async function convidarCoDocente(courseId: string, email: string): Promise<{ ok: boolean; erro?: string }> {
  const prof = await requireProfessor();
  const c = await db.course.findFirst({ where: { id: courseId, professorId: prof.id } }); // só o dono
  if (!c) return { ok: false, erro: "Sem permissão." };
  const alvo = await db.professor.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!alvo) return { ok: false, erro: "Não há nenhum professor registado com esse email." };
  if (alvo.id === prof.id) return { ok: false, erro: "Já és o docente responsável." };
  await db.coDocente.upsert({
    where: { courseId_professorId: { courseId, professorId: alvo.id } },
    update: {}, create: { courseId, professorId: alvo.id },
  });
  await registarAtividade(courseId, prof.nome, "convidou", `co-docente ${alvo.nome}`);
  revalidatePath(`/professor/cadeira/${courseId}`);
  return { ok: true };
}

export async function removerCoDocente(courseId: string, professorId: string): Promise<void> {
  const prof = await requireProfessor();
  const c = await db.course.findFirst({ where: { id: courseId, professorId: prof.id } }); // só o dono
  if (!c) return;
  const alvo = await db.professor.findUnique({ where: { id: professorId }, select: { nome: true } });
  await db.coDocente.deleteMany({ where: { courseId, professorId } });
  await registarAtividade(courseId, prof.nome, "removeu", `co-docente ${alvo?.nome ?? ""}`.trim());
  revalidatePath(`/professor/cadeira/${courseId}`);
}

// Arquiva / desarquiva uma cadeira.
export async function alternarArquivada(formData: FormData) {
  const prof = await requireProfessor();
  const id = String(formData.get("courseId"));
  const c = await db.course.findFirst({ where: { id, professorId: prof.id } });
  if (c) await db.course.update({ where: { id: c.id }, data: { arquivada: !c.arquivada } });
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
  const course = await db.course.findFirst({ where: { id: courseId, ...cadeiraAcesso(prof.id) } });
  if (!course) redirect("/professor");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const enunciado = String(formData.get("enunciado") ?? "").trim();
  const instrucoes = String(formData.get("instrucoes") ?? "").trim() || null;
  const solucaoModelo = String(formData.get("solucaoModelo") ?? "").trim() || null;
  const feedbackImediato = formData.get("feedbackImediato") === "on";
  const escala = String(formData.get("escala") ?? "vinte");
  const prazoRaw = String(formData.get("prazo") ?? "").trim();
  const prazo = prazoRaw ? new Date(prazoRaw) : null;
  const politicaAtraso = String(formData.get("politicaAtraso") ?? "aceitar");
  const penalizacaoAtraso = Math.max(0, Math.min(100, Number(formData.get("penalizacaoAtraso")) || 0));
  const grupo = formData.get("grupo") === "on";
  const avaliacaoPares = formData.get("avaliacaoPares") === "on";
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
      escala,
      prazo: prazo && !isNaN(prazo.getTime()) ? prazo : null,
      politicaAtraso, penalizacaoAtraso, grupo, avaliacaoPares,
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

  await registarAtividade(courseId, prof.nome, "criou-trabalho", titulo);
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
    where: { id: assignmentId, course: cadeiraAcesso(prof.id) },
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

// Explica ao aluno porque um teste do autograder falhou (sem dar a solução).
export async function explicarFalhaAction(submissionId: string, testeNome: string): Promise<string | null> {
  const aluno = await getCurrentStudent();
  if (!aluno) return null;
  const sub = await db.submission.findFirst({ where: { id: submissionId, studentId: aluno.id }, include: { assignment: true } });
  if (!sub) return null;
  const suite = sub.assignment.testSuite as { lang?: string } | null;
  return explicarFalha({ enunciado: sub.assignment.enunciado, testeNome, lang: suite?.lang });
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

// Avaliação manual: o professor lança uma nota direta (oral/apresentação/participação),
// sem ficheiro. Cria uma submissão + avaliação em RASCUNHO com a nota/feedback dados.
export async function criarAvaliacaoManual(assignmentId: string, alunoNome: string, alunoNumero: string, nota: number, feedback: string): Promise<{ ok: boolean }> {
  const prof = await requireProfessor();
  const a = await db.assignment.findFirst({ where: { id: assignmentId, course: cadeiraAcesso(prof.id) } });
  if (!a || !alunoNome.trim()) return { ok: false };
  const n = Math.max(0, Math.min(20, Number(nota) || 0));
  const sub = await db.submission.create({
    data: {
      assignmentId: a.id, alunoNome: alunoNome.trim(), alunoNumero: alunoNumero.trim() || null,
      ficheiros: [] as object, conteudoExtraido: null,
    },
  });
  await db.evaluation.create({
    data: { submissionId: sub.id, estado: "RASCUNHO", notaIA: n, feedbackGlobal: feedback.trim() || null, modelo: "manual", avaliadoEm: new Date(), revisorNome: prof.nome },
  });
  await registarAtividade(a.courseId, prof.nome, "avaliacao-manual", alunoNome.trim());
  revalidatePath(`/professor/trabalho/${a.id}`);
  return { ok: true };
}

// Abre/fecha as submissões de um trabalho.
export async function alternarAberto(assignmentId: string) {
  const prof = await requireProfessor();
  const a = await db.assignment.findFirst({ where: { id: assignmentId, course: cadeiraAcesso(prof.id) } });
  if (!a) return;
  await db.assignment.update({ where: { id: a.id }, data: { aberto: !a.aberto } });
  await registarAtividade(a.courseId, prof.nome, a.aberto ? "fechou" : "abriu", a.titulo);
  revalidatePath(`/professor/trabalho/${a.id}`);
}

// Duplica um trabalho (rubrica, testes, configurações) — sem submissões.
export async function duplicarTrabalho(assignmentId: string) {
  const prof = await requireProfessor();
  const a = await db.assignment.findFirst({ where: { id: assignmentId, course: cadeiraAcesso(prof.id) } });
  if (!a) redirect("/professor");
  const nova = await db.assignment.create({
    data: {
      courseId: a.courseId,
      titulo: `${a.titulo} (cópia)`,
      enunciado: a.enunciado,
      tiposFicheiro: a.tiposFicheiro as object,
      rubrica: a.rubrica as object,
      instrucoes: a.instrucoes,
      solucaoModelo: a.solucaoModelo,
      respostaIA: a.respostaIA,
      testSuite: (a.testSuite ?? undefined) as object | undefined,
      feedbackImediato: a.feedbackImediato,
      escala: a.escala,
      politicaAtraso: a.politicaAtraso,
      penalizacaoAtraso: a.penalizacaoAtraso,
      grupo: a.grupo,
      avaliacaoPares: a.avaliacaoPares,
      // prazo NÃO é copiado (cada edição define o seu)
    },
  });
  redirect(`/professor/trabalho/${nova.id}/editar`);
}

// ── Avaliação por pares ───────────────────────────────────────────────────────
// O aluno avalia a submissão (anonimizada) de um colega. Uma avaliação por par.
export async function submeterAvaliacaoPar(alvoSubId: string, nota: number, comentario: string): Promise<{ ok: boolean }> {
  const aluno = await getCurrentStudent();
  if (!aluno) return { ok: false };
  const alvo = await db.submission.findUnique({ where: { id: alvoSubId }, include: { assignment: true } });
  if (!alvo || !alvo.assignment.avaliacaoPares) return { ok: false };
  // a submissão do próprio revisor neste trabalho
  const minha = await db.submission.findFirst({ where: { assignmentId: alvo.assignmentId, studentId: aluno.id } });
  if (!minha || minha.id === alvoSubId) return { ok: false };
  const n = Math.max(0, Math.min(20, Number(nota) || 0));
  await db.peerReview.upsert({
    where: { revisorSubId_alvoSubId: { revisorSubId: minha.id, alvoSubId } },
    update: { nota: n, comentario: comentario.slice(0, 1000) },
    create: { assignmentId: alvo.assignmentId, revisorSubId: minha.id, alvoSubId, nota: n, comentario: comentario.slice(0, 1000) },
  });
  revalidatePath("/aluno");
  return { ok: true };
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
    where: { id: submissionId, assignment: { course: cadeiraAcesso(prof.id) } },
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
    where: { id: submissionId, assignment: { course: cadeiraAcesso(prof.id) } },
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

// ── Modelos de rubrica ────────────────────────────────────────────────────────
export interface RubricaModelo { id: string; nome: string; criterios: { nome: string; descricao: string; peso: number; pontosMax: number }[] }

export async function listarRubricaModelos(): Promise<RubricaModelo[]> {
  const prof = await requireProfessor();
  const ms = await db.rubricaTemplate.findMany({ where: { professorId: prof.id }, orderBy: { createdAt: "desc" }, select: { id: true, nome: true, criterios: true } });
  return ms.map((m) => ({ id: m.id, nome: m.nome, criterios: m.criterios as RubricaModelo["criterios"] }));
}

export async function guardarRubricaModelo(nome: string, criterios: RubricaModelo["criterios"]): Promise<RubricaModelo | null> {
  const prof = await requireProfessor();
  if (!nome.trim() || !Array.isArray(criterios) || criterios.length === 0) return null;
  const m = await db.rubricaTemplate.create({ data: { professorId: prof.id, nome: nome.trim().slice(0, 80), criterios: criterios as object } });
  return { id: m.id, nome: m.nome, criterios };
}

export async function apagarRubricaModelo(id: string): Promise<void> {
  const prof = await requireProfessor();
  await db.rubricaTemplate.deleteMany({ where: { id, professorId: prof.id } });
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
    where: { id: submissionId, assignment: { course: cadeiraAcesso(prof.id) } },
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

// Re-corre o autograder em TODAS as submissões de código de um trabalho.
export async function recorrerTodosAction(assignmentId: string): Promise<{ corridas: number }> {
  const prof = await requireProfessor();
  const a = await db.assignment.findFirst({ where: { id: assignmentId, course: cadeiraAcesso(prof.id) } });
  const suite = a?.testSuite as { lang: Lang; testFiles: TestFile[]; obrigatorios: "todos" | string[] } | null;
  if (!a || !runnerAtivo || !suite?.testFiles?.length) return { corridas: 0 };
  const subs = await db.submission.findMany({ where: { assignmentId: a.id, conteudoExtraido: { not: null } } });
  let corridas = 0;
  await Promise.all(subs.map(async (sub) => {
    const filename = (sub.ficheiros as { nome?: string }[] | null)?.[0]?.nome ?? `solution.${EXT[suite.lang][0].replace(".", "")}`;
    const run = await runTests(suite.lang, [{ path: filename, content: sub.conteudoExtraido! }], suite.testFiles);
    const gate = avaliarGate(run, suite.obrigatorios);
    await db.submission.update({ where: { id: sub.id }, data: { testResult: gate as object } });
    corridas++;
  }));
  revalidatePath(`/professor/trabalho/${a.id}`);
  return { corridas };
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
    go: "solution_test.go", ruby: "solution_test.rb", c: "tests.c", cpp: "tests.cpp", php: "tests.php", rust: "tests.rs", dart: "trabalho_test.dart", kotlin: "TrabalhoTest.kt", java: "TrabalhoTest.java",
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

  if (!assignment.aberto) return { ok: false, erro: "As submissões deste trabalho estão fechadas." };

  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Nenhum ficheiro submetido." };

  const aluno = await getCurrentStudent();
  const alunoNome = aluno?.nome ?? (String(formData.get("alunoNome") ?? "").trim() || "Anónimo");
  const alunoNumero = aluno?.numero ?? (String(formData.get("alunoNumero") ?? "").trim() || undefined);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Prazo: se expirou, bloqueia ou aceita marcando como fora de prazo.
  const atrasada = !!(assignment.prazo && Date.now() > assignment.prazo.getTime());
  const diasAtraso = atrasada ? Math.ceil((Date.now() - assignment.prazo!.getTime()) / 86400000) : 0;
  if (atrasada && assignment.politicaAtraso === "bloquear") {
    return { ok: false, erro: `O prazo terminou em ${assignment.prazo!.toLocaleString("pt-PT")}. Este trabalho não aceita entregas fora de prazo.` };
  }

  // Grupo (membros adicionais) e turma.
  const turma = String(formData.get("turma") ?? "").trim() || undefined;
  let membros: { nome: string; numero?: string }[] | undefined;
  if (assignment.grupo) {
    const raw = String(formData.get("membros") ?? "").trim();
    membros = raw
      ? raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
          const [nome, numero] = l.split(",").map((x) => x.trim());
          return { nome, numero: numero || undefined };
        }).filter((m) => m.nome)
      : undefined;
  }

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
    atrasada,
    diasAtraso,
    membros,
    turma,
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
  const escala = String(formData.get("escala") ?? "vinte");
  const prazoRaw = String(formData.get("prazo") ?? "").trim();
  const prazo = prazoRaw ? new Date(prazoRaw) : null;
  const politicaAtraso = String(formData.get("politicaAtraso") ?? "aceitar");
  const penalizacaoAtraso = Math.max(0, Math.min(100, Number(formData.get("penalizacaoAtraso")) || 0));
  const grupo = formData.get("grupo") === "on";
  const avaliacaoPares = formData.get("avaliacaoPares") === "on";
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
      titulo, enunciado, instrucoes, solucaoModelo, feedbackImediato, escala, politicaAtraso, penalizacaoAtraso, grupo, avaliacaoPares,
      prazo: prazo && !isNaN(prazo.getTime()) ? prazo : null,
      tiposFicheiro: tiposFicheiro.length ? tiposFicheiro : ["pdf", "docx", "txt"],
      rubrica: rubrica as any,
      testSuite: parseTestSuite(formData) as any,
    },
  });
  redirect(`/professor/trabalho/${id}`);
}

// ── Ações em lote ────────────────────────────────────────────────────────────
export async function aprovarTodas(formData: FormData) {
  const prof = await requireProfessor();
  const assignmentId = String(formData.get("assignmentId"));
  const evals = await db.evaluation.findMany({
    where: { estado: "RASCUNHO", submission: { assignmentId } },
  });
  for (const ev of evals) {
    await db.evaluation.update({
      where: { id: ev.id },
      data: { estado: "APROVADO", notaFinal: ev.notaIA, aprovadoEm: new Date(), revisorNome: prof.nome },
    });
  }
  if (evals.length > 0) {
    const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { courseId: true, titulo: true } });
    await registarAtividade(a?.courseId, prof.nome, "aprovou", `${evals.length} de "${a?.titulo ?? ""}"`);
  }
  revalidatePath(`/professor/trabalho/${assignmentId}`);
}

// ── Professor valida / re-avalia ─────────────────────────────────────────────
export async function aprovar(formData: FormData) {
  const prof = await requireProfessor();
  const evaluationId = String(formData.get("evaluationId"));
  const notaRaw = String(formData.get("notaFinal") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();
  const notaFinal = notaRaw ? Number(notaRaw) : undefined;
  await aprovarAvaliacao(evaluationId, notaFinal);
  await db.evaluation.update({
    where: { id: evaluationId },
    data: { revisorNome: prof.nome, ...(feedback ? { feedbackGlobal: feedback } : {}) },
  });
  const ev = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: { submission: { include: { assignment: { select: { courseId: true } } } } },
  });
  if (ev) {
    await registarAtividade(ev.submission.assignment.courseId, prof.nome, "aprovou", ev.submission.alunoNome);
    revalidatePath(`/professor/trabalho/${ev.submission.assignmentId}`);
  }
}

export async function reavaliar(formData: FormData) {
  const prof = await requireProfessor();
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
  await registarAtividade(sub.assignment.courseId, prof.nome, "reavaliou", sub.alunoNome);
  revalidatePath(`/professor/trabalho/${sub.assignmentId}`);
}
