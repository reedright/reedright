import { Link } from "react-router";
import type { Route } from "./+types/orgs.$slug.reports";
import { prisma } from "~/lib/db.server";
import { countSessions, dailyCounts, leaderboard, toolTotals, topPaths } from "~/lib/reports";
import { requireMember } from "~/lib/session.server";
import { Badge, Card, Empty, Page } from "~/components/ui";

const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "all time"]] as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const wanted = new URL(request.url).searchParams.get("range");
  const range = RANGES.some(([k]) => k === wanted) ? (wanted as (typeof RANGES)[number][0]) : "30";
  const days = range === "all" ? null : Number(range);
  const within = days ? { gte: new Date(Date.now() - days * 86_400_000).toISOString() } : undefined;
  const orgId = org.id;
  const [calls, reads, requests, approvals, members, tokens] = await Promise.all([
    prisma().toolCall.findMany({ where: { orgId, createdAt: within }, select: { handle: true, tokenId: true, tool: true, ok: true, ms: true, createdAt: true }, take: 100_000 }),
    prisma().usageLog.findMany({ where: { orgId, createdAt: within }, select: { handle: true, path: true, createdAt: true }, take: 100_000 }),
    prisma().writeRequest.findMany({ where: { orgId, createdAt: within }, select: { handle: true, type: true, status: true, createdAt: true } }),
    prisma().approval.findMany({ where: { orgId, createdAt: within }, select: { approverHandle: true, decision: true, createdAt: true } }),
    prisma().membership.findMany({ where: { orgId }, include: { user: true } }),
    prisma().apiToken.findMany({ where: { orgId, revokedAt: null }, include: { client: true } }),
  ]);
  const handleOf = new Map(members.map((m) => [m.userId, m.handle]));
  const tokensByHandle = new Map<string, string[]>();
  for (const t of tokens) {
    const h = handleOf.get(t.userId);
    if (!h) continue;
    const label = t.kind === "oauth" ? `${t.client?.name ?? "OAuth client"} (OAuth)` : t.name;
    const list = tokensByHandle.get(h);
    if (list) list.push(label);
    else tokensByHandle.set(h, [label]);
  }
  const board = leaderboard({ calls, reads, requests, approvals });
  const today = new Date().toISOString().slice(0, 10);
  return {
    range,
    me: membership.handle,
    totals: {
      calls: calls.length,
      errors: calls.filter((c) => !c.ok).length,
      sessions: countSessions(calls).total,
      reads: reads.length,
      proposed: requests.length,
      merged: requests.filter((r) => r.status === "merged").length,
      active: board.length,
      members: members.length,
      avgMs: calls.length ? Math.round(calls.reduce((n, c) => n + c.ms, 0) / calls.length) : 0,
    },
    board: board.map((b) => ({ ...b, name: members.find((m) => m.handle === b.handle)?.user.name ?? null, tokens: tokensByHandle.get(b.handle) ?? [], lastActive: b.lastActive?.slice(0, 16).replace("T", " ") ?? null })),
    silent: members.map((m) => m.handle).filter((h) => !board.some((b) => b.handle === h)),
    tools: toolTotals(calls),
    paths: topPaths(reads, 10).map((p) => ({ ...p, last: p.last.slice(0, 10) })),
    daily: dailyCounts(calls, Math.min(days ?? 30, 30), today),
  };
}

const TYPES = ["rule", "procedure", "ref", "observation"] as const;

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full rounded bg-stone-100 dark:bg-stone-800">
      <div className="h-2 rounded bg-stone-700 dark:bg-stone-300" style={{ width: `${max ? Math.max(2, Math.round((value / max) * 100)) : 0}%` }} />
    </div>
  );
}

export default function Reports({ loaderData }: Route.ComponentProps) {
  const { range, me, totals, board, silent, tools, paths, daily } = loaderData;
  const maxTool = tools[0]?.calls ?? 0;
  const maxDay = Math.max(0, ...daily.map((d) => d.calls));
  const prBoard = [...board].filter((b) => b.proposed).sort((a, b) => b.merged - a.merged || b.proposed - a.proposed);
  return (
    <Page
      title="Reports"
      aside={
        <nav className="flex gap-1 text-sm">
          {RANGES.map(([k, label]) => (
            <Link key={k} to={`?range=${k}`} className={`rounded px-2 py-1 ${k === range ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"}`}>
              {label}
            </Link>
          ))}
        </nav>
      }
    >
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        Who uses the brain and how. Tool calls are counted per MCP request by name only (arguments and results are never stored); a session is a run of calls from one token with no gap over 30 minutes; reads are the paths agents loaded.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["tool calls", totals.calls, totals.errors ? `${totals.errors} errored` : `avg ${totals.avgMs} ms`],
          ["sessions", totals.sessions, ""],
          ["reads", totals.reads, ""],
          ["proposed", totals.proposed, `${totals.merged} merged`],
        ].map(([label, n, sub]) => (
          <Card key={String(label)}>
            <div className="text-xs text-stone-500">{label}</div>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="h-4 text-xs text-stone-500">{sub}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-medium text-stone-500">Leaderboard <span className="font-normal">· {totals.active} of {totals.members} handles active</span></h2>
        {board.length === 0 ? (
          <Empty>No activity in this range. Tool calls are counted from the moment reporting shipped; reads and proposals go back further.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr><th className="py-1 pr-3">#</th><th className="py-1 pr-3">handle</th><th className="py-1 pr-3 text-right">calls</th><th className="py-1 pr-3 text-right">sessions</th><th className="py-1 pr-3 text-right">reads</th><th className="py-1 pr-3 text-right">proposed</th><th className="py-1 pr-3 text-right">approvals given</th><th className="py-1 text-right">last active</th></tr>
              </thead>
              <tbody>
                {board.map((b, i) => (
                  <tr key={b.handle} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="py-2 pr-3 text-stone-400">{i + 1}</td>
                    <td className="py-2 pr-3">
                      <span className="font-mono">{b.handle}</span>{b.handle === me && <Badge tone="green">you</Badge>}
                      <div className="text-xs text-stone-500">{[b.name, b.tokens.length ? `via ${b.tokens.join(", ")}` : null].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="py-2 pr-3 text-right">{b.calls}{b.errors > 0 && <span className="text-xs text-red-600"> ({b.errors} err)</span>}</td>
                    <td className="py-2 pr-3 text-right">{b.sessions}</td>
                    <td className="py-2 pr-3 text-right">{b.reads}</td>
                    <td className="py-2 pr-3 text-right">{b.proposed}<span className="text-xs text-stone-500"> · {b.merged} merged{b.open ? `, ${b.open} open` : ""}{b.rejected ? `, ${b.rejected} rejected` : ""}</span></td>
                    <td className="py-2 pr-3 text-right">{b.approvals}{b.rejections > 0 && <span className="text-xs text-stone-500"> · {b.rejections} rejected</span>}</td>
                    <td className="py-2 text-right text-xs text-stone-500">{b.lastActive ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {silent.length > 0 && <p className="mt-3 text-xs text-stone-500">No activity: {silent.map((h) => <Badge key={h}>{h}</Badge>)}</p>}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-stone-500">Tools</h2>
          {tools.length === 0 ? <Empty>No tool calls yet.</Empty> : (
            <ul className="space-y-2 text-sm">
              {tools.map((t) => (
                <li key={t.tool}>
                  <div className="flex justify-between"><span className="font-mono text-xs">{t.tool}</span><span>{t.calls}{t.errors > 0 && <span className="text-xs text-red-600"> ({t.errors} err)</span>}</span></div>
                  <Bar value={t.calls} max={maxTool} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium text-stone-500">Calls per day <span className="font-normal">· last {daily.length}</span></h2>
          <div className="flex h-32 items-end gap-px">
            {daily.map((d) => (
              <div key={d.day} className="group relative flex-1">
                <div className="w-full rounded-t bg-stone-700 dark:bg-stone-300" style={{ height: `${maxDay ? Math.max(d.calls ? 4 : 0, Math.round((d.calls / maxDay) * 120)) : 0}px` }} title={`${d.day}: ${d.calls}`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-stone-500"><span>{daily[0]?.day}</span><span>{daily[daily.length - 1]?.day}</span></div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-stone-500">Pull requests</h2>
          {prBoard.length === 0 ? <Empty>Nothing proposed in this range.</Empty> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr><th className="py-1 pr-2">handle</th>{TYPES.map((t) => <th key={t} className="py-1 pr-2 text-right">{t}s</th>)}<th className="py-1 text-right">merged</th></tr>
              </thead>
              <tbody>
                {prBoard.map((b) => (
                  <tr key={b.handle} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="py-1.5 pr-2 font-mono text-xs">{b.handle}</td>
                    {TYPES.map((t) => <td key={t} className="py-1.5 pr-2 text-right">{b.byType[t] ?? 0}</td>)}
                    <td className="py-1.5 text-right">{b.merged}<span className="text-xs text-stone-500">/{b.proposed}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium text-stone-500">Most-read entries</h2>
          {paths.length === 0 ? <Empty>No reads logged in this range.</Empty> : (
            <table className="w-full text-sm">
              <tbody>
                {paths.map((p) => (
                  <tr key={p.path} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="py-1.5 pr-2 font-mono text-xs break-all">{p.path}</td>
                    <td className="py-1.5 pr-2 text-right whitespace-nowrap">{p.reads}<span className="text-xs text-stone-500"> by {p.readers}</span></td>
                    <td className="py-1.5 text-right text-xs whitespace-nowrap text-stone-500">{p.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Page>
  );
}
