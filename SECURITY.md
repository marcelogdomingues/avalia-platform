# Política de segurança

O Avalia lida com dados de alunos e executa código submetido por eles, por isso levamos
a segurança a sério.

## Reportar uma vulnerabilidade

**Não abras uma issue pública.** Usa o
[reporte privado do GitHub](https://github.com/marcelogdomingues/avalia-platform/security/advisories/new)
com a descrição, o impacto e os passos para reproduzir. Respondemos o mais depressa possível
e combinamos a divulgação depois de haver correção.

## Âmbito

Especialmente relevante:
- fuga do sandbox do autograder (`runner/`, `lib/runner.ts`, `grader/`);
- quebra do isolamento multi-tenant (um docente a ver dados de outro);
- falsificação de sessões ou escalada de privilégios aluno → docente;
- prompt injection que altere notas sem intervenção do docente.

## Versões suportadas

Só a versão mais recente (`main`) recebe correções de segurança.

Checklist de produção e desenho do sandbox: [`docs/SEGURANCA.md`](docs/SEGURANCA.md).
