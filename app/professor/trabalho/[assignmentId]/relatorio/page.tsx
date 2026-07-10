import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { notFound } from "next/navigation";
import { calcularStats } from "@/lib/stats";
import { analisarIntegridade } from "@/lib/similaridade";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const round1 = (n: number | null | undefined) => (n != null ? Math.round(n * 10) / 10 : null);

export default async function RelatorioPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;

  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: cadeiraAcesso(prof.id) },
    include: { course: true, submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!a) notFound();

  const stats = calcularStats(a.submissions.map((s) => s.evaluation ?? { estado: "PENDENTE", notaIA: null, notaFinal: null }));
  const integridade = analisarIntegridade(
    a.submissions.map((s) => ({ id: s.id, alunoNome: s.alunoNome, conteudoExtraido: s.conteudoExtraido })),
    a.respostaIA,
  );

  // Dados por submissão (com critérios, deteção, similaridade já computada).
  const linhas = a.submissions.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null;
    return {
      nome: s.alunoNome,
      numero: s.alunoNumero,
      estado: ev?.estado ?? "PENDENTE",
      nota: round1(nota),
      notaIA: round1(ev?.notaIA),
      deteccao: (ev?.deteccaoIA as { probabilidade: number } | null)?.probabilidade ?? null,
    };
  });

  // Calibração IA vs professor (nas publicadas).
  const calib = linhas.filter((l) => l.estado === "APROVADO" && l.notaIA != null && l.nota != null);
  const calibDelta = calib.length ? calib.reduce((acc, l) => acc + (l.notaIA! - l.nota!), 0) / calib.length : null;

  // Critérios mais fracos (média /20).
  const critAgg = new Map<string, { soma: number; n: number }>();
  for (const s of a.submissions) {
    const crits = (s.evaluation?.porCriterio as { nome: string; pontos: number; pontosMax: number }[] | null) ?? [];
    for (const c of crits) {
      if (!c.pontosMax) continue;
      const cur = critAgg.get(c.nome) ?? { soma: 0, n: 0 };
      critAgg.set(c.nome, { soma: cur.soma + (c.pontos / c.pontosMax) * 20, n: cur.n + 1 });
    }
  }
  const criterios = [...critAgg.entries()].map(([nome, v]) => ({ nome, media: v.soma / v.n })).sort((x, y) => x.media - y.media);

  // Autograder: testes mais falhados.
  const testAgg = new Map<string, { falhas: number; total: number }>();
  for (const s of a.submissions) {
    const tr = s.testResult as { tests?: { nome: string; ok: boolean }[] } | null;
    for (const t of tr?.tests ?? []) {
      const cur = testAgg.get(t.nome) ?? { falhas: 0, total: 0 };
      cur.total++; if (!t.ok) cur.falhas++;
      testAgg.set(t.nome, cur);
    }
  }
  const testesFalhados = [...testAgg.entries()]
    .map(([nome, v]) => ({ nome, ...v, taxa: v.total ? v.falhas / v.total : 0 }))
    .filter((t) => t.falhas > 0).sort((x, y) => y.taxa - x.taxa);

  const risco = linhas.filter((l) => (l.nota != null && l.nota < 9.5) || (l.deteccao ?? 0) >= 60);
  const dataStr = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  const cor = (n: number | null) => (n == null ? "#999" : n < 9.5 ? "#9f1d1d" : n < 14 ? "#b45309" : "#0f766e");

  return (
    <div className="rel-root">
      <style>{`
        .rel-root { background: #f4f2ec; min-height: 100vh; padding: 32px 20px; color: #1d1a13; font-family: var(--font-inter, system-ui), sans-serif; }
        .rel-page { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); padding: 48px 56px; }
        .rel-toolbar { max-width: 820px; margin: 0 auto 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .rel-h1 { font-family: var(--font-newsreader, Georgia), serif; font-size: 30px; font-weight: 500; margin: 0 0 4px; }
        .rel-sub { color: rgba(29,26,19,0.55); font-size: 14px; margin-bottom: 28px; }
        .rel-sec { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(29,26,19,0.5); margin: 30px 0 12px; font-weight: 600; }
        .rel-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .rel-card { border: 1px solid rgba(29,26,19,0.12); border-radius: 10px; padding: 14px 16px; }
        .rel-card .n { font-family: var(--font-newsreader, Georgia), serif; font-size: 30px; font-weight: 500; line-height: 1; }
        .rel-card .l { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(29,26,19,0.5); margin-bottom: 8px; }
        .rel-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .rel-table th { text-align: left; font-weight: 600; color: rgba(29,26,19,0.55); padding: 7px 8px; border-bottom: 2px solid rgba(29,26,19,0.12); font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
        .rel-table td { padding: 7px 8px; border-bottom: 1px solid rgba(29,26,19,0.07); }
        .rel-bar { height: 7px; background: rgba(29,26,19,0.08); border-radius: 99px; overflow: hidden; }
        .rel-bar > span { display: block; height: 100%; border-radius: 99px; }
        .rel-foot { margin-top: 36px; padding-top: 16px; border-top: 1px solid rgba(29,26,19,0.1); font-size: 11.5px; color: rgba(29,26,19,0.5); }
        .rel-pill { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        @media print {
          .no-print { display: none !important; }
          .rel-root { background: #fff; padding: 0; }
          .rel-page { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
          .rel-sec { break-after: avoid; }
          table, tr, .rel-card { break-inside: avoid; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div className="rel-toolbar no-print">
        <a href={`/professor/trabalho/${a.id}`} className="btn secondary" style={{ padding: "9px 16px" }}>← Voltar ao trabalho</a>
        <PrintButton />
      </div>

      <div className="rel-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div className="rel-sec" style={{ margin: "0 0 8px" }}>Relatório de avaliação</div>
            <h1 className="rel-h1">{a.titulo}</h1>
            <div className="rel-sub">{a.course.nome}{a.course.ano ? ` · ${a.course.ano}` : ""} · {prof.nome}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "rgba(29,26,19,0.5)" }}>{dataStr}</div>
        </div>

        {/* Resumo */}
        <div className="rel-sec">Resumo</div>
        <div className="rel-cards">
          {[
            ["Submissões", `${stats.total}`],
            ["Média /20", stats.media != null ? `${stats.media}` : "—"],
            ["Publicadas", `${stats.aprovadas}`],
            ["Mín–Máx", `${stats.min ?? "—"}–${stats.max ?? "—"}`],
          ].map(([l, n]) => (
            <div className="rel-card" key={l}>
              <div className="l">{l}</div>
              <div className="n">{n}</div>
            </div>
          ))}
        </div>

        {/* Distribuição */}
        <div className="rel-sec">Distribuição de notas</div>
        <table className="rel-table">
          <tbody>
            {stats.distribuicao.map((d) => {
              const max = Math.max(1, ...stats.distribuicao.map((x) => x.n));
              return (
                <tr key={d.faixa}>
                  <td style={{ width: 60, color: "rgba(29,26,19,0.6)" }}>{d.faixa}</td>
                  <td><div className="rel-bar"><span style={{ width: `${(d.n / max) * 100}%`, background: "#0f766e" }} /></div></td>
                  <td style={{ width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Calibração */}
        {calibDelta != null && (
          <>
            <div className="rel-sec">Calibração da IA</div>
            <p style={{ fontSize: 13.5, margin: 0, color: "rgba(29,26,19,0.8)" }}>
              Nas {calib.length} submissões publicadas, a IA ficou em média <strong style={{ color: cor(calibDelta > 0 ? 8 : 15) }}>{calibDelta > 0 ? "+" : ""}{calibDelta.toFixed(1)}</strong> pontos face à nota do docente
              — {Math.abs(calibDelta) < 0.1 ? "alinhada" : calibDelta > 0 ? "ligeiramente otimista" : "ligeiramente pessimista"}.
            </p>
          </>
        )}

        {/* Critérios */}
        {criterios.length > 0 && (
          <>
            <div className="rel-sec">Desempenho por critério (média /20)</div>
            <table className="rel-table">
              <tbody>
                {criterios.map((c) => (
                  <tr key={c.nome}>
                    <td style={{ width: 220 }}>{c.nome}</td>
                    <td><div className="rel-bar"><span style={{ width: `${(c.media / 20) * 100}%`, background: cor(c.media) }} /></div></td>
                    <td style={{ width: 44, textAlign: "right", color: cor(c.media), fontWeight: 600 }}>{c.media.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Autograder: testes mais falhados */}
        {testAgg.size > 0 && (
          <>
            <div className="rel-sec">Autograder · testes mais falhados</div>
            {testesFalhados.length === 0 ? (
              <p style={{ fontSize: 13.5, margin: 0, color: "#0f766e" }}>Toda a gente passou todos os testes que correram.</p>
            ) : (
              <table className="rel-table">
                <tbody>
                  {testesFalhados.slice(0, 12).map((t) => (
                    <tr key={t.nome}>
                      <td style={{ width: 240 }}>{t.nome}</td>
                      <td><div className="rel-bar"><span style={{ width: `${Math.round(t.taxa * 100)}%`, background: t.taxa >= 0.6 ? "#9f1d1d" : t.taxa >= 0.3 ? "#b45309" : "#0f766e" }} /></div></td>
                      <td style={{ width: 90, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.falhas}/{t.total} falhou</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Integridade */}
        <div className="rel-sec">Integridade</div>
        {integridade.pares.length === 0 && integridade.proximidadeIA.filter((p) => p.score >= 0.12).length === 0 ? (
          <p style={{ fontSize: 13.5, margin: 0, color: "rgba(29,26,19,0.7)" }}>Sem sinais de cópia ou de proximidade elevada à resposta-tipo de IA.</p>
        ) : (
          <>
            {integridade.clusters.length > 0 && (
              <p style={{ fontSize: 13.5, margin: "0 0 8px" }}>
                <strong>{integridade.clusters.length}</strong> grupo(s) de submissões parecidas:{" "}
                {integridade.clusters.map((c) => `${c.nomes.join(" · ")} (${Math.round(c.scoreMax * 100)}%)`).join("; ")}.
              </p>
            )}
            {integridade.proximidadeIA.filter((p) => p.score >= 0.12).length > 0 && (
              <p style={{ fontSize: 13.5, margin: 0 }}>
                Perto da resposta-tipo de IA:{" "}
                {integridade.proximidadeIA.filter((p) => p.score >= 0.12).map((p) => `${p.nome} (${Math.round(p.score * 100)}%)`).join(", ")}.
              </p>
            )}
          </>
        )}

        {/* Alunos a acompanhar */}
        {risco.length > 0 && (
          <>
            <div className="rel-sec">Alunos a acompanhar</div>
            <table className="rel-table">
              <thead><tr><th>Aluno</th><th>Nº</th><th>Nota</th><th>Sinal de IA</th></tr></thead>
              <tbody>
                {risco.map((l, i) => (
                  <tr key={i}>
                    <td>{l.nome}</td>
                    <td style={{ color: "rgba(29,26,19,0.55)" }}>{l.numero ?? "—"}</td>
                    <td style={{ color: cor(l.nota), fontWeight: 600 }}>{l.nota ?? "—"}</td>
                    <td>{l.deteccao != null ? <span className="rel-pill" style={{ background: l.deteccao >= 60 ? "rgba(159,29,29,0.1)" : "rgba(29,26,19,0.06)", color: l.deteccao >= 60 ? "#9f1d1d" : "rgba(29,26,19,0.5)" }}>{l.deteccao}%</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Notas gerais */}
        <div className="rel-sec">Todas as submissões</div>
        <table className="rel-table">
          <thead><tr><th>Aluno</th><th>Nº</th><th>Estado</th><th style={{ textAlign: "right" }}>Nota</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>{l.nome}</td>
                <td style={{ color: "rgba(29,26,19,0.55)" }}>{l.numero ?? "—"}</td>
                <td style={{ color: "rgba(29,26,19,0.6)" }}>{l.estado === "APROVADO" ? "Publicado" : l.estado === "RASCUNHO" ? "Por rever" : l.estado === "ERRO" ? "Erro" : "Pendente"}</td>
                <td style={{ textAlign: "right", color: cor(l.nota), fontWeight: 600 }}>{l.nota ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rel-foot">
          Gerado por Avalia · avaliação assistida por IA com validação humana. As notas da IA são um rascunho; a decisão final é do docente.
        </div>
      </div>
    </div>
  );
}
