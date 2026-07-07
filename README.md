# Avalia — Plataforma de Avaliação Automática

Pré-avaliação de trabalhos académicos com IA e validação humana obrigatória.
Genérica e multi-tenant: qualquer professor faz onboarding da sua cadeira, define trabalhos
e rubricas, os alunos submetem, e a IA pré-avalia para o professor só rever e aprovar.

Motor **agnóstico de fornecedor** (API compatível com OpenAI): POC com modelo
open-source gratuito (Groq/OpenRouter), produção on-prem (vLLM/Ollama) sem mudar código.

## Arranque (zero configuração)

A POC usa **SQLite** (sem base de dados a instalar) e corre em **modo demo** sem chave
de API. Três comandos e tens a app a funcionar:

```bash
npm install
npm run db:push && npm run seed   # cria a BD SQLite + dados de exemplo
npm run dev                       # abre http://localhost:3000
```

- **Painel do professor:** http://localhost:3000/professor — vê submissões e aprova notas.
- **Submissão do aluno:** o link aparece no painel (`/submeter/<token>`).

### Ver o pipeline em texto (sem browser)

```bash
npm run demo   # cria 2 submissões de exemplo, avalia e imprime o resultado
```

### Avaliação real (opcional, quando quiseres)

Modo demo usa uma heurística só para demonstrar o fluxo. Para avaliação real com um
modelo open-source, mete uma chave grátis no `.env` (ver `.env.example`):

```bash
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_...            # grátis em https://console.groq.com/keys
LLM_MODEL=llama-3.3-70b-versatile
```

Reinicia (`npm run dev`) e passa a avaliar com o modelo real. Nada mais muda.

## Estrutura

```
app/
  page.tsx                     # home
  professor/page.tsx           # painel: submissões + aprovar notas
  submeter/[token]/page.tsx    # formulário de submissão do aluno
  api/evaluate/route.ts        # endpoint de avaliação (uso programático)
lib/
  llm.ts                       # cliente LLM agnóstico (OpenAI-compatible)
  evaluate.ts                  # NÚCLEO: avalia vs rubrica (LLM real OU modo demo)
  extract.ts                   # extração real de PDF/DOCX/TXT/ZIP
  pipeline.ts                  # submissão → extração → avaliação → gravação
  actions.ts                   # server actions (submeter, aprovar)
  db.ts                        # cliente Prisma
prisma/schema.prisma           # Professor, Course, Assignment, Submission, Evaluation
scripts/                       # seed.ts (dados exemplo), demo.ts (pipeline)
docs/                          # PROJETO, MODELO-DADOS, CUSTOS
```

## Documentação

- [`docs/PROJETO.md`](docs/PROJETO.md) — visão, fluxos, MVP, roadmap, riscos (PRD).
- [`docs/MODELO-DADOS.md`](docs/MODELO-DADOS.md) — modelo de dados e decisões de schema.
- [`docs/CUSTOS.md`](docs/CUSTOS.md) — open-source gratuito → on-prem; qualidade e custos.

## Estado

Funciona ponta-a-ponta: extração real de ficheiros, avaliação (demo + LLM real),
persistência, painel do professor com aprovação, submissão do aluno. Verificado com
`npm run build` e `npm run demo`.

Por fazer (roadmap em `docs/PROJETO.md`): auth de professores, criação de trabalhos pela
UI (por agora via `seed`/BD), export CSV para Moodle, visão para slides, integração LTI.
