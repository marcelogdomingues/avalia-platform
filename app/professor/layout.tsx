import { requireProfessor } from "@/lib/auth";
import { sair } from "@/lib/actions";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const prof = await requireProfessor();
  const iniciais = prof.nome
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/professor" className="brand">
          <span className="logo">A</span>
          <span>Avalia</span>
        </a>
        <a href="/professor" className="side-link">📚 Cadeiras</a>
        <div className="spacer" />
        <div className="prof">
          <div className="avatar">{iniciais}</div>
          <div className="meta">
            <div className="nome">{prof.nome}</div>
            <div className="email">{prof.email}</div>
          </div>
        </div>
        <form action={sair}>
          <button type="submit" className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start" }}>
            ↪ Sair
          </button>
        </form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
