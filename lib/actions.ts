"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { processarSubmissao } from "./pipeline";
import { aprovarAvaliacao } from "./pipeline";

// Aluno submete um trabalho (via link público /submeter/[token]).
export async function submeterTrabalho(token: string, formData: FormData) {
  const assignment = await db.assignment.findUnique({ where: { submitToken: token } });
  if (!assignment) throw new Error("Link de submissão inválido.");

  const alunoNome = String(formData.get("alunoNome") ?? "").trim() || "Anónimo";
  const alunoNumero = String(formData.get("alunoNumero") ?? "").trim() || undefined;
  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) throw new Error("Nenhum ficheiro submetido.");

  const buffer = Buffer.from(await file.arrayBuffer());
  await processarSubmissao({
    assignmentId: assignment.id,
    alunoNome,
    alunoNumero,
    ficheiros: [{ nome: file.name, mime: file.type, buffer }],
  });

  revalidatePath("/professor");
}

// Professor aprova uma avaliação (com nota final opcional ajustada).
export async function aprovar(formData: FormData) {
  const evaluationId = String(formData.get("evaluationId"));
  const notaRaw = String(formData.get("notaFinal") ?? "").trim();
  const notaFinal = notaRaw ? Number(notaRaw) : undefined;
  await aprovarAvaliacao(evaluationId, notaFinal);
  revalidatePath("/professor");
}
