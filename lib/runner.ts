// Autograder: corre os testes do professor contra o código do aluno num
// contentor Docker isolado (sem rede, limites de CPU/memória/PIDs, timeout;
// testes montados read-only para o aluno não os adulterar).
//
// v1: Python (pytest). Arquitetura pluggable — juntar uma linguagem = juntar
// a imagem Docker + a config do comando/parser.

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join, basename } from "path";
import AdmZip from "adm-zip";

const execFileP = promisify(execFile);

export type Lang = "python" | "java" | "dart" | "kotlin";
export interface TestFile { path: string; content: string }
export interface TestOutcome { nome: string; ok: boolean }
export interface RunResult { tests: TestOutcome[]; erro?: string }

export const LANG_LABELS: Record<Lang, string> = {
  python: "Python (pytest)",
  java: "Java (JUnit)",
  dart: "Dart (dart test)",
  kotlin: "Kotlin (Gradle)",
};
// Linguagens com imagem de runner pronta nesta instância.
export const LANGS_PRONTAS: Lang[] = ["python"];
export const EXT: Record<Lang, string[]> = {
  python: [".py"], java: [".java"], dart: [".dart"], kotlin: [".kt"],
};

const safeName = (p: string) => basename(p).replace(/[^\w.\-]/g, "_") || "f";

// Extrai os ficheiros de código do aluno de um upload (zip ou ficheiro único).
export function extrairCodigo(buffer: Buffer, filename: string, lang: Lang): TestFile[] {
  const exts = EXT[lang];
  if (/\.zip$/i.test(filename)) {
    try {
      const zip = new AdmZip(buffer);
      return zip
        .getEntries()
        .filter((e) => !e.isDirectory && exts.some((x) => e.entryName.toLowerCase().endsWith(x)))
        .map((e) => ({ path: e.entryName, content: e.getData().toString("utf8") }));
    } catch {
      return [];
    }
  }
  if (exts.some((x) => filename.toLowerCase().endsWith(x))) {
    return [{ path: filename, content: buffer.toString("utf8") }];
  }
  return [];
}

export async function runTests(lang: Lang, studentFiles: TestFile[], testFiles: TestFile[]): Promise<RunResult> {
  if (!LANGS_PRONTAS.includes(lang)) {
    return { tests: [], erro: `Runner de ${LANG_LABELS[lang]} ainda não está configurado (falta a imagem Docker). Já suportado: ${LANGS_PRONTAS.map((l) => LANG_LABELS[l]).join(", ")}.` };
  }
  const dir = await mkdtemp(join(tmpdir(), "avalia-run-"));
  const student = join(dir, "student");
  const tests = join(dir, "tests");
  await mkdir(student);
  await mkdir(tests);
  for (const f of studentFiles) await writeFile(join(student, safeName(f.path)), f.content);
  for (const f of testFiles) await writeFile(join(tests, safeName(f.path)), f.content);
  try {
    const { stdout } = await execFileP(
      "docker",
      [
        "run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
        "-v", `${student}:/work:rw`, "-v", `${tests}:/tests:ro`, "-w", "/work", "avalia-runner-python",
        "sh", "-c",
        "PYTHONPATH=/work timeout 25 pytest /tests --json-report --json-report-file=/work/r.json -q >/dev/null 2>&1; cat /work/r.json 2>/dev/null || true",
      ],
      { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
    );
    const raw = stdout.trim();
    if (!raw) return { tests: [], erro: "Os testes não produziram resultado (erro de importação/compilação ou nenhum teste encontrado)." };
    const j = JSON.parse(raw) as { tests?: { nodeid: string; outcome: string }[] };
    const outcomes = (j.tests ?? []).map((t) => ({
      nome: String(t.nodeid).split("::").pop() ?? t.nodeid,
      ok: t.outcome === "passed",
    }));
    return { tests: outcomes };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    return { tests: [], erro: /docker/i.test(msg) && /not found|ENOENT/i.test(msg) ? "Docker não está disponível no servidor." : `Falha a correr os testes: ${msg.slice(0, 160)}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Gate: quais testes são obrigatórios e se a submissão passa ────────────────
export interface GateResult {
  total: number;
  passed: number;
  obrigatoriosTotal: number;
  obrigatoriosPassed: number;
  gateMet: boolean;
  tests: { nome: string; ok: boolean; obrigatorio: boolean }[];
  erro?: string;
}

export function avaliarGate(run: RunResult, obrigatorios: "todos" | string[]): GateResult {
  const tests = run.tests.map((t) => ({
    ...t,
    obrigatorio: obrigatorios === "todos" ? true : obrigatorios.includes(t.nome),
  }));
  const obr = tests.filter((t) => t.obrigatorio);
  const obrPassed = obr.filter((t) => t.ok).length;
  // Se houve erro de execução, o gate não passa (nada corre).
  const gateMet = !run.erro && (obr.length === 0 ? tests.length > 0 : obrPassed === obr.length);
  return {
    total: tests.length,
    passed: tests.filter((t) => t.ok).length,
    obrigatoriosTotal: obr.length,
    obrigatoriosPassed: obrPassed,
    gateMet,
    tests,
    erro: run.erro,
  };
}
