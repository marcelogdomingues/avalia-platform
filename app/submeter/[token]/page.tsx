import { db } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth";
import { LANG_LABELS, type Lang } from "@/lib/runner";
import SubmeterForm from "@/components/SubmeterForm";

export const dynamic = "force-dynamic";

export default async function SubmeterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [assignment, aluno] = await Promise.all([
    db.assignment.findUnique({ where: { submitToken: token }, include: { course: true } }),
    getCurrentStudent(),
  ]);

  const wrap = (children: React.ReactNode) => (
    <div className="public">
      <div className="public-bar">
        <div className="row-between" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
          <span className="brand"><span className="logo" /> Avalia</span>
          {aluno ? <a className="nav-link" href="/aluno">As minhas submissões</a> : null}
        </div>
      </div>
      <div className="centered" style={{ alignItems: "start" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
      </div>
    </div>
  );

  if (!assignment) return wrap(<div className="card">Link de submissão inválido.</div>);

  const tipos = (assignment.tiposFicheiro as string[]) ?? [];
  const suite = assignment.testSuite as { lang: Lang } | null;
  const temTestes = !!(suite && suite.lang);

  return wrap(
    <>
      <span className="eyebrow">{assignment.course.nome}</span>
      <h1 className="page-title" style={{ marginTop: 4 }}>{assignment.titulo}</h1>
      <p className="page-sub">{assignment.enunciado}</p>

      {assignment.prazo && (() => {
        const fechado = Date.now() > assignment.prazo.getTime();
        const bloqueia = assignment.politicaAtraso === "bloquear";
        const cor = fechado ? (bloqueia ? "var(--red)" : "var(--amber)") : "var(--accent)";
        const data = assignment.prazo.toLocaleString("pt-PT", { dateStyle: "long", timeStyle: "short" });
        return (
          <div className="card" style={{ marginBottom: 16, borderColor: cor, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{fechado ? (bloqueia ? "🔒" : "⏰") : "🗓️"}</span>
            <span style={{ fontSize: 14, color: "var(--text)" }}>
              <b>Prazo:</b> {data}. {fechado
                ? bloqueia ? "O prazo terminou — este trabalho já não aceita entregas." : "Prazo terminado — a tua entrega será marcada como fora de prazo."
                : "Ainda a tempo."}
            </span>
          </div>
        );
      })()}

      {!aluno && (
        <div className="card" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
          <p className="hint" style={{ margin: 0 }}>
            💡 <a href={`/aluno/login?next=${encodeURIComponent(`/submeter/${token}`)}`}>Entra</a> ou{" "}
            <a href={`/aluno/registo?next=${encodeURIComponent(`/submeter/${token}`)}`}>cria conta</a> para guardares as
            tuas submissões e veres as notas num só sítio. (Opcional.)
          </p>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">Submeter trabalho</span>
        <div style={{ marginTop: 12 }}>
          <SubmeterForm
            token={token}
            temTestes={temTestes}
            langLabel={temTestes ? LANG_LABELS[suite!.lang] : ""}
            temAluno={!!aluno}
            alunoNome={aluno ? `${aluno.nome}${aluno.numero ? ` (nº ${aluno.numero})` : ""}` : undefined}
            tipos={tipos.join(", ") || "pdf, docx, txt, zip"}
            grupo={assignment.grupo}
          />
        </div>
      </div>
    </>,
  );
}
