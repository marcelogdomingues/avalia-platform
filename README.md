# Avalia — Plataforma de Avaliação Automática

Pré-avaliação de trabalhos académicos com IA (Claude) e validação humana obrigatória.
Genérica e multi-tenant: qualquer professor faz onboarding da sua cadeira, define trabalhos
e rubricas, os alunos submetem, e a IA pré-avalia para o professor só rever e aprovar.

## Documentação

- [`docs/PROJETO.md`](docs/PROJETO.md) — visão, fluxos, MVP, roadmap, riscos (PRD).
- [`docs/MODELO-DADOS.md`](docs/MODELO-DADOS.md) — modelo de dados e decisões de schema.
- [`docs/CUSTOS.md`](docs/CUSTOS.md) — custos por trabalho e escolha de modelo Claude.

## Estrutura

```
app/
  api/evaluate/route.ts   # endpoint que dispara a avaliação IA
  page.tsx, layout.tsx    # shell mínimo
lib/
  anthropic.ts            # cliente Claude + modelo default
  evaluate.ts             # NÚCLEO: avalia submissão vs rubrica (structured output)
  extract.ts              # extração de conteúdo (PDF/DOCX/ZIP) — stub MVP
prisma/
  schema.prisma           # Professor, Course, Assignment, Submission, Evaluation
docs/                     # os 3 documentos acima
```

## Arranque local

```bash
npm install
cp .env.example .env       # preencher ANTHROPIC_API_KEY e DATABASE_URL
npm run db:push            # cria as tabelas no Postgres
npm run dev
```

Testar o avaliador (com Postgres opcional — o endpoint aceita payload inline):

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "enunciado": "Escreve um relatório sobre ordenação em O(n log n).",
    "rubrica": [
      {"id":"c1","nome":"Correção","descricao":"Explica o algoritmo corretamente","peso":60,"pontosMax":20},
      {"id":"c2","nome":"Clareza","descricao":"Texto claro e bem estruturado","peso":40,"pontosMax":20}
    ],
    "conteudoExtraido": "O merge sort divide o array ao meio recursivamente..."
  }'
```

## Estado

Esqueleto de Fase 1 (MVP). Implementado: motor de avaliação com structured output,
endpoint, schema de dados. Por implementar: extração real de ficheiros, persistência,
auth, UI de validação, export CSV. Ver roadmap em `docs/PROJETO.md`.
