import { registar } from "@/lib/actions";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RegistoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await getCurrentProfessor()) redirect("/professor");
  const { erro } = await searchParams;

  return (
    <div className="public">
      <div className="public-bar">
        <a href="/" className="brand"><span className="logo">A</span> Avalia</a>
      </div>
      <div className="centered">
        <div className="card auth-card">
          <h1 className="page-title" style={{ fontSize: 22 }}>Criar conta</h1>
          <p className="page-sub" style={{ marginBottom: 20 }}>Regista-te como professor e começa a avaliar.</p>
          {erro === "email" && <div className="err-banner">Já existe uma conta com esse email.</div>}
          {erro === "campos" && <div className="err-banner">Preenche todos os campos (password ≥ 6 caracteres).</div>}
          <form action={registar}>
            <div className="field">
              <label>Nome</label>
              <input name="nome" type="text" required />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label>Password <span className="help">(mínimo 6 caracteres)</span></label>
              <input name="password" type="password" required minLength={6} autoComplete="new-password" />
            </div>
            <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Criar conta</button>
          </form>
          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            Já tens conta? <a href="/login">Entrar</a>
          </p>
        </div>
      </div>
    </div>
  );
}
