import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";

const SECRET = process.env.AUTH_SECRET ?? "avalia-dev-secret-troca-em-producao";
const COOKIE = "avalia_sess";

// ── Password (scrypt) ────────────────────────────────────────────────────────
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

// ── Cookie de sessão assinado (HMAC) ─────────────────────────────────────────
function sign(v: string): string {
  return `${v}.${createHmac("sha256", SECRET).update(v).digest("base64url")}`;
}
function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const v = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  return mac === createHmac("sha256", SECRET).update(v).digest("base64url") ? v : null;
}

export async function setSession(professorId: string) {
  const c = await cookies();
  c.set(COOKIE, sign(professorId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentProfessor() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const id = unsign(raw);
  if (!id) return null;
  return db.professor.findUnique({ where: { id } });
}

export async function requireProfessor() {
  const p = await getCurrentProfessor();
  if (!p) redirect("/login");
  return p;
}
