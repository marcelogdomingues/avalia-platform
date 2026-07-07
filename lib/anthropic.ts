import Anthropic from "@anthropic-ai/sdk";

// Cliente Claude partilhado. Lê ANTHROPIC_API_KEY do ambiente.
export const anthropic = new Anthropic();

// Modelo default do avaliador. Trocar aqui para mudar em toda a app.
// Ver docs/CUSTOS.md para a comparação de modelos.
export const AVALIADOR_MODEL = "claude-opus-4-8";
