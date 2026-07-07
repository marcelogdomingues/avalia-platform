export default function Home() {
  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 56 }}>
        Avaliação de trabalhos,<br />sem começar do zero.
      </h1>
      <p className="page-sub" style={{ fontSize: 18, maxWidth: 560 }}>
        Os alunos submetem, a IA pré-avalia por critério com justificações, e tu só tens de
        rever e aprovar. Genérico para qualquer cadeira — tu defines a rubrica.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <a className="btn" href="/professor">Abrir painel do professor</a>
      </div>

      <div className="card" style={{ marginTop: 40 }}>
        <span className="eyebrow">Como funciona</span>
        <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--muted)", lineHeight: 2 }}>
          <li><b style={{ color: "var(--text)" }}>Defines o trabalho</b> — enunciado + rubrica (critérios com peso).</li>
          <li><b style={{ color: "var(--text)" }}>O aluno submete</b> — PDF, DOCX, TXT ou ZIP de código, por link.</li>
          <li><b style={{ color: "var(--text)" }}>A IA pré-avalia</b> — nota e justificação por critério.</li>
          <li><b style={{ color: "var(--text)" }}>Tu aprovas</b> — ajustas a nota final; só aí conta.</li>
        </ol>
      </div>

      <p className="hint" style={{ marginTop: 24 }}>
        A correr em modo demo (sem chave de LLM). Para avaliação real, define{" "}
        <code>LLM_API_KEY</code> no <code>.env</code>.
      </p>
    </main>
  );
}
