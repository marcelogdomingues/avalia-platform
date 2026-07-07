export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h1>Avalia</h1>
      <p>
        Plataforma de pré-avaliação de trabalhos com IA e validação humana.
        Esqueleto do MVP — ver <code>docs/PROJETO.md</code>.
      </p>
      <ul>
        <li>Motor de avaliação: <code>lib/evaluate.ts</code></li>
        <li>Extração de conteúdo: <code>lib/extract.ts</code></li>
        <li>Endpoint: <code>POST /api/evaluate</code></li>
        <li>Schema de dados: <code>prisma/schema.prisma</code></li>
      </ul>
    </main>
  );
}
