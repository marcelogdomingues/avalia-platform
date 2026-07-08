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
// Config de execução por linguagem — juntar uma = imagem Docker + comando + parser.
// O comando corre em `sh -c` dentro do contentor: aluno em /work (rw), testes em
// /tests (ro). Deve escrever no stdout algo que o parser saiba ler.
interface LangRun { image: string; cmd: string; parse: (stdout: string) => TestOutcome[] }
const RUN_CFG: Partial<Record<Lang, LangRun>> = {
  python: {
    image: "avalia-runner-python",
    cmd: "PYTHONPATH=/work timeout 25 pytest /tests --json-report --json-report-file=/work/r.json -q >/dev/null 2>&1; cat /work/r.json 2>/dev/null || true",
    parse: (raw) => {
      const j = JSON.parse(raw) as { tests?: { nodeid: string; outcome: string }[] };
      return (j.tests ?? []).map((t) => ({ nome: String(t.nodeid).split("::").pop() ?? t.nodeid, ok: t.outcome === "passed" }));
    },
  },
  java: {
    image: "avalia-runner-java",
    // Junta testes e código do aluno na mesma pasta (testes ganham em colisão),
    // compila tudo e corre o JUnit console, que escreve relatórios XML legados.
    cmd: "cp /tests/*.java /work/ 2>/dev/null; timeout 40 sh -c 'javac -cp /opt/junit/junit.jar /work/*.java -d /work/out 2>/work/c.err && java -jar /opt/junit/junit.jar execute -cp /work/out --scan-classpath --reports-dir=/work/rep --disable-banner --details=none >/dev/null 2>&1'; cat /work/rep/*.xml 2>/dev/null || true",
    parse: parseJavaXml,
  },
};

// Linguagens com imagem de runner pronta nesta instância (derivado da config).
export const LANGS_PRONTAS: Lang[] = Object.keys(RUN_CFG) as Lang[];
export const EXT: Record<Lang, string[]> = {
  python: [".py"], java: [".java"], dart: [".dart"], kotlin: [".kt"],
};

// Modo de execução — resolve os problemas de memória e de deploy:
//   docker (default): corre localmente, com limite de concorrência.
//   remote:           delega a um grader por HTTP (VPS/Piston/Judge0) — para produção (ex.: Vercel).
//   off:              desativa a execução (autograder não bloqueia; ex.: preview sem grader).
const MODE = (process.env.RUNNER_MODE ?? "docker") as "docker" | "remote" | "off";
const CONCORRENCIA = Math.max(1, Number(process.env.RUNNER_CONCURRENCY) || 2);
export const runnerAtivo = MODE !== "off";

// Semáforo: nunca mais do que CONCORRENCIA execuções em paralelo (protege a RAM).
let ativos = 0;
const fila: Array<() => void> = [];
async function comLimite<T>(fn: () => Promise<T>): Promise<T> {
  if (ativos >= CONCORRENCIA) await new Promise<void>((r) => fila.push(r));
  ativos++;
  try {
    return await fn();
  } finally {
    ativos--;
    fila.shift()?.();
  }
}

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
  if (MODE === "off") return { tests: [], erro: "Execução de testes desativada (RUNNER_MODE=off)." };
  if (MODE === "remote") return runRemote(lang, studentFiles, testFiles);
  return comLimite(() => runDocker(lang, studentFiles, testFiles));
}

// Delega a um grader externo por HTTP (produção). Contrato JSON:
//   req  { lang, studentFiles:[{path,content}], testFiles:[{path,content}] }
//   resp { tests:[{nome,ok}], erro? }
async function runRemote(lang: Lang, studentFiles: TestFile[], testFiles: TestFile[]): Promise<RunResult> {
  const url = process.env.RUNNER_URL;
  if (!url) return { tests: [], erro: "RUNNER_URL não configurado (grader externo)." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.RUNNER_TOKEN ? { authorization: `Bearer ${process.env.RUNNER_TOKEN}` } : {}) },
      body: JSON.stringify({ lang, studentFiles, testFiles }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { tests: [], erro: `O grader respondeu ${res.status}.` };
    const j = (await res.json()) as { tests?: { nome: string; ok: boolean }[]; erro?: string };
    return { tests: Array.isArray(j.tests) ? j.tests.map((t) => ({ nome: String(t.nome), ok: !!t.ok })) : [], erro: j.erro };
  } catch (e) {
    return { tests: [], erro: `Grader inacessível: ${(e as Error).message.slice(0, 120)}` };
  }
}

// Faz parse dos relatórios JUnit XML legados (<testcase name=... > com <failure>/<error>).
export function parseJavaXml(raw: string): TestOutcome[] {
  const tests: TestOutcome[] = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const attrs = m[1];
    const inner = m[3] ?? "";
    const nome = attrs.match(/\bname="([^"]*)"/)?.[1]?.replace(/\(\)$/, "").trim();
    if (!nome) continue;
    if (/<skipped\b/.test(inner)) continue;         // ignorados não contam
    tests.push({ nome, ok: !/<(failure|error)\b/.test(inner) });
  }
  return tests;
}

async function runDocker(lang: Lang, studentFiles: TestFile[], testFiles: TestFile[]): Promise<RunResult> {
  const cfg = RUN_CFG[lang];
  if (!cfg) {
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
        "-v", `${student}:/work:rw`, "-v", `${tests}:/tests:ro`, "-w", "/work", cfg.image,
        "sh", "-c", cfg.cmd,
      ],
      { timeout: 60000, maxBuffer: 8 * 1024 * 1024 }
    );
    const raw = stdout.trim();
    if (!raw) return { tests: [], erro: "Os testes não produziram resultado (erro de importação/compilação ou nenhum teste encontrado)." };
    return { tests: cfg.parse(raw) };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    return { tests: [], erro: /docker/i.test(msg) && /not found|ENOENT/i.test(msg) ? "Docker não está disponível no servidor." : `Falha a correr os testes: ${msg.slice(0, 160)}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Deteção exata: pergunta ao runner os nomes reais dos testes ───────────────
// Melhor que a heurística por regex do editor: apanha parametrização, classes,
// e nomes que o regex não vê. Corre a coleção do framework sem executar nada.
export interface CollectResult { nomes: string[]; erro?: string }

// conftest que faz stub de qualquer módulo em falta (ex.: `from solution import ...`)
// para a *coleção* não falhar por o código do aluno ainda não existir. Como é um
// finder de último recurso, pytest/stdlib carregam normalmente; só os que faltam
// recebem um módulo-fantasma. Nada é executado — só coletado.
const PY_CONFTEST = `import sys, types, importlib.abc, importlib.machinery
def _noop(*a, **k): return _Dummy("_")
class _Dummy(types.ModuleType):
    def __getattr__(self, n): return _noop
class _Loader(importlib.abc.Loader):
    def create_module(self, spec): return _Dummy(spec.name)
    def exec_module(self, m): pass
class _Finder(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path, target=None):
        return importlib.machinery.ModuleSpec(name, _Loader())
sys.meta_path.append(_Finder())
`;

export async function collectTests(lang: Lang, testFiles: TestFile[]): Promise<CollectResult> {
  if (MODE === "off") return { nomes: [], erro: "Runner desativado (RUNNER_MODE=off)." };
  if (MODE === "remote") return collectRemote(lang, testFiles);
  return comLimite(() => collectDocker(lang, testFiles));
}

async function collectRemote(lang: Lang, testFiles: TestFile[]): Promise<CollectResult> {
  const url = process.env.RUNNER_URL;
  if (!url) return { nomes: [], erro: "RUNNER_URL não configurado." };
  try {
    const res = await fetch(url.replace(/\/run$/, "") + "/collect", {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.RUNNER_TOKEN ? { authorization: `Bearer ${process.env.RUNNER_TOKEN}` } : {}) },
      body: JSON.stringify({ lang, testFiles }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { nomes: [], erro: `O grader respondeu ${res.status}.` };
    const j = (await res.json()) as { nomes?: string[]; erro?: string };
    return { nomes: Array.isArray(j.nomes) ? j.nomes.map(String) : [], erro: j.erro };
  } catch (e) {
    return { nomes: [], erro: `Grader inacessível: ${(e as Error).message.slice(0, 120)}` };
  }
}

async function collectDocker(lang: Lang, testFiles: TestFile[]): Promise<CollectResult> {
  if (!LANGS_PRONTAS.includes(lang)) {
    return { nomes: [], erro: `Runner de ${LANG_LABELS[lang]} ainda não está configurado.` };
  }
  const dir = await mkdtemp(join(tmpdir(), "avalia-collect-"));
  const tests = join(dir, "tests");
  await mkdir(tests);
  for (const f of testFiles) await writeFile(join(tests, safeName(f.path)), f.content);
  try {
    if (lang === "python") {
      await writeFile(join(tests, "conftest.py"), PY_CONFTEST);
      const { stdout } = await execFileP(
        "docker",
        [
          "run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
          "-v", `${tests}:/tests:ro`, "-w", "/tests", "avalia-runner-python",
          "sh", "-c", "timeout 20 pytest /tests --collect-only -q 2>/dev/null || true",
        ],
        { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }
      );
      return { nomes: parsePyCollect(stdout) };
    }
    return { nomes: [], erro: `Coleção de ${LANG_LABELS[lang]} ainda não suportada.` };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    return { nomes: [], erro: /docker/i.test(msg) && /not found|ENOENT/i.test(msg) ? "Docker não está disponível." : `Falha na deteção: ${msg.slice(0, 140)}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// pytest --collect-only -q imprime node ids (um por linha): "ficheiro.py::test_x[param]".
export function parsePyCollect(stdout: string): string[] {
  const nomes = new Set<string>();
  for (const linha of stdout.split("\n")) {
    const l = linha.trim();
    if (!l.includes("::")) continue;
    const ult = l.split("::").pop()!;      // último segmento = nome do teste
    const nome = ult.replace(/\[.*\]$/, "").trim(); // tira parametrização [ ... ]
    if (nome) nomes.add(nome);
  }
  return [...nomes];
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
