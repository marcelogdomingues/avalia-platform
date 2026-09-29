// Smoke-test do Avalia — verifica que as rotas-chave respondem 200 e contêm os
// marcadores esperados, autenticando via cookies de sessão assinados (sem passwords).
//
// Correr:  node scripts/smoke.mjs            (assume o dev em http://localhost:3000)
//          BASE=http://localhost:3000 node scripts/smoke.mjs
//
// Sai com código 1 se algum check falhar (útil em CI/pre-push).

import { createHmac } from "crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const BASE = process.env.BASE || "http://localhost:3000";
const SECRET = process.env.AUTH_SECRET || "avalia-dev-secret-troca-em-producao";
const sign = (v) => `${v}.${createHmac("sha256", SECRET).update(v).digest("base64url")}`;

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});
let falhas = 0;

async function check(nome, url, { cookie, marcadores = [], status = 200 } = {}) {
  try {
    const res = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    const okStatus = res.status === status;
    let body = "";
    if (marcadores.length) body = await res.text();
    const faltam = marcadores.filter((m) => !body.includes(m));
    const ok = okStatus && faltam.length === 0;
    if (ok) {
      console.log(`  ✓ ${nome} — ${res.status}`);
    } else {
      falhas++;
      console.log(`  ✗ ${nome} — status ${res.status} (esperado ${status})${faltam.length ? `, faltam marcadores: ${faltam.join(", ")}` : ""}`);
    }
  } catch (e) {
    falhas++;
    console.log(`  ✗ ${nome} — erro: ${String(e.message).slice(0, 100)}`);
  }
}

async function main() {
  const prof = await db.professor.findFirst();
  const aluno = await db.student.findFirst({ where: { submissions: { some: { evaluation: { estado: "APROVADO" } } } } });
  const assignment = await db.assignment.findFirst({ where: prof ? { course: { professorId: prof.id } } : {}, include: { submissions: { take: 2, select: { id: true } } } });
  const course = await db.course.findFirst({ where: prof ? { professorId: prof.id } : {} });
  if (!prof || !assignment) {
    console.log("!! Sem dados de seed — corre `npx tsx scripts/seed.ts` primeiro.");
    process.exit(1);
  }
  const cookieProf = `avalia_sess=${sign(prof.id)}`;
  const cookieAluno = aluno ? `avalia_aluno=${sign(aluno.id)}` : null;

  console.log(`Smoke-test @ ${BASE}\n`);

  console.log("Público:");
  await check("landing /", "/", { marcadores: ["Avalia"] });
  await check("login professor", "/login", { status: 200 });
  await check("login aluno", "/aluno/login", { status: 200 });
  await check("submeter (link público)", `/submeter/${assignment.submitToken}`, { status: 200 });

  console.log("\nProfessor (autenticado):");
  await check("dashboard /professor", "/professor", { cookie: cookieProf, marcadores: ["Cadeiras"] });
  await check("trabalho (fila de revisão)", `/professor/trabalho/${assignment.id}`, { cookie: cookieProf, marcadores: ["Fila de revisão", "Integridade"] });
  await check("relatório imprimível", `/professor/trabalho/${assignment.id}/relatorio`, { cookie: cookieProf, marcadores: ["Relatório de avaliação", "Resumo"] });
  await check("export CSV", `/professor/trabalho/${assignment.id}/export`, { cookie: cookieProf });
  if (course) await check("cadeira (progresso dos alunos)", `/professor/cadeira/${course.id}`, { cookie: cookieProf, marcadores: ["Trabalhos"] });
  if (assignment.submissions.length >= 2) {
    const [s1, s2] = assignment.submissions;
    await check("comparar submissões", `/professor/trabalho/${assignment.id}/comparar?a=${s1.id}&b=${s2.id}`, { cookie: cookieProf, marcadores: ["Comparar"] });
  }
  await check("redireciona sem sessão", "/professor", { status: 307 });

  if (cookieAluno) {
    console.log("\nAluno (autenticado):");
    await check("portal /aluno", "/aluno", { cookie: cookieAluno, marcadores: ["Os meus trabalhos"] });
    await check("redireciona sem sessão", "/aluno", { status: 307 });
  }

  console.log(`\n${falhas === 0 ? "✓ Tudo verde" : `✗ ${falhas} falha(s)`}`);
  await db.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main();
