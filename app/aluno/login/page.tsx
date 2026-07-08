import { entrarAluno } from "@/lib/actions";
import { getCurrentStudent } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AlunoLogin({
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
        <h1 className="page-title" style={{ fontSize: 22 }}>Entrar (aluno)</h1>
        <p className="page-sub" style={{ marginBottom: 20 }}>Acede às tuas submissões e notas.</p>
        {erro && <div className="err-banner">Email ou password incorretos.</div>}
        <form action={entrarAluno}>
          <input type="hidden" name="next" value={next ?? "/aluno"} />
          <div className="field"><label>Email</label><input name="email" type="email" required /></div>
          <div className="field"><label>Password</label><input name="password" type="password" required /></div>
          <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Entrar</button>
        </form>
          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            Não tens conta? <a href={`/aluno/registo${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Criar conta</a>
          </p>
        </div>
      </div>
    </div>
  );
}
