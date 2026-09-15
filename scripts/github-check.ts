// Verify the GitHub App credentials in .env: prints the app, its permissions, and current installations.
// Usage: pnpm github:check
import { githubApp, listInstallations } from "../app/lib/github/app.server";

const { data: app } = await githubApp().octokit.request("GET /app");
if (!app) throw new Error("GET /app returned nothing; check GITHUB_APP_ID and the private key");
const owner = app.owner && "login" in app.owner ? app.owner.login : "?";
console.log(`app ok: ${app.slug} (id ${app.id}) owned by ${owner}`);
console.log(`permissions: ${JSON.stringify(app.permissions)}`);
const installs = await listInstallations();
console.log(`installations (${installs.length}): ${installs.map((i) => `${i.account} #${i.id}`).join(", ") || "none yet"}`);
