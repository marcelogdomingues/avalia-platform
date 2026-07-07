import { getCurrentStudent } from "@/lib/auth";
import { sairAluno } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const aluno = await getCurrentStudent();
  return (
    <div className="public">
      <div className="public-bar">
        <div className="row-between" style={{ maxWidth: 880, margin: "0 auto" }}>
          <a href="/aluno" className="brand"><span className="logo">A</span> Avalia · Aluno</a>
          {aluno && (
            <div className="btn-row">
              <span className="muted" style={{ fontSize: 14 }}>{aluno.nome}</span>
              <form action={sairAluno}><button className="btn ghost sm" type="submit">Sair</button></form>
            </div>
          )}
        </div>
      </div>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px 80px", width: "100%" }}>
        {children}
      </div>
    </div>
  );
}
