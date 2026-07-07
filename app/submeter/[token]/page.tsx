import { db } from "@/lib/db";
import { submeterTrabalho } from "@/lib/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SubmeterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const assignment = await db.assignment.findUnique({
    where: { submitToken: token },
    include: { course: true },
  });

  if (!assignment) {
    return <main style={wrap}><p>Link de submissão inválido.</p></main>;
  }

  const tipos = (assignment.tiposFicheiro as string[]) ?? [];

  async function acao(formData: FormData) {
    "use server";
    await submeterTrabalho(token, formData);
    redirect("/submeter/" + token + "?ok=1");
  }

  return (
    <main style={wrap}>
      <h1>{assignment.titulo}</h1>
      <p style={{ color: "#666" }}>{assignment.course.nome}</p>
      <p>{assignment.enunciado}</p>

      <form action={acao} style={{ display: "grid", gap: 12, marginTop: "1.5rem", maxWidth: 420 }}>
        <label>Nome<br /><input name="alunoNome" required style={inp} /></label>
        <label>Número de aluno<br /><input name="alunoNumero" style={inp} /></label>
        <label>
          Ficheiro ({tipos.join(", ") || "pdf, docx, txt, zip"})<br />
          <input name="ficheiro" type="file" required
            accept=".pdf,.docx,.txt,.md,.zip" />
        </label>
        <button type="submit">Submeter</button>
      </form>
    </main>
  );
}

const wrap = { maxWidth: 640, margin: "3rem auto", fontFamily: "system-ui", padding: "0 1rem" } as const;
const inp = { width: "100%", padding: 6 } as const;
