# Avalia — Plataforma de Avaliação Automática de Trabalhos

> Documento de projeto (PRD). Nome "Avalia" é provisório — renomeável.
> Última atualização: 2026-07-07

## 1. Visão

Uma plataforma **genérica e multi-tenant** onde **qualquer professor** faz onboarding
da sua cadeira, define trabalhos e critérios de avaliação em linguagem natural, os alunos
submetem os trabalhos, e a IA faz uma **pré-avaliação com feedback por critério** que o
professor só tem de **rever e aprovar** — em vez de avaliar tudo do zero.

**Princípio central:** _human-in-the-loop_. A IA nunca dá a nota final sozinha. Guarda-se
sempre a justificação por critério para o professor auditar, ajustar e aprovar.

**Não é** uma tool à medida de uma cadeira. O coração da app é um **"builder" de avaliação**
configurável pelo professor, que serve qualquer tipo de trabalho (relatórios, ensaios,
zips de código, quizzes, slides).

## 2. Problema

Avaliar trabalhos no Moodle demora imenso tempo ao docente. Cada trabalho tem de ser lido,
analisado contra critérios e comentado manualmente, aluno a aluno. Não escala com turmas
grandes nem com múltiplas entregas por semestre.

## 3. Utilizadores

- **Professor** (utilizador principal): auto-registo, cria cadeiras e trabalhos, define
  rubricas, revê e aprova avaliações, exporta notas.
- **Aluno**: submete trabalhos via link, recebe (opcionalmente) feedback.
- *(Fase futura)* **Admin da instituição**: gestão de contas, integração Moodle.

## 4. Conceitos-chave (modelo mental)

| Conceito | O que é |
|---|---|
| **Professor** | Conta multi-tenant (auto-registo). Dono de tudo o que cria. |
| **Cadeira** (Course) | Agrupa alunos e trabalhos. |
| **Trabalho** (Assignment) | Enunciado + tipos de ficheiro aceites + **rubrica** (critérios com peso) + instruções de avaliação + solução-modelo opcional. |
| **Submissão** (Submission) | Ficheiros do aluno + conteúdo extraído (texto/código/imagem). |
| **Avaliação** (Evaluation) | Nota por critério + justificação + feedback global, gerada pela IA. Estado: `rascunho` → `aprovado`. |
| **Rubrica** | Lista de critérios: `{ nome, descrição, peso, escala }`. Guardada de forma semi-estruturada (não texto livre). |

## 5. Decisões de arquitetura tomadas

1. **Builder = rubrica + instruções em linguagem natural**, guardada de forma
   semi-estruturada (lista de critérios com peso). Dá flexibilidade total **e**
   consistência de notas. Grelha rígida e execução de código ficam para fases posteriores.
2. **Plataforma separada primeiro** (não integração Moodle no MVP). Export CSV compatível
   com o gradebook do Moodle. LTI/API do Moodle fica para a Fase 3.
3. **Auto-registo aberto** (SaaS multi-tenant) desde o início.
4. **Motor de avaliação = agnóstico de fornecedor** (API compatível com OpenAI), com
   _JSON mode_ (nota+justificação por critério, parseável). POC com modelo **open-source
   gratuito**; migração para **on-prem** (servidor da faculdade) sem mudar código — só
   variáveis de ambiente. Ver `docs/CUSTOS.md`.

## 6. Fluxos principais

**Professor onboarding:**
`registo → criar cadeira → criar trabalho → escrever rubrica/instruções → gerar link de submissão`

**Aluno:**
`abre link → submete ficheiros → confirmação` (feedback imediato ou retido até aprovação — configurável por trabalho)

**Avaliação (assíncrona, em fila):**
`submissão → extração de conteúdo (PDF/DOCX→texto, ZIP→árvore de ficheiros, slides/imagem→visão) → avaliador IA corre contra a rubrica → nota por critério + comentários`

**Validação:**
`professor vê submissão + avaliação IA lado a lado → ajusta → aprova em lote → export CSV`

## 7. MVP (1ª versão — testar com 1-2 cadeiras)

Inclui:
- Auto-registo de professor + criar cadeira + criar trabalho com rubrica em linguagem natural.
- Submissão de alunos por link (sem conta, ou conta leve).
- Extração de conteúdo: **PDF, DOCX, TXT e ZIP de código**.
- Avaliador IA com nota por critério + feedback (structured output).
- Ecrã de validação do professor (rever, ajustar, aprovar).
- Export CSV das notas.

Fora do MVP (mas desenhado para caber):
- Integração LTI/API Moodle.
- Execução real de código em sandbox.
- Visão para slides/imagens (entra logo a seguir).
- Deteção de plágio, analytics.

## 8. Roadmap

| Fase | Objetivo | Entregáveis-chave |
|---|---|---|
| **1 — MVP** | Provar que a avaliação IA é boa o suficiente | Builder de rubrica, submissão, extração PDF/DOCX/ZIP, avaliador IA, validação, export CSV |
| **2 — Robustez** | Ampliar formatos e UX | Visão (slides/imagens), grelha estruturada opcional, feedback ao aluno, validação em lote melhorada |
| **3 — Integração** | Encaixar no Moodle | LTI/API: buscar submissões + devolver notas |
| **4 — Avançado** | Diferenciação | Sandbox de código com testes, deteção de similaridade, calibração da IA com correções do professor |

## 9. Stack (proposta)

- **Frontend/Backend:** Next.js (App Router) + TypeScript + Tailwind.
- **Fila de jobs:** avaliações correm em worker assíncrono (não bloqueiam o pedido web).
- **Base de dados:** Postgres (multi-tenant por `professor_id`/`course_id`) via Prisma.
- **Storage de ficheiros:** S3 / object storage (UE, RGPD).
- **Auth:** provider com auto-registo (email institucional).
- **IA:** motor agnóstico de fornecedor via SDK `openai` (API compatível com OpenAI).
  POC com modelo open-source gratuito (Groq/OpenRouter); produção on-prem (vLLM/Ollama).
  Ver `docs/CUSTOS.md`.

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Alucinação / injustiça da IA | Validação humana obrigatória; guardar justificação por critério para auditoria |
| Inconsistência de notas | Rubrica estruturada + solução-modelo + prompt determinístico |
| RGPD / dados de alunos | Hosting UE, política de retenção, consentimento no link de submissão |
| Custo por avaliação | Prompt caching do enunciado/rubrica; escolha de modelo por tipo de trabalho (ver CUSTOS.md) |
| Prompt injection via submissão do aluno | Tratar conteúdo do aluno como dados, não instruções; delimitar claramente no prompt |
