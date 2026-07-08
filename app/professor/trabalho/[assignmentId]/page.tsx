import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { aprovar, reavaliar, apagarTrabalho, aprovarTodas, gerarLinhaBase } from "@/lib/actions";
import { temLLM } from "@/lib/evaluate";
import { calcularStats } from "@/lib/stats";
import { calcularSimilaridades, similaridadeComTexto } from "@/lib/similaridade";

export const dynamic = "force-dynamic";

function gradeClass(n: number | null | undefined) {
  if (n == null) return "g-mid";
  if (n >= 14) return "g-high";
  if (n >= 9.5) return "g-mid";
  return "g-low";
}

export default async function TrabalhoPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ filtro?: string; ordenar?: string }>;
}) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;
  const { filtro = "todas", ordenar = "recentes" } = await searchParams;
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: { professorId: prof.id } },
    include: {
      course: true,
      submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!a) notFound();

  const stats = calcularStats(a.submissions.map((s) => s.evaluation ?? { estado: "PENDENTE", notaIA: null, notaFinal: null }));
  const sims = calcularSimilaridades(
    a.submissions.map((s) => ({ id: s.id, alunoNome: s.alunoNome, conteudoExtraido: s.conteudoExtraido })),
  );
  const maxDist = Math.max(1, ...stats.distribuicao.map((d) => d.n));
  const pendentes = a.submissions.filter((s) => s.evaluation?.estado === "RASCUNHO").length;

  // Deriva campos por submissão (para filtrar/ordenar), preservando a ordem por data.
  const items = a.submissions.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const nota = aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null;
    const sim = sims.get(s.id);
    const simIA = similaridadeComTexto(s.conteudoExtraido, a.respostaIA);
    return { s, ev, aprovado, nota, sim, simIA, estado: ev?.estado ?? "PENDENTE" };
  });

  // Suspeita = cópia entre alunos OU proximidade com a linha-base de IA.
  const suspeita = (i: (typeof items)[number]) =>
    (i.sim != null && i.sim.score >= 0.15) || i.simIA >= 0.12;

  const contagens = {
    todas: items.length,
    pendentes: items.filter((i) => i.estado === "RASCUNHO").length,
    aprovadas: items.filter((i) => i.aprovado).length,
    suspeitas: items.filter(suspeita).length,
  };

  let lista = items;
  if (filtro === "pendentes") lista = items.filter((i) => i.estado === "RASCUNHO");
  else if (filtro === "aprovadas") lista = items.filter((i) => i.aprovado);
  else if (filtro === "suspeitas") lista = items.filter(suspeita);

  if (ordenar === "nota_desc") lista = [...lista].sort((x, y) => (y.nota ?? -1) - (x.nota ?? -1));
  else if (ordenar === "nota_asc") lista = [...lista].sort((x, y) => (x.nota ?? 99) - (y.nota ?? 99));
  else if (ordenar === "nome") lista = [...lista].sort((x, y) => x.s.alunoNome.localeCompare(y.s.alunoNome, "pt"));

  const base = `/professor/trabalho/${a.id}`;
  const qs = (o: { filtro?: string; ordenar?: string }) =>
    `${base}?filtro=${o.filtro ?? filtro}&ordenar=${o.ordenar ?? ordenar}`;
  const filtros: { key: string; label: string; n: number }[] = [
    { key: "todas", label: "Todas", n: contagens.todas },
    { key: "pendentes", label: "Por aprovar", n: contagens.pendentes },
    { key: "aprovadas", label: "Aprovadas", n: contagens.aprovadas },
    { key: "suspeitas", label: "Suspeitas", n: contagens.suspeitas },
  ];
  const ordens: { key: string; label: string }[] = [
    { key: "recentes", label: "Recentes" },
    { key: "nota_desc", label: "Nota ↓" },
    { key: "nota_asc", label: "Nota ↑" },
    { key: "nome", label: "Nome" },
  ];

  return (
    <>
      <div className="breadcrumb">
        <a href="/professor">Cadeiras</a> <span>/</span>
        <a href={`/professor/cadeira/${a.courseId}`}>{a.course.nome}</a> <span>/</span>
        <span>{a.titulo}</span>
      </div>

      <div className="row-between">
        <h1 className="page-title" style={{ margin: 0 }}>{a.titulo}</h1>
        <div className="btn-row">
          <a className="btn secondary sm" href={`/professor/trabalho/${a.id}/editar`}>Editar</a>
          <form action={apagarTrabalho}>
            <input type="hidden" name="assignmentId" value={a.id} />
            <button className="btn danger sm" type="submit">Apagar</button>
          </form>
        </div>
      </div>
      <p className="page-sub">{a.enunciado}</p>

      {!temLLM && (
        <div className="demo-banner">
          <span>⚠️</span>
          <span>Modo demo — notas por heurística. Define <code>LLM_API_KEY</code> no <code>.env</code> para avaliação real.</span>
        </div>
      )}

      {/* Estatísticas */}
      {stats.total > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="eyebrow">Estatísticas</span>
          <div className="row-between" style={{ marginTop: 12, flexWrap: "wrap", gap: 20 }}>
            <div className="statgrid">
              <div className="stat"><div className="stat-n">{stats.total}</div><div className="stat-l">submissões</div></div>
              <div className="stat"><div className="stat-n">{stats.media ?? "—"}</div><div className="stat-l">média /20</div></div>
              <div className="stat"><div className="stat-n">{stats.min ?? "—"}–{stats.max ?? "—"}</div><div className="stat-l">min–máx</div></div>
              <div className="stat"><div className="stat-n">{stats.aprovadas}/{stats.total}</div><div className="stat-l">aprovadas</div></div>
            </div>
            <div className="histo">
              {stats.distribuicao.map((d) => (
                <div key={d.faixa} className="histo-col">
                  <div className="histo-bar" style={{ height: `${(d.n / maxDist) * 60 + 2}px` }} title={`${d.n}`} />
                  <div className="histo-lbl">{d.faixa}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Link do aluno + ações */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="eyebrow">Link de submissão do aluno</span>
            <div style={{ marginTop: 6 }}><span className="submit-link">🔗 <code>/submeter/{a.submitToken}</code></span></div>
          </div>
          <div className="btn-row">
            <a className="btn secondary sm" href={`/submeter/${a.submitToken}`} target="_blank">Abrir página do aluno ↗</a>
            <a className="btn sm" href={`/professor/trabalho/${a.id}/export`}>⬇ Exportar CSV</a>
          </div>
        </div>
      </div>

      {temLLM && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div style={{ maxWidth: 620 }}>
              <span className="eyebrow">🛡️ Linha-base de IA</span>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
                {a.respostaIA
                  ? "Resposta-tipo que uma IA produz para este enunciado. Cada submissão é comparada com ela — proximidade alta é sinal de uso de IA."
                  : "Gera a resposta-tipo da IA para este enunciado. Depois, cada submissão mostra quão próxima está dela."}
              </p>
            </div>
            <form action={gerarLinhaBase}>
              <input type="hidden" name="assignmentId" value={a.id} />
              <button className="btn secondary sm" type="submit">
                {a.respostaIA ? "↻ Regenerar" : "Gerar linha-base"}
              </button>
            </form>
          </div>
          {a.respostaIA && (
            <details className="disclosure" style={{ marginTop: 10 }}>
              <summary>Ver resposta-tipo da IA</summary>
              <p className="justif" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{a.respostaIA}</p>
            </details>
          )}
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title">Submissões ({a.submissions.length})</h2>
        {pendentes > 0 && (
          <form action={aprovarTodas}>
            <input type="hidden" name="assignmentId" value={a.id} />
            <button className="btn secondary sm" type="submit">✓ Aprovar {pendentes} pendente(s)</button>
          </form>
        )}
      </div>

      {a.submissions.length > 0 && (
        <div className="toolbar">
          <div className="seg">
            {filtros.map((f) => (
              <a key={f.key} href={qs({ filtro: f.key })} className={filtro === f.key ? "active" : ""}>
                {f.label}<span className="n">{f.n}</span>
              </a>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="seg-label">Ordenar</span>
            <div className="seg">
              {ordens.map((o) => (
                <a key={o.key} href={qs({ ordenar: o.key })} className={ordenar === o.key ? "active" : ""}>
                  {o.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {a.submissions.length === 0 ? (
        <div className="card empty-state"><div className="big">📥</div><p>Ainda sem submissões. Partilha o link acima.</p></div>
      ) : lista.length === 0 ? (
        <div className="card empty-state"><div className="big">🔍</div><p>Nenhuma submissão neste filtro.</p></div>
      ) : (
        lista.map(({ s, ev, aprovado, nota, sim, simIA }) => {
          const criterios = (ev?.porCriterio as any[]) ?? [];
          const estado = (ev?.estado ?? "PENDENTE").toLowerCase();
          const alta = sim && sim.score >= 0.35;
          const altaIA = simIA >= 0.3;
          const perguntas = (ev?.perguntasDefesa as string[] | null) ?? [];
          return (
            <div key={s.id} className="card submission">
              <div className="submission-head">
                <div>
                  <div className="student">
                    {s.alunoNome}
                    {s.alunoNumero ? <span className="num"> · nº {s.alunoNumero}</span> : null}
                    {s.studentId ? <span className="num" title="Conta de aluno"> · ✓ conta</span> : null}
                  </div>
                  <span className="model-tag">{ev?.modelo ?? "—"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {simIA >= 0.12 && (
                    <span className={`badge ${altaIA ? "s-erro" : "s-rascunho"}`} title="Proximidade com a resposta-tipo da IA">
                      ≈ IA {Math.round(simIA * 100)}%
                    </span>
                  )}
                  {sim && sim.score >= 0.15 && (
                    <span className={`badge ${alta ? "s-erro" : "s-rascunho"}`} title={`Parecido com ${sim.outroNome}`}>
                      ⚠ {Math.round(sim.score * 100)}% similar
                    </span>
                  )}
                  <span className={`badge s-${estado}`}>{ev?.estado ?? "PENDENTE"}</span>
                  <span className={`grade ${gradeClass(nota)}`}>{nota ?? "—"}<span className="max">/20</span></span>
                </div>
              </div>

              {alta && (
                <div className="err-banner" style={{ margin: "12px 0 0" }}>
                  Alta similaridade ({Math.round(sim!.score * 100)}%) com a submissão de <b>{sim!.outroNome}</b> — possível cópia.
                </div>
              )}
              {altaIA && (
                <div className="err-banner" style={{ margin: "12px 0 0" }}>
                  Proximidade alta ({Math.round(simIA * 100)}%) com a resposta-tipo da IA — possível uso de IA. Confirma com as perguntas de defesa.
                </div>
              )}

              <ul className="criteria">
                {criterios.map((c) => {
                  const pct = c.pontosMax > 0 ? Math.round((c.pontos / c.pontosMax) * 100) : 0;
                  return (
                    <li key={c.criterioId} className="criterion">
                      <div className="criterion-top">
                        <span className="criterion-name">{c.nome}</span>
                        <span className="criterion-score">{c.pontos}/{c.pontosMax}</span>
                      </div>
                      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                      <p className="justif">{c.justificacao}</p>
                    </li>
                  );
                })}
              </ul>

              {ev?.feedbackGlobal && <div className="feedback">{ev.feedbackGlobal}</div>}

              {perguntas.length > 0 && (
                <details className="disclosure" style={{ marginTop: 14 }}>
                  <summary>🎤 Perguntas de defesa ({perguntas.length})</summary>
                  <ul className="justif" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {perguntas.map((q, i) => (
                      <li key={i} style={{ marginBottom: 5 }}>{q}</li>
                    ))}
                  </ul>
                </details>
              )}

              <hr className="hr" />
              <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
                {ev && !aprovado ? (
                  <form action={aprovar} className="btn-row" style={{ alignItems: "end" }}>
                    <input type="hidden" name="evaluationId" value={ev.id} />
                    <div className="field" style={{ margin: 0, width: 96 }}>
                      <label>Nota final</label>
                      <input name="notaFinal" type="number" step="0.1" min="0" max="20" defaultValue={ev.notaIA ?? undefined} />
                    </div>
                    <button className="btn" type="submit">Aprovar</button>
                  </form>
                ) : (
                  <span className="muted" style={{ fontSize: 14 }}>
                    {aprovado ? `✓ Aprovado — nota final ${ev?.notaFinal ?? ev?.notaIA}/20` : "Sem avaliação"}
                  </span>
                )}
                <div className="btn-row">
                  <a className="btn ghost sm" href={`/recibo/${s.id}`} target="_blank">Ver recibo ↗</a>
                  <form action={reavaliar}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button className="btn ghost sm" type="submit">↻ Re-avaliar</button>
                  </form>
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
