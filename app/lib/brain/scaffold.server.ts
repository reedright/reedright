// Initial layout for a fresh brain repository (RFC §2). Idempotent: skipped when SCHEMA.md exists.
import { renderManifest } from "./manifest";
import { initialOwnersYaml } from "./owners";
import { MANIFEST_PATH, OWNERS_PATH, SCHEMA_PATH } from "./paths";
import { RFC_MARKDOWN } from "./rfc";
import { ENTRY_TYPES, TYPE_DIR } from "./schema";
import type { BrainRepo } from "../github/repo.server";

export const DEFAULT_DOMAINS = ["marketing", "compliance", "engineering", "ops"];

export function readme(orgName: string, orgUrl: string): string {
  return `# ${orgName} brain

Shared context for ${orgName}'s people and agents. Flat files in git. Nothing else is the brain.

- Read \`MANIFEST.md\` first, then read entries by path.
- The schema is \`SCHEMA.md\`. Ownership and identity are in \`OWNERS.yaml\`.
- Every write is a pull request. Observations merge when lint passes. Rules, procedures, and refs merge when a domain owner approves.
- Who wrote and who approved each file is recorded in the file's frontmatter, not in git.

Layout:

\`\`\`
MANIFEST.md            generated on each merge
SCHEMA.md              the protocol
OWNERS.yaml            who owns each domain
rules/<domain>/        policy; a person approves
procedures/<domain>/   small, testable skills; a person approves
refs/<domain>/         pointers to data in its system of record
observations/<domain>/ agent-written; auto-merge on lint; 30-day review
archive/               nothing is deleted
\`\`\`

Agents connect through reedright: ${orgUrl}
`;
}

export interface ScaffoldResult {
  created: boolean;
  files: string[];
}

export async function scaffoldRepo(repo: BrainRepo, input: { orgName: string; orgUrl: string; admin: { handle: string; name: string; email: string }; domains?: string[] }): Promise<ScaffoldResult> {
  if (await repo.readFile(SCHEMA_PATH)) return { created: false, files: [] };
  const domains = input.domains ?? DEFAULT_DOMAINS;
  const writes = [
    { path: SCHEMA_PATH, content: RFC_MARKDOWN },
    { path: OWNERS_PATH, content: initialOwnersYaml(input.admin, domains) },
    { path: MANIFEST_PATH, content: renderManifest([], new Date().toISOString()) },
    { path: "archive/.gitkeep", content: "" },
  ];
  for (const type of ENTRY_TYPES) for (const d of domains) writes.push({ path: `${TYPE_DIR[type]}/${d}/.gitkeep`, content: "" });

  // An empty repository has no commit to build a tree on; the Contents API makes the first one.
  if (!(await repo.headSha())) {
    await repo.putFileViaContents("README.md", readme(input.orgName, input.orgUrl), "Initialize brain");
  } else if (!(await repo.readFile("README.md"))) {
    writes.unshift({ path: "README.md", content: readme(input.orgName, input.orgUrl) });
  }
  await repo.commit({ branch: repo.defaultBranch, message: "Scaffold brain layout (Shared Context Protocol v0.2)", writes });
  return { created: true, files: writes.map((w) => w.path) };
}
