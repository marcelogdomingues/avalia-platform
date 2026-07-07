import { getCurrentProfessor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const prof = await getCurrentProfessor();
  return (
    <div className="public">
      <div className="public-bar">
        <div className="row-between" style={{ maxWidth: 940, margin: "0 auto" }}>
          <a href="/" className="brand"><span className="logo">A</span> Avalia</a>
          <div className="btn-row">
            {prof ? (
              <a className="btn" href="/professor">O meu painel</a>
            ) : (
              <>
                <a className="btn ghost sm" href="/login">Entrar</a>
                <a className="btn" href="/registo">Criar conta</a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="centered" style={{ alignItems: "start" }}>
        <div style={{ maxWidth: 640 }}>
          <h1 className="page-title" style={{ fontSize: 40, lineHeight: 1.1, marginTop: 24 }}>
            Avaliação de trabalhos,<br />sem começar do zero.
          </h1>
          <p className="page-sub" style={{ fontSize: 18, maxWidth: 560 }}>
            Os alunos submetem, a IA pré-avalia por critério com justificações, e tu só tens de
            rever e aprovar. Genérico para qualquer cadeira — tu defines a rubrica.
          </p>
          <div className="btn-row">
            <a className="btn" href={prof ? "/professor" : "/registo"}>Começar</a>
            <a className="btn secondary" href="/login">Já tenho conta</a>
          </div>

          <div className="card" style={{ marginTop: 40 }}>
            <span className="eyebrow">Como funciona</span>
            <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--muted)", lineHeight: 2 }}>
              <li><b style={{ color: "var(--text)" }}>Defines o trabalho</b> — enunciado + rubrica (critérios com peso).</li>
              <li><b style={{ color: "var(--text)" }}>O aluno submete</b> — PDF, DOCX, TXT ou ZIP de código, por link.</li>
              <li><b style={{ color: "var(--text)" }}>A IA pré-avalia</b> — nota e justificação por critério.</li>
              <li><b style={{ color: "var(--text)" }}>Tu aprovas</b> — ajustas a nota final e exportas para o Moodle.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
