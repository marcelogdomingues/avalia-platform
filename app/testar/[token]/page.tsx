import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { LANG_LABELS, EXT, runnerAtivo, type Lang } from "@/lib/runner";
import TestarPlayground from "@/components/TestarPlayground";

export const dynamic = "force-dynamic";

// Playground público: corre os testes de um trabalho contra código colado, sem
// submeter. Só disponível para trabalhos com autograder.
export default async function TestarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const assignment = await db.assignment.findUnique({ where: { submitToken: token }, include: { course: true } });
  if (!assignment) notFound();

  const suite = assignment.testSuite as { lang: Lang; testFiles?: unknown[] } | null;
  const temTestes = !!suite?.testFiles?.length;
  const ext = suite ? EXT[suite.lang]?.[0]?.replace(".", "") ?? "txt" : "txt";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px" }}>
      <div className="breadcrumb">
        <a href={`/submeter/${token}`}>Submeter</a> <span>/</span> <span>Testar</span>
      </div>
      <h1 className="page-title">Testar o teu código</h1>
      <p className="page-sub">{assignment.titulo} · {assignment.course.nome}</p>

      {!temTestes ? (
        <div className="card empty-state">
          <div className="big">🧪</div>
          <p>Este trabalho não tem testes automáticos. Entrega diretamente em <a href={`/submeter/${token}`}>submeter</a>.</p>
        </div>
      ) : !runnerAtivo ? (
        <div className="card"><p style={{ margin: 0 }}>O autograder está desativado no servidor de momento.</p></div>
      ) : (
        <div className="card">
          <TestarPlayground token={token} langLabel={LANG_LABELS[suite!.lang]} ext={ext} />
        </div>
      )}

      <p className="hint" style={{ marginTop: 20, textAlign: "center" }}>
        Preferes o teu editor? Vê o <a href="/">CLI e extensões</a> em <code>editor/</code>. Quando estiver a passar, <a href={`/submeter/${token}`}>submete</a>.
      </p>
    </div>
  );
}
