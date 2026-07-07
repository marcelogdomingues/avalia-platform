// Extração de conteúdo das submissões → texto normalizado para o avaliador.
//
// STUB do MVP: define a interface e o roteamento por tipo. As implementações
// reais (pdf-parse, mammoth para docx, unzip para código) entram na Fase 1.

export interface FicheiroSubmissao {
  nome: string;
  mime: string;
  buffer: Buffer;
}

export async function extrairConteudo(ficheiros: FicheiroSubmissao[]): Promise<string> {
  const partes: string[] = [];

  for (const f of ficheiros) {
    const ext = f.nome.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        partes.push(await extrairPdf(f)); // TODO: pdf-parse
        break;
      case "docx":
        partes.push(await extrairDocx(f)); // TODO: mammoth
        break;
      case "txt":
      case "md":
        partes.push(f.buffer.toString("utf-8"));
        break;
      case "zip":
        partes.push(await extrairZipCodigo(f)); // TODO: unzipper + concatenar
        break;
      default:
        // Fase 2: imagens/slides → visão do Claude (bloco image no prompt).
        partes.push(`[ficheiro não suportado no MVP: ${f.nome}]`);
    }
  }

  return partes.join("\n\n---\n\n");
}

async function extrairPdf(f: FicheiroSubmissao): Promise<string> {
  return `[TODO extrair PDF: ${f.nome}]`;
}
async function extrairDocx(f: FicheiroSubmissao): Promise<string> {
  return `[TODO extrair DOCX: ${f.nome}]`;
}
async function extrairZipCodigo(f: FicheiroSubmissao): Promise<string> {
  // Concatenar ficheiros de código com marcadores por ficheiro, ex:
  //   === src/main.py ===\n<conteúdo>\n
  return `[TODO extrair ZIP de código: ${f.nome}]`;
}
