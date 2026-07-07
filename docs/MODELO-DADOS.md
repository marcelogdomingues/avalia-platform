# Modelo de dados

O schema completo está em `prisma/schema.prisma`. Este documento explica as decisões.

## Diagrama (texto)

```
Professor 1───* Course 1───* Assignment 1───* Submission 1───1 Evaluation
```

Tudo pende de `Professor` → isolamento multi-tenant simples (filtrar por `professorId`).

## A rubrica (o coração do builder)

Guardada como **JSON** no campo `Assignment.rubrica`, não como tabelas rígidas. Porquê:
o professor constrói livremente a sua avaliação; JSON evita migrações de schema por cada
formato de rubrica e mantém a plataforma genérica.

Estrutura de cada critério:

```json
{
  "id": "c1",
  "nome": "Correção técnica",
  "descricao": "O código/análise está correto e resolve o problema proposto.",
  "peso": 40,            // peso relativo (a soma dos pesos deve dar 100)
  "pontosMax": 20        // escala do critério (ex: 0–20)
}
```

Exemplo completo de `rubrica`:

```json
[
  { "id": "c1", "nome": "Correção técnica",   "descricao": "...", "peso": 40, "pontosMax": 20 },
  { "id": "c2", "nome": "Qualidade do texto", "descricao": "...", "peso": 30, "pontosMax": 20 },
  { "id": "c3", "nome": "Estrutura e clareza","descricao": "...", "peso": 30, "pontosMax": 20 }
]
```

## A avaliação (output da IA)

`Evaluation.porCriterio` espelha a rubrica, mas com o resultado:

```json
[
  { "criterioId": "c1", "nome": "Correção técnica", "pontos": 16, "pontosMax": 20,
    "justificacao": "Resolve o problema principal mas falha o caso limite X." },
  { "criterioId": "c2", "nome": "Qualidade do texto", "pontos": 18, "pontosMax": 20,
    "justificacao": "Bem escrito, ligeiros erros de pontuação." }
]
```

- `notaIA` = soma ponderada calculada a partir de `porCriterio` + pesos da rubrica.
- `notaFinal` = valor que o professor confirma/ajusta ao aprovar. Só isto conta como nota oficial.
- `estado` percorre `PENDENTE → RASCUNHO → APROVADO` (ou `ERRO`).

## Ficheiros e conteúdo extraído

- `Submission.ficheiros` (JSON): metadados + `storageKey` para o object storage (S3).
- `Submission.conteudoExtraido`: texto normalizado que o avaliador consome. A extração
  acontece no worker antes da avaliação:
  - PDF/DOCX → texto
  - ZIP de código → árvore de ficheiros concatenada com marcadores por ficheiro
  - imagem/slides → (Fase 2) visão do Claude

## Multi-tenant e RGPD

- Isolamento por `professorId` em todas as queries (row-level, aplicado na camada de acesso).
- `alunoNumero` existe para casar com o gradebook do Moodle no export CSV.
- Retenção: definir job de expurgo de submissões após N meses (a definir por política).

## Índices

Definidos em `professorId`, `courseId`, `assignmentId` — os caminhos de query mais comuns
(listar cadeiras de um professor, trabalhos de uma cadeira, submissões de um trabalho).
