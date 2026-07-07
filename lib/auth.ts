import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";

const SECRET = process.env.AUTH_SECRET ?? "avalia-dev-secret-troca-em-producao";
const COOKIE_PROF = "avalia_sess";
const COOKIE_ALUNO = "avalia_aluno";

// ── Password (scrypt) ────────────────────────────────────────────────────────
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

// ── Cookie assinado (HMAC) ───────────────────────────────────────────────────
function sign(v: string): string {
  return `${v}.${createHmac("sha256", SECRET).update(v).digest("base64url")}`;
}
function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const v = signed.slice(0, i);
  return signed.slice(i + 1) === createHmac("sha256", SECRET).update(v).digest("base64url") ? v : null;
}
async function setCookie(name: string, value: string) {
  (await cookies()).set(name, sign(value), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
async function readCookie(name: string): Promise<string | null> {
  const raw = (await cookies()).get(name)?.value;
  return raw ? unsign(raw) : null;
}

// ── Professor ────────────────────────────────────────────────────────────────
export async function setSession(id: string) { await setCookie(COOKIE_PROF, id); }
export async function clearSession() { (await cookies()).delete(COOKIE_PROF); }
export async function getCurrentProfessor() {
  const id = await readCookie(COOKIE_PROF);
  return id ? db.professor.findUnique({ where: { id } }) : null;
}
export async function requireProfessor() {
  const p = await getCurrentProfessor();
  if (!p) redirect("/login");
  return p;
}

// ── Aluno ────────────────────────────────────────────────────────────────────
export async function setStudentSession(id: string) { await setCookie(COOKIE_ALUNO, id); }
export async function clearStudentSession() { (await cookies()).delete(COOKIE_ALUNO); }
export async function getCurrentStudent() {
  const id = await readCookie(COOKIE_ALUNO);
  return id ? db.student.findUnique({ where: { id } }) : null;
}
export async function requireStudent() {
  const s = await getCurrentStudent();
  if (!s) redirect("/aluno/login");
  return s;
}
