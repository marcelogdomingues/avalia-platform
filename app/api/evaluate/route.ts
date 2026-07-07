import { NextRequest, NextResponse } from "next/server";
import { avaliarSubmissao, type Criterio } from "@/lib/evaluate";

// POST /api/evaluate
// Dispara a avaliação IA de uma submissão. No MVP corre inline; em produção
// deve ir para uma fila de jobs (worker) para não bloquear o pedido web.
//
// Body esperado (exemplo — em produção vem do lookup na BD pela submissionId):
// { enunciado, instrucoes?, solucaoModelo?, rubrica: Criterio[], conteudoExtraido }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      enunciado,
      instrucoes,
      solucaoModelo,
      rubrica,
      conteudoExtraido,
    }: {
      enunciado: string;
      instrucoes?: string;
      solucaoModelo?: string;
      rubrica: Criterio[];
      conteudoExtraido: string;
    } = body;

    if (!enunciado || !Array.isArray(rubrica) || !conteudoExtraido) {
      return NextResponse.json(
        { erro: "Faltam campos: enunciado, rubrica[], conteudoExtraido." },
        { status: 400 },
      );
    }

    const resultado = await avaliarSubmissao({
      enunciado,
      instrucoes,
      solucaoModelo,
      rubrica,
      conteudoExtraido,
    });

    // TODO: persistir em Evaluation (estado: RASCUNHO) via Prisma.
    return NextResponse.json(resultado);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ erro: "Falha na avaliação." }, { status: 500 });
  }
}
