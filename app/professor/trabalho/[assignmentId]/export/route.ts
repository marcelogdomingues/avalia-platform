import { NextRequest, NextResponse } from "next/server";
import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /professor/trabalho/[assignmentId]/export → CSV de notas.
// Formato compatível com importação no gradebook do Moodle.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;

  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { professorId: prof.id } },
    include: { submissions: { include: { evaluation: true } } },
  });
  if (!a) return new NextResponse("Não encontrado", { status: 404 });

  const temAutograder = !!a.testSuite;
  const cabecalho = ["Numero", "Nome", "Email", "Nota", "Estado", "Sinal IA %"];
  if (temAutograder) cabecalho.push("Testes");
  const linhas = [cabecalho];
  for (const s of a.submissions) {
    const ev = s.evaluation;
    // exporta a nota final (aprovada) ou, se ainda não aprovada, a nota da IA
    const nota = ev?.notaFinal ?? ev?.notaIA;
    if (nota == null) continue;
    const estado = ev?.estado === "APROVADO" ? "Publicado" : ev?.estado === "RASCUNHO" ? "Por rever" : ev?.estado ?? "";
    const sinalIA = (ev?.deteccaoIA as { probabilidade?: number } | null)?.probabilidade;
    const tr = s.testResult as { passed?: number; total?: number } | null;
    const linha = [
      s.alunoNumero ?? "",
      s.alunoNome,
      s.alunoEmail ?? "",
      String(nota).replace(".", ","), // vírgula decimal (Excel PT)
      estado,
      sinalIA != null ? String(sinalIA) : "",
    ];
    if (temAutograder) linha.push(tr?.total != null ? `${tr.passed}/${tr.total}` : "");
    linhas.push(linha);
  }

  const csv = linhas.map((l) => l.map(escaparCsv).join(",")).join("\r\n");
  const nomeFicheiro = `notas-${a.titulo.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeFicheiro}"`,
    },
  });
}

function escaparCsv(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
