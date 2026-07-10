import { requireProfessor } from "@/lib/auth";
import { db } from "@/lib/db";
import { cadeiraAcesso } from "@/lib/acesso";
import { notFound } from "next/navigation";
import { diffPalavras } from "@/lib/diff";
import { similaridadeComTexto } from "@/lib/similaridade";

export const dynamic = "force-dynamic";

// Compara duas submissões lado a lado, destacando o texto partilhado (indício de
// cópia). As passagens comuns (segmentos "igual" do diff) ficam realçadas em ambas.
export default async function CompararPage({
  params, searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const prof = await requireProfessor();
  const { assignmentId } = await params;
  const { a: aId, b: bId } = await searchParams;

  const a = await db.assignment.findFirst({
    where: { id: assignmentId, course: cadeiraAcesso(prof.id) },
    include: { course: true, submissions: { include: { evaluation: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!a) notFound();

  const subA = a.submissions.find((s) => s.id === aId);
  const subB = a.submissions.find((s) => s.id === bId);
  const back = `/professor/trabalho/${a.id}`;

  const escolher = (excluir?: string) =>
    a.submissions.filter((s) => s.id !== excluir).map((s) => ({ id: s.id, nome: s.alunoNome }));

  if (!subA || !subB) {
    // Seletor: escolher as duas submissões a comparar.
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "var(--font-inter, system-ui), sans-serif", color: "#1d1a13" }}>
        <a href={back} style={{ color: "#0f766e", fontSize: 14 }}>← Voltar ao trabalho</a>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, margin: "14px 0 6px" }}>Comparar submissões</h1>
        <p style={{ color: "rgba(29,26,19,0.6)", fontSize: 14, marginBottom: 24 }}>Escolhe duas submissões para ver o texto partilhado lado a lado.</p>
        <form method="GET" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Submissão A</label>
            <select name="a" defaultValue={aId ?? ""}>
              <option value="" disabled>escolher…</option>
              {escolher(bId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Submissão B</label>
            <select name="b" defaultValue={bId ?? ""}>
              <option value="" disabled>escolher…</option>
              {escolher(aId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <button className="btn" type="submit">Comparar</button>
        </form>
      </div>
    );
  }

  const score = Math.round(
    (() => {
      // Jaccard entre os dois textos (mesma métrica da vista Integridade).
      const s = similaridadeComTexto(subA.conteudoExtraido, subB.conteudoExtraido);
      return s * 100;
    })(),
  );
  const cor = score >= 60 ? "#9f1d1d" : score >= 40 ? "#b45309" : "#0f766e";

  const { segs } = diffPalavras(subA.conteudoExtraido ?? "", subB.conteudoExtraido ?? "");
  // Coluna A: segmentos que existem em A (igual + rem). Coluna B: (igual + add).
  // "igual" = partilhado → destacado.
  const colA = segs.filter((s) => s.tipo !== "add");
  const colB = segs.filter((s) => s.tipo !== "rem");
  const render = (parts: typeof segs) =>
    parts.map((s, i) => (
      <span key={i} style={s.tipo === "igual" ? { background: "rgba(180,83,9,0.18)", borderRadius: 3 } : { color: "rgba(29,26,19,0.7)" }}>{s.texto}</span>
    ));

  const Col = ({ sub, parts }: { sub: typeof subA; parts: typeof segs }) => (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid rgba(29,26,19,0.12)", borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(29,26,19,0.08)" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#efe8da", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>
          {sub!.alunoNome.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{sub!.alunoNome}</div>
          <div style={{ fontSize: 12, color: "rgba(29,26,19,0.5)" }}>{sub!.alunoNumero ?? "—"}</div>
        </div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{render(parts)}</div>
    </div>
  );

  return (
    <div style={{ background: "#f4f2ec", minHeight: "100vh", padding: "28px 24px", fontFamily: "var(--font-inter, system-ui), sans-serif", color: "#1d1a13" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <a href={back} style={{ color: "#0f766e", fontSize: 14 }}>← Voltar ao trabalho</a>
            <h1 className="serif" style={{ fontSize: 26, fontWeight: 500, margin: "8px 0 2px" }}>Comparar · {subA.alunoNome} ↔ {subB.alunoNome}</h1>
            <div style={{ fontSize: 13, color: "rgba(29,26,19,0.55)" }}>{a.titulo} · texto partilhado realçado</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: cor, fontFamily: "var(--font-newsreader, Georgia), serif" }}>{score}%</div>
            <div style={{ fontSize: 11.5, color: "rgba(29,26,19,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>semelhança</div>
          </div>
        </div>
        <div style={{ background: "rgba(180,83,9,0.09)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(29,26,19,0.75)", marginBottom: 18 }}>
          As passagens <span style={{ background: "rgba(180,83,9,0.18)", borderRadius: 3, padding: "0 4px" }}>realçadas</span> aparecem em ambas as submissões. É um indício — confirma a autoria com as perguntas de defesa antes de decidir.
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <Col sub={subA} parts={colA} />
          <Col sub={subB} parts={colB} />
        </div>
      </div>
    </div>
  );
}
