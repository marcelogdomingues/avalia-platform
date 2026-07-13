// Extensão VSCode: corre o autograder da Avalia contra o ficheiro atual.
// Sem dependências externas — usa apenas a API do VSCode e o fetch do Node 18+.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/** Descobre o token: config → ficheiro .avalia na pasta do projeto. */
function descobrirToken(doc) {
  const cfg = vscode.workspace.getConfiguration("avalia").get("token");
  if (cfg) return cfg.trim();
  const pasta = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (pasta) {
    const f = path.join(pasta.uri.fsPath, ".avalia");
    try {
      const t = fs.readFileSync(f, "utf8").trim();
      if (t) return t.split(/\r?\n/)[0].trim();
    } catch { /* sem ficheiro .avalia */ }
  }
  return "";
}

async function testar() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Avalia: abre o ficheiro a testar.");

  const doc = editor.document;
  const code = doc.getText();
  if (!code.trim()) return vscode.window.showWarningMessage("Avalia: o ficheiro está vazio.");

  const token = descobrirToken(doc);
  if (!token) {
    const r = await vscode.window.showWarningMessage("Avalia: falta o token do trabalho.", "Definir agora");
    if (r === "Definir agora") await definirToken();
    return;
  }

  const base = (vscode.workspace.getConfiguration("avalia").get("serverUrl") || "http://localhost:3000").replace(/\/$/, "");
  // O servidor testa o código como `solution.<ext>` (o nome que os testes esperam).
  // Não enviamos o nome local para não quebrar imports.

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Avalia: a correr os testes…" },
    async () => {
      let data;
      try {
        const res = await fetch(`${base}/api/testar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, code }),
        });
        data = await res.json();
        if (!res.ok || !data.ok) {
          return vscode.window.showErrorMessage(`Avalia: ${data && data.erro ? data.erro : "erro " + res.status}.`);
        }
      } catch (e) {
        return vscode.window.showErrorMessage(`Avalia: servidor inacessível (${base}). ${String(e.message || e)}`);
      }
      mostrarResultado(data);
    },
  );
}

const canal = vscode.window.createOutputChannel("Avalia");

function mostrarResultado(data) {
  const { passed, total, gateMet, testes = [], erro, duracaoMs, trabalho } = data;
  canal.clear();
  canal.appendLine(`Avalia — ${trabalho || "trabalho"} (${data.lang})`);
  canal.appendLine("─".repeat(48));
  for (const t of testes) {
    canal.appendLine(`${t.ok ? "✓" : "✗"} ${t.nome}${t.obrigatorio ? "" : "  (opcional)"}${t.ms != null ? `  ${t.ms}ms` : ""}`);
  }
  if (erro) { canal.appendLine("─".repeat(48)); canal.appendLine("Erro de execução:\n" + erro); }
  canal.appendLine("─".repeat(48));
  canal.appendLine(`${passed}/${total} testes · gate ${gateMet ? "PASSOU" : "falhou"}${duracaoMs != null ? ` · ${duracaoMs}ms` : ""}`);
  canal.show(true);

  const resumo = `Avalia: ${passed}/${total} testes${gateMet ? " · gate ✓" : ""}`;
  if (gateMet) vscode.window.showInformationMessage(resumo);
  else vscode.window.showWarningMessage(resumo + (erro ? " · erro de execução" : ""));
}

async function definirToken() {
  const valor = await vscode.window.showInputBox({
    prompt: "Token do trabalho (do link de submissão da Avalia)",
    ignoreFocusOut: true,
  });
  if (valor && valor.trim()) {
    await vscode.workspace.getConfiguration("avalia").update("token", valor.trim(), vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage("Avalia: token guardado para este projeto.");
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("avalia.testar", testar),
    vscode.commands.registerCommand("avalia.definirToken", definirToken),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
