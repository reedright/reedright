import { prisma } from "~/lib/db.server";

export async function loader() {
  await prisma().$queryRaw`SELECT 1`;
  return Response.json({ ok: true, service: "reedright" });
}
