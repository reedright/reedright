# reedright

The identity and approval layer for a shared-context "brain" that lives in git.

The brain itself is flat files in a GitHub repository, laid out and governed by the [Shared Context Protocol](app/lib/brain/rfc.ts) (RFC v0.2, scaffolded into every brain as `SCHEMA.md`). reedright is a client of that repository. It adds the three things git does not have:

- **Identity.** Each person gets a handle (their id in `OWNERS.yaml`) and per-agent bearer tokens. What an agent writes is recorded as `author: <handle>`, never as a git user.
- **One MCP server.** Agents read the manifest, read entries by path, search, and propose. Every proposal becomes a pull request opened by the `reedright` GitHub App on behalf of the person.
- **Approvals without git.** Observations auto-merge when lint passes. Rules, procedures, and refs wait in a queue. A domain owner approves in the web UI; reedright writes `approved_by`, `approved_at`, and `approval_ref` into the file, re-lints, squash-merges, and regenerates `MANIFEST.md`. The approval record page is the `approval_ref`.

## How it maps to the RFC

| RFC | reedright |
| --- | --- |
| §2 layout, §4 frontmatter | `app/lib/brain/schema.ts`, `paths.ts`, `frontmatter.ts`; scaffolded by `scaffold.server.ts` |
| §5 lint | `app/lib/brain/lint.ts`, pure, 32 tests in `tests/`; run in "proposal" mode before a PR and "final" mode before merge |
| §5 MANIFEST.md generated on merge | `app/lib/brain/manifest.server.ts` commits a regenerated manifest to the default branch after every merge |
| §6 every write is a PR | `app/lib/brain/propose.server.ts`: lint, branch, one commit, PR, labels |
| §6 approval bot records approval in the file, then merges | `app/lib/brain/approve.server.ts` |
| §6 reads record paths | `brain_read` writes a `UsageLog` row per path; never the prompt |
| §7 OWNERS.yaml is the only source of identity | Membership handles map to it. Approval rights are computed from the file on `main` at approval time, not from a reedright role |

## Run it locally

```
pnpm install
cp .env.example .env            # set SESSION_SECRET; GitHub App vars can wait
pnpm db:migrate                  # creates data/reedright.db
pnpm dev                         # http://localhost:5173
pnpm seed                        # org "liveitup", two users, two tokens, printed
```

`pnpm test` runs the lint, frontmatter, manifest, owners, and paths suites. `pnpm typecheck` runs React Router typegen plus tsc.

## GitHub App setup (once per reedright deployment)

1. github.com → Settings → Developer settings → GitHub Apps → New GitHub App (or under an org's settings).
2. Name: `reedright` (the slug becomes `github.com/apps/<slug>`). Homepage: your APP_URL.
3. Identifying and authorizing users: leave the redirect URI empty; do not request user authorization during installation.
4. Post installation: Setup URL `<APP_URL>/github/setup`, tick **Redirect on update**.
5. Webhook: untick **Active**.
6. Repository permissions: **Contents: read and write**, **Pull requests: read and write**, **Issues: read and write** (labels and PR comments), Metadata: read-only. No org or account permissions.
7. Where can it be installed: **Any account**.
8. After creating: note the **App ID**, generate a **private key** (downloads a `.pem`).
9. Env: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY_B64` (`base64 -i key.pem | tr -d '\n'`).

## Deploy (Railway)

One service, Node 22, `pnpm build`, start `pnpm start` (runs `prisma migrate deploy` then `react-router-serve`). Attach a volume at `/data` and set:

```
APP_URL=https://reedright.info
SESSION_SECRET=<32 random bytes, base64>
DATABASE_PATH=/data/reedright.db
NODE_ENV=production
PORT=3000
GITHUB_APP_ID=…
GITHUB_APP_SLUG=…
GITHUB_APP_PRIVATE_KEY_B64=…
```

`/healthz` returns `{"ok":true}` when the database is reachable.

## Connect an organization

1. Sign up, create an org, pick your handle (for example `cam`). You are the admin and, after scaffolding, the owner of every domain.
2. Create an empty repository for the brain (for example `liveitup-agent-brain`).
3. Org → Connect → **Install on GitHub**, choose that repository. GitHub sends you back; pick the repo; click **Scaffold**. That writes `SCHEMA.md`, `OWNERS.yaml`, an empty `MANIFEST.md`, and the directory layout in one commit.
4. Members → invite teammates by email with a handle. They get a link; no GitHub account needed. To let a teammate approve a domain, add their handle to that domain's `owners` in `OWNERS.yaml` (edit it in GitHub or through a PR; a reedright editor is phase 2).

## Give an agent access

Tokens → Mint. You get, once:

```
claude mcp add --transport http reedright https://reedright.info/mcp --header "Authorization: Bearer rr_…"
```

and a context snippet to put in a system prompt or `CLAUDE.md`:

> Strongly prefer the `reedright` MCP server as the global read/write knowledgebase for the organization "Live it Up". Before answering questions about Live it Up, call `brain_manifest`, then `brain_read` the relevant paths. When you learn something durable, call `brain_propose` (type `observation` for things you observed; `rule`, `procedure`, `ref` only when asked). Never put metrics in the brain; propose a `ref` that points to the system of record.

Tools: `brain_whoami`, `brain_manifest`, `brain_list`, `brain_read`, `brain_search`, `brain_propose`, `brain_status`. The endpoint is stateless Streamable HTTP with JSON responses; any MCP client that can send a bearer header works (Claude Code, the Agent SDK, Cursor). claude.ai's connector UI needs OAuth, which is phase 2.

## Acceptance test

Two agents, two tokens, one admin. Observations auto-merge; a rule waits; the admin approves; the approval lands in the file.

```
APP_URL=https://reedright.info ORG_SLUG=liveitup \
TOKEN_A=rr_… TOKEN_B=rr_… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm acceptance
```

TOKEN_A belongs to the admin (whose handle owns `marketing`); TOKEN_B to any other member. The agents are `claude -p` runs; the assertions go through the MCP endpoint itself, so no GitHub token is needed.

## Known gaps in v0

- reedright is the lint gate. The RFC wants CI in the brain repo to enforce the schema too; a vendored lint script and workflow are phase 2. Until then, protect `main` so only the app can push.
- The "use an existing installation" picker on the Connect page trusts any org admin to bind any installation of the app. Fine for a demo; not for multi-tenant production.
- No OAuth for MCP (bearer tokens only), no webhooks (PR state is fetched live when a page loads), no 60-day unread flagging, no vector search, no OWNERS.yaml editor, no repo auto-creation, SQLite on one volume.
