// End-to-end acceptance test (plan M6). Two agents with different tokens, an admin approval, assertions through the MCP endpoint itself.
//
//   APP_URL=https://reedright.info ORG_SLUG=acmecorp TOKEN_A=rr_... TOKEN_B=rr_... \
//   ADMIN_EMAIL=cam@example.com ADMIN_PASSWORD=... pnpm acceptance
//
// TOKEN_A must belong to an org admin whose handle owns the `marketing` domain in OWNERS.yaml.
// TOKEN_B is any other member. Requires the `claude` CLI on PATH (the agents are `claude -p`).
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const ORG_SLUG = process.env.ORG_SLUG ?? "acmecorp";
const TOKEN_A = process.env.TOKEN_A ?? "";
const TOKEN_B = process.env.TOKEN_B ?? "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
if (!TOKEN_A || !TOKEN_B) {
  console.error("Set APP_URL, ORG_SLUG, TOKEN_A, TOKEN_B. Set ADMIN_EMAIL and ADMIN_PASSWORD to approve automatically; omit them to approve by hand in the UI.");
  process.exit(2);
}
const HUMAN_APPROVAL = !(ADMIN_EMAIL && ADMIN_PASSWORD);

const ts = Date.now().toString(36);
const today = new Date().toISOString().slice(0, 10);
const results: Array<{ step: string; ok: boolean; detail: string }> = [];
function check(step: string, ok: boolean, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  (${detail})` : ""}`);
  if (!ok) {
    summary();
    process.exit(1);
  }
}
function summary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
}

// ---- direct MCP client (assertions) ----
async function rpc(token: string, method: string, params: unknown) {
  const r = await fetch(`${APP_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (r.status === 401) throw new Error(`401 from /mcp: ${await r.text()}`);
  const j = (await r.json()) as { result?: { content?: Array<{ text: string }>; isError?: boolean }; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result!;
}
async function tool<T = unknown>(token: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await rpc(token, "tools/call", { name, arguments: args });
  const text = res.content?.[0]?.text ?? "";
  if (res.isError) throw new Error(`${name}: ${text}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ---- agents (claude -p) ----
const dir = mkdtempSync(join(tmpdir(), "reedright-acceptance-"));
function mcpConfig(token: string) {
  const p = join(dir, `mcp-${token.slice(3, 9)}.json`);
  writeFileSync(p, JSON.stringify({ mcpServers: { reedright: { type: "http", url: `${APP_URL}/mcp`, headers: { Authorization: `Bearer ${token}` } } } }));
  return p;
}
function agent(label: string, token: string, prompt: string): string {
  console.log(`\n>>> ${label}: ${prompt.split("\n")[0].slice(0, 110)}…`);
  const r = spawnSync("claude", ["-p", "--mcp-config", mcpConfig(token), "--strict-mcp-config", "--allowedTools", "mcp__reedright__*", "--output-format", "json", "--max-turns", "10", prompt], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`claude exited ${r.status}: ${r.stderr.slice(0, 500)}`);
  let events: Array<{ type: string; result?: string; num_turns?: number; total_cost_usd?: number }>;
  try {
    events = JSON.parse(r.stdout);
  } catch {
    throw new Error(`could not parse claude output: ${r.stdout.slice(0, 500)}`);
  }
  const result = events.find((e) => e.type === "result");
  console.log(`<<< ${label} (${result?.num_turns} turns, $${result?.total_cost_usd?.toFixed(3)}): ${result?.result?.slice(0, 300)}`);
  return result?.result ?? "";
}
const requestIdIn = (s: string) => /wr_[a-f0-9]{16}/.exec(s)?.[0] ?? null;

// ---- admin over HTTP ----
async function adminApprove(requestId: string) {
  const login = await fetch(`${APP_URL}/login`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, next: "/" }) });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (login.status !== 302 || !cookie) throw new Error(`admin login failed: ${login.status}`);
  const r = await fetch(`${APP_URL}/orgs/${ORG_SLUG}/approvals`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie }, body: new URLSearchParams({ intent: "approve", requestId, note: "acceptance test" }) });
  const html = await r.text();
  return { status: r.status, ok: html.includes("Approved and merged"), snippet: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/(Approved and merged[^.]*\.|Only an owner[^.]*\.|already [a-z]+\.|Lint[^.]*\.)/)?.[0] ?? "" };
}

async function main() {
  console.log(`reedright acceptance against ${APP_URL} org=${ORG_SLUG} run=${ts}\n`);

  const whoA = await tool<{ handle: string; role: string; domains_you_can_approve: string[]; repo: string | null }>(TOKEN_A, "brain_whoami");
  const whoB = await tool<{ handle: string; role: string }>(TOKEN_B, "brain_whoami");
  check("A and B are different identities", whoA.handle !== whoB.handle, `A=${whoA.handle} B=${whoB.handle}`);
  check("A can approve marketing", whoA.domains_you_can_approve?.includes("marketing") ?? false, `A owns ${JSON.stringify(whoA.domains_you_can_approve)}`);
  check("repo connected", Boolean(whoA.repo), whoA.repo ?? "");
  const manifest = await tool<string>(TOKEN_B, "brain_manifest");
  check("B reads the manifest", typeof manifest === "string" && manifest.startsWith("# MANIFEST"));

  // 1. Agent A writes an observation -> auto-merge
  const obsSlug = `acceptance-${ts}`;
  const obsTitle = `Acceptance observation ${ts}`;
  const outA1 = agent("agent A (observation)", TOKEN_A, `Use the reedright brain. Propose an observation in the marketing domain with slug "${obsSlug}", title "${obsTitle}", body "The acceptance test ran with run id ${ts}. Onboarding emails are now sent by the growth team, not the agency." and source "reasoning". Then reply with exactly one line: request_id=<the request_id returned> status=<the status returned>.`);
  const obsId = requestIdIn(outA1);
  check("A's observation produced a request id", Boolean(obsId), obsId ?? outA1.slice(0, 120));
  const obsStatus = await tool<{ status: string; path: string; pr_url: string }>(TOKEN_A, "brain_status", { request_id: obsId });
  check("observation auto-merged", obsStatus.status === "merged", `${obsStatus.status} ${obsStatus.pr_url}`);
  const obsPath = obsStatus.path;
  const obsRead = await tool<{ files: Array<{ path: string; found: boolean; content: string | null }> }>(TOKEN_B, "brain_read", { paths: [obsPath] });
  check("B reads A's observation from main", obsRead.files[0]?.found === true && (obsRead.files[0].content ?? "").includes(`author: ${whoA.handle}`), obsPath);
  const manifest2 = await tool<string>(TOKEN_B, "brain_manifest");
  check("manifest lists the observation", manifest2.includes(obsPath));

  // 2. Agent B reads it in natural language
  const outB1 = agent("agent B (read)", TOKEN_B, `Use the reedright brain. Find the observation titled "${obsTitle}" (use brain_search or brain_manifest, then brain_read). Reply with exactly one line: path=<its path> author=<the author handle from its frontmatter>.`);
  check("B's agent found the path and author", outB1.includes(obsPath) && outB1.includes(`author=${whoA.handle}`), outB1.slice(0, 160));

  // 3. Agent B proposes a rule -> stays open
  const ruleSlug = `acceptance-rule-${ts}`;
  const ruleTitle = `Acceptance rule ${ts}`;
  const outB2 = agent("agent B (rule)", TOKEN_B, `Use the reedright brain. Propose a rule in the marketing domain with slug "${ruleSlug}", title "${ruleTitle}", body "Subject lines written during acceptance run ${ts} must not use exclamation marks." and source "reasoning". Then reply with exactly one line: request_id=<the request_id returned> status=<the status returned>.`);
  const ruleId = requestIdIn(outB2);
  check("B's rule produced a request id", Boolean(ruleId), ruleId ?? outB2.slice(0, 120));
  const ruleStatus = await tool<{ status: string; path: string; pr_url: string }>(TOKEN_B, "brain_status", { request_id: ruleId });
  check("rule PR is open, not merged", ruleStatus.status === "open", `${ruleStatus.status} ${ruleStatus.pr_url}`);
  const rulePath = ruleStatus.path;
  check("rule path is under rules/marketing/", rulePath === `rules/marketing/${today}-${ruleSlug}.md`, rulePath);
  const notYet = await tool<{ files: Array<{ found: boolean }> }>(TOKEN_A, "brain_read", { paths: [rulePath] });
  check("rule is not on main before approval", notYet.files[0]?.found === false);

  // 4. An owner approves in the reedright UI: automatically over HTTP, or a person while we poll
  if (HUMAN_APPROVAL) {
    console.log(`\n>>> Waiting for a marketing owner to approve request ${ruleId} at ${APP_URL}/orgs/${ORG_SLUG}/approvals (up to 15 minutes)…`);
    const deadline = Date.now() + 15 * 60_000;
    let st = "open";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      st = (await tool<{ status: string }>(TOKEN_B, "brain_status", { request_id: ruleId })).status;
      if (st !== "open") break;
    }
    check("a person approved in the UI", st === "merged", st);
  } else {
    const ap = await adminApprove(ruleId!);
    check("admin approval accepted", ap.ok, ap.snippet || `http ${ap.status}`);
  }
  const ruleStatus2 = await tool<{ status: string; approvals: Array<{ decision: string; by: string; ref: string }> }>(TOKEN_B, "brain_status", { request_id: ruleId });
  check("rule merged after approval", ruleStatus2.status === "merged", ruleStatus2.status);
  check("approval recorded by admin handle", ruleStatus2.approvals?.[0]?.by === whoA.handle && ruleStatus2.approvals[0].decision === "approve");

  // 5. Agent A reads the approved rule; frontmatter carries the approval
  const ruleRead = await tool<{ files: Array<{ found: boolean; content: string | null }> }>(TOKEN_A, "brain_read", { paths: [rulePath] });
  const content = ruleRead.files[0]?.content ?? "";
  check("approved rule is on main", ruleRead.files[0]?.found === true);
  check("frontmatter has approved_by", content.includes(`approved_by: ${whoA.handle}`));
  check("frontmatter has approved_at", /approved_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(content));
  const ref = /approval_ref: (\S+)/.exec(content)?.[1] ?? "";
  check("approval_ref is a reedright URL, not git", ref.startsWith(`${APP_URL}/orgs/${ORG_SLUG}/approvals/`) && !ref.includes("github.com"), ref);
  const outA2 = agent("agent A (read rule)", TOKEN_A, `Use the reedright brain. Read the file ${rulePath} with brain_read. Reply with exactly one line: approved_by=<value> approval_ref=<value>.`);
  check("A's agent reports the approval", outA2.includes(`approved_by=${whoA.handle}`) && outA2.includes(ref), outA2.slice(0, 160));

  summary();
}

main().catch((e) => {
  console.error("\nERROR", e instanceof Error ? e.message : e);
  summary();
  process.exit(1);
});
