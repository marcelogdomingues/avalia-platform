#!/usr/bin/env node
// CLI da Avalia: corre o autograder de um trabalho contra um ficheiro local.
// Usa o MESMO endpoint que a extensão VSCode (/api/testar) — serve de referência
// do contrato e de ferramenta para terminal/CI.
//
// Uso:
//   node editor/avalia-cli.mjs --token <TOKEN> --file solucao.py [--url http://localhost:3000]
//   AVALIA_TOKEN=<TOKEN> node editor/avalia-cli.mjs solucao.py
// Sai com código 0 se o gate passou, 1 caso contrário (bom para CI).
import fs from "node:fs";

function arg(nome, curto) {
  const i = process.argv.findIndex((a) => a === nome || (curto && a === curto));
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = (arg("--url") || process.env.AVALIA_URL || "http://localhost:3000").replace(/\/$/, "");
const token = arg("--token", "-t") || process.env.AVALIA_TOKEN;
const file = arg("--file", "-f") || process.argv.slice(2).find((a) => !a.startsWith("-") && fs.existsSync(a));

if (!token || !file) {
  console.error("Uso: avalia-cli --token <TOKEN> --file <ficheiro> [--url <base>]");
  process.exit(2);
}
if (!fs.existsSync(file)) { console.error(`Ficheiro não encontrado: ${file}`); process.exit(2); }

const code = fs.readFileSync(file, "utf8");
// Por defeito o servidor testa o código como `solution.<ext>` (o nome que os
// testes esperam importar). Só forçamos um nome com --as se o utilizador pedir.
const filename = arg("--as");

const res = await fetch(`${url}/api/testar`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, code, ...(filename ? { filename } : {}) }),
}).catch((e) => { console.error(`Servidor inacessível (${url}): ${e.message}`); process.exit(2); });

const data = await res.json();
if (!res.ok || !data.ok) { console.error(`Erro: ${data?.erro ?? res.status}`); process.exit(2); }

const g = "\x1b[32m", r = "\x1b[31m", dim = "\x1b[2m", z = "\x1b[0m";
console.log(`${data.trabalho} (${data.lang})`);
for (const t of data.testes) {
  console.log(`  ${t.ok ? g + "✓" : r + "✗"}${z} ${t.nome}${t.obrigatorio ? "" : dim + " (opcional)" + z}${t.ms != null ? dim + `  ${t.ms}ms` + z : ""}`);
}
if (data.erro) console.log(`\n${r}Erro de execução:${z}\n${data.erro}`);
console.log(`\n${data.passed}/${data.total} testes · gate ${data.gateMet ? g + "PASSOU" : r + "falhou"}${z}`);
process.exit(data.gateMet ? 0 : 1);
