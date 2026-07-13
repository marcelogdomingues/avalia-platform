// Testes unitários das funções puras (sem BD, sem rede).
// Corre com o runner nativo do Node via tsx: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { notaTexto, aprovado20, escalaSufixo, escalaLabel } from "../lib/escala";
import { calcularStats } from "../lib/stats";
import { diffPalavras } from "../lib/diff";
import { similaridadeComTexto, calcularSimilaridades, compararComArquivo, analisarIntegridade } from "../lib/similaridade";
import { parseTapJs, parseGoTest, parseRustTest } from "../lib/runner";

// ── escala ────────────────────────────────────────────────────────────────────
test("notaTexto: escala vinte usa vírgula decimal", () => {
  assert.equal(notaTexto(15.5, "vinte"), "15,5");
  assert.equal(notaTexto(null, "vinte"), "—");
});
test("notaTexto: cem multiplica por 5", () => {
  assert.equal(notaTexto(20, "cem"), "100");
  assert.equal(notaTexto(10, "cem"), "50");
});
test("notaTexto: letra e ects nos limiares", () => {
  assert.equal(notaTexto(16, "letra"), "A");
  assert.equal(notaTexto(9, "letra"), "F");
  assert.equal(notaTexto(9.5, "ects"), "E");
  assert.equal(notaTexto(9, "ects"), "F");
});
test("notaTexto: passa/reprova no limiar 9,5", () => {
  assert.equal(notaTexto(9.5, "passa"), "Aprovado");
  assert.equal(notaTexto(9.4, "passa"), "Reprovado");
});
test("aprovado20 respeita o limiar 9,5", () => {
  assert.equal(aprovado20(9.5), true);
  assert.equal(aprovado20(9.49), false);
  assert.equal(aprovado20(null), false);
});
test("escalaSufixo e escalaLabel", () => {
  assert.equal(escalaSufixo("vinte"), "/20");
  assert.equal(escalaSufixo("cem"), "/100");
  assert.equal(escalaSufixo("letra"), "");
  assert.equal(escalaLabel("passa").length > 0, true);
});

// ── stats ──────────────────────────────────────────────────────────────────────
test("calcularStats: contagens, média e distribuição", () => {
  const s = calcularStats([
    { estado: "APROVADO", notaIA: 10, notaFinal: 18 },
    { estado: "RASCUNHO", notaIA: 8, notaFinal: null },
    { estado: "PENDENTE", notaIA: null, notaFinal: null },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.avaliadas, 2);
  assert.equal(s.aprovadas, 1);
  assert.equal(s.porAvaliar, 1);
  assert.equal(s.media, 13); // (18 + 8) / 2
  assert.equal(s.min, 8);
  assert.equal(s.max, 18);
  assert.equal(s.distribuicao.reduce((a, b) => a + b.n, 0), 2);
});
test("calcularStats: vazio devolve nulos", () => {
  const s = calcularStats([]);
  assert.equal(s.media, null);
  assert.equal(s.min, null);
});

// ── diff ───────────────────────────────────────────────────────────────────────
test("diffPalavras conta adições e remoções", () => {
  const d = diffPalavras("o gato preto", "o gato branco");
  assert.equal(d.adicionadas, 1);
  assert.equal(d.removidas, 1);
  assert.ok(d.iguais >= 2);
});
test("diffPalavras texto igual não muda nada", () => {
  const d = diffPalavras("um dois tres", "um dois tres");
  assert.equal(d.adicionadas, 0);
  assert.equal(d.removidas, 0);
});

// ── similaridade ────────────────────────────────────────────────────────────────
test("similaridadeComTexto: idêntico ~1, disjunto 0", () => {
  const txt = "um dois tres quatro cinco seis sete";
  assert.ok(similaridadeComTexto(txt, txt) > 0.99);
  assert.equal(similaridadeComTexto(txt, "alfa beta gama delta epsilon zeta eta"), 0);
  assert.equal(similaridadeComTexto(null, txt), 0);
});
test("calcularSimilaridades encontra o par mais parecido", () => {
  const base = "a b c d e f g h i j";
  const m = calcularSimilaridades([
    { id: "1", alunoNome: "Ana", conteudoExtraido: base },
    { id: "2", alunoNome: "Rui", conteudoExtraido: base },
    { id: "3", alunoNome: "Zé", conteudoExtraido: "z y x w v u t s r q" },
  ]);
  assert.equal(m.get("1")?.outroId, "2");
  assert.equal(m.get("3"), null); // sem semelhança relevante
});
test("compararComArquivo deteta reutilização de edição anterior", () => {
  const texto = "introducao metodologia resultados discussao conclusao referencias anexos";
  const m = compararComArquivo(
    [{ id: "atual", conteudoExtraido: texto }, { id: "orig", conteudoExtraido: "texto totalmente diferente sem qualquer relacao aqui" }],
    [{ alunoNome: "Tiago (2023)", conteudoExtraido: texto, origem: "AED · 2023/2024" }],
  );
  assert.ok((m.get("atual")?.score ?? 0) > 0.9);
  assert.equal(m.get("atual")?.origem, "AED · 2023/2024");
  assert.equal(m.get("orig"), null);
});
test("analisarIntegridade agrupa cópias em clusters", () => {
  const igual = "primeira segunda terceira quarta quinta sexta setima oitava";
  const r = analisarIntegridade([
    { id: "1", alunoNome: "A", conteudoExtraido: igual },
    { id: "2", alunoNome: "B", conteudoExtraido: igual },
    { id: "3", alunoNome: "C", conteudoExtraido: "nada a ver com o resto deste conjunto de palavras" },
  ], null);
  assert.ok(r.pares.length >= 1);
  assert.equal(r.clusters.length, 1);
  assert.equal(r.clusters[0].ids.sort().join(","), "1,2");
});

// ── parsers do autograder ───────────────────────────────────────────────────────
test("parseTapJs lê ok/not ok e ignora caminhos de ficheiro", () => {
  const raw = ["TAP version 13", "ok 1 - soma simples", "not ok 2 - subtrai negativos", "ok 3 - test/foo.js"].join("\n");
  const t = parseTapJs(raw);
  assert.equal(t.length, 2);
  assert.equal(t[0].ok, true);
  assert.equal(t[1].ok, false);
  assert.equal(t[1].nome, "subtrai negativos");
});
test("parseGoTest lê PASS/FAIL com duração", () => {
  const raw = ["=== RUN   TestSoma", "--- PASS: TestSoma (0.02s)", "--- FAIL: TestDiv (0.00s)"].join("\n");
  const t = parseGoTest(raw);
  assert.equal(t.length, 2);
  assert.equal(t[0].ok, true);
  assert.equal(t[0].ms, 20);
  assert.equal(t[1].ok, false);
});
test("parseRustTest lê ok/FAILED e limpa o módulo", () => {
  const raw = ["running 2 tests", "test tests::soma ... ok", "test tests::div ... FAILED"].join("\n");
  const t = parseRustTest(raw);
  assert.equal(t.length, 2);
  assert.equal(t[0].nome, "soma");
  assert.equal(t[0].ok, true);
  assert.equal(t[1].ok, false);
});
