// Avalia — grader remoto (worker).
// Serviço standalone (Node puro, sem dependências) que corre os testes do
// professor contra o código do aluno em contentores Docker isolados, com
// limite de concorrência. É o backend do modo RUNNER_MODE=remote do web app.
//
// Contrato:
//   POST /run   { lang, studentFiles:[{path,content}], testFiles:[{path,content}] }
//        -> 200 { tests:[{nome,ok}], erro? }
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

// Registo de linguagens — juntar uma = juntar a imagem Docker + o comando + o parser.
const LANGS = {
  python: {
    image: "avalia-runner-python",
    cmd: "PYTHONPATH=/work timeout 25 pytest /tests --json-report --json-report-file=/work/r.json -q >/dev/null 2>&1; cat /work/r.json 2>/dev/null || true",
    parse: (raw) => {
      const j = JSON.parse(raw);
      return (j.tests || []).map((t) => ({ nome: String(t.nodeid).split("::").pop(), ok: t.outcome === "passed" }));
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

const server = http.createServer((req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/health") return json(200, { ok: true, langs: Object.keys(LANGS), ativos, concorrencia: CONC });
  if (req.method !== "POST" || req.url !== "/run") return json(404, { erro: "not found" });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { erro: "unauthorized" });

  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 4 * 1024 * 1024) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { lang, studentFiles, testFiles } = JSON.parse(body || "{}");
      if (!lang || !Array.isArray(studentFiles) || !Array.isArray(testFiles)) return json(400, { erro: "body inválido: { lang, studentFiles[], testFiles[] }" });
      const out = await comLimite(() => run(lang, studentFiles, testFiles));
      json(200, out);
    } catch (e) {
      json(500, { erro: String(e.message).slice(0, 160) });
    }
  });
});

server.listen(PORT, () => console.log(`Avalia grader :${PORT} — langs: ${Object.keys(LANGS).join(", ")}, concorrência ${CONC}${TOKEN ? " (com token)" : ""}`));
