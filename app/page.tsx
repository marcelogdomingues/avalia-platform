export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", fontFamily: "system-ui", padding: "0 1rem" }}>
      <h1>Avalia</h1>
      <p>Pré-avaliação de trabalhos com IA e validação humana.</p>
      <p>
        <a href="/professor">→ Painel do professor</a> (ver submissões e aprovar notas)
      </p>
      <p style={{ color: "#666", marginTop: "2rem" }}>
        POC em modo demo (sem chave de LLM). Para avaliação real, define{" "}
        <code>LLM_API_KEY</code> no <code>.env</code>. Ver <code>README.md</code>.
      </p>
    </main>
  );
}
