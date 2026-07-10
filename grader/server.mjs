// Avalia — grader remoto (worker).
// Serviço standalone (Node puro, sem dependências) que corre os testes do
// professor contra o código do aluno em contentores Docker isolados, com
// limite de concorrência. É o backend do modo RUNNER_MODE=remote do web app.
//
// Contrato:
//   POST /run     { lang, studentFiles:[{path,content}], testFiles:[{path,content}] }
//        -> 200 { tests:[{nome,ok}], erro? }
//   POST /collect { lang, testFiles:[{path,content}] }
//        -> 200 { nomes:[...], erro? }   (nomes exatos dos testes, sem os correr)
//   GET  /health -> { ok, langs, ativos }
//
// Correr:  node grader/server.mjs     (precisa de Docker + as imagens de runner)
// Deploy:  ver grader/README.md (VPS pequeno / servidor da faculdade / Modal).

import http from "http";
import { execFile } from "child_process";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join, basename } from "path";
import { promisify } from "util";

const execFileP = promisify(execFile);
const PORT = Number(process.env.PORT) || 4000;
const TOKEN = process.env.RUNNER_TOKEN || "";
const CONC = Math.max(1, Number(process.env.RUNNER_CONCURRENCY) || 2);

// conftest que faz stub de imports em falta para a *coleção* não falhar (o código
// do aluno ainda não existe). Finder de último recurso — pytest/stdlib carregam
// normalmente; nada é executado, só coletado.
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

// Parser TAP partilhado (node:test, js e ts).
const tapParse = (raw) => {
  const tests = [];
  for (const linha of String(raw).split("\n")) {
    const m = linha.match(/^\s*(not ok|ok)\s+\d+\s+-\s+(.+?)\s*(?:#.*)?$/);
    if (!m) continue;
    const nome = m[2].trim();
    if (/\.(js|mjs|cjs|ts)$/i.test(nome) || nome.includes("/")) continue;
    tests.push({ nome, ok: m[1] === "ok" });
  }
  return tests;
};

// Registo de linguagens — juntar uma = juntar a imagem Docker + o comando + o parser.
const LANGS = {
  python: {
    image: "avalia-runner-python",
    cmd: "PYTHONPATH=/work timeout 25 pytest /tests --json-report --json-report-file=/work/r.json -q >/dev/null 2>&1; cat /work/r.json 2>/dev/null || true",
    parse: (raw) => {
      const j = JSON.parse(raw);
      return (j.tests || []).map((t) => ({ nome: String(t.nodeid).split("::").pop(), ok: t.outcome === "passed" }));
    },
    conftest: PY_CONFTEST,
    collectCmd: "timeout 20 pytest /tests --collect-only -q 2>/dev/null || true",
    collectParse: (raw) => {
      const nomes = new Set();
      for (const linha of String(raw).split("\n")) {
        const l = linha.trim();
        if (!l.includes("::")) continue;
        const nome = l.split("::").pop().replace(/\[.*\]$/, "").trim();
        if (nome) nomes.add(nome);
      }
      return [...nomes];
    },
  },
  java: {
    image: "avalia-runner-java",
    cmd: "cp /tests/*.java /work/ 2>/dev/null; timeout 40 sh -c 'javac -cp /opt/junit/junit.jar /work/*.java -d /work/out 2>/work/c.err && java -jar /opt/junit/junit.jar execute -cp /work/out --scan-classpath --reports-dir=/work/rep --disable-banner --details=none >/dev/null 2>&1'; cat /work/rep/*.xml 2>/dev/null || true",
    parse: (raw) => {
      const tests = [];
      const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
      let m;
      while ((m = re.exec(String(raw)))) {
        const attrs = m[1], inner = m[3] || "";
        const nm = (attrs.match(/\bname="([^"]*)"/) || [])[1];
        if (!nm || /<skipped\b/.test(inner)) continue;
        tests.push({ nome: nm.replace(/\(\)$/, "").trim(), ok: !/<(failure|error)\b/.test(inner) });
      }
      return tests;
    },
  },
  javascript: {
    image: "avalia-runner-node",
    cmd: "cp /tests/*.js /work/ 2>/dev/null; cd /work; timeout 20 node --test --test-reporter=tap 2>/dev/null || true",
    parse: tapParse,
  },
  typescript: {
    image: "avalia-runner-ts",
    cmd: "cp /tests/*.ts /work/ 2>/dev/null; cd /work; timeout 20 node --test --experimental-strip-types --test-reporter=tap 2>/dev/null || true",
    parse: tapParse,
  },
  go: {
    image: "avalia-runner-go",
    cmd: "cp /tests/*.go /work/ 2>/dev/null; cd /work; go mod init solution >/dev/null 2>&1; timeout 30 go test -v . 2>&1 || true",
    parse: (raw) => {
      const tests = [];
      for (const l of String(raw).split("\n")) {
        const m = l.match(/^\s*--- (PASS|FAIL):\s+(\w+)/);
        if (m) tests.push({ nome: m[2], ok: m[1] === "PASS" });
      }
      return tests;
    },
  },
  ruby: {
    image: "avalia-runner-ruby",
    cmd: "cp /tests/*.rb /work/ 2>/dev/null; cd /work; timeout 20 ruby -I. *_test.rb -v 2>&1 || true",
    parse: (raw) => {
      const tests = [];
      for (const l of String(raw).split("\n")) {
        const m = l.match(/(?:(\w+)#)?(\w+)\s*=\s*[\d.]+\s*s\s*=\s*([.FES])/);
        if (m && m[2]) tests.push({ nome: m[2], ok: m[3] === "." });
      }
      return tests;
    },
  },
  c: {
    image: "avalia-runner-c",
    cmd: "cp /tests/*.c /work/ 2>/dev/null; cd /work; timeout 15 sh -c 'gcc -O0 -o prog *.c -lm 2>/dev/null && ./prog' 2>/dev/null || true",
    parse: tapParse,
  },
  cpp: {
    image: "avalia-runner-cpp",
    cmd: "cp /tests/*.cpp /work/ 2>/dev/null; cd /work; timeout 15 sh -c 'g++ -O0 -o prog *.cpp 2>/dev/null && ./prog' 2>/dev/null || true",
    parse: tapParse,
  },
  php: {
    image: "avalia-runner-php",
    cmd: "cp /tests/*.php /work/ 2>/dev/null; cd /work; f=$(ls tests.php *_test.php 2>/dev/null | head -1); timeout 15 php \"$f\" 2>/dev/null || true",
    parse: tapParse,
  },
  rust: {
    image: "avalia-runner-rust",
    cmd: "cd /work; cat /work/*.rs /tests/*.rs > all.rs 2>/dev/null; timeout 30 sh -c 'rustc --test all.rs -o prog 2>/dev/null && ./prog' 2>/dev/null || true",
    parse: (raw) => {
      const tests = [];
      for (const l of String(raw).split("\n")) {
        const m = l.match(/^test\s+(\S+)\s+\.\.\.\s+(ok|FAILED)/);
        if (m) tests.push({ nome: m[1].replace(/^.*::/, ""), ok: m[2] === "ok" });
      }
      return tests;
    },
  },
};

// Semáforo — nunca mais do que CONC contentores em paralelo (protege a RAM).
let ativos = 0;
const fila = [];
async function comLimite(fn) {
  if (ativos >= CONC) await new Promise((r) => fila.push(r));
  ativos++;
  try {
    return await fn();
  } finally {
    ativos--;
    fila.shift()?.();
  }
}

const safe = (p) => basename(String(p)).replace(/[^\w.\-]/g, "_") || "f";

async function run(lang, studentFiles, testFiles) {
  const cfg = LANGS[lang];
  if (!cfg) return { tests: [], erro: `Linguagem "${lang}" não suportada por este grader.` };
  const dir = await mkdtemp(join(tmpdir(), "grader-"));
  const student = join(dir, "student");
  const tests = join(dir, "tests");
  await mkdir(student);
  await mkdir(tests);
  for (const f of studentFiles) await writeFile(join(student, safe(f.path)), String(f.content ?? ""));
  for (const f of testFiles) await writeFile(join(tests, safe(f.path)), String(f.content ?? ""));
  try {
    const { stdout } = await execFileP(
      "docker",
      [
        "run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
        "-v", `${student}:/work:rw`, "-v", `${tests}:/tests:ro`, "-w", "/work", cfg.image, "sh", "-c", cfg.cmd,
      ],
      { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
    );
    const raw = stdout.trim();
    if (!raw) return { tests: [], erro: "Os testes não produziram resultado (erro de compilação ou nenhum teste encontrado)." };
    return { tests: cfg.parse(raw) };
  } catch (e) {
    return { tests: [], erro: `Falha a correr os testes: ${String(e.message).slice(0, 160)}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function collect(lang, testFiles) {
  const cfg = LANGS[lang];
  if (!cfg || !cfg.collectCmd) return { nomes: [], erro: `Coleção não suportada para "${lang}".` };
  const dir = await mkdtemp(join(tmpdir(), "grader-col-"));
  const tests = join(dir, "tests");
  await mkdir(tests);
  for (const f of testFiles) await writeFile(join(tests, safe(f.path)), String(f.content ?? ""));
  if (cfg.conftest) await writeFile(join(tests, "conftest.py"), cfg.conftest);
  try {
    const { stdout } = await execFileP(
      "docker",
      [
        "run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
        "-v", `${tests}:/tests:ro`, "-w", "/tests", cfg.image, "sh", "-c", cfg.collectCmd,
      ],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }
    );
    return { nomes: cfg.collectParse(stdout) };
  } catch (e) {
    return { nomes: [], erro: `Falha na deteção: ${String(e.message).slice(0, 140)}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer((req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/health") return json(200, { ok: true, langs: Object.keys(LANGS), ativos, concorrencia: CONC });
  const rota = req.url === "/run" ? "run" : req.url === "/collect" ? "collect" : null;
  if (req.method !== "POST" || !rota) return json(404, { erro: "not found" });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { erro: "unauthorized" });

  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 4 * 1024 * 1024) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { lang, studentFiles, testFiles } = JSON.parse(body || "{}");
      if (!lang || !Array.isArray(testFiles)) return json(400, { erro: "body inválido: { lang, testFiles[] }" });
      if (rota === "collect") {
        const out = await comLimite(() => collect(lang, testFiles));
        return json(200, out);
      }
      if (!Array.isArray(studentFiles)) return json(400, { erro: "body inválido: { lang, studentFiles[], testFiles[] }" });
      const out = await comLimite(() => run(lang, studentFiles, testFiles));
      json(200, out);
    } catch (e) {
      json(500, { erro: String(e.message).slice(0, 160) });
    }
  });
});

server.listen(PORT, () => console.log(`Avalia grader :${PORT} — langs: ${Object.keys(LANGS).join(", ")}, concorrência ${CONC}${TOKEN ? " (com token)" : ""}`));
