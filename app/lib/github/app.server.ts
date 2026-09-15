// GitHub App client. The App is the git actor for every write; reedright handles are the human record.
import { App, type Octokit } from "octokit";
import { env } from "../env.server";

let app: App | undefined;

export function githubApp(): App {
  if (!app) app = new App({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY });
  return app;
}

export async function installationOctokit(installationId: number): Promise<Octokit> {
  return githubApp().getInstallationOctokit(installationId);
}

export function installUrl(state: string): string {
  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
}

function accountLogin(account: unknown): string {
  if (account && typeof account === "object") {
    if ("login" in account && typeof account.login === "string") return account.login;
    if ("slug" in account && typeof account.slug === "string") return account.slug;
  }
  return "unknown";
}

export interface InstallationSummary {
  id: number;
  account: string;
  htmlUrl: string;
}

export async function listInstallations(): Promise<InstallationSummary[]> {
  const { data } = await githubApp().octokit.request("GET /app/installations", { per_page: 100 });
  return data.map((i) => ({ id: i.id, account: accountLogin(i.account), htmlUrl: i.html_url }));
}

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export async function listInstallationRepos(installationId: number): Promise<RepoSummary[]> {
  const okt = await installationOctokit(installationId);
  const { data } = await okt.request("GET /installation/repositories", { per_page: 100 });
  return data.repositories.map((r) => ({ owner: r.owner.login, name: r.name, fullName: r.full_name, defaultBranch: r.default_branch, private: r.private, htmlUrl: r.html_url }));
}

export function isNotFound(e: unknown): boolean {
  const s = (e as { status?: number })?.status;
  return s === 404 || s === 409; // 409 = "Git Repository is empty"
}
