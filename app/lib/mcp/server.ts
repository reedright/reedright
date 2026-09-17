// The reedright MCP server: one instance per request, scoped to the bearer token's (user, org).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma, now } from "../db.server";
import { env } from "../env.server";
import { BrainRepo } from "../github/repo.server";
import type { TokenContext } from "../tokens.server";
import { syncStatus } from "../brain/approve.server";
import { parseManifest } from "../brain/manifest";
import { domainsOwnedBy, parseOwners } from "../brain/owners";
import { MANIFEST_PATH, OWNERS_PATH } from "../brain/paths";
import { ProposeError, propose } from "../brain/propose.server";
import { revise } from "../brain/revise.server";
import { parseEnabledRules, parseFlags } from "../brain/rules";
import { ENTRY_TYPES, ENTRY_SLUG_RE, HANDLE_RE } from "../brain/schema";

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (value: unknown) => ({ ...text(value), isError: true as const });

const SAFE_PATH = /^(?!\/)(?!.*\.\.)[\w./-]+$/;

export function buildServer(ctx: TokenContext): McpServer {
  const { org, membership } = ctx;
  const enabledRules = parseEnabledRules(org.enabledRules);
  const server = new McpServer(
    { name: "reedright", version: "0.1.0" },
    {
      instructions: [
        `This is the shared brain for the organization "${org.name}". It is flat files in a git repository; reedright is only a client of it.`,
        `Read MANIFEST.md first (brain_manifest), then read entries by path (brain_read). Do not guess paths.`,
        `To add knowledge, call brain_propose. Every write becomes a pull request. Observations merge automatically when lint passes; rules, procedures, and refs wait for a domain owner to approve in reedright.`,
        `Never put a metric in a rule or observation. Propose a ref that points to where the number lives.`,
        ...(enabledRules.length
          ? [`Rules this organization has turned on, checked on every write whatever its type: ${enabledRules.map((r) => `"${r.name}" (${r.description})`).join("; ")} A match flags the request for review, and an observation that trips a rule waits for a domain owner instead of merging.`]
          : []),
        `You are acting as handle "${membership.handle}". That handle is recorded as the author of everything you propose.`,
      ].join(" "),
    },
  );

  const repo = () => BrainRepo.forOrg(org);

  server.registerTool(
    "brain_whoami",
    { title: "Who am I", description: "Your identity in this brain: organization, handle (the author recorded on your writes), role, the domains you may approve, and the connected repository. Call this once at the start of a session if you are unsure who you are acting as." },
    async () => {
      let domainsOwned: string[] = [];
      let repoUrl: string | null = null;
      try {
        const r = await repo();
        repoUrl = r.htmlUrl;
        const ownersFile = await r.readFile(OWNERS_PATH);
        if (ownersFile) domainsOwned = domainsOwnedBy(parseOwners(ownersFile.content), membership.handle);
      } catch (e) {
        return text({ org: org.slug, handle: membership.handle, role: membership.role, repo: null, warning: (e as Error).message });
      }
      return text({ org: { slug: org.slug, name: org.name }, handle: membership.handle, role: membership.role, domains_you_can_approve: domainsOwned, repo: repoUrl, approvals_page: `${env.APP_URL}/orgs/${org.slug}/approvals` });
    },
  );

  server.registerTool(
    "brain_manifest",
    { title: "Read the manifest", description: "Returns MANIFEST.md: every entry in the brain by type, path, domain, title, author, dates, and approver. Read this first, then use brain_read on the paths you need." },
    async () => {
      const file = await (await repo()).readFile(MANIFEST_PATH);
      if (!file) return fail("MANIFEST.md is missing. The repository has not been scaffolded yet; ask an org admin.");
      return text(file.content);
    },
  );

  server.registerTool(
    "brain_list",
    {
      title: "List entries",
      description: "Entries from the manifest, optionally filtered by type (rule, procedure, ref, observation) and domain. Returns path, title, domain, author, created, review_by, approved_by.",
      inputSchema: { type: z.enum(ENTRY_TYPES).optional(), domain: z.string().regex(HANDLE_RE).optional(), include_archived: z.boolean().optional().describe("Also list entries under archive/. Default false.") },
    },
    async ({ type, domain, include_archived }) => {
      const file = await (await repo()).readFile(MANIFEST_PATH);
      if (!file) return fail("MANIFEST.md is missing. The repository has not been scaffolded yet.");
      const rows = parseManifest(file.content).filter((e) => (include_archived || !e.archived) && (!type || e.type === type) && (!domain || e.domain === domain));
      return text({ count: rows.length, entries: rows });
    },
  );

  server.registerTool(
    "brain_read",
    {
      title: "Read entries",
      description: "Read up to 20 files by repository path (for example observations/marketing/2026-09-15-klaviyo-flows.md, or OWNERS.yaml). Each read is logged by path, never by content. Returns the raw markdown including frontmatter.",
      inputSchema: { paths: z.array(z.string().regex(SAFE_PATH, "repository-relative path, no .. or leading /")).min(1).max(20) },
    },
    async ({ paths }) => {
      const r = await repo();
      const files = await r.readMany(paths);
      const ts = now();
      const run = `mcp-${ctx.token.prefix}`;
      const found = files.filter((f) => f.raw !== null);
      if (found.length) {
        await prisma().usageLog.createMany({ data: found.map((f) => ({ orgId: org.id, userId: ctx.user.id, handle: membership.handle, run, path: f.path, createdAt: ts })) });
      }
      return text({ files: files.map((f) => ({ path: f.path, found: f.raw !== null, content: f.raw })) });
    },
  );

  server.registerTool(
    "brain_search",
    {
      title: "Search entries",
      description: "Keyword search over the manifest (path, title, domain, author). Cheap and exact-word based; it does not read file bodies. Use it to find candidate paths, then brain_read them.",
      inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() },
    },
    async ({ query, limit }) => {
      const file = await (await repo()).readFile(MANIFEST_PATH);
      if (!file) return fail("MANIFEST.md is missing. The repository has not been scaffolded yet.");
      const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
      const scored = parseManifest(file.content)
        .filter((e) => !e.archived)
        .map((e) => {
          const hay = `${e.path} ${e.title} ${e.domain} ${e.author} ${e.type}`.toLowerCase();
          const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
          return { score, entry: e };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 10);
      return text({ query, count: scored.length, results: scored.map((s) => ({ score: s.score, ...s.entry })), hint: scored.length ? "Call brain_read with the paths you want." : "No manifest rows matched. Try brain_list to browse by type and domain." });
    },
  );

  server.registerTool(
    "brain_propose",
    {
      title: "Propose an entry",
      description: [
        "Write a new entry to the brain as a pull request. You are recorded as the author.",
        "type: observation = something you noticed (auto-merges when lint passes, 300 words max, reviewed within 30 days); rule = policy; procedure = a small testable skill; ref = a pointer to a number or dataset in its system of record (needs system + locator).",
        "Rules, procedures, and refs stay open until a domain owner approves them in reedright.",
        "Lint rejects: metrics in rules/observations, near-duplicates of existing entries, unknown domains, past review dates. On failure you get the errors; fix and call again.",
        "The organization's rules (listed in the server instructions, if any) are checked as well: a match is returned as flags and marks the request for review, and an observation that trips one is held open for a domain owner instead of merging.",
        "slug: lowercase-hyphenated, becomes the filename. body: markdown without a title (the title is added as the H1). source: a URL, document, system name, or 'reasoning'.",
      ].join(" "),
      inputSchema: {
        type: z.enum(ENTRY_TYPES),
        domain: z.string().regex(HANDLE_RE).describe("A domain from OWNERS.yaml, e.g. marketing, compliance, engineering, ops"),
        slug: z.string().regex(ENTRY_SLUG_RE),
        title: z.string().min(3).max(120),
        body: z.string().min(1),
        source: z.string().min(1).describe("URL, document, system, or 'reasoning'"),
        run: z.string().optional().describe("Your session or run id, if you have one"),
        review_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD. Defaults to +30 days for observations, +180 days otherwise"),
        supersedes: z.string().regex(SAFE_PATH).optional().describe("Path of an existing entry this replaces; it is moved to archive/ in the same PR"),
        system: z.string().optional().describe("refs only: the system of record, e.g. shopify, recharge, sheets"),
        locator: z.string().optional().describe("refs only: endpoint, sheet range, or query"),
      },
    },
    async (input) => {
      try {
        return text(await propose(ctx, input));
      } catch (e) {
        if (e instanceof ProposeError) return fail({ error: e.message, lint: e.report ? { errors: e.report.errors, warnings: e.report.warnings, similarity: e.report.similarity } : undefined });
        return fail({ error: (e as Error).message });
      }
    },
  );

  server.registerTool(
    "brain_revise",
    {
      title: "Revise your open proposal",
      description: [
        "Edit one of your own proposals while it is still open: a rule, procedure, or ref waiting for approval, or an observation a rule held for review. Only the author can revise.",
        "Pass only the fields you want to change: title, body, source, review_by, and for refs system and locator. Type, domain, path, and author stay fixed.",
        "The file is re-linted and a new commit is pushed to the same pull request, so the approver sees the latest version.",
        "An observation that already merged cannot be revised; propose a new one with supersedes instead. A held observation merges on its own once the revision clears every flag.",
      ].join(" "),
      inputSchema: {
        request_id: z.string().min(1),
        title: z.string().min(3).max(120).optional(),
        body: z.string().min(1).optional().describe("Markdown without the title heading; the title is added as the H1"),
        source: z.string().min(1).optional(),
        review_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        system: z.string().optional().describe("refs only"),
        locator: z.string().optional().describe("refs only"),
      },
    },
    async (input) => {
      try {
        return text(await revise(ctx, input));
      } catch (e) {
        if (e instanceof ProposeError) return fail({ error: e.message, lint: e.report ? { errors: e.report.errors, warnings: e.report.warnings, similarity: e.report.similarity } : undefined });
        return fail({ error: (e as Error).message });
      }
    },
  );

  server.registerTool(
    "brain_status",
    {
      title: "Check a write request",
      description: "Status of a write request you or a teammate proposed: open (awaiting approval), merged, rejected, or closed, with the PR link, what the organization's rules flagged, and any approval record.",
      inputSchema: { request_id: z.string().min(1) },
    },
    async ({ request_id }) => {
      const wr = await prisma().writeRequest.findUnique({ where: { id: request_id }, include: { approvals: true } });
      if (!wr || wr.orgId !== org.id) return fail({ error: "No such write request in this organization." });
      const synced = await syncStatus(await repo(), wr);
      return text({
        request_id: wr.id, status: synced.status, type: wr.type, domain: wr.domain, path: wr.path, author: wr.handle, pr_url: wr.prUrl, review_url: `${env.APP_URL}/orgs/${org.slug}/requests/${wr.id}`, created_at: wr.createdAt,
        flags: parseFlags(wr.flags),
        approvals: wr.approvals.map((a) => ({ decision: a.decision, by: a.approverHandle, at: a.createdAt, note: a.note, ref: `${env.APP_URL}/orgs/${org.slug}/approvals/${a.id}` })),
      });
    },
  );

  return server;
}
