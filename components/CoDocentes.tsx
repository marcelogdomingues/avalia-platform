"use client";

import { useState } from "react";
import { convidarCoDocente, removerCoDocente } from "@/lib/actions";

type Doc = { id: string; nome: string; email: string };

export default function CoDocentes({ courseId, isOwner, iniciais }: { courseId: string; isOwner: boolean; iniciais: Doc[] }) {
  const [lista, setLista] = useState<Doc[]>(iniciais);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function convidar() {
    if (loading || !email.trim()) return;
    setLoading(true); setErro(null);
    try {
      const r = await convidarCoDocente(courseId, email);
      if (r.ok) { setEmail(""); location.reload(); }
      else setErro(r.erro ?? "Não foi possível convidar.");
    } finally { setLoading(false); }
  }
  async function remover(id: string) {
    setLista((l) => l.filter((d) => d.id !== id));
    await removerCoDocente(courseId, id);
  }

  return (
    <details className="disclosure card" style={{ marginTop: 20 }}>
      <summary style={{ fontSize: 15 }}>👥 Co-docentes {lista.length > 0 ? `(${lista.length})` : ""}</summary>
      <div style={{ marginTop: 14 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          {isOwner ? "Convida outros professores (por email registado) para co-lecionarem esta cadeira — veem e avaliam tudo. Só tu podes apagar/arquivar a cadeira e gerir co-docentes." : "És co-docente desta cadeira."}
        </p>
        {lista.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: isOwner ? 16 : 0 }}>
            {lista.map((d) => (
              <div key={d.id} className="row-between" style={{ fontSize: 14, background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px" }}>
                <span>{d.nome} <span className="faint">· {d.email}</span></span>
                {isOwner && <button type="button" className="btn ghost sm" onClick={() => remover(d.id)}>Remover</button>}
              </div>
            ))}
          </div>
        )}
        {isOwner && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
              <label>Email do professor</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colega@exemplo.pt" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); convidar(); } }} />
            </div>
            <button type="button" className="btn" onClick={convidar} disabled={loading || !email.trim()}>{loading ? "…" : "Convidar"}</button>
          </div>
        )}
        {erro && <p className="hint" style={{ color: "var(--amber)", marginTop: 8 }}>{erro}</p>}
      </div>
    </details>
  );
}
