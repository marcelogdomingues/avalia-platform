import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTests, avaliarGate, runnerAtivo, EXT, type Lang, type TestFile } from "@/lib/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// POST /api/testar — corre o autograder de um trabalho contra código enviado,
// sem persistir nada. Serve editores (VSCode/IntelliJ), CLIs e CI.
//
// Autenticação: o `token` público do trabalho (submitToken) — o mesmo do link de
// submissão. Isola o acesso a um único trabalho e nunca devolve o código dos testes.
// Segurança: reutiliza o sandbox Docker (rede desligada, limites de CPU/memória/
// processos, timeout). Limita o tamanho do código e aplica rate-limit por token+IP.

const MAX_CODE = 200_000; // ~200 KB de código
const RL_MAX = 20;        // pedidos
const RL_JANELA = 60_000; // por minuto
const hits = new Map<string, number[]>();

function rateLimited(chave: string, agora: number): boolean {
  const janela = (hits.get(chave) ?? []).filter((t) => agora - t < RL_JANELA);
  janela.push(agora);
  hits.set(chave, janela);
  return janela.length > RL_MAX;
}

function erro(status: number, msg: string) {
  return NextResponse.json({ ok: false, erro: msg }, { status });
}

export async function POST(req: NextRequest) {
  if (!runnerAtivo) return erro(503, "Autograder desativado no servidor (RUNNER_MODE=off).");

  let body: { token?: string; code?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return erro(400, "Corpo inválido — envia JSON { token, code, filename? }.");
  }

  const token = String(body.token ?? "").trim();
  const code = typeof body.code === "string" ? body.code : "";
  if (!token) return erro(400, "Falta o token do trabalho.");
  if (!code.trim()) return erro(400, "Falta o código a testar.");
  if (code.length > MAX_CODE) return erro(413, `Código demasiado grande (máx ${MAX_CODE / 1000} KB).`);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const agora = Date.now();
  if (rateLimited(`${token}:${ip}`, agora)) return erro(429, "Demasiados pedidos — tenta daqui a pouco.");

  const a = await db.assignment.findUnique({ where: { submitToken: token } });
  if (!a) return erro(404, "Trabalho não encontrado para este token.");

  const suite = a.testSuite as { lang: Lang; testFiles: TestFile[]; obrigatorios: "todos" | string[] } | null;
  if (!suite?.testFiles?.length) return erro(400, "Este trabalho não tem autograder configurado.");

  const ext = EXT[suite.lang]?.[0]?.replace(".", "") ?? "txt";
  const filename = (body.filename && /^[\w.\-]{1,64}$/.test(body.filename)) ? body.filename : `solution.${ext}`;

  const run = await runTests(suite.lang, [{ path: filename, content: code }], suite.testFiles);
  const gate = avaliarGate(run, suite.obrigatorios);

  return NextResponse.json({
    ok: true,
    trabalho: a.titulo,
    lang: suite.lang,
    passed: gate.passed,
    total: gate.total,
    gateMet: gate.gateMet,
    obrigatoriosPassed: gate.obrigatoriosPassed,
    obrigatoriosTotal: gate.obrigatoriosTotal,
    duracaoMs: gate.duracaoMs ?? null,
    erro: gate.erro ?? null,
    // Apenas nome/estado por teste — nunca o código dos testes.
    testes: gate.tests.map((t) => ({ nome: t.nome, ok: t.ok, obrigatorio: t.obrigatorio, ms: t.ms ?? null })),
  });
}
