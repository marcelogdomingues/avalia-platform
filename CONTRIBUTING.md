# Contribuir para o Avalia

Obrigado pelo interesse! Este guia resume como montar o ambiente e propor alterações.

## Ambiente

Requisitos: Node.js 20.19+ (recomendado 22 LTS). Docker é opcional (só para o autograder).

```bash
npm install
cp .env.example .env              # sem chave de LLM → modo demo
npm run db:push && npm run seed
npm run dev                       # http://localhost:3000
```

Logins de exemplo: `prof@exemplo.pt` / `aluno@exemplo.pt`, password `demo1234`.

## Antes de abrir um PR

```bash
npx tsc --noEmit    # type-check
npm test            # testes unitários
npm run build       # build de produção
npm run smoke       # com o servidor a correr: rotas-chave (professor/aluno)
```

A CI corre type-check, testes e build em cada PR.

## Convenções

- Código e UI em **português de Portugal**; textos da interface passam por `lib/i18n.ts` (PT/EN).
- Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:` …), uma alteração lógica por commit.
- Regista mudanças visíveis na secção **[Não lançado]** do [`CHANGELOG.md`](CHANGELOG.md).
- Funções puras novas (cálculo de notas, similaridade, estatísticas) devem ter teste em `tests/`.

## Princípios que não se negociam

- **Humano no circuito:** a IA nunca publica uma nota sozinha; o docente aprova sempre.
- **Conteúdo do aluno é dados, não instruções** — nunca o concatenes ao prompt sem delimitação.
- **Código do aluno corre sempre em sandbox** (ver [`docs/SEGURANCA.md`](docs/SEGURANCA.md)).
- **Nada de dados reais de alunos** em issues, PRs, fixtures ou seeds.

## Reportar problemas

Abre uma issue com passos para reproduzir, o esperado e o observado. Vulnerabilidades de
segurança **não** vão para issues públicas — ver [`SECURITY.md`](SECURITY.md).
