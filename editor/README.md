# Testar submissões a partir do editor

Corre o autograder da Avalia contra o teu código **antes de submeter** — no
terminal, no VSCode ou no IntelliJ. Tudo assenta num único endpoint da
plataforma que reutiliza o **sandbox Docker** já existente (rede desligada,
limites de CPU/memória/processos, timeout). O código dos testes nunca é
devolvido; só o nome de cada teste e se passou.

## O endpoint

```
POST /api/testar
Content-Type: application/json
{ "token": "<token do trabalho>", "code": "<o teu código>", "filename": "solution.py" (opcional) }
```

Resposta:

```json
{
  "ok": true,
  "trabalho": "Funções: soma e média (Python)",
  "lang": "python",
  "passed": 3, "total": 5, "gateMet": false,
  "obrigatoriosPassed": 3, "obrigatoriosTotal": 4,
  "duracaoMs": 820,
  "testes": [{ "nome": "test_soma_positivos", "ok": true, "obrigatorio": true, "ms": 12 }]
}
```

- **token** — é o token público do link de submissão do trabalho. Isola o acesso
  a esse trabalho.
- **filename** — opcional. Por omissão o servidor testa o código como
  `solution.<ext>`, que é o nome que os testes esperam importar. Só o envia se
  souberes que o trabalho espera outro nome.
- Limites: código até 200 KB; 20 pedidos/min por token+IP.

## CLI (terminal / CI)

```bash
node editor/avalia-cli.mjs --token <TOKEN> --file solucao.py
# ou
AVALIA_TOKEN=<TOKEN> node editor/avalia-cli.mjs solucao.py
```

Sai com código **0** se o gate passou, **1** caso contrário — pronto para CI.
Opções: `--url <base>` (por omissão `http://localhost:3000`), `--as <nome>`
para forçar o nome do ficheiro.

## Extensão VSCode (`vscode-avalia/`)

1. Copia a pasta `vscode-avalia/` para `~/.vscode/extensions/` (ou abre-a em
   VSCode e faz **F5** para correr em modo de desenvolvimento).
2. Define o token: paleta de comandos → **Avalia: Definir token do trabalho**
   (ou coloca um ficheiro `.avalia` na raiz do projeto com o token).
3. Abre o teu ficheiro e corre **Avalia: Testar ficheiro atual**. Os resultados
   aparecem no canal de saída "Avalia".

Configuração: `avalia.serverUrl` e `avalia.token` nas definições.

## Plugin IntelliJ (`intellij-avalia/`)

Esqueleto Gradle/Kotlin (requer o SDK IntelliJ para compilar — não é construído
no ambiente da plataforma):

```bash
cd editor/intellij-avalia
./gradlew buildPlugin        # gera build/distributions/*.zip
./gradlew runIde             # abre uma IntelliJ de testes com o plugin
```

Config: variáveis de ambiente `AVALIA_URL` / `AVALIA_TOKEN`, ou um ficheiro
`.avalia` na raiz do projeto. Ação em **Tools → Avalia: Testar ficheiro atual**
(atalho `Ctrl+Alt+A`).

## Segurança

O endpoint corre código não confiável — mantém o sandbox Docker do servidor
(`RUNNER_MODE=docker`). Em produção, considera: autenticação por sessão do aluno
além do token, rate-limit distribuído e execução no grader remoto
(`RUNNER_MODE=remote`, `RUNNER_URL`).
