import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Configuração do Prisma CLI (v7): o URL da BD vive aqui, não no schema.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
