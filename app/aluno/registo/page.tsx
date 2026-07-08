import { registarAluno } from "@/lib/actions";
import { getCurrentStudent } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AlunoRegisto({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  if (await getCurrentStudent()) redirect(next ?? "/aluno");

  return (
    <div className="public">
      <div className="public-bar">
        <a href="/" className="brand"><span className="logo" /> Avalia · Aluno</a>
      </div>
      <div className="centered">
        <div className="card auth-card">
        <h1 className="page-title" style={{ fontSize: 22 }}>Criar conta (aluno)</h1>
        <p className="page-sub" style={{ marginBottom: 20 }}>Guarda as tuas submissões e vê as notas.</p>
        {erro === "email" && <div className="err-banner">Já existe uma conta com esse email.</div>}
        {erro === "campos" && <div className="err-banner">Preenche tudo (password ≥ 6 caracteres).</div>}
        <form action={registarAluno}>
          <input type="hidden" name="next" value={next ?? "/aluno"} />
          <div className="field"><label>Nome</label><input name="nome" required /></div>
          <div className="field"><label>Número de aluno</label><input name="numero" /></div>
          <div className="field"><label>Email</label><input name="email" type="email" required /></div>
          <div className="field"><label>Password <span className="help">(mín. 6)</span></label><input name="password" type="password" required minLength={6} /></div>
          <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Criar conta</button>
        </form>
          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            Já tens conta? <a href={`/aluno/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Entrar</a>
          </p>
        </div>
      </div>
    </div>
  );
}
