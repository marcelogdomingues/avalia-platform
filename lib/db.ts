import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Singleton do Prisma (evita múltiplas ligações em dev/hot-reload).
// Prisma 7 liga à BD por driver adapter: SQLite em dev; para Postgres trocar
// por @prisma/adapter-pg (ver .env.example).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const db = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
