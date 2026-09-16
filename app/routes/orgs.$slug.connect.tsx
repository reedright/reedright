import { Form, data, redirect } from "react-router";
import type { Route } from "./+types/orgs.$slug.connect";
import { prisma } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { installUrl, listInstallationRepos, listInstallations, type InstallationSummary, type RepoSummary } from "~/lib/github/app.server";
import { BrainRepo } from "~/lib/github/repo.server";
import { SCHEMA_PATH } from "~/lib/brain/paths";
import { scaffoldRepo } from "~/lib/brain/scaffold.server";
import { requireAdmin } from "~/lib/session.server";
import { sign } from "~/lib/signing.server";
import { str } from "~/lib/validate";
import { Alert, Button, Card, Empty, Page, Select, SubmitButton } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org } = await requireAdmin(request, params.slug);
  if (!env.githubConfigured) return { configured: false as const, org: { slug: org.slug, name: org.name } };
  let installations: InstallationSummary[] = [];
  let repos: RepoSummary[] = [];
  let scaffolded: boolean | null = null;
  let error: string | null = null;
  try {
    if (org.githubInstallationId) {
      repos = await listInstallationRepos(org.githubInstallationId);
      if (org.repoName) scaffolded = Boolean(await (await BrainRepo.forOrg(org)).readFile(SCHEMA_PATH));
    } else {
      const bound = new Set((await prisma().org.findMany({ where: { githubInstallationId: { not: null } }, select: { githubInstallationId: true } })).map((o) => o.githubInstallationId));
      installations = (await listInstallations()).filter((i) => !bound.has(i.id));
    }
  } catch (e) {
    error = (e as Error).message;
  }
  return {
    configured: true as const,
    org: { slug: org.slug, name: org.name, installationId: org.githubInstallationId, repoOwner: org.repoOwner, repoName: org.repoName, defaultBranch: org.defaultBranch },
    installations,
    repos,
    scaffolded,
    error,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org, user, membership } = await requireAdmin(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent === "install") return redirect(installUrl(sign(org.id)));
  if (intent === "use-installation") {
    const id = Number(str(form, "installationId"));
    if (!Number.isInteger(id) || id <= 0) return data({ error: "Pick an installation." }, { status: 400 });
    await prisma().org.update({ where: { id: org.id }, data: { githubInstallationId: id, repoOwner: null, repoName: null } });
    return redirect(`/orgs/${org.slug}/connect`);
  }
  if (intent === "select-repo") {
    if (!org.githubInstallationId) return data({ error: "Install the app first." }, { status: 400 });
    const fullName = str(form, "repo");
    const match = (await listInstallationRepos(org.githubInstallationId)).find((r) => r.fullName === fullName);
    if (!match) return data({ error: "That repository is not available to this installation." }, { status: 400 });
    await prisma().org.update({ where: { id: org.id }, data: { repoOwner: match.owner, repoName: match.name, defaultBranch: match.defaultBranch } });
    return redirect(`/orgs/${org.slug}/connect`);
  }
  if (intent === "scaffold") {
    try {
      const repo = await BrainRepo.forOrg(org);
      const result = await scaffoldRepo(repo, { orgName: org.name, orgUrl: `${env.APP_URL}/orgs/${org.slug}`, admin: { handle: membership.handle, name: user.name, email: user.email } });
      return data({ ok: result.created ? `Scaffolded ${result.files.length} files.` : "Already scaffolded; nothing changed." });
    } catch (e) {
      return data({ error: `Scaffold failed: ${(e as Error).message}` }, { status: 500 });
    }
  }
  if (intent === "disconnect") {
    await prisma().org.update({ where: { id: org.id }, data: { githubInstallationId: null, repoOwner: null, repoName: null } });
    return redirect(`/orgs/${org.slug}/connect`);
  }
  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Connect({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.configured) {
    return (
      <Page title="Connect GitHub">
        <Alert>This reedright server has no GitHub App configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY_B64.</Alert>
      </Page>
    );
  }
  const { org, installations, repos, scaffolded, error } = loaderData;
  const msg = actionData as { error?: string; ok?: string } | undefined;
  return (
    <Page title="Connect GitHub">
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {msg?.error && <div className="mb-4"><Alert>{msg.error}</Alert></div>}
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}

      <Card>
        <h2 className="mb-2 font-medium">1. Install the reedright GitHub App</h2>
        {org.installationId ? (
          <div className="flex items-center justify-between">
            <p className="text-sm">Installation <span className="font-mono">#{org.installationId}</span> is connected.</p>
            <Form method="post"><input type="hidden" name="intent" value="disconnect" /><Button variant="secondary" type="submit">Disconnect</Button></Form>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
              Create an empty repository for the brain first (for example <code>acmecorp-brain</code>), then install the app on it. GitHub sends you back here.
            </p>
            <Form method="post"><input type="hidden" name="intent" value="install" /><SubmitButton pendingText="Redirecting to GitHub…">Install on GitHub</SubmitButton></Form>
            {installations.length > 0 && (
              <Form method="post" className="mt-4 flex items-end gap-3">
                <input type="hidden" name="intent" value="use-installation" />
                <div className="grow">
                  <label className="block text-sm font-medium">Or use an existing installation</label>
                  <Select name="installationId">{installations.map((i) => <option key={i.id} value={i.id}>{i.account} (#{i.id})</option>)}</Select>
                </div>
                <Button type="submit" variant="secondary">Use</Button>
              </Form>
            )}
          </>
        )}
      </Card>

      {org.installationId && (
        <Card className="mt-4">
          <h2 className="mb-2 font-medium">2. Pick the brain repository</h2>
          {repos.length === 0 ? (
            <Empty>The installation has no repositories. Grant it access to one in GitHub, then reload.</Empty>
          ) : (
            <Form method="post" className="flex items-end gap-3">
              <input type="hidden" name="intent" value="select-repo" />
              <div className="grow">
                <label className="block text-sm font-medium">Repository</label>
                <Select name="repo" defaultValue={org.repoOwner && org.repoName ? `${org.repoOwner}/${org.repoName}` : undefined}>
                  {repos.map((r) => <option key={r.fullName} value={r.fullName}>{r.fullName}{r.private ? " (private)" : ""}</option>)}
                </Select>
              </div>
              <SubmitButton variant="secondary" pendingText="Saving…">Use this repo</SubmitButton>
            </Form>
          )}
          {org.repoName && <p className="mt-3 text-sm">Current: <a className="font-mono underline" href={`https://github.com/${org.repoOwner}/${org.repoName}`} target="_blank" rel="noreferrer">{org.repoOwner}/{org.repoName}</a> (default branch <code>{org.defaultBranch}</code>)</p>}
        </Card>
      )}

      {org.repoName && (
        <Card className="mt-4">
          <h2 className="mb-2 font-medium">3. Scaffold the layout</h2>
          {scaffolded ? (
            <p className="text-sm">SCHEMA.md is present. The repository is ready.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Writes SCHEMA.md, OWNERS.yaml (you own every domain), an empty MANIFEST.md, and the directory layout. One commit on <code>{org.defaultBranch}</code>.</p>
              <Form method="post"><input type="hidden" name="intent" value="scaffold" /><SubmitButton pendingText="Scaffolding… (one commit to GitHub, a few seconds)">Scaffold</SubmitButton></Form>
            </>
          )}
        </Card>
      )}
    </Page>
  );
}
