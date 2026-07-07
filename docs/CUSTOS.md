# Custos e escolha de modelo

Preços Claude (por 1M de tokens, à data 2026-06):

| Modelo | Model ID | Input | Output | Contexto | Visão | Structured output |
|---|---|---|---|---|---|---|
| **Claude Opus 4.8** | `claude-opus-4-8` | $5 | $25 | 1M | ✅ | ✅ |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | $3 | $15 | 1M | ✅ | ✅ |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | $1 | $5 | 200K | ✅ | ✅ |

Os três suportam **visão** (para slides/imagens na Fase 2) e **structured output**
(`output_config.format`) — essencial para receber nota+justificação por critério de forma fiável.

## Pressupostos de estimativa

Avaliação típica de um **relatório de ~4 páginas**:
- Prefixo partilhado (enunciado + rubrica + instruções): ~2.000 tokens input
- Submissão do aluno: ~3.000 tokens input
- Output (nota por critério + justificações + feedback): ~1.000 tokens output
- **Total: ~5.000 input + ~1.000 output**

## Custo por trabalho (tempo real, sem otimizações)

| Modelo | Por trabalho | Turma de 40 | Semestre (5 trab × 40 = 200) |
|---|---|---|---|
| Opus 4.8 | **~$0.05** | ~$2.00 | ~$10.00 |
| Sonnet 4.6 | **~$0.03** | ~$1.20 | ~$6.00 |
| Haiku 4.5 | **~$0.01** | ~$0.40 | ~$2.00 |

Trabalho **grande (zip de código, ~15k input)**: Opus ~$0.11, Sonnet ~$0.07, Haiku ~$0.02.
Turma de 40 zips com Opus ≈ **$4.50**.

**Conclusão:** o custo é praticamente irrelevante face ao tempo de docente poupado.
Uma cadeira inteira num semestre custa entre **$2 e $10** em IA.

## Duas alavancas que cortam custo (grátis de implementar)

1. **Batch API (−50%)**: avaliar a turma toda de uma vez não é sensível a latência →
   usar a Batches API corta metade do custo. Turma de 40 com Opus passa de ~$2.00 → **~$1.00**.
2. **Prompt caching (~−90% no prefixo)**: o enunciado/rubrica/solução-modelo é igual para
   todos os alunos. Cacheado uma vez, os restantes N-1 alunos pagam ~0.1× nesse prefixo.
   Ganho cresce com enunciados/soluções-modelo grandes.

## Recomendação de modelo

- **Default do MVP: `claude-opus-4-8`.** Máxima qualidade de avaliação e de justificações —
  é o que dá mais confiança ao professor na fase de validação, que é o objetivo do produto.
  1M de contexto aguenta zips grandes; suporta visão e structured output.
- **`claude-sonnet-4-6` como alavanca de custo** se o volume crescer muito e a qualidade
  se mostrar equivalente na tua cadeira — corta ~40% do custo. Decisão a validar com dados reais.
- **`claude-haiku-4-5` para pré-verificações baratas**: validar formato, quizzes de resposta
  curta, triagem antes de uma avaliação mais cara.
- **Escalonamento**: começar em Opus 4.8; opcionalmente usar Haiku para uma primeira passagem
  e Opus só nos casos-limite/fronteira.

## Onde controlar custo no código

- `lib/evaluate.ts` centraliza o `model` — trocar num sítio só.
- Ativar Batch API para avaliação em lote da turma.
- Ativar `cache_control` no bloco do enunciado/rubrica (prefixo estável).
- Guardar `tokensInput`/`tokensOutput` por avaliação (já no schema) para medir custo real.
