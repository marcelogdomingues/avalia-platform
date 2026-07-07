// Extração de conteúdo das submissões → texto normalizado (+ imagens para visão).
// Suporta PDF, DOCX, TXT/MD, ZIP de código e imagens (PNG/JPG/WEBP).

import mammoth from "mammoth";
import AdmZip from "adm-zip";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface FicheiroSubmissao {
  nome: string;
  mime?: string;
  buffer: Buffer;
}

export interface ImagemExtraida {
  mime: string;
  base64: string;
}

export interface ConteudoExtraido {
  texto: string;
  imagens: ImagemExtraida[];
}

const EXT_CODIGO = new Set([
  "py","js","ts","tsx","jsx","java","c","cpp","h","hpp","cs","go","rb","php",
  "rs","kt","swift","sql","html","css","md","txt","json","yaml","yml",
]);
const EXT_IMAGEM: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};

export async function extrairConteudo(ficheiros: FicheiroSubmissao[]): Promise<ConteudoExtraido> {
  const partes: string[] = [];
  const imagens: ImagemExtraida[] = [];

  for (const f of ficheiros) {
    const ext = f.nome.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "pdf") partes.push(await extrairPdf(f.buffer));
      else if (ext === "docx") partes.push(await extrairDocx(f.buffer));
      else if (ext === "txt" || ext === "md") partes.push(f.buffer.toString("utf-8"));
      else if (ext === "zip") partes.push(extrairZipCodigo(f.buffer));
      else if (EXT_IMAGEM[ext]) {
        imagens.push({ mime: EXT_IMAGEM[ext], base64: f.buffer.toString("base64") });
        partes.push(`[imagem anexada: ${f.nome} — ver conteúdo visual]`);
      } else {
        partes.push(`[ficheiro não suportado: ${f.nome}]`);
      }
    } catch (err) {
      partes.push(`[falha a extrair ${f.nome}: ${(err as Error).message}]`);
    }
  }

  return { texto: partes.join("\n\n---\n\n"), imagens };
}

async function extrairPdf(buffer: Buffer): Promise<string> {
  return (await pdfParse(buffer)).text.trim();
}
async function extrairDocx(buffer: Buffer): Promise<string> {
  return (await mammoth.extractRawText({ buffer })).value.trim();
}
function extrairZipCodigo(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const partes: string[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const nome = entry.entryName;
    if (nome.includes("__MACOSX") || nome.includes("node_modules") || nome.includes(".git/")) continue;
    const ext = nome.split(".").pop()?.toLowerCase() ?? "";
    if (!EXT_CODIGO.has(ext)) continue;
    partes.push(`===== ${nome} =====\n${entry.getData().toString("utf-8")}`);
  }
  return partes.length ? partes.join("\n\n") : "[ZIP sem ficheiros de código reconhecidos]";
}
