import { defineConfig } from "prisma/config";
import { resolve } from "node:path";

// SQLite file. Local default: data/reedright.db (gitignored). Railway: DATABASE_PATH=/data/reedright.db on a volume.
const dbPath = process.env.DATABASE_PATH ?? resolve(import.meta.dirname, "data/reedright.db");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: `file:${dbPath}` },
});
