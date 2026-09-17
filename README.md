<p align="center"><a href="https://reedright.info"><img src="docs/images/reedright-banner.png" width="520" alt="reedright"></a></p>

# reedright

![feelsgood](docs/images/feelsgood.jpg)

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
pnpm seed                        # org "acmecorp", two users, two tokens, printed
```

`pnpm test` runs the lint, frontmatter, manifest, owners, and paths suites. `pnpm typecheck` runs React Router typegen plus tsc.

## GitHub App setup (once per reedright deployment)

1. github.com → Settings → Developer settings → GitHub Apps → New GitHub App (or under an org's settings).
2. Name: `reedright` (the slug becomes `github.com/apps/<slug>`). Homepage: your APP_URL.
3. Identifying and authorizing users: leave the redirect URI empty; do not request user authorization during installation.
4. Post installation: Setup URL `<APP_URL>/github/setup`, tick **Redirect on update**.
5. Webhook: untick **Active**.
6. Repository permissions: **Contents: read and write**, **Pull requests: read and write**, **Issues: read and write** (labels and PR comments), Metadata: read-only. To publish a site, also **Pages: read and write**, **Workflows: read and write**, and **Actions: read and write**. To run rules, **Workflows: read and write** and **Checks: read-only**. No org or account permissions.
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

## Analytics (PostHog)

Optional. Set `VITE_POSTHOG_PROJECT_TOKEN` (and `VITE_POSTHOG_HOST`, default `https://us.i.posthog.com`) where the app is **built**; Vite bakes them into the client bundle, so on Railway they are service variables. Without a token nothing loads. With one, `app/entry.client.tsx` initializes posthog-js with the `2025-05-24` defaults (pageviews on navigation, autocapture, identified-only person profiles), `root.tsx` identifies logged-in users by id with email and name and resets on logout, and the error boundary reports exceptions. The MCP endpoint and OAuth routes send nothing. Leave the token out of your local `.env` unless you want dev traffic in the project.

## Connect an organization

1. Sign up, create an org, pick your handle (for example `cam`). You are the admin and, after scaffolding, the owner of every domain.
2. Create an empty repository for the brain (for example `acmecorp-brain`).
3. Org → Connect → **Install on GitHub**, choose that repository. GitHub sends you back; pick the repo; click **Scaffold**. That writes `SCHEMA.md`, `OWNERS.yaml`, an empty `MANIFEST.md`, and the directory layout in one commit.
4. Members → invite teammates by email with a handle. They get a link; no GitHub account needed. To let a teammate approve a domain, add their handle to that domain's `owners` in `OWNERS.yaml` (edit it in GitHub or through a PR; a reedright editor is phase 2).

## Give an agent access

Tokens → Mint. You get, once:

```
claude mcp add --transport http reedright https://reedright.info/mcp --header "Authorization: Bearer rr_…"
```

and a context snippet to put in a system prompt or `CLAUDE.md`:

> Strongly prefer the `reedright` MCP server as the global read/write knowledgebase for the organization "Acme Corp". Before answering questions about Acme Corp, call `brain_manifest`, then `brain_read` the relevant paths. When you learn something durable, call `brain_propose` (type `observation` for things you observed; `rule`, `procedure`, `ref` only when asked). Never put metrics in the brain; propose a `ref` that points to the system of record.

Tools: `brain_whoami`, `brain_manifest`, `brain_list`, `brain_read`, `brain_search`, `brain_propose`, `brain_revise` (the author edits an open proposal before approval), `brain_status`. The endpoint is stateless Streamable HTTP with JSON responses; any MCP client that can send a bearer header works (Claude Code, the Agent SDK, Cursor). claude.ai's connector UI signs in with OAuth; see below.

## Acceptance test

Two agents, two tokens, one admin. Observations auto-merge; a rule waits; the admin approves; the approval lands in the file.

```
APP_URL=https://reedright.info ORG_SLUG=acmecorp \
TOKEN_A=rr_… TOKEN_B=rr_… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm acceptance
```

TOKEN_A belongs to the admin (whose handle owns `marketing`); TOKEN_B to any other member. The agents are `claude -p` runs; the assertions go through the MCP endpoint itself, so no GitHub token is needed.

## Reviewing a request

Every write request has a review page at `/orgs/<slug>/requests/<id>` (linked from the approvals queue, the overview, the approval record, and the `review_url` that `brain_propose` and `brain_status` return). It shows the request's provenance, lint warnings, what each enabled rule's CI job found on the PR's head commit (with the annotated lines), who can approve, and the pull request file by file: each markdown file's frontmatter as a table next to the body rendered as markdown (raw HTML is dropped), and, when the file already existed on the default branch, GitHub's diff inline with old and new line numbers. Supersedes show as a move into `archive/`. Approve and reject work from this page too. Drive-sync requests render the first 25 files and link to the rest on GitHub.

## Reports

`/orgs/<slug>/reports` answers who uses the brain and how, over 7, 30, 90 days or all time: a leaderboard per handle (tool calls, sessions, reads, proposals with merged/open/rejected, approvals given, last active, and which tokens or OAuth clients they connect through), calls per tool, calls per day, a pull-request table per handle and type, and the most-read entries. Every MCP `tools/call` is logged with its name, outcome, and latency (never arguments or results; RFC §8). A session is a run of calls from one token with no gap over thirty minutes, since the transport is stateless.

## Publish a browsable site (Quartz on GitHub Pages)

Overview → **Publish with Quartz** (admins). reedright turns on GitHub Pages for the brain repository with the "GitHub Actions" build type and commits two files to it: `.github/workflows/reedright-site.yml` and `.github/reedright/site-prep.mjs`. On every push to the default branch (every merge, including the manifest regeneration) the workflow checks out the brain and a pinned [Quartz](https://quartz.jzhao.xyz) release, gives each entry a page title from its heading and tags for its type and domain, builds the home page from `MANIFEST.md` with every path linked, runs `quartz build` straight against the checkout, and deploys to `https://<owner>.github.io/<repo>/` (or the owner's custom Pages domain). **Rebuild now** triggers a build without a push; **Stop publishing** removes the two files.

The site is a cache in the RFC's sense: it is rebuilt from the repository alone and nothing reads from it. Public repositories publish for free; private ones need GitHub Pro/Team. The GitHub App needs the Workflows permission to write under `.github/workflows/` (Contents alone is refused), Pages to read the site URL, and Actions for **Rebuild now**. Turning Pages on is an admin-only operation that GitHub does not grant to apps, so the first Publish asks you to set Source to "GitHub Actions" once under the repository's Settings → Pages; a second click records the URL.

## Rules

A rule is an org-wide check on what gets written to the brain, whatever the entry type; it runs alongside the type-specific lint, not instead of it. `/orgs/<slug>/rules` lists the rules reedright knows, and an admin turns each on or off. Turning the first one on commits `.github/workflows/reedright-rules.yml` to the brain repository; turning the last one off removes it. The workflow runs on every pull request to the default branch, one job per rule named `rule: <name>`, so each shows as its own check on the PR. A job checks out the PR, lists the entry files it adds or changes (under `rules/`, `procedures/`, `refs/`, `observations/`; never `archive/` or the top-level files), runs `grep -E` with the rule's pattern over them, emits a line annotation per match, and fails when there is any. The pattern sits in the job's `env`, so the file is readable and editable by hand, though the next toggle rewrites it.

reedright reads those checks back through the Checks API: the request review page shows each enabled rule as not run, running, clear, flagged (with the annotated lines) or inconclusive, with a link to the job. reedright also runs the same pattern itself the moment a proposal is made, before the PR exists, so `brain_propose` returns the flags, the approvals queue shows them without waiting for CI, and the PR carries a `flagged` label. A rule, procedure, or ref that is flagged still waits for its domain owner as usual, with the flags in view. An observation that trips a rule is held open for a domain owner instead of auto-merging; `brain_revise` on it re-runs the rules and merges it once nothing flags it. Approving a held observation is recorded in reedright only, and its file keeps `approved_by: null`, as the RFC requires for observations. The MCP server's instructions list the enabled rules so agents know before they write.

Rules available:

- **Flag dollar figures.** As a matter of course, agent memory stores should not keep data reporting directly, they should call the underlying data warehouse or source for such figures. Attempts to write `$xx.xx` strings of text to the brain will raise a review flag before being accepted. Pattern: `\$ ?[0-9][0-9,]*(\.[0-9]+)?`. Lint already refuses a metric-looking number in a rule or observation; this rule covers procedures and refs too, and gives the repository a check of its own that does not depend on reedright.

The registry is `app/lib/brain/rules.ts`; a new regex rule is one entry there. `tests/rules.test.ts` runs the generated CI step for real in a throwaway git repository and checks it agrees with reedright's own evaluation.

## Known gaps in v0

- reedright is the lint gate. The RFC wants CI in the brain repo to enforce the schema too; the rules workflow is the first CI reedright manages, but a vendored lint script is still phase 2. Until then, protect `main` so only the app can push.
- The "use an existing installation" picker on the Connect page trusts any org admin to bind any installation of the app. Fine for a demo; not for multi-tenant production.
- No webhooks (PR state is fetched live when a page loads), no 60-day unread flagging, no vector search, no OWNERS.yaml editor, no repo auto-creation, SQLite on one volume.

## Connect from claude.ai (OAuth)

reedright is also an OAuth 2.1 authorization server, so MCP clients that sign people in (claude.ai custom connectors, Claude Code without a pasted token) work without minting anything by hand.

In claude.ai: Settings → Connectors → **Add custom connector** → URL `https://reedright.info/mcp`. Leave Authentication on **Sign in now** (claude.ai detects it from the 401) and OAuth client on **Use Claude's published identity** (or **Register automatically**; both are supported). Click Add, then Connect: reedright opens its consent page, you log in if needed, pick the organization the connector is for, and approve. From Claude Code, `claude mcp add --transport http reedright https://reedright.info/mcp` with no header triggers the same sign-in.

What is implemented: RFC 8414 and RFC 9728 metadata under `/.well-known/`, PKCE S256 only, dynamic client registration (RFC 7591), Client ID Metadata Documents (an https `client_id` whose JSON body describes the client, cached for an hour), single-use codes with replay revocation, seven-day access tokens, ninety-day refresh tokens with rotation, RFC 7009 revocation, and RFC 8707 resource checks. An OAuth token is an ordinary reedright token bound to one user and one org, listed on the Tokens page as `<client> (OAuth)` and revocable there.

## Google Drive ingestion

One service account per deployment (`GOOGLE_SERVICE_ACCOUNT_JSON_B64`, a base64 key JSON). People share a Drive file or folder with its email; on the org's **Drive** page any member picks it (paste a link, or choose from what is shared with the account), picks a domain, and reedright walks it recursively.

Every document becomes a `ref` at `refs/<domain>/gdrive-<name>-<id>.md`: frontmatter with `system: gdrive`, `locator` = the Drive API URL, `source` = the Drive link, plus the content in plain text where Drive can export it (Docs as Markdown, Sheets as CSV of the first sheet, Slides as text, text files as-is; PDFs, images, and Office files as pointers). Long content is truncated at 200k characters. A run is one commit and one pull request whose body lists each document with its Drive link, location, mode, and path. Refs need a domain owner's approval, so the PR waits in the approvals queue; approving stamps every file in it.

Images that Google Docs embeds in its Markdown export as base64 data URIs are dropped and replaced with `[image omitted]` markers, with a count in the ref's header; the Drive link has the originals.

A re-sync rewrites only documents whose Drive `modifiedTime` or checksum changed (or that were rendered by an older version of the renderer), archives refs whose documents disappeared, and does nothing when everything is current. Running a sync again while its previous PR is still open closes that PR as superseded and opens a fresh one, so the queue never holds two PRs for the same documents. Synced refs are updated in place (git history keeps versions) rather than superseded, which is a deliberate departure from the RFC's supersede-and-archive rule for hand-written entries. Limits: 300 files per run, depth 10, 5 MB per text download.
