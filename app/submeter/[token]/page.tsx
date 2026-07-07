import { db } from "@/lib/db";
import { submeterTrabalho } from "@/lib/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function gradeClass(n: number | null | undefined) {
  if (n == null) return "g-mid";
  if (n >= 14) return "g-high";
  if (n >= 9.5) return "g-mid";
  return "g-low";
}

export default async function SubmeterPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { token } = await params;
  const { sub } = await searchParams;
  const assignment = await db.assignment.findUnique({
    where: { submitToken: token },
    include: { course: true },
  });

  if (!assignment) {
    return (
      <div className="public"><div className="public-bar"><span className="brand"><span className="logo">A</span> Avalia</span></div>
        <div className="centered"><div className="card">Link de submissão inválido.</div></div></div>
    );
  }

  // resultado após submeter (se feedback imediato estiver ligado)
  let resultado: any = null;
  if (sub) {
    const s = await db.submission.findFirst({
      where: { id: sub, assignmentId: assignment.id },
      include: { evaluation: true },
    });
    if (s?.evaluation) resultado = { ...s, ev: s.evaluation };
  }

  const tipos = (assignment.tiposFicheiro as string[]) ?? [];

  async function acao(formData: FormData) {
    "use server";
    const submissionId = await submeterTrabalho(token, formData);
    if (assignment!.feedbackImediato) redirect(`/submeter/${token}?sub=${submissionId}`);
    redirect(`/submeter/${token}?sub=${submissionId}&ok=1`);
  }

  const criterios = (resultado?.ev?.porCriterio as any[]) ?? [];
  const mostrarNota = resultado && assignment.feedbackImediato;

  return (
    <div className="public">
      <div className="public-bar"><span className="brand"><span className="logo">A</span> Avalia</span></div>
      <div className="centered" style={{ alignItems: "start" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <span className="eyebrow">{assignment.course.nome}</span>
          <h1 className="page-title" style={{ marginTop: 4 }}>{assignment.titulo}</h1>
          <p className="page-sub">{assignment.enunciado}</p>

          {resultado && (
            <div className="ok-banner">✓ Trabalho submetido{mostrarNota ? " e avaliado" : ""}.</div>
          )}

          {mostrarNota && (
            <div className="card" style={{ marginBottom: 22 }}>
              <div className="row-between">
                <span className="eyebrow">A tua avaliação (provisória)</span>
                <span className={`grade ${gradeClass(resultado.ev.notaIA)}`}>{resultado.ev.notaIA}<span className="max">/20</span></span>
              </div>
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
              {resultado.ev.feedbackGlobal && <div className="feedback">{resultado.ev.feedbackGlobal}</div>}
              <p className="hint" style={{ marginTop: 12 }}>Nota sujeita a validação do professor.</p>
            </div>
          )}

          <div className="card">
            <span className="eyebrow">{resultado ? "Submeter outro" : "Submeter trabalho"}</span>
            <form action={acao} style={{ marginTop: 12 }}>
              <div className="field">
                <label>Nome</label>
                <input name="alunoNome" required />
              </div>
              <div className="field">
                <label>Número de aluno</label>
                <input name="alunoNumero" />
              </div>
              <div className="field">
                <label>Ficheiro <span className="help">({tipos.join(", ") || "pdf, docx, txt, zip"})</span></label>
                <input name="ficheiro" type="file" required accept=".pdf,.docx,.txt,.md,.zip" />
              </div>
              <button className="btn" type="submit">Submeter</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
