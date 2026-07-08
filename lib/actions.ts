"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { processarSubmissao, aprovarAvaliacao } from "./pipeline";
import { avaliarSubmissao, gerarRespostaIA, type Criterio } from "./evaluate";
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
export async function submeterTrabalho(token: string, formData: FormData) {
  const assignment = await db.assignment.findUnique({ where: { submitToken: token } });
  if (!assignment) throw new Error("Link de submissão inválido.");

  const alunoNome = String(formData.get("alunoNome") ?? "").trim() || "Anónimo";
  const alunoNumero = String(formData.get("alunoNumero") ?? "").trim() || undefined;
  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) throw new Error("Nenhum ficheiro submetido.");

  // se houver aluno autenticado, associa a submissão à conta dele
  const aluno = await getCurrentStudent();

  const buffer = Buffer.from(await file.arrayBuffer());
  const { submissionId } = await processarSubmissao({
    assignmentId: assignment.id,
    studentId: aluno?.id,
    alunoNome: aluno?.nome ?? alunoNome,
    alunoEmail: aluno?.email,
    alunoNumero: aluno?.numero ?? alunoNumero,
    ficheiros: [{ nome: file.name, mime: file.type, buffer }],
  });

  revalidatePath(`/professor/trabalho/${assignment.id}`);
  return submissionId;
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
