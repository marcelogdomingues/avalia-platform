import OpenAI from "openai";

// Cliente LLM agnóstico de fornecedor.
//
// Funciona com qualquer endpoint compatível com a API OpenAI:
//  - POC gratuita:  Groq (default abaixo) ou OpenRouter (tiers free)
//  - Produção:      vLLM ou Ollama no servidor da faculdade (dados on-prem)
//
// Trocar de fornecedor = mudar só estas 3 variáveis de ambiente. Zero código.
//   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL

export const llm = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
  apiKey: process.env.LLM_API_KEY ?? "",
});

// Modelo open-source default (Groq). Ver .env.example para alternativas
// (Qwen2.5 via OpenRouter, ou modelo local via vLLM/Ollama).
export const AVALIADOR_MODEL = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
