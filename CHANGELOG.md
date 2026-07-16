# Changelog

Todas as entregas notáveis do Avalia ficam registadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

_Nada por lançar de momento._

## [0.1.0] — 2026-07-16

Primeira release registada. Marca a plataforma Avalia end-to-end: submissão,
autograder, avaliação assistida por IA (com anti-abuso), revisão do professor e
portal do aluno — tudo verificado (build de produção, 18 testes unitários, smoke
de 13 fluxos).

### Autograder (código)
- Testes do professor que **gateiam** a submissão em sandbox Docker isolado.
- 12 linguagens: Python, JavaScript, TypeScript, Go, Ruby, Java, C, C++, PHP, Rust, Dart, Kotlin.
- Editor de testes na UI + **geração de testes com IA** + deteção exata de nomes de teste.
- Execução pluggable (`docker`/`remote`/`off`), limite de concorrência e worker remoto.
- Re-correr autograder (por submissão e em lote), analytics (testes mais falhados, duração).
- `POST /api/testar` — correr o autograder contra código enviado (editores, CLI, CI).
- Plugins de editor: CLI, extensão VSCode e esqueleto IntelliJ; playground web.

### Avaliação por IA e anti-abuso
- Avaliação por rubrica com feedback e nota (agnóstica de fornecedor de LLM).
- **Deteção de uso de IA** por submissão (sinal, não veredicto) + perguntas de defesa.
- **Análise de resistência do enunciado à IA** com sugestões concretas — e agora
  **aplicar essas sugestões ao enunciado automaticamente** (a IA reescreve-o).
- Linha-base de IA, rubrica orientada a IA-hard, gerar rubrica/enunciado com IA.
- Tutor socrático para o aluno; a IA explica um teste falhado sem dar a solução.

### Portal do professor
- Dashboard "Precisa de atenção", fila de revisão com filtros, pesquisa e ordenação.
- Rubric builder, modelos de rubrica reutilizáveis e banco de comentários.
- Comparação lado-a-lado, vista de Integridade (grafo de similaridade + clusters),
  plágio entre edições/anos, comentários em linha.
- Correção anónima (blind marking), avaliação manual, abrir/fechar e duplicar trabalhos.
- Co-docência (convidar colegas) e calibração entre co-docentes.

### Portal do aluno
- Submissão por link público (com ou sem conta) e recibo com resultados dos testes.
- Notas, boletim imprimível/PDF, gráfico de progresso e recomendações por critério fraco.
- Feed de notificações, avaliação por pares e fluxo de recurso/reavaliação.

### Cadeira, analytics e relatórios
- Analytics ao nível da cadeira (matriz aluno×trabalho), pauta consolidada (CSV),
  vista de alunos em risco, insights da turma e simulador de curva de notas.
- Relatório imprimível da cadeira e do trabalho (PDF para coordenação); audit log.

### Configuração de trabalhos
- Escalas configuráveis (0–20, 0–100, letras, ECTS, aprovado/reprovado).
- Prazos + política de fora de prazo, trabalhos de grupo, turmas e tipos de ficheiro.

### Plataforma
- Autenticação de professor e aluno (sessões assinadas), multi-idioma PT/EN.
- Notificações por email pluggable (publicação de nota, resposta a recurso).
- Seed showcase (`npm run seed`), smoke-test de 13 fluxos e testes unitários.
- Documentação de segurança (sandbox, isolamento, checklist de produção).

[Não lançado]: https://github.com/marcelogdomingues/avalia-platform/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/marcelogdomingues/avalia-platform/releases/tag/v0.1.0
