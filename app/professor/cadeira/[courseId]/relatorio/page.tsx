import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { notFound } from "next/navigation";
import { calcularStats } from "@/lib/stats";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const nota1 = (n: number | null) => (n == null ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));

// Relatório imprimível da cadeira — visão para coordenação (PDF).
export default async function RelatorioPage({ params }: { params: Promise<{ courseId: string }> }) {
  const prof = await requireProfessor();
  const { courseId } = await params;

  const course = await db.course.findFirst({
    where: { id: courseId, ...cadeiraAcesso(prof.id) },
    include: {
      professor: { select: { nome: true } },
      coDocentes: { include: { professor: { select: { nome: true } } } },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: { submissions: { include: { evaluation: { select: { estado: true, notaIA: true, notaFinal: true, deteccaoIA: true } } } } },
      },
    },
  });
  if (!course) notFound();

  const nota = (ev: { estado: string; notaIA: number | null; notaFinal: number | null } | null) =>
    ev == null ? null : ev.estado === "APROVADO" ? ev.notaFinal ?? ev.notaIA ?? null : ev.notaIA ?? null;

  const todasEvals = course.assignments.flatMap((a) => a.submissions.map((s) => s.evaluation ?? { estado: "PENDENTE", notaIA: null, notaFinal: null }));
  const stats = calcularStats(todasEvals);
  const maxBalde = Math.max(1, ...stats.distribuicao.map((d) => d.n));

  const porTrabalho = course.assignments.map((a) => {
    const notas = a.submissions.map((s) => nota(s.evaluation)).filter((n): n is number => n != null);
    const media = notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : null;
    const aprov = notas.filter((n) => n >= 9.5).length;
    const sinaisIA = a.submissions.filter((s) => ((s.evaluation?.deteccaoIA as { probabilidade?: number } | null)?.probabilidade ?? 0) >= 60).length;
    return { titulo: a.titulo, n: a.submissions.length, media, taxa: notas.length ? Math.round((aprov / notas.length) * 100) : null, sinaisIA };
  });

  const docentes = [course.professor?.nome, ...course.coDocentes.map((c) => c.professor.nome)].filter(Boolean);
  const dataStr = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date());

  return (
    <div className="rel-root">
      <style>{`
        .rel-root { background: transparent; min-height: 100vh; padding: 32px 20px; color: #1d1a13; font-family: var(--font-inter, system-ui), sans-serif; }
        .rel-page { max-width: 780px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); padding: 44px 52px; }
        .rel-bar { max-width: 780px; margin: 0 auto 16px; display: flex; justify-content: space-between; gap: 12px; }
        .rel-h1 { font-family: var(--font-newsreader, Georgia), serif; font-size: 28px; font-weight: 500; margin: 0 0 2px; }
        .rel-sub { color: rgba(29,26,19,0.55); font-size: 13.5px; margin-bottom: 26px; }
        .rel-sec { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(29,26,19,0.5); font-weight: 600; margin: 28px 0 12px; }
        .rel-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .rel-stat { border: 1px solid rgba(29,26,19,0.1); border-radius: 10px; padding: 14px 16px; }
        .rel-stat .n { font-family: var(--font-newsreader, Georgia), serif; font-size: 26px; font-weight: 500; }
        .rel-stat .l { font-size: 11.5px; color: rgba(29,26,19,0.55); margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(29,26,19,0.55); padding: 7px 8px; border-bottom: 2px solid rgba(29,26,19,0.12); font-weight: 600; }
        td { padding: 8px; border-bottom: 1px solid rgba(29,26,19,0.07); }
        .bar-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; margin-bottom: 6px; }
        .bar-track { flex: 1; height: 16px; background: rgba(29,26,19,0.06); border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; background: #0f766e; border-radius: 4px; }
        .foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid rgba(29,26,19,0.1); font-size: 11px; color: rgba(29,26,19,0.5); }
        @media print { .no-print { display: none !important; } .rel-root { background: #fff; padding: 0; } .rel-page { box-shadow: none; border-radius: 0; padding: 0; max-width: none; } }
        @page { margin: 16mm; }
      `}</style>
      <div className="rel-bar no-print">
        <a href={`/professor/cadeira/${course.id}`} className="btn secondary" style={{ padding: "9px 16px" }}>← Voltar</a>
        <PrintButton />
      </div>
      <div className="rel-page">
        <h1 className="rel-h1">Relatório da cadeira</h1>
        <div className="rel-sub">{course.nome}{course.ano ? ` · ${course.ano}` : ""} · {docentes.join(", ")} · emitido a {dataStr}</div>

        <div className="rel-grid">
          <div className="rel-stat"><div className="n">{course.assignments.length}</div><div className="l">Trabalhos</div></div>
          <div className="rel-stat"><div className="n">{stats.total}</div><div className="l">Submissões</div></div>
          <div className="rel-stat"><div className="n">{nota1(stats.media)}</div><div className="l">Média /20</div></div>
          <div className="rel-stat"><div className="n">{stats.avaliadas ? Math.round((stats.distribuicao.slice(2).reduce((a, b) => a + b.n, 0) / stats.avaliadas) * 100) : 0}%</div><div className="l">Taxa de aprovação</div></div>
        </div>

        <div className="rel-sec">Distribuição das notas</div>
        {stats.distribuicao.map((d) => (
          <div key={d.faixa} className="bar-row">
            <span style={{ width: 46, color: "rgba(29,26,19,0.6)" }}>{d.faixa}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.n / maxBalde) * 100}%`, background: d.faixa === "0–4" || d.faixa === "4–8" ? "#9f1d1d" : d.faixa === "8–12" ? "#b45309" : "#0f766e" }} /></span>
            <span style={{ width: 24, textAlign: "right", fontWeight: 600 }}>{d.n}</span>
          </div>
        ))}

        <div className="rel-sec">Por trabalho</div>
        <table>
          <thead><tr><th>Trabalho</th><th style={{ textAlign: "right" }}>Subs.</th><th style={{ textAlign: "right" }}>Média</th><th style={{ textAlign: "right" }}>Aprov.</th><th style={{ textAlign: "right" }}>Sinais IA</th></tr></thead>
          <tbody>
            {porTrabalho.map((t, i) => (
              <tr key={i}>
                <td>{t.titulo}</td>
                <td style={{ textAlign: "right" }}>{t.n}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{nota1(t.media)}</td>
                <td style={{ textAlign: "right" }}>{t.taxa != null ? `${t.taxa}%` : "—"}</td>
                <td style={{ textAlign: "right", color: t.sinaisIA > 0 ? "#b45309" : "inherit" }}>{t.sinaisIA || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="foot">Documento informativo gerado por Avalia. Os sinais de IA são indícios para revisão pedagógica, não veredictos.</div>
      </div>
    </div>
  );
}
