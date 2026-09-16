// Operations on one brain repository. Writes go through the Git Data API so a change is one commit.
import type { Octokit } from "octokit";
import type { Org } from "../../../generated/prisma/client";
import { installationOctokit, isNotFound } from "./app.server";

export interface FileWrite {
  path: string;
  content: string;
}

export interface CommitSpec {
  branch: string;
  message: string;
  writes: FileWrite[];
  deletes?: string[];
}

export interface PRFile {
  path: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  patch: string | null;
  previousPath: string | null;
}

export interface PRInfo {
  number: number;
  htmlUrl: string;
  state: "open" | "closed";
  merged: boolean;
  headRef: string;
  headSha: string;
  title: string;
}

function warn(op: string, e: unknown) {
  console.warn(`[reedright] github ${op} skipped: ${(e as { status?: number }).status ?? ""} ${(e as Error).message ?? e}`);
}

export class BrainRepo {
  constructor(
    private okt: Octokit,
    public owner: string,
    public repo: string,
    public defaultBranch: string,
  ) {}

  static async forOrg(org: Org): Promise<BrainRepo> {
    if (!org.githubInstallationId || !org.repoOwner || !org.repoName) throw new Error("This organization has no brain repository connected yet.");
    const okt = await installationOctokit(org.githubInstallationId);
    return new BrainRepo(okt, org.repoOwner, org.repoName, org.defaultBranch);
  }

  get htmlUrl() {
    return `https://github.com/${this.owner}/${this.repo}`;
  }

  private get base() {
    return { owner: this.owner, repo: this.repo };
  }

  async readFile(path: string, ref = this.defaultBranch): Promise<{ content: string; sha: string } | null> {
    try {
      const { data } = await this.okt.request("GET /repos/{owner}/{repo}/contents/{path}", { ...this.base, path, ref });
      if (Array.isArray(data) || data.type !== "file") return null;
      return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async readMany(paths: string[], ref = this.defaultBranch): Promise<Array<{ path: string; raw: string | null }>> {
    const out: Array<{ path: string; raw: string | null }> = [];
    for (let i = 0; i < paths.length; i += 8) {
      const chunk = paths.slice(i, i + 8);
      const got = await Promise.all(chunk.map(async (p) => ({ path: p, raw: (await this.readFile(p, ref))?.content ?? null })));
      out.push(...got);
    }
    return out;
  }

  /** All blob paths in the tree at `ref`. Empty array for an empty repository. */
  async listPaths(ref = this.defaultBranch): Promise<string[]> {
    try {
      const { data } = await this.okt.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", { ...this.base, tree_sha: ref, recursive: "1" });
      return (data.tree ?? []).filter((t) => t.type === "blob" && t.path).map((t) => t.path as string);
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
  }

  async headSha(branch = this.defaultBranch): Promise<string | null> {
    try {
      const { data } = await this.okt.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { ...this.base, ref: `heads/${branch}` });
      return data.object.sha;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async createBranch(name: string, fromSha: string): Promise<void> {
    await this.okt.request("POST /repos/{owner}/{repo}/git/refs", { ...this.base, ref: `refs/heads/${name}`, sha: fromSha });
  }

  async deleteBranch(name: string): Promise<void> {
    try {
      await this.okt.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", { ...this.base, ref: `heads/${name}` });
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }

  /** Bootstrap for an empty repository: the Contents API can make the first commit, the Git Data API cannot. */
  async putFileViaContents(path: string, content: string, message: string, branch?: string): Promise<void> {
    await this.okt.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      ...this.base,
      path,
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(branch ? { branch } : {}),
    });
  }

  /** One commit on `branch` containing all writes and deletes. Returns the new commit sha. */
  async commit(spec: CommitSpec): Promise<string> {
    const parentSha = await this.headSha(spec.branch);
    if (!parentSha) throw new Error(`branch ${spec.branch} does not exist`);
    const { data: parent } = await this.okt.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", { ...this.base, commit_sha: parentSha });
    const tree = [
      ...spec.writes.map((w) => ({ path: w.path, mode: "100644" as const, type: "blob" as const, content: w.content })),
      ...(spec.deletes ?? []).map((p) => ({ path: p, mode: "100644" as const, type: "blob" as const, sha: null })),
    ];
    const { data: newTree } = await this.okt.request("POST /repos/{owner}/{repo}/git/trees", { ...this.base, base_tree: parent.tree.sha, tree });
    const { data: commit } = await this.okt.request("POST /repos/{owner}/{repo}/git/commits", { ...this.base, message: spec.message, tree: newTree.sha, parents: [parentSha] });
    await this.okt.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { ...this.base, ref: `heads/${spec.branch}`, sha: commit.sha });
    return commit.sha;
  }

  async openPR(input: { title: string; body: string; head: string; base?: string }): Promise<{ number: number; htmlUrl: string }> {
    const { data } = await this.okt.request("POST /repos/{owner}/{repo}/pulls", { ...this.base, title: input.title, body: input.body, head: input.head, base: input.base ?? this.defaultBranch });
    return { number: data.number, htmlUrl: data.html_url };
  }

  async updatePR(number: number, patch: { title?: string; body?: string }): Promise<void> {
    await this.okt.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", { ...this.base, pull_number: number, ...patch });
  }

  async getPR(number: number): Promise<PRInfo> {
    const { data } = await this.okt.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", { ...this.base, pull_number: number });
    return { number: data.number, htmlUrl: data.html_url, state: data.state, merged: Boolean(data.merged_at), headRef: data.head.ref, headSha: data.head.sha, title: data.title };
  }

  /** Files changed by a PR with GitHub's unified patch per file (absent for binary or very large changes). Up to 300 files. */
  async listPRFiles(number: number): Promise<PRFile[]> {
    const out: PRFile[] = [];
    for (let page = 1; page <= 3; page++) {
      const { data } = await this.okt.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { ...this.base, pull_number: number, per_page: 100, page });
      out.push(...data.map((f) => ({ path: f.filename, status: f.status as PRFile["status"], additions: f.additions, deletions: f.deletions, patch: f.patch ?? null, previousPath: f.previous_filename ?? null })));
      if (data.length < 100) break;
    }
    return out;
  }

  /** Best-effort: labels are cosmetic and need the Issues permission, which an installation may lack. */
  async ensureLabels(labels: Array<{ name: string; color: string; description: string }>): Promise<void> {
    for (const l of labels) {
      try {
        await this.okt.request("GET /repos/{owner}/{repo}/labels/{name}", { ...this.base, name: l.name });
      } catch (e) {
        if (!isNotFound(e)) return warn("ensureLabels", e);
        try {
          await this.okt.request("POST /repos/{owner}/{repo}/labels", { ...this.base, ...l });
        } catch (e2) {
          return warn("ensureLabels", e2);
        }
      }
    }
  }

  /** Best-effort, see ensureLabels. */
  async addLabels(number: number, labels: string[]): Promise<void> {
    try {
      await this.okt.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", { ...this.base, issue_number: number, labels });
    } catch (e) {
      warn("addLabels", e);
    }
  }

  /** Best-effort: a rejection is recorded in reedright and the PR is closed either way. */
  async comment(number: number, body: string): Promise<void> {
    try {
      await this.okt.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", { ...this.base, issue_number: number, body });
    } catch (e) {
      warn("comment", e);
    }
  }

  /**
   * Squash-merge. GitHub computes mergeability asynchronously after a PR is opened, so an immediate merge can
   * answer 405 "not mergeable"; retry briefly. Falls back to a merge commit if the repo disallows squash.
   */
  async mergePR(number: number, commitTitle: string, commitMessage?: string): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      for (const merge_method of ["squash", "merge"] as const) {
        try {
          const { data } = await this.okt.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
            ...this.base,
            pull_number: number,
            merge_method,
            commit_title: commitTitle,
            commit_message: commitMessage ?? "",
          });
          if (data.merged) return data.sha;
          lastError = new Error(data.message);
        } catch (e) {
          lastError = e;
          const msg = String((e as Error).message ?? "");
          const status = (e as { status?: number }).status;
          if (status === 405 && /squash/i.test(msg)) continue; // try the next merge method
          if (status === 405 || status === 409) break; // not mergeable yet: wait and retry
          throw e;
        }
      }
    }
    throw new Error(`merge failed after retries: ${(lastError as Error)?.message ?? lastError}`);
  }

  async closePR(number: number): Promise<void> {
    await this.okt.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", { ...this.base, pull_number: number, state: "closed" });
  }

  /** The repository's GitHub Pages site, or null when Pages is off. Needs the Pages permission. */
  async getPagesSite(): Promise<{ url: string; buildType: string } | null> {
    try {
      const { data } = await this.okt.request("GET /repos/{owner}/{repo}/pages", this.base);
      return { url: data.html_url ?? `https://${this.owner}.github.io/${this.repo}/`, buildType: data.build_type ?? "legacy" };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  /** Turn Pages on with the GitHub Actions build type, or switch an existing site to it. Returns the site URL. */
  async enablePagesViaActions(): Promise<string> {
    const existing = await this.getPagesSite();
    if (!existing) {
      const { data } = await this.okt.request("POST /repos/{owner}/{repo}/pages", { ...this.base, build_type: "workflow" });
      return data.html_url ?? `https://${this.owner}.github.io/${this.repo}/`;
    }
    if (existing.buildType !== "workflow") await this.okt.request("PUT /repos/{owner}/{repo}/pages", { ...this.base, build_type: "workflow" });
    return existing.url;
  }

  /** Run a workflow by file name on a branch (workflow_dispatch). Needs the Actions permission. */
  async dispatchWorkflow(file: string, ref = this.defaultBranch): Promise<void> {
    await this.okt.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", { ...this.base, workflow_id: file, ref });
  }

  async listOpenPRs(): Promise<PRInfo[]> {
    const { data } = await this.okt.request("GET /repos/{owner}/{repo}/pulls", { ...this.base, state: "open", per_page: 100 });
    return data.map((d) => ({ number: d.number, htmlUrl: d.html_url, state: d.state as "open" | "closed", merged: Boolean(d.merged_at), headRef: d.head.ref, headSha: d.head.sha, title: d.title }));
  }
}

export const REEDRIGHT_LABELS = [
  { name: "reedright", color: "0e8a16", description: "Opened by reedright on behalf of a person" },
  { name: "type:observation", color: "c5def5", description: "Auto-merges when lint passes" },
  { name: "type:rule", color: "fbca04", description: "Needs a domain owner's approval" },
  { name: "type:procedure", color: "fbca04", description: "Needs a domain owner's approval" },
  { name: "type:ref", color: "fbca04", description: "Needs a domain owner's approval" },
];
