// Notificações externas (email) — pluggable, à semelhança do runner.
//   NOTIFY_MODE=off      (por omissão) não faz nada
//   NOTIFY_MODE=log      escreve no stdout do servidor (útil em dev/CI)
//   NOTIFY_MODE=webhook  faz POST { para, assunto, corpo } a NOTIFY_URL
//                        (liga a um serviço de email — SendGrid, SES, etc.)
//
// Best-effort: nunca deve derrubar a operação principal (publicar nota).

const MODE = (process.env.NOTIFY_MODE ?? "off") as "off" | "log" | "webhook";

export const notificacoesAtivas = MODE !== "off";

export interface Notificacao {
  para: string;      // email do destinatário
  assunto: string;
  corpo: string;
}

export async function notificar(n: Notificacao): Promise<{ ok: boolean; erro?: string }> {
  if (MODE === "off") return { ok: false };
  if (!n.para || !n.para.includes("@")) return { ok: false, erro: "destinatário inválido" };

  if (MODE === "log") {
    console.log(`[notify] → ${n.para} · ${n.assunto}\n${n.corpo}\n`);
    return { ok: true };
  }

  // webhook
  const url = process.env.NOTIFY_URL;
  if (!url) return { ok: false, erro: "NOTIFY_URL não configurado" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.NOTIFY_TOKEN ? { authorization: `Bearer ${process.env.NOTIFY_TOKEN}` } : {}) },
      body: JSON.stringify(n),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? { ok: true } : { ok: false, erro: `webhook respondeu ${res.status}` };
  } catch (e) {
    return { ok: false, erro: (e as Error).message.slice(0, 120) };
  }
}

// Notifica o aluno de que a nota de um trabalho foi publicada.
export async function notificarNota(opts: { para?: string | null; aluno: string; trabalho: string; nota: string; baseUrl?: string }) {
  if (!notificacoesAtivas || !opts.para) return;
  const link = opts.baseUrl ? `\n\nVê o feedback em ${opts.baseUrl}/aluno` : "";
  await notificar({
    para: opts.para,
    assunto: `A tua nota de "${opts.trabalho}" foi publicada`,
    corpo: `Olá ${opts.aluno},\n\nA nota do trabalho "${opts.trabalho}" já está disponível: ${opts.nota}.${link}\n\n— Avalia`,
  });
}
