import { db } from "@/lib/db";
import { submeterTrabalho } from "@/lib/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SubmeterPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { token } = await params;
  const { ok } = await searchParams;
  const assignment = await db.assignment.findUnique({
    where: { submitToken: token },
    include: { course: true },
  });

  if (!assignment) {
    return (
      <main className="container">
        <div className="card" style={{ marginTop: 40 }}>
          <p className="empty">Link de submissão inválido.</p>
        </div>
      </main>
    );
  }

  const tipos = (assignment.tiposFicheiro as string[]) ?? [];

  async function acao(formData: FormData) {
    "use server";
    await submeterTrabalho(token, formData);
    redirect("/submeter/" + token + "?ok=1");
  }

  return (
    <main className="container">
      <span className="eyebrow" style={{ display: "block", marginTop: 40 }}>{assignment.course.nome}</span>
      <h1 className="page-title" style={{ marginTop: 4 }}>{assignment.titulo}</h1>
      <p className="page-sub">{assignment.enunciado}</p>

      {ok && <div className="ok-banner">✓ Trabalho submetido e avaliado. Podes submeter outro se quiseres.</div>}

      <div className="card" style={{ maxWidth: 460 }}>
        <form action={acao}>
          <div className="field">
            <label>Nome</label>
            <input className="input" name="alunoNome" required />
          </div>
          <div className="field">
            <label>Número de aluno</label>
            <input className="input" name="alunoNumero" />
          </div>
          <div className="field">
            <label>Ficheiro <span className="hint">({tipos.join(", ") || "pdf, docx, txt, zip"})</span></label>
            <input name="ficheiro" type="file" required accept=".pdf,.docx,.txt,.md,.zip" />
          </div>
          <button className="btn" type="submit">Submeter trabalho</button>
        </form>
      </div>
    </main>
  );
}
