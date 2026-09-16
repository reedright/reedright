// Parse a unified diff (GitHub's per-file `patch`) into hunks with old and new line numbers for inline display.

export interface DiffLine {
  kind: "context" | "add" | "del";
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let cur: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.split("\n")) {
    const m = HUNK_RE.exec(raw);
    if (m) {
      oldNo = Number(m[1]);
      newNo = Number(m[3]);
      cur = { header: raw, lines: [] };
      hunks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
    const mark = raw[0];
    const text = raw.slice(1);
    if (mark === "+") cur.lines.push({ kind: "add", text, oldNo: null, newNo: newNo++ });
    else if (mark === "-") cur.lines.push({ kind: "del", text, oldNo: oldNo++, newNo: null });
    else cur.lines.push({ kind: "context", text, oldNo: oldNo++, newNo: newNo++ });
  }
  return hunks;
}

export function diffStats(hunks: Hunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const h of hunks) for (const l of h.lines) if (l.kind === "add") additions++; else if (l.kind === "del") deletions++;
  return { additions, deletions };
}
