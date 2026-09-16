import { Form, data } from "react-router";
import type { Route } from "./+types/orgs.$slug.drive";
import { prisma, now } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { runDriveSync } from "~/lib/brain/drive-sync.server";
import { DEFAULT_DOMAINS } from "~/lib/brain/scaffold.server";
import { domainsOf, parseOwners } from "~/lib/brain/owners";
import { OWNERS_PATH } from "~/lib/brain/paths";
import { BrainRepo } from "~/lib/github/repo.server";
import { serviceAccountEmail } from "~/lib/google/auth.server";
import { FOLDER_MIME, getFile, listSharedWithMe, parseDriveId } from "~/lib/google/drive.server";
import { requireMember } from "~/lib/session.server";
import { str } from "~/lib/validate";
import { Alert, Badge, Button, Card, Code, Empty, Input, Label, Page, Select, SubmitButton } from "~/components/ui";

const kind = (mime: string) => (mime === FOLDER_MIME ? "folder" : mime.replace("application/vnd.google-apps.", "google ").replace(/^application\//, "").replace(/^text\//, "text "));

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const email = env.googleConfigured ? serviceAccountEmail() : null;
  const connected = Boolean(org.githubInstallationId && org.repoName);
  let domains: string[] = DEFAULT_DOMAINS;
  let error: string | null = null;
  if (connected) {
    try {
      const f = await (await BrainRepo.forOrg(org)).readFile(OWNERS_PATH);
      if (f) domains = domainsOf(parseOwners(f.content));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const syncs = await prisma().driveSync.findMany({ where: { orgId: org.id }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "asc" } });
  const requests = await prisma().writeRequest.findMany({ where: { id: { in: syncs.map((s) => s.lastRequestId).filter((x): x is string => Boolean(x)) } } });
  const prOf = new Map(requests.map((r) => [r.id, { url: r.prUrl, status: r.status }]));
  let shared: Array<{ id: string; name: string; kind: string; link: string }> = [];
  if (email) {
    try {
      const have = new Set(syncs.map((s) => s.driveId));
      shared = (await listSharedWithMe()).filter((f) => !have.has(f.id)).map((f) => ({ id: f.id, name: f.name, kind: kind(f.mimeType), link: f.webViewLink }));
    } catch (e) {
      error = error ?? `Could not list Drive: ${(e as Error).message}`;
    }
  }
  return {
    email, connected, domains, error, shared, handle: membership.handle, isAdmin: membership.role === "admin", me: membership.userId,
    syncs: syncs.map((s) => ({ id: s.id, name: s.name, kind: kind(s.mimeType), domain: s.domain, status: s.status, lastRunAt: s.lastRunAt?.slice(0, 16).replace("T", " ") ?? null, lastError: s.lastError, items: s._count.items, handle: s.handle, userId: s.userId, link: `https://drive.google.com/open?id=${s.driveId}`, pr: s.lastRequestId ? prOf.get(s.lastRequestId) ?? null : null })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org, user, membership } = await requireMember(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  try {
    if (intent === "add") {
      const id = parseDriveId(str(form, "drive"));
      const domain = str(form, "domain");
      if (!id) return data({ error: "Paste a Drive link or file id." }, { status: 400 });
      if (!/^[a-z0-9][a-z0-9-]{0,38}$/.test(domain)) return data({ error: "Pick a domain." }, { status: 400 });
      const file = await getFile(id);
      const sync = await prisma().driveSync.upsert({
        where: { orgId_driveId: { orgId: org.id, driveId: file.id } },
        create: { orgId: org.id, userId: user.id, handle: membership.handle, domain, driveId: file.id, name: file.name, mimeType: file.mimeType, createdAt: now() },
        update: { domain, name: file.name, mimeType: file.mimeType },
      });
      const r = await runDriveSync({ org, user, membership, syncId: sync.id });
      return data({ ok: r.message });
    }
    if (intent === "run") {
      const r = await runDriveSync({ org, user, membership, syncId: str(form, "syncId") });
      return data({ ok: r.message });
    }
    if (intent === "remove") {
      const sync = await prisma().driveSync.findUnique({ where: { id: str(form, "syncId") } });
      if (!sync || sync.orgId !== org.id) return data({ error: "No such sync." }, { status: 404 });
      if (sync.userId !== user.id && membership.role !== "admin") return data({ error: "Only the person who added it or an admin can remove a sync." }, { status: 403 });
      await prisma().$transaction([prisma().driveSyncItem.deleteMany({ where: { syncId: sync.id } }), prisma().driveSync.delete({ where: { id: sync.id } })]);
      return data({ ok: "Removed. Files already in the brain stay there until someone archives them." });
    }
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 500 });
  }
  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Drive({ loaderData, actionData }: Route.ComponentProps) {
  const { email, connected, domains, error, shared, syncs, isAdmin, me } = loaderData;
  const msg = actionData as { ok?: string; error?: string } | undefined;
  return (
    <Page title="Google Drive">
      {!email && <div className="mb-4"><Alert kind="info">Drive ingestion is not configured on this server (GOOGLE_SERVICE_ACCOUNT_JSON_B64).</Alert></div>}
      {!connected && <div className="mb-4"><Alert kind="info">Connect a brain repository first; synced documents become <code>refs/</code> entries in it.</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg?.error && <div className="mb-4"><Alert>{msg.error}</Alert></div>}

      {email && (
        <Card>
          <h2 className="mb-2 font-medium">1. Share with the reedright service account</h2>
          <p className="mb-2 text-sm text-stone-600 dark:text-stone-400">In Google Drive, share any file or folder (Viewer is enough) with this address. Folders are walked recursively.</p>
          <Code>{email}</Code>
        </Card>
      )}

      {email && connected && (
        <Card className="mt-4">
          <h2 className="mb-2 font-medium">2. Add a file or folder to sync</h2>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
            Each document becomes a <code>ref</code> under <code>refs/&lt;domain&gt;/</code>, in plain text where Drive can export it (Docs as Markdown, Sheets as CSV, Slides as text, text files as-is; other types as a pointer). One pull request per run lists every document; a domain owner approves it.
          </p>
          <Form method="post" className="grid gap-3 md:grid-cols-[1fr_12rem_auto]">
            <input type="hidden" name="intent" value="add" />
            <div><Label htmlFor="drive">Drive link or id</Label><Input id="drive" name="drive" required placeholder="https://drive.google.com/drive/folders/…" /></div>
            <div><Label htmlFor="domain">Domain</Label><Select id="domain" name="domain">{domains.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
            <div className="flex items-end"><SubmitButton match={{ intent: "add" }} pendingText="Syncing… (walking Drive, opening a PR)">Add and sync</SubmitButton></div>
          </Form>
          {shared.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-stone-500">Shared with the service account, not yet synced</h3>
              <ul className="space-y-2">
                {shared.map((f) => (
                  <li key={f.id}>
                    <Form method="post" className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="hidden" name="intent" value="add" />
                      <input type="hidden" name="drive" value={f.id} />
                      <Badge>{f.kind}</Badge>
                      <a className="underline" href={f.link} target="_blank" rel="noreferrer">{f.name}</a>
                      <Select name="domain" className="!mt-0 w-40">{domains.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
                      <SubmitButton variant="secondary" match={{ intent: "add", drive: f.id }} pendingText="Syncing…">Add and sync</SubmitButton>
                    </Form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Synced sources</h2>
        {syncs.length === 0 ? <Empty>Nothing yet.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500"><tr><th className="pb-2">Source</th><th className="pb-2">Domain</th><th className="pb-2">Files</th><th className="pb-2">Last run</th><th className="pb-2">Last PR</th><th /></tr></thead>
            <tbody>
              {syncs.map((s) => (
                <tr key={s.id} className="border-t border-stone-100 align-top dark:border-stone-800">
                  <td className="py-2 pr-3"><Badge>{s.kind}</Badge> <a className="underline" href={s.link} target="_blank" rel="noreferrer">{s.name}</a><div className="text-xs text-stone-500">added by <span className="font-mono">{s.handle}</span></div>{s.lastError && <div className="mt-1 text-xs text-red-700 dark:text-red-400">{s.lastError}</div>}</td>
                  <td className="py-2 pr-3"><Badge>{s.domain}</Badge></td>
                  <td className="py-2 pr-3">{s.items}</td>
                  <td className="py-2 pr-3 text-stone-500">{s.lastRunAt ?? "never"} {s.status !== "idle" && <Badge tone={s.status === "error" ? "red" : "amber"}>{s.status}</Badge>}</td>
                  <td className="py-2 pr-3">{s.pr ? <a className="underline" href={s.pr.url} target="_blank" rel="noreferrer">{s.pr.status}</a> : "—"}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Form method="post" className="inline"><input type="hidden" name="intent" value="run" /><input type="hidden" name="syncId" value={s.id} /><SubmitButton variant="secondary" match={{ intent: "run", syncId: s.id }} pendingText="Syncing…">Sync now</SubmitButton></Form>{" "}
                    {(isAdmin || s.userId === me) && <Form method="post" className="inline"><input type="hidden" name="intent" value="remove" /><input type="hidden" name="syncId" value={s.id} /><Button variant="danger" type="submit">Remove</Button></Form>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-stone-500">A re-sync rewrites only documents that changed in Drive and archives ones that disappeared. Runs are capped at 300 files; run again to continue.</p>
      </Card>
    </Page>
  );
}
