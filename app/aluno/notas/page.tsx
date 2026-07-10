import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { notaTexto, escalaSufixo, aprovado20, type Escala } from "@/lib/escala";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Boletim de notas do aluno — imprimível / guardar como PDF.
export default async function BoletimPage() {
  const aluno = await requireStudent();
  const subs = await db.submission.findMany({
    where: { studentId: aluno.id },
    orderBy: { createdAt: "desc" },
    include: { assignment: { include: { course: true } }, evaluation: true },
  });

  const linhas = subs.map((s) => {
    const ev = s.evaluation;
    const aprovado = ev?.estado === "APROVADO";
    const released = aprovado || s.assignment.feedbackImediato;
    const nota20 = released ? (aprovado ? ev?.notaFinal ?? ev?.notaIA ?? null : ev?.notaIA ?? null) : null;
    return {
      cadeira: s.assignment.course.nome,
      trabalho: s.assignment.titulo,
      data: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(s.createdAt),
      escala: (s.assignment.escala ?? "vinte") as Escala,
      nota20,
      estado: aprovado ? "Publicada" : released ? "Provisória" : "A aguardar",
    };
  });

  const publicadas = linhas.filter((l) => l.nota20 != null);
  const media = publicadas.length ? publicadas.reduce((a, l) => a + (l.nota20 ?? 0), 0) / publicadas.length : null;
  const dataStr = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date());

  const cor = (n: number | null) => (n == null ? "#999" : aprovado20(n) ? (n >= 14 ? "#0f766e" : "#b45309") : "#9f1d1d");

  return (
    <div className="rel-root">
      <style>{`
        .rel-root { background: #f4f2ec; min-height: 100vh; padding: 32px 20px; color: #1d1a13; font-family: var(--font-inter, system-ui), sans-serif; }
        .rel-page { max-width: 760px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); padding: 44px 52px; }
        .rel-bar2 { max-width: 760px; margin: 0 auto 16px; display: flex; justify-content: space-between; gap: 12px; }
        .rel-h1 { font-family: var(--font-newsreader, Georgia), serif; font-size: 28px; font-weight: 500; margin: 0 0 2px; }
        .rel-sub { color: rgba(29,26,19,0.55); font-size: 13.5px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(29,26,19,0.55); padding: 8px 8px; border-bottom: 2px solid rgba(29,26,19,0.12); font-weight: 600; }
        td { padding: 9px 8px; border-bottom: 1px solid rgba(29,26,19,0.07); }
        .foot { margin-top: 26px; padding-top: 14px; border-top: 1px solid rgba(29,26,19,0.1); font-size: 11.5px; color: rgba(29,26,19,0.5); }
        @media print { .no-print { display: none !important; } .rel-root { background: #fff; padding: 0; } .rel-page { box-shadow: none; border-radius: 0; padding: 0; max-width: none; } }
        @page { margin: 18mm; }
      `}</style>
      <div className="rel-bar2 no-print">
        <a href="/aluno" className="btn secondary" style={{ padding: "9px 16px" }}>← Voltar</a>
        <PrintButton />
      </div>
      <div className="rel-page">
        <h1 className="rel-h1">Boletim de notas</h1>
        <div className="rel-sub">{aluno.nome}{aluno.numero ? ` · nº ${aluno.numero}` : ""} · emitido a {dataStr}</div>

        {media != null && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
            <span style={{ fontFamily: "var(--font-newsreader, Georgia), serif", fontSize: 34, fontWeight: 500, color: cor(media) }}>{Math.round(media * 10) / 10}</span>
            <span style={{ fontSize: 13.5, color: "rgba(29,26,19,0.6)" }}>média geral (/20) · {publicadas.length} nota(s) lançada(s)</span>
          </div>
        )}

        {linhas.length === 0 ? (
          <p style={{ color: "rgba(29,26,19,0.6)" }}>Ainda não tens submissões.</p>
        ) : (
          <table>
            <thead><tr><th>Cadeira</th><th>Trabalho</th><th>Data</th><th style={{ textAlign: "right" }}>Nota</th><th>Estado</th></tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td style={{ color: "rgba(29,26,19,0.7)" }}>{l.cadeira}</td>
                  <td>{l.trabalho}</td>
                  <td style={{ color: "rgba(29,26,19,0.55)" }}>{l.data}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: cor(l.nota20) }}>{l.nota20 != null ? `${notaTexto(l.nota20, l.escala)}${escalaSufixo(l.escala)}` : "—"}</td>
                  <td style={{ color: "rgba(29,26,19,0.6)", fontSize: 12.5 }}>{l.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot">Documento informativo gerado por Avalia. As notas provisórias estão sujeitas a validação do docente.</div>
      </div>
    </div>
  );
}
