# Avalia — Plataforma de Avaliação Automática

Pré-avaliação de trabalhos académicos com IA e validação humana obrigatória.
Genérica e multi-tenant: qualquer professor regista-se, cria cadeiras e trabalhos com
rubrica própria, os alunos submetem, a IA pré-avalia por critério, e o professor revê,
aprova e exporta as notas.

Motor **agnóstico de fornecedor** (API compatível com OpenAI): POC com modelo
open-source gratuito (Groq/OpenRouter), produção on-prem (vLLM/Ollama) sem mudar código.

## Arranque (zero configuração)

SQLite (sem BD a instalar) e **modo demo** sem chave de API. Três comandos:

```bash
npm install
npm run db:push && npm run seed   # BD SQLite + dados de exemplo
npm run dev                       # http://localhost:3000
```

Login de exemplo criado pelo seed: **prof@exemplo.pt** / **demo1234**
(ou cria a tua conta em `/registo`).

## Funcionalidades

- **Auth de professores** — registo, login, logout (sessão por cookie assinado, password com scrypt).
- **Cadeiras** — criar/apagar, isoladas por professor (multi-tenant).
- **Trabalhos com rubric builder** — enunciado, tipos de ficheiro aceites, critérios com
  peso e escala, instruções extra e solução-modelo opcionais, feedback imediato ao aluno.
- **Submissão do aluno** por link público — PDF, DOCX, TXT ou ZIP de código (extração real).
- **Pré-avaliação IA** — nota e justificação por critério (modelo demo OU LLM real).
- **Validação** — rever, ajustar a nota final, **aprovar**; **re-avaliar** quando quiser.
- **Export CSV** das notas (formato para importar no gradebook do Moodle).

## Avaliação real (opcional)

Modo demo usa uma heurística. Para avaliação real com modelo open-source, mete uma chave
grátis no `.env` (ver `.env.example`) e reinicia:

```bash
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_...            # grátis em https://console.groq.com/keys
LLM_MODEL=llama-3.3-70b-versatile
```

## Estrutura

```
app/
  page.tsx                              # landing pública
  login/ · registo/                     # auth
  professor/
    layout.tsx                          # shell (sidebar) + guarda de auth
    page.tsx                            # dashboard: cadeiras
    cadeira/[courseId]/page.tsx         # trabalhos + criar trabalho (rubric builder)
    trabalho/[assignmentId]/page.tsx    # submissões, aprovar, re-avaliar
    trabalho/[assignmentId]/export/     # CSV das notas
  submeter/[token]/page.tsx             # submissão do aluno (+ resultado imediato)
components/CriarTrabalho.tsx            # rubric builder (client)
lib/
  auth.ts                              # sessão, hashing (scrypt)
  actions.ts                           # server actions (auth, cadeiras, trabalhos, validação)
  llm.ts · evaluate.ts                 # avaliador agnóstico (demo + LLM real)
  extract.ts · pipeline.ts · db.ts     # extração, orquestração, Prisma
prisma/schema.prisma                   # Professor, Course, Assignment, Submission, Evaluation
scripts/                               # seed.ts, demo.ts
docs/                                  # PROJETO, MODELO-DADOS, CUSTOS
```

## Documentação

- [`docs/PROJETO.md`](docs/PROJETO.md) — visão, fluxos, roadmap, riscos.
- [`docs/MODELO-DADOS.md`](docs/MODELO-DADOS.md) — modelo de dados.
- [`docs/CUSTOS.md`](docs/CUSTOS.md) — open-source gratuito → on-prem; custos.

## Estado

Fluxo completo funcional e verificado (`npm run build`). Por fazer (roadmap): visão para
slides/imagens, execução de código em sandbox, integração LTI/API com o Moodle, analytics.
