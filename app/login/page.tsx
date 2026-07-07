import { entrar } from "@/lib/actions";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
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
          <h1 className="page-title" style={{ fontSize: 22 }}>Entrar</h1>
          <p className="page-sub" style={{ marginBottom: 20 }}>Acede ao teu painel de avaliação.</p>
          {erro && <div className="err-banner">Email ou password incorretos.</div>}
          <form action={entrar}>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label>Password</label>
              <input name="password" type="password" required autoComplete="current-password" />
            </div>
            <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Entrar</button>
          </form>
          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            Não tens conta? <a href="/registo">Criar conta</a>
          </p>
        </div>
      </div>
    </div>
  );
}
