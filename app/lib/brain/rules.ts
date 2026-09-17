// Rules: org-wide checks on what gets written to the brain, whatever the entry type (orthogonal to RFC §3).
// Pure half. The registry, the evaluation reedright runs on a proposal, and the GitHub Actions workflow that runs the
// same check in the brain repository on every pull request. One pattern per rule, written so `grep -E` in CI and
// `new RegExp` here read it the same way.
import { isEntryPath } from "./paths";

export const RULES_WORKFLOW_PATH = ".github/workflows/reedright-rules.yml";

export interface RuleDef {
  /** Stable id; also the workflow job id, so it must match ^[a-z][a-z0-9-]*$. */
  id: string;
  name: string;
  description: string;
  /** POSIX ERE that is also a valid JavaScript regex. No lookarounds, no \d, no \b. */
  pattern: string;
}

export const RULES: readonly RuleDef[] = [
  {
    id: "flag-dollar-figures",
    name: "Flag dollar figures",
    description:
      "As a matter of course, agent memory stores should not keep data reporting directly, they should call the underlying data warehouse or source for such figures. Attempts to write $xx.xx strings of text to the brain will raise a review flag before being accepted.",
    pattern: "\\$ ?[0-9][0-9,]*(\\.[0-9]+)?",
  },
];

export const ruleById = (id: string): RuleDef | null => RULES.find((r) => r.id === id) ?? null;

/** The org's enabled rules from its stored JSON (string[] of ids). Unknown ids are dropped; registry order is kept. */
export function parseEnabledRules(json: string | null | undefined): RuleDef[] {
  let ids: unknown = [];
  try {
    ids = JSON.parse(json || "[]");
  } catch {
    ids = [];
  }
  const set = new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  return RULES.filter((r) => set.has(r.id));
}

export const serializeEnabledRules = (rules: readonly RuleDef[]): string => JSON.stringify(RULES.filter((r) => rules.some((x) => x.id === r.id)).map((r) => r.id));

/** The check run name GitHub gives the rule's job: its display name. reedright finds the job's result by it. */
export const checkName = (rule: RuleDef): string => `rule: ${rule.name}`;

export interface RuleHit {
  rule: string;
  path: string;
  /** 1-based. */
  line: number;
  match: string;
}

/** What CI will find: every match in entry files (rules/, procedures/, refs/, observations/; never archive/). */
export function evaluateRules(rules: readonly RuleDef[], files: Array<{ path: string; content: string }>): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const rule of rules) {
    const re = new RegExp(rule.pattern, "g");
    for (const f of files) {
      if (!isEntryPath(f.path)) continue;
      f.content.split(/\r?\n/).forEach((text, i) => {
        for (const m of text.matchAll(re)) hits.push({ rule: rule.id, path: f.path, line: i + 1, match: m[0] });
      });
    }
  }
  return hits;
}

export const parseFlags = (json: string | null | undefined): RuleHit[] => {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? (v as RuleHit[]) : [];
  } catch {
    return [];
  }
};

/** One line per hit, for PR bodies, MCP messages, and the UI. */
export const describeHit = (h: RuleHit): string => `${ruleById(h.rule)?.name ?? h.rule}: "${h.match}" at ${h.path}:${h.line}`;

/**
 * The shell step of a rule's job. Runs in a checkout of the pull request with BASE_SHA, HEAD_SHA, PATTERN, and
 * TITLE in the environment: lists the entry files the PR adds or changes, greps them, annotates each match, and
 * fails when there is any. The tests execute this string as-is with bash.
 */
export const REGEX_RULE_SCRIPT = `set -euo pipefail
: "\${BASE_SHA:?}" "\${HEAD_SHA:?}" "\${PATTERN:?}" "\${TITLE:?}"
tmp=\${RUNNER_TEMP:-$(mktemp -d)}
git diff --name-only --diff-filter=AM "$BASE_SHA...$HEAD_SHA" -- rules procedures refs observations | grep '\\.md$' > "$tmp/changed.txt" || true
: > "$tmp/hits.txt"
while IFS= read -r f; do
  if [ -f "$f" ]; then grep -nHoE -e "$PATTERN" -- "$f" >> "$tmp/hits.txt" || true; fi
done < "$tmp/changed.txt"
changed=$(wc -l < "$tmp/changed.txt" | tr -d ' ')
count=0
while IFS=: read -r file line match; do
  count=$((count + 1))
  echo "::error file=$file,line=$line,title=$TITLE::$match"
done < "$tmp/hits.txt"
if [ "$count" -gt 0 ]; then
  {
    echo "### $TITLE: $count match(es)"
    echo
    echo "| file | line | match |"
    echo "| --- | --- | --- |"
    while IFS=: read -r file line match; do echo "| $file | $line | \\\`$match\\\` |"; done < "$tmp/hits.txt"
  } >> "\${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "$TITLE: $count match(es) in $changed changed file(s). Review them in reedright before approving."
  exit 1
fi
echo "$TITLE: nothing flagged in $changed changed file(s)."
`;

const yamlSingle = (s: string) => `'${s.replace(/'/g, "''")}'`; // single-quoted YAML keeps backslashes as they are
const indent = (s: string, n: number) => s.trimEnd().split("\n").map((l) => (l ? " ".repeat(n) + l : "")).join("\n");

/** The workflow committed to the brain repository: one job per enabled rule, so each shows up as its own check. */
export function renderRulesWorkflow(input: { defaultBranch: string; rules: readonly RuleDef[] }): string {
  const jobs = input.rules
    .map(
      (r) => `  ${r.id}:
    name: ${JSON.stringify(checkName(r))}
    runs-on: ubuntu-latest
    steps:
      - name: Check out the pull request
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: ${JSON.stringify(r.name)}
        shell: bash
        env:
          TITLE: ${JSON.stringify(r.name)}
          PATTERN: ${yamlSingle(r.pattern)}
          BASE_SHA: \${{ github.event.pull_request.base.sha }}
          HEAD_SHA: \${{ github.event.pull_request.head.sha }}
        run: |
${indent(REGEX_RULE_SCRIPT, 10)}`,
    )
    .join("\n");
  return `# Generated by reedright (https://reedright.info). Runs the rules this organization turned on against every pull
# request to ${input.defaultBranch}: one job per rule, over the entry files the pull request adds or changes. A match
# annotates the line and fails the job; reedright shows the result on the request's review page. Turn rules on and
# off in reedright, which rewrites this file. Delete it to stop.
name: reedright rules

on:
  pull_request:
    branches: [${input.defaultBranch}]

permissions:
  contents: read

concurrency:
  group: reedright-rules-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
${jobs}
`;
}
