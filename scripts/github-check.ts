// Verify the GitHub App credentials in .env: prints the app, its permissions, and current installations.
// Usage: pnpm github:check
import { githubApp, listInstallations } from "../app/lib/github/app.server";

const r = await githubApp().octokit.request("GET /app");
const owner = r.data.owner && "login" in r.data.owner ? r.data.owner.login : "?";
console.log(`app ok: ${r.data.slug} (id ${r.data.id}) owned by ${owner}`);
console.log(`permissions: ${JSON.stringify(r.data.permissions)}`);
const installs = await listInstallations();
console.log(`installations (${installs.length}): ${installs.map((i) => `${i.account} #${i.id}`).join(", ") || "none yet"}`);
