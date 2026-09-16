import { Form, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/orgs.$slug";
import { requireMember } from "~/lib/session.server";

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
  const nav: Array<[string, string, boolean]> = [
    ["", "Overview", true],
    ["approvals", "Approvals", true],
    ["members", "Members", true],
    ["tokens", "Tokens", true],
    ["drive", "Drive", true],
    ["reports", "Reports", true],
    ["connect", "Connect", membership.role === "admin"],
  ];
  return (
    <>
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-2 px-6 py-3">
          <NavLink to="/" className="text-lg font-semibold tracking-tight">reedright</NavLink>
          <span className="text-stone-400">/</span>
          <span className="font-medium">{org.name}</span>
          <nav className="flex gap-4 text-sm">
            {nav.filter(([, , show]) => show).map(([to, label]) => (
              <NavLink
                key={to}
                to={`/orgs/${org.slug}/${to}`}
                end={to === ""}
                className={({ isActive }) =>
                  isActive ? "text-stone-900 underline underline-offset-4 dark:text-stone-100" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto flex items-center gap-3 text-xs text-stone-400">
            <span>{user.email} · <span className="font-mono">{membership.handle}</span></span>
            <Form method="post" action="/logout"><button className="underline">Log out</button></Form>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Outlet />
      </main>
    </>
  );
}
