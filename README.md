# Avalia — Plataforma de Avaliação Automática

[![CI](https://github.com/marcelogdomingues/avalia-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/marcelogdomingues/avalia-platform/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

> **English summary:** Avalia is an open-source, multi-tenant platform for AI-assisted
> grading of student work. Teachers define rubrics, students submit, an LLM pre-grades
> each criterion with a justification, and the teacher always reviews and approves.
> Includes a sandboxed autograder (12 languages), academic-integrity tools and a
> provider-agnostic LLM engine (free open-source models or fully on-prem).

Pré-avaliação de trabalhos académicos com IA e validação humana obrigatória.
Genérica e multi-tenant: qualquer professor regista-se, cria cadeiras e trabalhos com
rubrica própria, os alunos submetem, a IA pré-avalia por critério, e o professor revê,
aprova e exporta as notas.

Motor **agnóstico de fornecedor** (API compatível com OpenAI): POC com modelo
open-source gratuito (Groq/OpenRouter), produção on-prem (vLLM/Ollama) sem mudar código.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 (SQLite em dev, Postgres em
produção) · SDK `openai` (qualquer endpoint compatível) · Docker (autograder).

## Arranque (zero configuração)

Requisitos: **Node.js 20.19+** (recomendado 22 LTS). Docker só é preciso para o autograder.

SQLite (sem BD a instalar) e **modo demo** sem chave de API. Quatro comandos:

```bash
npm install
cp .env.example .env              # sem chave de LLM → modo demo
npm run db:push && npm run seed   # BD SQLite + dados de exemplo
npm run dev                       # http://localhost:3000
```

Logins de exemplo criados pelo seed:
- Professor: **prof@exemplo.pt** / **demo1234**
- Aluno: **aluno@exemplo.pt** / **demo1234**

## Funcionalidades

**Professor**
- **Auth** — registo, login, logout (sessão por cookie assinado, password com scrypt).
- **Cadeiras** — criar/apagar, isoladas por professor (multi-tenant).
- **Trabalhos com rubric builder** — enunciado, tipos de ficheiro, critérios com peso e
  escala, instruções extra e solução-modelo, feedback imediato ao aluno. **Editável.**
- **IA na criação** — sugerir enunciado, gerar rubrica, analisar resistência do enunciado à IA.
- **Fila de revisão** — rever, ajustar nota final, **aprovar**, **re-avaliar**, **aprovar todas** (lote),
  navegação por teclado (J/K).
- **Banco de comentários** — atalhos de feedback reutilizáveis (guardar/inserir/contar usos).
- **Melhorar feedback com IA** — reescreve num tom (encorajador/direto/conciso).
- **Vista Integridade** — grafo de similaridade, grupos de cópia (clusters), proximidade à
  resposta-tipo de IA, e **comparação lado-a-lado** com texto partilhado realçado.
- **Analytics profundos** — calibração IA-vs-professor, critérios mais fracos, alunos em risco,
  **mapa de calor aluno×critério**, insights da turma (IA), e **analytics ao nível da cadeira**
  (matriz de progresso, médias, tendência).
- **Fila** — pesquisa, ordenação (nota/sinal/data), filtro por turma, navegação J/K;
  **ver a submissão** do aluno (conteúdo extraído) e **correção anónima** (blind marking).
- **Avaliação manual** — lançar nota sem ficheiro (oral, apresentação, participação).
- **Relatório imprimível/PDF** e **export CSV** (Moodle); **duplicar trabalho**;
  **modelos de rubrica** reutilizáveis; **abrir/fechar** submissões.
- **Simulador de curva** de notas; painel **"Precisa de atenção"** (por aprovar / recursos).

**Configuração por trabalho, para qualquer faculdade**
- **Escalas de notação**: 0–20, 0–100, letras A–F, ECTS, aprovado/reprovado (a IA/rubrica
  mantém-se em 0–20 interno; só a apresentação muda).
- **Prazos** + política de fora de prazo (bloquear / aceitar marcando) + **penalização** %/dia.
- **Trabalhos de grupo** (membros), **turmas/turnos** (filtro + estatísticas), **avaliação por pares**.

**Aluno**
- **Contas de aluno** — registo/login; submissões associadas à conta.
- **Portal** — trabalhos, notas, feedback, linha do tempo e **feed de notificações**.
- **Tutor socrático (IA)** — ajuda a melhorar com pistas, **sem dar a resposta**; a IA
  **explica testes falhados** sem dar a solução.
- **Entrevista de defesa** · **avaliação por pares** (avaliar colega anónimo) · **pedido de revisão**.
- **Boletim de notas** imprimível/PDF · **recibo** por link (`/recibo/[id]`).

**Cadeiras**: multi-tenant, **arquiváveis**; analytics ao nível da cadeira (matriz de progresso).

**Motor**
- **Pré-avaliação IA** — nota e justificação por critério (modelo demo OU LLM real).
- **Extração real** — PDF, DOCX, TXT, ZIP de código; **imagens** (visão) no caminho LLM.

## Combate ao abuso de IA

Postura **detetar e dissuadir**, em quatro frentes:
- **Deteção de uso de IA** — sinal probabilístico (0–100%) com indicadores, sobre texto *e código*.
- **Linha-base de IA** — resposta que uma IA genérica daria ao enunciado, para medir proximidade.
- **Perguntas de defesa** — geradas por submissão; o aluno responde e a IA avalia a **consistência**
  das respostas com o trabalho (indício de autoria real).
- **Rubrica resistente a IA** — critérios que exigem autoria autêntica (reflexão, defesa de escolhas).

## Autograder (testes de código em sandbox)

Trabalhos de código correm os **testes do professor** contra o código do aluno num contentor
**Docker isolado** (`--network none --memory 512m --cpus 1 --pids-limit 128`, testes read-only,
timeout). O aluno **tem de passar os testes obrigatórios para submeter**; os opcionais contam para
a nota mas não bloqueiam. Tempo de execução (total e por-teste) mostrado no UI.

- **12 linguagens**: Python (pytest), Java (JUnit 5), JavaScript e TypeScript (node:test),
  Go (go test), Ruby (minitest), C e C++ (gcc/g++, TAP), PHP (TAP), Rust (rustc --test),
  Dart e Kotlin (TAP). Juntar outra = imagem `runner/Dockerfile.<lang>` + entrada em
  `lib/runner.ts` (e `grader/server.mjs`). Constrói todas com `bash scripts/build-runners.sh`.
- **Deteção exata** de testes (ex.: `pytest --collect-only`) além da heurística por regex.
- **Sandbox comprovado**: loop infinito (timeout), fork bomb (pids-limit), memory bomb (OOM),
  acesso à rede (network none) e erros de compilação → todos bloqueados.
- **Pluggable para produção**: `RUNNER_MODE=docker|remote|off`. Vercel não corre Docker → usa
  `remote` com um grader externo (ver [`grader/README.md`](grader/README.md)).

Construir as imagens (uma vez — todas, ou só as linguagens que usas):

```bash
bash scripts/build-runners.sh
# ou uma a uma, ex.:
docker build -t avalia-runner-python -f runner/Dockerfile.python runner
```

## Testar do editor (VSCode, IntelliJ, CLI)

Os alunos podem correr o autograder **antes de submeter**, a partir do editor ou do
terminal, via o endpoint `POST /api/testar` (reutiliza o mesmo sandbox Docker e nunca
devolve o código dos testes). Inclui **CLI** (bom para CI, sai 0/1 conforme o gate),
**extensão VSCode** e **esqueleto de plugin IntelliJ**. Ver [`editor/README.md`](editor/README.md).

```bash
AVALIA_TOKEN=<token-do-trabalho> node editor/avalia-cli.mjs solucao.py
```

## Notificações por email (opcional)

Quando o docente publica uma nota, o aluno pode ser avisado por email. Pluggable
como o runner: `NOTIFY_MODE=off|log|webhook`. Em `log` escreve no stdout do
servidor (dev/CI); em `webhook` faz `POST { para, assunto, corpo }` a `NOTIFY_URL`
(liga a SendGrid/SES/…). Best-effort — nunca bloqueia a publicação da nota.

## Avaliação real (opcional)

Modo demo usa uma heurística. Para avaliação real com modelo open-source, mete uma chave
grátis no `.env` (ver `.env.example` para alternativas e on-prem) e reinicia:

```bash
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_...            # grátis em https://console.groq.com/keys
LLM_MODEL=openai/gpt-oss-120b  # ou llama-3.3-70b-versatile, qwen/qwen3-32b
```

On-prem (dados nunca saem da instituição): aponta `LLM_BASE_URL` a um vLLM ou Ollama local.

## Estrutura

```
app/
  page.tsx                              # landing pública
  login/ · registo/                     # auth
  professor/
    layout.tsx                          # shell (sidebar) + guarda de auth
    page.tsx                            # dashboard: cadeiras
    cadeira/[courseId]/page.tsx         # trabalhos + criar trabalho (rubric builder)
    cadeira/[courseId]/page.tsx         # trabalhos + analytics da cadeira (matriz de progresso)
    trabalho/[assignmentId]/page.tsx    # fila de revisão, integridade, análises
    trabalho/[assignmentId]/relatorio/  # relatório imprimível/PDF
    trabalho/[assignmentId]/comparar/   # comparação lado-a-lado de submissões
    trabalho/[assignmentId]/export/     # CSV das notas
  aluno/page.tsx                        # portal do aluno (tutor, defesa, recurso)
  submeter/[token]/page.tsx             # submissão do aluno (+ autograder ao vivo)
components/                            # ProfessorPortal, StudentPortal, TestSuiteEditor, …
lib/
  auth.ts                              # sessão, hashing (scrypt)
  actions.ts                           # server actions
  llm.ts · evaluate.ts                 # avaliador + IA (deteção, defesa, tutor, insights)
  runner.ts                            # autograder (Docker), 12 linguagens, gate, deteção exata
  similaridade.ts · diff.ts · stats.ts # integridade, diff palavra-a-palavra, estatísticas
  extract.ts · pipeline.ts · db.ts     # extração, orquestração, Prisma
runner/Dockerfile.<lang>               # imagens do autograder (uma por linguagem)
grader/                                # grader remoto (RUNNER_MODE=remote) + README
prisma/schema.prisma                   # Professor, Course, Assignment, Submission, Evaluation, …
prisma.config.ts                       # configuração do Prisma CLI (URL da BD)
editor/                                # CLI, extensão VSCode, esqueleto IntelliJ
scripts/                               # seed.ts (dados ricos + autograder real), smoke.mjs, build-runners.sh
tests/                                 # testes unitários (node:test)
docs/                                  # PROJETO, MODELO-DADOS, CUSTOS
```

## Documentação

- [`docs/PROJETO.md`](docs/PROJETO.md) — visão, fluxos, roadmap, riscos.
- [`docs/MODELO-DADOS.md`](docs/MODELO-DADOS.md) — modelo de dados.
- [`docs/CUSTOS.md`](docs/CUSTOS.md) — open-source gratuito → on-prem; custos.
- [`docs/SEGURANCA.md`](docs/SEGURANCA.md) — sandbox, sessões, isolamento, checklist de produção.
- [`grader/README.md`](grader/README.md) — grader remoto para produção.

## Segurança

- Sessões assinadas por HMAC; **`AUTH_SECRET` obrigatório em produção** (ver `.env.example`),
  cookies `secure` em produção.
- Código de aluno corre **sempre** em sandbox Docker isolado (ver Autograder).
- `.env` nunca é versionado. Se partilhaste chaves de API, **roda-as**.

## Testes

```bash
npm test             # testes unitários
npm run dev          # noutro terminal
npm run smoke        # verifica rotas-chave (público/professor/aluno) via cookies assinados
```

A CI (GitHub Actions) corre type-check, testes unitários e build em cada push/PR.

## Estado

Fluxo completo funcional e verificado (`npm run build` + `npm test` + `npm run smoke`). Feito face
ao roadmap original: **execução de código em sandbox** (12 linguagens), **analytics** (turma e
cadeira), **visão/imagens** no caminho LLM. Por fazer: integração LTI 1.3 com o Moodle, autenticação
SSO institucional, fila de avaliação com workers, e medição sistemática da concordância IA–docente.
Ver [`CHANGELOG.md`](CHANGELOG.md).

## Contribuir

Contribuições são bem-vindas — ver [`CONTRIBUTING.md`](CONTRIBUTING.md). Para reportar uma
vulnerabilidade, segue [`SECURITY.md`](SECURITY.md) (não abras issue pública).

## Licença

[MIT](LICENSE) © 2026 Marcelo Domingues
