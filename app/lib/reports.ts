// Pure aggregation behind the Reports page. Rows come from the database; nothing here does I/O.

/** A session is a run of calls from one token with no gap longer than this. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export interface CallRow { handle: string; tokenId: string; tool: string; ok: boolean; createdAt: string }
export interface ReadRow { handle: string; path: string; createdAt: string }
export interface RequestRow { handle: string; type: string; status: string; createdAt: string }
export interface ApprovalRow { approverHandle: string; decision: string; createdAt: string }

export interface HandleStats {
  handle: string;
  calls: number;
  errors: number;
  sessions: number;
  reads: number;
  proposed: number;
  merged: number;
  open: number;
  rejected: number;
  approvals: number;
  rejections: number;
  byType: Record<string, number>;
  lastActive: string | null;
}

const later = (a: string | null, b: string) => (a === null || b > a ? b : a);

/** Sessions per handle and in total. Calls are grouped by token, sorted, and split at gaps over `gapMs`. */
export function countSessions(calls: CallRow[], gapMs = SESSION_GAP_MS): { total: number; byHandle: Map<string, number> } {
  const byToken = new Map<string, CallRow[]>();
  for (const c of calls) {
    const list = byToken.get(c.tokenId);
    if (list) list.push(c);
    else byToken.set(c.tokenId, [c]);
  }
  const byHandle = new Map<string, number>();
  let total = 0;
  for (const rows of byToken.values()) {
    rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    let last = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      const t = Date.parse(r.createdAt);
      if (t - last > gapMs) {
        total++;
        byHandle.set(r.handle, (byHandle.get(r.handle) ?? 0) + 1);
      }
      last = t;
    }
  }
  return { total, byHandle };
}

export function leaderboard(input: { calls: CallRow[]; reads: ReadRow[]; requests: RequestRow[]; approvals: ApprovalRow[] }, gapMs = SESSION_GAP_MS): HandleStats[] {
  const stats = new Map<string, HandleStats>();
  const get = (handle: string) => {
    let s = stats.get(handle);
    if (!s) {
      s = { handle, calls: 0, errors: 0, sessions: 0, reads: 0, proposed: 0, merged: 0, open: 0, rejected: 0, approvals: 0, rejections: 0, byType: {}, lastActive: null };
      stats.set(handle, s);
    }
    return s;
  };
  for (const c of input.calls) {
    const s = get(c.handle);
    s.calls++;
    if (!c.ok) s.errors++;
    s.lastActive = later(s.lastActive, c.createdAt);
  }
  for (const [handle, n] of countSessions(input.calls, gapMs).byHandle) get(handle).sessions = n;
  for (const r of input.reads) {
    const s = get(r.handle);
    s.reads++;
    s.lastActive = later(s.lastActive, r.createdAt);
  }
  for (const r of input.requests) {
    const s = get(r.handle);
    s.proposed++;
    s.byType[r.type] = (s.byType[r.type] ?? 0) + 1;
    if (r.status === "merged") s.merged++;
    else if (r.status === "open") s.open++;
    else s.rejected++;
    s.lastActive = later(s.lastActive, r.createdAt);
  }
  for (const a of input.approvals) {
    const s = get(a.approverHandle);
    if (a.decision === "approve") s.approvals++;
    else s.rejections++;
    s.lastActive = later(s.lastActive, a.createdAt);
  }
  return [...stats.values()].sort((a, b) => b.calls - a.calls || b.proposed - a.proposed || b.reads - a.reads || a.handle.localeCompare(b.handle));
}

export function toolTotals(calls: CallRow[]): Array<{ tool: string; calls: number; errors: number }> {
  const m = new Map<string, { tool: string; calls: number; errors: number }>();
  for (const c of calls) {
    const t = m.get(c.tool) ?? { tool: c.tool, calls: 0, errors: 0 };
    t.calls++;
    if (!c.ok) t.errors++;
    m.set(c.tool, t);
  }
  return [...m.values()].sort((a, b) => b.calls - a.calls || a.tool.localeCompare(b.tool));
}

export function topPaths(reads: ReadRow[], limit = 10): Array<{ path: string; reads: number; readers: number; last: string }> {
  const m = new Map<string, { path: string; reads: number; handles: Set<string>; last: string }>();
  for (const r of reads) {
    const t = m.get(r.path) ?? { path: r.path, reads: 0, handles: new Set<string>(), last: r.createdAt };
    t.reads++;
    t.handles.add(r.handle);
    if (r.createdAt > t.last) t.last = r.createdAt;
    m.set(r.path, t);
  }
  return [...m.values()]
    .sort((a, b) => b.reads - a.reads || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((t) => ({ path: t.path, reads: t.reads, readers: t.handles.size, last: t.last }));
}

/** Calls per UTC day for the `days` days ending on `today` (YYYY-MM-DD), oldest first, zero-filled. */
export function dailyCounts(calls: CallRow[], days: number, today: string): Array<{ day: string; calls: number }> {
  const counts = new Map<string, number>();
  for (const c of calls) counts.set(c.createdAt.slice(0, 10), (counts.get(c.createdAt.slice(0, 10)) ?? 0) + 1);
  const end = Date.parse(`${today}T00:00:00Z`);
  const out: Array<{ day: string; calls: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, calls: counts.get(day) ?? 0 });
  }
  return out;
}
