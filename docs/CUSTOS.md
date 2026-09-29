# Custos e escolha de modelo

**Direção do projeto:** o motor é **agnóstico de fornecedor** (API compatível com OpenAI).
Para a POC usamos um **modelo open-source num tier gratuito hospedado**; mais tarde migra-se
para um **servidor da faculdade** (on-prem) sem mudar código — só variáveis de ambiente.

## POC: open-source gratuito (escolha atual)

| Fornecedor | Modelo | Licença | Custo | Notas |
|---|---|---|---|---|
| **Groq** (default) | Llama 3.3 70B | Llama Community | **Grátis** (tier) | Muito rápido, chave grátis, ótimo para POC |
| **OpenRouter** | Qwen2.5 72B | **Apache 2.0** | **Grátis** (tier free) | Mais estritamente open-source; bom PT e JSON |
| Google AI Studio | Gemini | proprietário | Grátis (tier) | *Não* open-source — evitar se o objetivo é FOSS |

Trade-offs do tier gratuito hospedado:
- ✅ Sem hardware, sem custo, arranca em minutos.
- ⚠️ Os dados dos alunos **saem para o fornecedor** e há **limites de uso** (rate limits).
  Aceitável para uma POC; para produção real com dados de alunos, migrar para on-prem (RGPD).

## Produção: on-prem no servidor da faculdade

| Runtime | Modelo | Hardware típico | Custo por avaliação |
|---|---|---|---|
| vLLM | Qwen2.5-72B-Instruct | GPU ~40GB+ (A100 80GB, 2×A6000) | **€0** (só eletricidade) |
| vLLM | Qwen2.5-32B | GPU 24–48GB | €0 |
| Ollama | qwen2.5:14b / :32b | RTX 4090 24GB ou Mac 64GB+ | €0 |

- ✅ **Dados 100% on-prem** (RGPD), **custo zero por token**, stack toda livre.
- Recomendado: **Qwen2.5** (Apache 2.0, forte em JSON estruturado e português; família
  `Qwen2.5-VL` cobre a visão da Fase 2).

## Qualidade — o que esperar

Ordem aproximada de qualidade nas justificações: modelos proprietários de topo >
gpt-oss-120b ≈ Llama 3.3 70B ≈ Qwen2.5 72B > modelos 14–32B. Os melhores open-source ficam **um degrau
abaixo** do topo proprietário, mas como a tool tem **validação humana obrigatória**, o
trade-off é muito aceitável — e ganha-se custo zero + on-prem.

Se em algum momento quiseres máxima qualidade num caso difícil, o motor agnóstico permite
apontar a um modelo proprietário (via endpoint compatível com OpenAI) só para esses casos —
sem reescrever nada.

## Onde controlar no código

- `lib/llm.ts` — 3 variáveis (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) trocam o fornecedor.
- `lib/evaluate.ts` — `temperature: 0.2` para notas consistentes; JSON mode para output parseável.
- `Evaluation.tokensInput/Output` (schema) — medir uso real para dimensionar hardware on-prem.
