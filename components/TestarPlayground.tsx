"use client";

import { useState } from "react";

type Resultado = {
  ok: boolean;
  trabalho?: string;
  lang?: string;
  passed?: number;
  total?: number;
  gateMet?: boolean;
  duracaoMs?: number | null;
  erro?: string | null;
  testes?: { nome: string; ok: boolean; obrigatorio: boolean; ms?: number | null }[];
};

export default function TestarPlayground({ token, langLabel, ext }: { token: string; langLabel: string; ext: string }) {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function correr() {
    if (loading || !code.trim()) return;
    setLoading(true); setErro(null); setRes(null);
    try {
      const r = await fetch("/api/testar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) { setErro(data?.erro ?? `Erro ${r.status}.`); return; }
      setRes(data);
    } catch (e) {
      setErro(`Não foi possível contactar o servidor. ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const cor = res?.gateMet ? "#0f766e" : "#9f1d1d";

  return (
    <div>
      <div className="field" style={{ margin: 0 }}>
        <label>O teu código ({langLabel} · será testado como <code>solution.{ext}</code>)</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={`Cola aqui a tua solução em ${langLabel}…`}
          spellCheck={false}
          rows={16}
          style={{ width: "100%", fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: 13, lineHeight: 1.5, padding: "12px 14px", borderRadius: 10, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
        />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <button type="button" className="btn" onClick={correr} disabled={loading || !code.trim()}>
          {loading ? "A correr os testes…" : "▶ Correr testes"}
        </button>
        <span className="hint" style={{ margin: 0 }}>Não submete nada — só corre os testes no sandbox.</span>
      </div>

      {erro && <p className="hint" style={{ color: "var(--amber)", marginTop: 12 }}>{erro}</p>}

      {res && (
        <div className="card" style={{ marginTop: 16, borderColor: cor + "44" }}>
          <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: cor }}>
              {res.gateMet ? "✓ Passa o gate" : "✗ Ainda não passa"} · {res.passed}/{res.total} testes
            </span>
            {res.duracaoMs != null && <span className="faint mono" style={{ fontSize: 12 }}>{res.duracaoMs}ms</span>}
          </div>
          <div style={{ display: "grid", gap: 4, marginTop: 12 }}>
            {(res.testes ?? []).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: t.ok ? "#0f766e" : "#9f1d1d", fontWeight: 700 }}>{t.ok ? "✓" : "✗"}</span>
                <span style={{ flex: 1 }}>{t.nome}{!t.obrigatorio && <span className="faint"> · opcional</span>}</span>
                {t.ms != null && <span className="faint mono" style={{ fontSize: 11.5 }}>{t.ms}ms</span>}
              </div>
            ))}
          </div>
          {res.erro && (
            <pre style={{ marginTop: 12, background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, whiteSpace: "pre-wrap", color: "#9f1d1d" }}>{res.erro}</pre>
          )}
        </div>
      )}
    </div>
  );
}
