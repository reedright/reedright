import { Form, data } from "react-router";
import type { Route } from "./+types/orgs.$slug.tokens";
import { prisma, now } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { requireMember } from "~/lib/session.server";
import { mintToken } from "~/lib/tokens.server";
import { claudeMcpAddCommand, contextSnippet, mcpConfigJson } from "~/lib/snippets";
import { str } from "~/lib/validate";
import { Alert, Badge, Button, Card, Code, Empty, Input, Label, Page } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, user, membership } = await requireMember(request, params.slug);
  const tokens = await prisma().apiToken.findMany({ where: { orgId: org.id, userId: user.id }, orderBy: { createdAt: "desc" } });
  return {
    org: { slug: org.slug, name: org.name },
    handle: membership.handle,
    appUrl: env.APP_URL,
    snippet: contextSnippet(org.name),
    tokens: tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, createdAt: t.createdAt.slice(0, 10), lastUsedAt: t.lastUsedAt?.slice(0, 16).replace("T", " ") ?? null, revoked: Boolean(t.revokedAt) })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org, user } = await requireMember(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent === "mint") {
    const name = str(form, "name") || "default";
    const { plaintext, hash, prefix } = mintToken();
    await prisma().apiToken.create({ data: { orgId: org.id, userId: user.id, name, tokenHash: hash, prefix, createdAt: now() } });
    return data({ minted: { name, plaintext } });
  }
  if (intent === "revoke") {
    await prisma().apiToken.updateMany({ where: { id: str(form, "id"), orgId: org.id, userId: user.id, revokedAt: null }, data: { revokedAt: now() } });
    return data({ revoked: true });
  }
  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Tokens({ loaderData, actionData }: Route.ComponentProps) {
  const { org, handle, appUrl, snippet, tokens } = loaderData;
  const minted = actionData && "minted" in actionData ? actionData.minted : null;
  return (
    <Page title="MCP tokens">
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        Each token identifies you (<code className="font-mono">{handle}</code>) to the MCP server. Give one to each agent or machine. Revoke it when done.
      </p>
      {minted && (
        <Card className="mb-4 border-green-300 dark:border-green-900">
          <Alert kind="success">Token "{minted.name}" created. This is the only time it is shown.</Alert>
          <h3 className="mt-4 text-sm font-medium">1. Add the server to Claude Code</h3>
          <Code>{claudeMcpAddCommand(appUrl, minted.plaintext)}</Code>
          <h3 className="mt-4 text-sm font-medium">Or use an MCP config file (<code>claude -p --mcp-config reedright.json</code>)</h3>
          <Code>{mcpConfigJson(appUrl, minted.plaintext)}</Code>
          <h3 className="mt-4 text-sm font-medium">2. Put this in your system prompt or CLAUDE.md</h3>
          <Code>{snippet}</Code>
        </Card>
      )}
      <Card>
        <h2 className="mb-3 font-medium">Mint a token</h2>
        <Form method="post" className="flex items-end gap-3">
          <input type="hidden" name="intent" value="mint" />
          <div className="grow"><Label htmlFor="name">Name</Label><Input id="name" name="name" placeholder="laptop, claudata, ci" /></div>
          <Button type="submit">Mint</Button>
        </Form>
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Your tokens for {org.name}</h2>
        {tokens.length === 0 ? <Empty>None yet.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500"><tr><th className="pb-2">Name</th><th className="pb-2">Prefix</th><th className="pb-2">Created</th><th className="pb-2">Last used</th><th /></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-2">{t.name}</td>
                  <td className="py-2 font-mono">{t.prefix}…</td>
                  <td className="py-2 text-stone-500">{t.createdAt}</td>
                  <td className="py-2 text-stone-500">{t.lastUsedAt ?? "never"}</td>
                  <td className="py-2 text-right">
                    {t.revoked ? <Badge tone="red">revoked</Badge> : (
                      <Form method="post"><input type="hidden" name="intent" value="revoke" /><input type="hidden" name="id" value={t.id} /><Button variant="secondary" type="submit">Revoke</Button></Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="mt-4">
        <h2 className="mb-2 font-medium">Context snippet</h2>
        <p className="mb-2 text-xs text-stone-500">The same text shown after minting. Paste it into any agent's system prompt.</p>
        <Code>{snippet}</Code>
      </Card>
    </Page>
  );
}
