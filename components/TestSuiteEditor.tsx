"use client";

import { useState } from "react";

// Nota: não importa lib/runner (server-only). As linguagens estão aqui.
const LANGS = [
  { v: "python", l: "Python (pytest)", pronto: true },
  { v: "java", l: "Java (JUnit)", pronto: false },
  { v: "dart", l: "Dart (dart test)", pronto: false },
  { v: "kotlin", l: "Kotlin (Gradle)", pronto: false },
] as const;

type Lang = (typeof LANGS)[number]["v"];

export interface TestSuiteValor {
  lang: Lang;
  testFiles: { path: string; content: string }[];
  obrigatorios: "todos" | string[];
}

// Deteta nomes de testes no conteúdo (pytest: def test_...; JUnit: @Test ... nome()).
function detetarTestes(lang: Lang, conteudo: string): string[] {
  const nomes = new Set<string>();
  if (lang === "python") {
    for (const m of conteudo.matchAll(/^\s*(?:async\s+)?def\s+(test_\w+)/gm)) nomes.add(m[1]);
  } else if (lang === "java" || lang === "kotlin") {
    const re = /@Test[\s\S]{0,120}?\b(\w+)\s*\(/g;
    for (const m of conteudo.matchAll(re)) nomes.add(m[1]);
  } else if (lang === "dart") {
    for (const m of conteudo.matchAll(/\btest\(\s*['"]([^'"]+)['"]/g)) nomes.add(m[1]);
  }
  return [...nomes];
}

export default function TestSuiteEditor({ inicial }: { inicial?: TestSuiteValor | null }) {
  const [ativo, setAtivo] = useState<boolean>(!!inicial);
  const [lang, setLang] = useState<Lang>(inicial?.lang ?? "python");
  const [conteudo, setConteudo] = useState<string>(inicial?.testFiles?.[0]?.content ?? "");
  const detetados = detetarTestes(lang, conteudo);
  const [obrig, setObrig] = useState<Set<string>>(
    () => new Set(inicial ? (inicial.obrigatorios === "todos" ? detetarTestes(inicial.lang, inicial.testFiles?.[0]?.content ?? "") : inicial.obrigatorios) : [])
  );

  const langInfo = LANGS.find((l) => l.v === lang)!;
  const path = lang === "python" ? "test_trabalho.py" : lang === "dart" ? "trabalho_test.dart" : lang === "kotlin" ? "TrabalhoTest.kt" : "TrabalhoTest.java";

  // Convenção: conjunto vazio = "todos obrigatórios" (default). Assim, novos
  // testes detetados ficam obrigatórios por omissão.
  const obrigEfetivo = obrig.size === 0 ? new Set(detetados) : new Set([...obrig].filter((n) => detetados.includes(n)));
  const todosObrig = detetados.length > 0 && detetados.every((n) => obrigEfetivo.has(n));

  const valor: TestSuiteValor | null =
    ativo && detetados.length
      ? { lang, testFiles: [{ path, content: conteudo }], obrigatorios: todosObrig ? "todos" : [...obrigEfetivo] }
      : null;

  function toggleObrig(nome: string) {
    setObrig((s) => {
      const n = new Set(s.size ? s : detetados); // materializa "todos" na 1ª interação
      n.has(nome) ? n.delete(nome) : n.add(nome);
      return n;
    });
  }

  return (
    <div className="field">
      <label className="checkbox" style={{ fontSize: 14.5, fontWeight: 600 }}>
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> 🧪 Testes automáticos (autograder)
        <span className="help" style={{ fontWeight: 400 }}>— para projetos de código; o aluno tem de passar os obrigatórios para submeter</span>
      </label>

      {ativo && (
        <div className="card" style={{ marginTop: 10, background: "var(--surface-2)" }}>
          <div className="field">
            <label>Linguagem</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.v} value={l.v}>{l.l}{l.pronto ? "" : " — runner em breve"}</option>
              ))}
            </select>
          </div>

          {!langInfo.pronto && (
            <p className="hint" style={{ color: "var(--amber)", marginTop: -6, marginBottom: 12 }}>
              O runner de {langInfo.l} ainda não está configurado nesta instância — os testes serão guardados mas não correrão até a imagem existir.
            </p>
          )}

          <div className="field">
            <label>Ficheiro de testes <span className="help">({path})</span></label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder={lang === "python" ? "from solution import soma\n\ndef test_soma(): assert soma(2, 3) == 5" : "Cola aqui os testes do professor…"}
              style={{ minHeight: 150, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}
            />
          </div>

          {detetados.length > 0 ? (
            <>
              <label style={{ display: "block", marginBottom: 8 }}>
                Testes obrigatórios <span className="help">({obrigEfetivo.size}/{detetados.length} marcados — o aluno tem de passar todos estes)</span>
              </label>
              <div className="chips">
                {detetados.map((nome) => (
                  <label key={nome} className="chip">
                    <input type="checkbox" checked={obrigEfetivo.has(nome)} onChange={() => toggleObrig(nome)} /> {nome}
                  </label>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 10 }}>
                Detetei {detetados.length} teste(s). Ao submeter, correm num contentor isolado; os não-obrigatórios contam para a nota mas não bloqueiam.
              </p>
            </>
          ) : (
            <p className="hint">Cola os testes acima — deteto-os automaticamente para escolheres os obrigatórios.</p>
          )}
        </div>
      )}

      <input type="hidden" name="testSuite" value={valor ? JSON.stringify(valor) : ""} />
    </div>
  );
}
