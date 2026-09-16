import { describe, expect, it } from "vitest";
import { diffStats, parsePatch } from "~/lib/brain/diff";

const patch = `@@ -1,4 +1,5 @@
 ---
-type: rule
+type: procedure
 domain: marketing
+author: cam
 ---
@@ -10,2 +11,2 @@ # Title
-old line
+new line
\\ No newline at end of file`;

describe("diff: parsePatch", () => {
  const hunks = parsePatch(patch);
  it("numbers old and new lines through each hunk", () => {
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toBe("@@ -1,4 +1,5 @@");
    expect(hunks[0].lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 1, 1], ["del", 2, null], ["add", null, 2], ["context", 3, 3], ["add", null, 4], ["context", 4, 5],
    ]);
    expect(hunks[1].lines.map((l) => [l.kind, l.text, l.oldNo, l.newNo])).toEqual([["del", "old line", 10, null], ["add", "new line", null, 11]]);
  });
  it("counts additions and deletions and ignores the no-newline marker", () => {
    expect(diffStats(hunks)).toEqual({ additions: 3, deletions: 2 });
    expect(parsePatch("")).toEqual([]);
  });
});
