// GitHub App post-install callback: ?installation_id=…&setup_action=install&state=<signed org id>
import { redirect } from "react-router";
import type { Route } from "./+types/github.setup";
import { prisma } from "~/lib/db.server";
import { verify } from "~/lib/signing.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const orgId = verify(url.searchParams.get("state"));
  if (!orgId || !Number.isInteger(installationId) || installationId <= 0) return redirect("/");
  const org = await prisma().org.findUnique({ where: { id: orgId } });
  if (!org) return redirect("/");
  const other = await prisma().org.findFirst({ where: { githubInstallationId: installationId, NOT: { id: org.id } } });
  if (other) throw new Response(`Installation ${installationId} is already connected to another organization.`, { status: 409 });
  await prisma().org.update({ where: { id: org.id }, data: { githubInstallationId: installationId, repoOwner: null, repoName: null } });
  return redirect(`/orgs/${org.slug}/connect`);
}
