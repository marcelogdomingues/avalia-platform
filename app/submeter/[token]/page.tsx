import { db } from "@/lib/db";
import { submeterTrabalho } from "@/lib/actions";
import { getCurrentStudent } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SubmeterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [assignment, aluno] = await Promise.all([
    db.assignment.findUnique({ where: { submitToken: token }, include: { course: true } }),
    getCurrentStudent(),
  ]);

  const wrap = (children: React.ReactNode) => (
    <div className="public">
      <div className="public-bar">
        <div className="row-between" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
          <span className="brand"><span className="logo">A</span> Avalia</span>
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

  async function acao(formData: FormData) {
    "use server";
    const submissionId = await submeterTrabalho(token, formData);
    redirect(`/recibo/${submissionId}`);
  }

  return wrap(
    <>
      <span className="eyebrow">{assignment.course.nome}</span>
      <h1 className="page-title" style={{ marginTop: 4 }}>{assignment.titulo}</h1>
      <p className="page-sub">{assignment.enunciado}</p>

      {!aluno && (
        <div className="card" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
          <p className="hint" style={{ margin: 0 }}>
            💡 <a href={`/aluno/login?next=${encodeURIComponent(`/submeter/${token}`)}`}>Entra</a> ou{" "}
            <a href={`/aluno/registo?next=${encodeURIComponent(`/submeter/${token}`)}`}>cria conta</a> para
            guardares as tuas submissões e veres as notas num só sítio. (Opcional.)
          </p>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">Submeter trabalho</span>
        <form action={acao} style={{ marginTop: 12 }}>
          {aluno ? (
            <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
              A submeter como <b>{aluno.nome}</b>{aluno.numero ? ` (nº ${aluno.numero})` : ""}.
            </p>
          ) : (
            <>
              <div className="field"><label>Nome</label><input name="alunoNome" required /></div>
              <div className="field"><label>Número de aluno</label><input name="alunoNumero" /></div>
            </>
          )}
          <div className="field">
            <label>Ficheiro <span className="help">({tipos.join(", ") || "pdf, docx, txt, zip"})</span></label>
            <input name="ficheiro" type="file" required accept=".pdf,.docx,.txt,.md,.zip,.png,.jpg,.jpeg,.webp" />
          </div>
          <button className="btn" type="submit">Submeter</button>
        </form>
      </div>
    </>,
  );
}
