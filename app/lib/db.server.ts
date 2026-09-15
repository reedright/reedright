// Prisma client. Server-only.
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const DB_PATH = process.env.DATABASE_PATH ?? resolve(ROOT, "data/reedright.db");

let client: PrismaClient | undefined;

export function prisma(): PrismaClient {
  if (!client) {
    const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export const now = () => new Date().toISOString();
