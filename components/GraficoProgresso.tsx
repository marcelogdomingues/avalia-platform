// Gráfico de progresso (linha) em SVG puro — sem cliente, imprimível.
// Mostra a evolução das notas (0–20) por ordem cronológica, com linha de
// aprovação a 9,5 e pontos coloridos por aprovação.

export type PontoProgresso = { label: string; nota: number; data?: string };

export default function GraficoProgresso({
  pontos,
  altura = 170,
  titulo,
}: {
  pontos: PontoProgresso[];
  altura?: number;
  titulo?: string;
}) {
  if (pontos.length < 2) return null;

  const W = 640;
  const H = altura;
  const padL = 30, padR = 14, padT = 16, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const x = (i: number) => padL + (pontos.length === 1 ? innerW / 2 : (innerW * i) / (pontos.length - 1));
  const y = (n: number) => padT + innerH - (Math.max(0, Math.min(20, n)) / 20) * innerH;

  const cor = (n: number) => (n < 9.5 ? "#9f1d1d" : n < 14 ? "#b45309" : "#0f766e");
  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.nota).toFixed(1)}`).join(" ");
  const yPass = y(9.5);

  const media = pontos.reduce((a, p) => a + p.nota, 0) / pontos.length;
  const tendencia = pontos[pontos.length - 1].nota - pontos[0].nota;

  return (
    <div>
      {titulo && (
        <div className="row-between" style={{ marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <span className="eyebrow">{titulo}</span>
          <span style={{ fontSize: 12.5, color: "rgba(29,26,19,0.6)" }}>
            média {Math.round(media * 10) / 10}/20 ·{" "}
            <span style={{ color: tendencia > 0.3 ? "#0f766e" : tendencia < -0.3 ? "#9f1d1d" : "rgba(29,26,19,0.5)", fontWeight: 600 }}>
              {tendencia > 0.3 ? "↑ a melhorar" : tendencia < -0.3 ? "↓ a descer" : "→ estável"}
            </span>
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Gráfico de progresso das notas" style={{ display: "block" }}>
        {/* grelha horizontal em 0, 10, 20 */}
        {[0, 10, 20].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgba(29,26,19,0.08)" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="rgba(29,26,19,0.45)">{v}</text>
          </g>
        ))}
        {/* linha de aprovação a 9,5 */}
        <line x1={padL} y1={yPass} x2={W - padR} y2={yPass} stroke="rgba(159,29,29,0.4)" strokeWidth={1} strokeDasharray="4 4" />
        <text x={W - padR} y={yPass - 4} textAnchor="end" fontSize={9.5} fill="rgba(159,29,29,0.7)">aprovação 9,5</text>
        {/* linha de progresso */}
        <path d={linha} fill="none" stroke="rgba(29,26,19,0.35)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* pontos + rótulos */}
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.nota)} r={4.5} fill={cor(p.nota)} />
            <text x={x(i)} y={y(p.nota) - 9} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={cor(p.nota)}>{Math.round(p.nota * 10) / 10}</text>
            <text x={x(i)} y={H - 12} textAnchor="middle" fontSize={9.5} fill="rgba(29,26,19,0.5)">{p.label.length > 12 ? p.label.slice(0, 11) + "…" : p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
