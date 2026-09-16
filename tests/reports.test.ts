import { describe, expect, it } from "vitest";
import { countSessions, dailyCounts, leaderboard, toolTotals, topPaths, type CallRow } from "~/lib/reports";

const at = (min: number) => new Date(Date.UTC(2026, 8, 16, 10, min)).toISOString();
const call = (handle: string, tokenId: string, min: number, tool = "brain_read", ok = true): CallRow => ({ handle, tokenId, tool, ok, createdAt: at(min) });

describe("reports: sessions", () => {
  it("splits a token's calls at gaps over the threshold", () => {
    const calls = [call("cam", "t1", 0), call("cam", "t1", 5), call("cam", "t1", 50), call("cam", "t1", 60), call("rr", "t2", 0), call("rr", "t2", 200)];
    const s = countSessions(calls);
    expect(s.total).toBe(4);
    expect(s.byHandle.get("cam")).toBe(2);
    expect(s.byHandle.get("rr")).toBe(2);
  });
  it("counts two tokens of the same handle as separate sessions", () => {
    const s = countSessions([call("cam", "t1", 0), call("cam", "t2", 1)]);
    expect(s.total).toBe(2);
    expect(s.byHandle.get("cam")).toBe(2);
  });
  it("does not depend on input order", () => {
    expect(countSessions([call("cam", "t1", 50), call("cam", "t1", 0)]).total).toBe(2);
  });
});

describe("reports: leaderboard", () => {
  const board = leaderboard({
    calls: [call("cam", "t1", 0), call("cam", "t1", 1, "brain_propose", false), call("rr", "t2", 0)],
    reads: [{ handle: "rr", path: "rules/marketing/a.md", createdAt: at(2) }, { handle: "rr", path: "rules/marketing/a.md", createdAt: at(3) }],
    requests: [
      { handle: "cam", type: "rule", status: "merged", createdAt: at(4) },
      { handle: "cam", type: "observation", status: "open", createdAt: at(5) },
      { handle: "rr", type: "ref", status: "rejected", createdAt: at(6) },
    ],
    approvals: [{ approverHandle: "cam", decision: "approve", createdAt: at(7) }, { approverHandle: "cam", decision: "reject", createdAt: at(8) }],
  });
  it("ranks by calls and rolls up every activity kind", () => {
    expect(board.map((b) => b.handle)).toEqual(["cam", "rr"]);
    const cam = board[0];
    expect(cam).toMatchObject({ calls: 2, errors: 1, sessions: 1, reads: 0, proposed: 2, merged: 1, open: 1, rejected: 0, approvals: 1, rejections: 1, byType: { rule: 1, observation: 1 } });
    expect(cam.lastActive).toBe(at(8));
    expect(board[1]).toMatchObject({ calls: 1, reads: 2, proposed: 1, rejected: 1, byType: { ref: 1 } });
  });
  it("totals tools and paths", () => {
    expect(toolTotals([call("a", "t", 0, "brain_read"), call("a", "t", 1, "brain_read", false), call("a", "t", 2, "brain_manifest")])).toEqual([
      { tool: "brain_read", calls: 2, errors: 1 },
      { tool: "brain_manifest", calls: 1, errors: 0 },
    ]);
    const paths = topPaths([
      { handle: "a", path: "x.md", createdAt: at(0) }, { handle: "b", path: "x.md", createdAt: at(9) }, { handle: "a", path: "y.md", createdAt: at(1) },
    ], 1);
    expect(paths).toEqual([{ path: "x.md", reads: 2, readers: 2, last: at(9) }]);
  });
  it("zero-fills daily counts ending today", () => {
    const d = dailyCounts([call("a", "t", 0), call("a", "t", 1)], 3, "2026-09-16");
    expect(d).toEqual([{ day: "2026-09-14", calls: 0 }, { day: "2026-09-15", calls: 0 }, { day: "2026-09-16", calls: 2 }]);
  });
});
