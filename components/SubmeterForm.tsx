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
  grupo,
}: {
  token: string;
  temTestes: boolean;
  langLabel: string;
  temAluno: boolean;
  alunoNome?: string;
  tipos: string;
  grupo?: boolean;
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

      <div className="field"><label>Turma / turno <span className="help">(opcional)</span></label><input name="turma" placeholder="ex: PL2" /></div>

      {grupo && (
        <div className="field">
          <label>Membros do grupo <span className="help">(um por linha: nome, número)</span></label>
          <textarea name="membros" placeholder={"Ana Silva, 20211234\nJoão Dias, 20215678"} style={{ minHeight: 70 }} />
        </div>
      )}

      {temTestes && (
        <div className="demo-banner" style={{ marginBottom: 16, alignItems: "center" }}>
          <span className="badge" style={{ background: "rgba(15,118,110,0.14)", color: "#0f766e", fontWeight: 600, whiteSpace: "nowrap" }}>🧪 {langLabel}</span>
          <span>
            Este trabalho corre <b>testes automáticos</b>. Submete um <code>.zip</code> ou ficheiro de
            código — tens de passar todos os testes <b>obrigatórios</b> para submeter.
          </span>
        </div>
      )}

      <div className="field">
        <label>Ficheiro <span className="help">({tipos})</span></label>
        <input name="ficheiro" type="file" required accept=".pdf,.docx,.txt,.md,.zip,.py,.java,.js,.ts,.go,.rb,.c,.h,.cpp,.cc,.php,.rs,.dart,.kt,.png,.jpg,.jpeg,.webp" />
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
                Passaste <b>{gate.passed}/{gate.total}</b> testes · obrigatórios <b>{gate.obrigatoriosPassed}/{gate.obrigatoriosTotal}</b>
                {gate.duracaoMs != null ? ` · ${(gate.duracaoMs / 1000).toFixed(1)}s` : ""}.
                Corrige e volta a submeter.
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4, fontSize: 13 }}>
                {gate.tests.map((t, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: t.ok ? "var(--green)" : "var(--red)" }}>
                    <span>{t.ok ? "✓" : "✗"}</span>
                    <span style={{ color: "var(--text)" }}>{t.nome}</span>
                    {t.obrigatorio && <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>obrigatório</span>}
                    {t.ms != null && <span className="mono" style={{ fontSize: 10, color: "var(--faint)", marginLeft: "auto" }}>{t.ms < 1 ? "<1" : t.ms}ms</span>}
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
