"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submeterTrabalho, type SubmeterResultado } from "@/lib/actions";

export default function SubmeterForm({
  token,
  temTestes,
  langLabel,
  temAluno,
  alunoNome,
  tipos,
}: {
  token: string;
  temTestes: boolean;
  langLabel: string;
  temAluno: boolean;
  alunoNome?: string;
  tipos: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<SubmeterResultado | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setRes(null);
    start(async () => {
      const r = await submeterTrabalho(token, fd);
      if (r.ok) router.push(`/recibo/${r.submissionId}`);
      else setRes(r);
    });
  }

  const gate = res && !res.ok ? res.gate : undefined;

  return (
    <form onSubmit={onSubmit}>
      {temAluno ? (
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          A submeter como <b>{alunoNome}</b>.
        </p>
      ) : (
        <>
          <div className="field"><label>Nome</label><input name="alunoNome" required /></div>
          <div className="field"><label>Número de aluno</label><input name="alunoNumero" /></div>
        </>
      )}

      {temTestes && (
        <div className="demo-banner" style={{ marginBottom: 16 }}>
          <span>🧪</span>
          <span>
            Este trabalho corre <b>testes automáticos</b> ({langLabel}). Submete um <code>.zip</code> ou ficheiro de
            código — tens de passar todos os testes <b>obrigatórios</b> para submeter.
          </span>
        </div>
      )}

      <div className="field">
        <label>Ficheiro <span className="help">({tipos})</span></label>
        <input name="ficheiro" type="file" required accept=".pdf,.docx,.txt,.md,.zip,.py,.java,.dart,.kt,.png,.jpg,.jpeg,.webp" />
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? (temTestes ? "🧪 A correr os testes…" : "A submeter…") : "Submeter"}
      </button>

      {res && !res.ok && (
        <div className="err-banner" style={{ marginTop: 18, display: "block" }}>
          <div style={{ fontWeight: 600, marginBottom: gate ? 8 : 0 }}>
            {gate ? "Submissão bloqueada" : "Não foi possível submeter"} — {res.erro}
          </div>

          {gate && gate.total > 0 && (
            <>
              <div style={{ fontSize: 13.5, marginBottom: 10 }}>
                Passaste <b>{gate.passed}/{gate.total}</b> testes · obrigatórios <b>{gate.obrigatoriosPassed}/{gate.obrigatoriosTotal}</b>.
                Corrige e volta a submeter.
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4, fontSize: 13 }}>
                {gate.tests.map((t, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: t.ok ? "var(--green)" : "var(--red)" }}>
                    <span>{t.ok ? "✓" : "✗"}</span>
                    <span style={{ color: "var(--text)" }}>{t.nome}</span>
                    {t.obrigatorio && <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>obrigatório</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
