// Extração de conteúdo das submissões → texto normalizado para o avaliador.
// Suporta PDF, DOCX, TXT/MD e ZIP de código.

import mammoth from "mammoth";
import AdmZip from "adm-zip";
// pdf-parse: importar o módulo interno evita o código de teste do index.js.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface FicheiroSubmissao {
  nome: string;
  mime?: string;
  buffer: Buffer;
}

// Extensões de código que interessa incluir de um ZIP.
const EXT_CODIGO = new Set([
  "py", "js", "ts", "tsx", "jsx", "java", "c", "cpp", "h", "hpp", "cs",
  "go", "rb", "php", "rs", "kt", "swift", "sql", "html", "css", "md", "txt",
  "json", "yaml", "yml",
]);

export async function extrairConteudo(ficheiros: FicheiroSubmissao[]): Promise<string> {
  const partes: string[] = [];

  for (const f of ficheiros) {
    const ext = f.nome.split(".").pop()?.toLowerCase() ?? "";
    try {
      switch (ext) {
        case "pdf":
          partes.push(await extrairPdf(f.buffer));
          break;
        case "docx":
          partes.push(await extrairDocx(f.buffer));
          break;
        case "txt":
        case "md":
          partes.push(f.buffer.toString("utf-8"));
          break;
        case "zip":
          partes.push(extrairZipCodigo(f.buffer));
          break;
        default:
          // Fase 2: imagens/slides → visão (bloco image no prompt).
          partes.push(`[ficheiro não suportado no MVP: ${f.nome}]`);
      }
    } catch (err) {
      partes.push(`[falha a extrair ${f.nome}: ${(err as Error).message}]`);
    }
  }

  return partes.join("\n\n---\n\n");
}

async function extrairPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text.trim();
}

async function extrairDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

// Concatena os ficheiros de código de um ZIP com marcadores por ficheiro.
function extrairZipCodigo(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const partes: string[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const nome = entry.entryName;
    // ignorar lixo comum
    if (nome.includes("__MACOSX") || nome.includes("node_modules") || nome.includes(".git/")) {
      continue;
    }
    const ext = nome.split(".").pop()?.toLowerCase() ?? "";
    if (!EXT_CODIGO.has(ext)) continue;
    const conteudo = entry.getData().toString("utf-8");
    partes.push(`===== ${nome} =====\n${conteudo}`);
  }
  return partes.length ? partes.join("\n\n") : "[ZIP sem ficheiros de código reconhecidos]";
}
