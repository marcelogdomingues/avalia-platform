import { NextRequest, NextResponse } from "next/server";
import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { notaTexto, type Escala } from "@/lib/escala";

// GET /professor/cadeira/[courseId]/pauta → CSV consolidado da cadeira.
// Linhas = alunos, colunas = trabalhos (por ordem cronológica) + média final.
// Cada trabalho pode ter escala própria: mostramos /20 e, se diferente, a escala.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const prof = await requireProfessor();
  const { courseId } = await params;

  const course = await db.course.findFirst({
    where: { id: courseId, ...cadeiraAcesso(prof.id) },
    include: {
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
            select: {
              studentId: true, alunoNome: true, alunoNumero: true, alunoEmail: true,
              evaluation: { select: { estado: true, notaIA: true, notaFinal: true } },
            },
          },
        },
      },
    },
  });
  if (!course) return new NextResponse("Não encontrado", { status: 404 });

  const cols = course.assignments;
  const notaDe = (ev: { estado: string; notaIA: number | null; notaFinal: number | null } | null) =>
    ev == null ? null : ev.estado === "APROVADO" ? ev.notaFinal ?? ev.notaIA ?? null : ev.notaIA ?? null;

  type Reg = { nome: string; numero: string | null; email: string | null; cel: Map<string, number | null> };
  const alunos = new Map<string, Reg>();
  for (const a of cols) {
    const vistos = new Set<string>();
    for (const s of a.submissions) {
      const chave = s.studentId ?? s.alunoNumero ?? s.alunoNome;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const reg = alunos.get(chave) ?? { nome: s.alunoNome, numero: s.alunoNumero, email: s.alunoEmail, cel: new Map() };
      reg.cel.set(a.id, notaDe(s.evaluation));
      alunos.set(chave, reg);
    }
  }

  const cabecalho = ["Numero", "Nome", "Email", ...cols.map((a) => a.titulo), "Media /20"];
  const linhas = [cabecalho];
  const linhasOrdenadas = [...alunos.values()].sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
  for (const al of linhasOrdenadas) {
    const notas = cols.map((a) => al.cel.get(a.id) ?? null);
    const validas = notas.filter((n): n is number => n != null);
    const media = validas.length ? validas.reduce((s, n) => s + n, 0) / validas.length : null;
    const linha = [
      al.numero ?? "",
      al.nome,
      al.email ?? "",
      ...cols.map((a) => {
        const n = al.cel.get(a.id);
        if (n == null) return "";
        const escala = (a.escala ?? "vinte") as Escala;
        const base = String(Math.round(n * 10) / 10).replace(".", ",");
        return escala === "vinte" ? base : `${base} (${notaTexto(n, escala)})`;
      }),
      media != null ? String(Math.round(media * 10) / 10).replace(".", ",") : "",
    ];
    linhas.push(linha);
  }

  // Rodapé: média por trabalho.
  const rodape = ["", "Media do trabalho", ""];
  for (const a of cols) {
    const ns = linhasOrdenadas.map((al) => al.cel.get(a.id)).filter((n): n is number => n != null);
    rodape.push(ns.length ? String(Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 10) / 10).replace(".", ",") : "");
  }
  rodape.push("");
  linhas.push(rodape);

  const csv = linhas.map((l) => l.map(escaparCsv).join(",")).join("\r\n");
  const nomeFicheiro = `pauta-${course.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;

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
