import { Outlet } from "react-router";
import type { Route } from "./+types/orgs.$slug";
import { requireMember } from "~/lib/session.server";
import { Shell, type NavItem } from "~/components/shell";
import type { PageContext } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, org, membership } = await requireMember(request, params.slug);
  return {
    org: { slug: org.slug, name: org.name, repoOwner: org.repoOwner, repoName: org.repoName, connected: Boolean(org.githubInstallationId && org.repoName) },
    membership: { handle: membership.handle, role: membership.role },
    user: { email: user.email, name: user.name },
  };
}

export default function OrgLayout({ loaderData }: Route.ComponentProps) {
  const { org, membership, user } = loaderData;
  const pages: Array<[string, string, boolean]> = [
    ["", "Overview", true],
    ["approvals", "Approvals", true],
    ["members", "Members", true],
    ["tokens", "Tokens", true],
    ["drive", "Drive", true],
    ["reports", "Reports", true],
    ["rules", "Rules", true],
    ["connect", "Connect", membership.role === "admin"],
  ];
  const nav: NavItem[] = pages.filter(([, , show]) => show).map(([to, label]) => ({ to: `/orgs/${org.slug}/${to}`, label, end: to === "" }));
  // The organization's name is the eyebrow over every page title, so the header carries only the lockup and the links.
  const context: PageContext = { eyebrow: org.name };
  return (
    <Shell nav={nav} user={{ email: user.email, handle: membership.handle }}>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet context={context} />
      </main>
    </Shell>
  );
}
