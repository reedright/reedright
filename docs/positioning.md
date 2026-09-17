# reedright positioning

Working document. Not committed. Last edit 2026-09-16.

The goal of the landing page is one click: **Sign up free**. Everything below serves that.

---

## 1. Where this comes from

A developer who reviewed the setup said: "all in all, your setup is much more understandable to me than Bamboo, although I still find it too complex for an average business user to use and trust."

That is two problems in one sentence.

- **Complex to use.** The product shows its engine: pull requests, frontmatter, lint, OWNERS.yaml, tokens, MCP. A business user needs none of those words to get value from it.
- **Hard to trust.** For a business user, trust is not "is the code good". It is: Will it tell my agent the wrong thing? Who said this? Can I undo it? Where is my data? Can I leave?

The landing page answers the trust questions with the engine out of sight. The engine stays. The vocabulary changes. Developers get the README.

---

## 2. The position in one paragraph

reedright is shared context for AI-forward teams. It co-creates a single trusted/reviewed source of what your company knows. Every AI tool you use reads it before it answers. Anyone, person or agent, can add to it. The owner of each topic approves what stays. Everyone can browse it on an internal website, with search, without needing engineers or GitHub access. Underneath, it is plain text files in a repository your company owns, and your human colleagues can read, so nothing is locked in and nothing is hidden.

The sentence to remember:

> **Every agent reads it. Anyone can add to it. The right person approves it.**

That is also the name. Read, write, right.

### One thing

reedright does one thing: shared context. It keeps the context your AI tools share correct, current, and yours.

What that rules out: a chat window, a document search engine, a project tool, a wiki editor, dashboards for their own sake. The test for any feature: does it help someone read, add, approve, or browse shared context? If not, it is not ours.

On the page, one line, under the hero sub or in the footer:

- (a) "reedright does one thing. It keeps the context your AI tools share correct, current, and yours."
- (b) "One job: the context your AI tools share. Correct, current, and yours."

---

## 3. Who it is for

Four roles inside one customer:

| Role | What they want | What they touch |
| --- | --- | --- |
| **Champion** (ops lead, founder, "the person who set up Claude for everyone") | Agents that stop starting from zero. One place to point every tool. | Sign up, connect the repository, invite, connect tools. |
| **Owner** (a manager who knows a topic: brand, support, finance) | Control over what agents believe about their area, without a new job. | Approve or reject from a link. Read the weekly summary. Browse the site. |
| **Member** (anyone with an AI tool) | Better answers. No re-pasting. | Connect once. Chat as usual. |
| **Agent builder** (engineer or automation person) | A stable, authenticated read/write API with rules. | MCP, tokens, the repository. |

The landing page speaks to the **champion** and reassures them about the **owners**. Owners are the "average business user" from the feedback. The page has to make an owner's whole experience visible: a link, a page, a button, a website to browse. Engineers get one FAQ answer and a link to the README.

**Ideal customer:** 5 to 200 people. Already pays for 2 or more AI tools. At least one person builds agents or automations. No central knowledge team. Examples: DTC brands and their agencies, agencies, small SaaS companies, consultancies.

**Not for:** a team with one AI tool and no agents (vendor memory is fine). Enterprises that need SSO and compliance today. Teams that want search across every document they have (a different product).

---

## 4. The problem, in their words

- "Every chat starts from zero. I paste the same three paragraphs into every conversation."
- "My Claude knows things my coworker's ChatGPT doesn't. Neither knows what we decided last week."
- "Our agent learned something wrong and now it says it every time."
- "The agency's agents and our agents disagree about our brand voice."
- "Our context lives in one person's ChatGPT memory. She leaves in March."
- "Nobody maintains the wiki. The agent quotes a page from 2023."
- "I'm the manager. I have no idea what the agents think they know about my department."

Underneath: AI tools multiplied faster than the company's ability to keep them all told the same thing. Each vendor's answer is a memory feature that lives inside its own product, which makes the problem worse.

---

## 5. Why now

- Every team runs several AI tools, and some agents act with nobody watching.
- MCP became the common way tools connect to outside context. One server serves every tool.
- Vendors are shipping memory that lives in their product. Portability is about to be a purchasing question.
- Agents writing to shared knowledge is new. Nobody has a review model for it. reedright has one.

---

## 6. Alternatives and the difference

| Alternative | Good at | Where it breaks | What reedright does instead |
| --- | --- | --- | --- |
| Vendor memory (ChatGPT memory, Claude projects) | Zero setup | Per person, per vendor. Nobody reviews it. Leaves with the account. | One source for all tools and all people. Reviewed. Portable. |
| A wiki or Notion, connected by MCP | People can write it | Agents cannot write to it safely. No owner, no review date, no provenance. Goes stale. | Agents add. Owners approve. Every entry has an author, an approver, and a review date. |
| A git repo plus CLAUDE.md | Engineers love it | Business users cannot approve. No identity per agent. No read log. No website. | Same files, plus identity, approval, and a browsable site for people who never open GitHub. |
| Enterprise search (Glean and similar) | Finds anything | Finds everything, including the wrong version. Expensive. Takes no writes. | Small, curated, reviewed. Refs point to the system of record for numbers. |
| Custom RAG | Tailored | An engineering project to maintain. Same provenance gap. | Ready today. You can still build RAG on top of the files. |

What reedright is **not**: a chat app, a document search engine, a wiki. It is the reviewed layer that every tool reads and writes, and that every person can browse.

---

## 7. Business case

For the champion's manager, and for us.

**What the company gets**

1. **Fewer wrong answers.** Agents read a reviewed source instead of guessing or quoting stale documents. A wrong answer is a wrong email, a wrong price, a wrong claim to a customer.
2. **Time back.** No re-pasting. Onboarding a new tool, agent, or hire is "connect".
3. **Control.** The owner of a topic decides what is true about it. Every entry has a review date. Every read is logged by path. A manager can browse what the agents know, any time, on a website.
4. **No lock-in.** Plain files in your repository. Switch AI vendors without losing what the company knows.

**What it costs to adopt:** free. Minutes to set up. No migration: Google Docs come in as references.

**Wedge:** nothing else gives non-technical people approval rights over what agents know, with a paper trail, on files the company owns. The git-based tools skip the business user. The business tools skip the agents.

**Pricing proposal (open):** free up to 5 members with unlimited agents. Paid per member per month above that, with weekly summaries, longer report history, and priority support. Later: SSO, Postgres, a hosted private site. The code is Apache 2.0, so "host it yourself" is always true; that matters to engineers and not to the landing page.

---

## 8. Voice

ASD-STE100, loosened. Simple and straight, not flat.

- One idea per sentence. About 20 words or fewer.
- Active voice, present tense. "The owner approves it." Not "Changes are approved."
- One word per thing. Never two names for one thing on the same page. See the table.
- Say what it does. Never what it "empowers", "unlocks", or "supercharges".
- No idioms. No superlatives. No "seamless", "powerful", "effortless".
- Numbers as digits. "2 minutes", not "two minutes".
- Address the reader as "you". Their company is "your company". Their brain is "your brain".
- Warm is allowed. Clever is allowed once per page.

**Vocabulary**

| Use | Not | Why |
| --- | --- | --- |
| brain (your company's brain) | knowledge base, wiki, repo, context store | One syllable. Already the product's word. |
| shared context | memory | "Memory" is the vendors' word and means per person. Category label for the eyebrow only. |
| entry | file, page, doc, node | One unit of knowledge. "File" reappears only when we explain ownership. |
| add | write, commit, submit, PR | What a person or agent does. |
| owner | approver, admin, manager, maintainer | The person who owns a topic. Matches OWNERS.yaml. |
| approve, reject | merge, close, LGTM | |
| review date | expiry, TTL, stale | Every entry has one. |
| connect | install, integrate, mint, configure | |
| browse | view, explore, navigate | What an owner does on the site. |
| agent, or the product name (Claude, ChatGPT, Cursor) | assistant, bot, LLM, model | |
| topic | domain | "Domain" stays in the product; "topic" on the page. |

Words that never appear above the fold: pull request, merge, lint, frontmatter, YAML, MCP, token, git, GitHub.

GitHub appears once on the page, in the ownership sidekick, as the answer to "where is my data".

---

## 9. Homepage copy

### Hero

**Eyebrow:** Shared context for AI-forward teams

**Headline (recommended):**
Every agent reads it. Anyone can add to it. The right person approves it.

**Sub:**
reedright is your company's brain: one reviewed source of what you know. Claude, ChatGPT, and the agents you build read it before they answer. Your team browses it on a website. Underneath, it is plain files you own.

**Buttons:** [Sign up free] [Browse a live brain]

**Under the buttons:** 2 minutes to connect your first tool. No credit card. Your teammates never need GitHub.

**Alternate headlines to test**

- B. "Your company's memory, for every AI tool you use." Safer and more searchable. Loses the trust clause.
- C. "Stop telling every AI tool the same thing." Pain first. Good for ads; weaker as the permanent headline.

### Sidekick 1: Every tool reads the same thing.

Connect Claude, ChatGPT, Cursor, or an agent you built. Each person connects with their own login, so every read and every addition has a name on it. Your agent reads the brain before it answers. When it learns something, it adds an entry.

*Visual: the hub (section 10, #1).*

### Sidekick 2: Anyone can add. The owner decides what stays.

Quick observations go in right away, with limits: short, no numbers, no duplicates. Rules and procedures wait for the owner of that topic. The owner reads the change on one page and clicks approve or reject. No git. The approval is written into the entry: who, when, and a link. Each week, owners get a summary of what changed and what is waiting. *(weekly summary: to build, see section 11)*

*Visual: the review page, or the entry card with provenance (section 10, #2 and #3).*

### Sidekick 3: Browse it like a website. Own it like a file.

Every brain gets a clickable, searchable website, free. Managers read what the agents know without a chat window and without GitHub. Search it. Click through it. Send a link to a colleague. Pull in Google Docs. See who reads what and what is due for review. Underneath, it is plain text in a repository your company owns. Leave any time and keep everything.

*Visual: the Quartz site next to a file tree (section 10, #4).*

### How it works (optional strip between sidekicks and FAQ)

1. Sign up and connect a repository. We lay it out for you.
2. Invite your team. Connect your tools.
3. Agents read and add. Owners approve. Everyone browses.

### FAQ

**What is shared context?**
The things your company knows that an AI tool needs before it answers: how you talk, what you decided, how you do things, where the numbers live. reedright keeps it in one place that every tool reads.

**Which AI tools work with it?**
Claude (claude.ai, Claude Code, desktop), Cursor, ChatGPT, Gemini CLI, and any agent that speaks MCP, the standard way tools connect to outside context. One connection per person. The tool reads and adds on your behalf. *(ChatGPT and Gemini: verify before we claim, see section 11)*

**Do my teammates need GitHub?**
No. They sign up with an email. They approve from a web page. They browse the brain on its website. Only the first person connects the repository.

**What stops an agent from adding nonsense?**
Limits. Observations are short, cannot contain numbers, and are rejected if they duplicate an existing entry. Rules, procedures, and references wait for an owner. Every entry has an author, a source, and a review date. Anything can be rejected before it lands and removed after.

**Why not ChatGPT memory or a Claude project?**
Those belong to one person and one vendor. Nobody reviews them. They leave with the account. reedright is shared, reviewed, and yours.

**Why not a wiki?**
Agents cannot write to a wiki safely, and nobody keeps it current. In reedright, agents add, owners approve, and every entry has a review date. And you still get the website.

**Where is my data? What do you store?**
Your brain lives in your repository. reedright stores accounts, who added and approved what, and which entries were read. Never prompts. Never conversation content. Delete an entry by deleting the file. Uninstall and keep everything.

**What does it cost?**
Free for small teams. *(boundary: open question)*

**How long does setup take?**
About 2 minutes to sign up and connect your first tool. Inviting the team and pulling in documents takes as long as you want to spend.

**For engineers: how does it actually work?**
Every addition is a pull request opened by the reedright GitHub App on behalf of the person. Observations merge when lint passes. Rules, procedures, and refs wait for a domain owner listed in OWNERS.yaml. The approval is stamped into the file's frontmatter. The MCP server is stateless Streamable HTTP with OAuth 2.1 or bearer tokens. The layout is the Shared Context Protocol; read SCHEMA.md in any brain. The code is Apache 2.0. [Read the README]

### How people use it

Illustrative, for layout. Ship these as role cards titled "How teams use it", not as attributed testimonials, until real quotes exist. Live it Up is the first candidate for a real one.

1. **Ops lead, consumer brand.** "Every Monday I approve five or six things the agents noticed last week. Ten minutes. Before, nobody wrote them down."
2. **Marketing manager.** "I have never opened GitHub. I get a link, read the change, click approve. When I want to know what the agents think about our brand, I open the site and search."
3. **Founder working with an agency.** "The agency's Claude and our ChatGPT finally agree on our brand voice, because they read the same entry."
4. **Engineer.** "It is a git repo. I trust it because I can read it, diff it, and take it with us."
5. **Automation builder.** "My agent adds an observation after every run. The good ones get kept. The bad ones get rejected before anyone acts on them."

### Footer line

Read. Write. Right. *(optional; use only if it lands; it explains the name)*

---

## 10. Visualizations

In priority order for the landing page.

1. **The hub (hero).** Tool logos in a ring around one brain. Read arrows in one color, add arrows in another. A small "owner approves" gate on the add path. Static SVG; animate the arrows if cheap. Proves: one source, many tools, a human gate.
2. **An entry with its paper trail (sidekick 2 or a trust strip).** One rendered entry with a margin: author, source, added, approved by, review by. This is the visual answer to "can I trust this". Cheap: it is a screenshot of the review page's frontmatter table beside the rendered body.
3. **The approve page (sidekick 2).** The real review screen: rendered entry, the diff if it changed, the Approve button. Proves: approving is one page, no git. Blur real content or use a demo brain.
4. **The site beside the files (sidekick 3).** Left: the Quartz site with its search box open and a result list. Right: the same entry as a plain file in a tree. Proves: browsable for managers, ownable for the company.
5. **Weekly summary email (sidekick 2, once built).** "This week in Live it Up brain: 12 observations added by 4 agents. 2 rules approved by cam. 3 entries due for review." With approve links. Proves: owners stay in control without logging in.
6. **Before and after (above the FAQ, optional).** Left: 5 chat windows, each with a different pasted context. Right: 5 tools reading one brain. Proves the pain in one glance.
7. **Reports leaderboard (sidekick 3 or a small strip).** The real reports page. Proves adoption is visible, and adds a little competition.
8. **A live brain (button in the hero).** A public demo brain's website. The strongest trust device: they can read a real one. Needs a public demo org with sample content.

Product visualizations worth theorizing beyond the page:

- **Freshness strip.** Entries by review date as a heat strip; red is overdue. For owners.
- **Read heat.** Which entries agents actually read. Unread for 60 days suggests archive (the RFC already asks for this).
- **Graph.** The Quartz site has a graph view. A moving graph of a demo brain as a hero background is pretty and low-information. Use with care.

---

## 11. Claims ledger

What the page promises against what exists today.

| Page claim | True today | Gap or action |
| --- | --- | --- |
| Sign up free | Yes; there is no billing | Decide the free tier before adding billing |
| 2 minutes to connect your first tool | Yes for an invited member: claude.ai connector is URL, sign in, pick org; Claude Code is one command | The first admin needs an empty GitHub repo and the App install, about 5 to 10 minutes. Build repo auto-creation (phase 2) to make "2 minutes" true for admins too |
| Works with Claude | Yes: claude.ai OAuth, Claude Code, Agent SDK | |
| Works with ChatGPT, Gemini CLI, Cursor | Untested. All three accept remote MCP servers with OAuth | Test each with a real connector before it goes on the page |
| Teammates never need GitHub | Yes | |
| Owner approves on one page | Yes, review page shipped 2026-09-16 | |
| The landing page itself | Live at reedright.info since 2026-09-16 (commit c346a8a) | Replace role cards with real quotes; add the live-brain button once a demo brain exists |
| Weekly summary for owners | No | Build: one email per owner per week from existing data (added, approved, waiting, due for review) with approve links. Small; the data is already in write requests, usage logs, and review_by |
| Owners can edit with as much precision as they like | Partly: approve, reject, and the author can revise | Build: let an owner edit the proposed entry before approving (edit in review) |
| Every brain gets a clickable, searchable website, free | Partly: the workflow builds a Quartz site with search, and today it publishes to GitHub Pages, which a repo admin must switch on | Decided 2026-09-16: the workflow uploads the built site to a reedright endpoint instead, and reedright serves it per brain behind its own login. No Pages, no GitHub setting, private by default. The workflow, the build, and the site search already exist; the endpoint and the static serving are the work |
| Pull in Google Docs | Yes | |
| See who reads what | Yes, Reports | |
| Never stores prompts | Yes: paths and tool names only | Say it on a privacy page |
| Analytics | PostHog (US cloud) since 2026-09-16: pageviews, autocapture, logged-in users identified by id with email and name, exceptions. Nothing on the MCP or OAuth routes | Say so on the privacy page too. Session replay is off unless someone turns it on in the PostHog project; if it is turned on, mask text on the org pages first |
| Leave any time, keep everything | Yes | Add the uninstall note to the FAQ |
| Browse a live brain (hero button) | No public brain exists | Create a demo org with sample content and make its hosted site public |

---

## 12. Open questions for Cam

1. **Category word.** "Shared context" (matches the protocol; my pick) or "company memory" (more searchable, but it is the vendors' word)?
2. **Name line.** Use "Read. Write. Right."?
3. **Live it Up.** Citable as a customer, even anonymized as "a consumer brand"?
4. **Free tier.** By members, by agents, by orgs? My pick: 5 members, unlimited agents, 1 org.
5. **Weekly summary.** Build before the page launches, or launch with "coming"? My pick: build it. For an owner it is the whole experience of the product.
6. **Hosted site.** Decided: the workflow sends the Quartz build to reedright, which hosts it behind login. Still open: do we keep a public option (a public reedright URL or Pages) for teams that want to share a brain outside the company?
7. **Open source.** Apache 2.0 is a trust lever for engineers. Mention it only in the engineer FAQ, or in the footer too?

---

## 13. Brand and design language

**What exists:** one asset, the bamboo "R" mark (`docs/images/reedright-mark.svg`, single path, ink, currentColor). No wordmark, no palette, no type. The banner PNG is the same mark on white.

**The idea in one line:** ink on paper, with one green. Precise, plain, and calm. The page should feel like a well-set document, not a launch.

### Type

Humanist sans for everything, plus one display face for the page's headings and nothing else.

- **Body: Fira Sans** (trial from 2026-09-17, replacing Source Sans 3), self-hosted from `@fontsource/fira-sans` so the page makes no request to Google (we say we never leak; the page should not either). Static weights 400 body, 500 labels, 600 headings and buttons, 700 strong, plus the 400 italic; Latin subset only. Holds up at 13 px in the app tables.
- **Headings on the page: Zodiak** (Indian Type Foundry, via Fontshare), a grotesque slab with ball terminals. Only the landing page's H1 (700) and H2s (600), via the `font-slab` utility; never in the app, never for body or labels. Erik Kennedy's rule applies: the flashier the face, the more restrained its use. One variable file, fetched from Fontshare when the site is built (`scripts/fonts.mjs`) because its license allows self-hosting but not a public repository.
- Both faces have a metric-matched local stand-in (`Zodiak Fallback` on Georgia, `Fira Sans Fallback` on Arial, in `app.css`) with `size-adjust` and the vertical overrides computed with Capsize, so lines wrap in the same places before and after the webfont arrives and the swap does not move the page.
- Previous pick: Source Sans 3. Alternates considered: **Atkinson Hyperlegible** (more personality and an accessibility story; distinctive letterforms get quirky in long text). **Cabin** (warmer, Gill-like; softer at small UI sizes).
- Not: Inter, IBM Plex, Geist, JetBrains, Space Grotesk. That is the "techy" look the brief rules out.
- Mono stays system mono, only for handles, paths, and commands. Never for headings or labels.

Scale on the page: H1 44 px on desktop and 32 px on phones, line height 1.15. Body 18 px, line height 1.55, measure about 65 characters. Section headings 28 px. In the app, body stays 14 to 15 px.

### Color

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| paper | stone-50 `#fafaf9` | stone-950 `#0c0a09` | page background |
| ink | stone-900 `#1c1917` | stone-100 `#f5f5f4` | text, the mark, primary button |
| rule | stone-200 | stone-800 | 1 px borders |
| muted | stone-500 | stone-400 | captions, metadata |
| reed | `#4a7a3d` | `#8fbf7a` | the one accent: links on the page, the "approved" state, the read arrows in the hub |

Green is also the product's "approved" color. That is the point: the accent means "the right person said yes". Amber stays "waiting", red stays "rejected", as in the app today. No other hue on the page. No gradients, no glow, no glass, no dark hero.

### Surface and shape

Cards are paper with a 1 px rule and an 8 px radius, as the app does now. No drop shadows beyond the input's. Buttons are ink on paper (primary) or paper with a rule (secondary), 6 px radius. Underlined links, not colored-only links.

### Layout

Same 64 rem column as the app. The hero is left-aligned text with the visual on the right, one column on phones. Sections sit about 6 rem apart on desktop. Everything left-aligned; centered heroes read as "launch".

### Imagery

Two kinds only.

1. **Ink diagrams** in the mark's own language: single-weight strokes, the odd joint, like bamboo. The hub and the before/after. Drawn as SVG with currentColor, so they follow dark mode.
2. **Product mocks built in HTML** from the app's own components: the entry with its paper trail, the approve page, the weekly summary email. Crisper than screenshots, follow dark mode, and never go stale.

No photos, no stock, no 3D, no abstract AI swirls, no logos of other companies larger than 20 px.

### Appearance

The page follows the system setting by default. A text control in the footer cycles system, light, dark; the choice is kept in localStorage and applied before first paint. No icons. The footer is the same component on the page and in the app (`app/components/shell.tsx`), so the control is in the same place everywhere; pages that are a single form (log in, sign up, invite, authorize) keep the stalk instead of a footer.

### Motion

None by default, with one exception. The hub draws itself once on load, in the order of the headline: the reads from the brain to the tools, then the dashed adds from the tools to the owner, then the owner's check, then the keep into the brain, about 2.5 s in all. Afterwards the dashed add lines drift slowly toward the owner. Each arrow is revealed by a mask stroke on its own path, so the arrowhead arrives with the line (`.hub-draw`, `.hub-drift` in `app.css`). Everything is static under `prefers-reduced-motion`, and the hidden state lives only in the keyframes, so a browser that will not animate shows the finished diagram.

### The app

The app inherits the page: the same lockup in the header, the same footer, and the organization's name as the eyebrow over every page title (`Page` in `app/components/ui.tsx`, fed through the org layout's outlet context). Reed is the approved and success color there too (badges, the success alert, the on state of a switch, added lines in a diff); amber is waiting, red is rejected, and an `ink` badge marks a role. No blue.

### Logo rules

- Lockup: mark 28 px tall beside the wordmark "reedright", lowercase, 20 px, weight 600, letter-spacing −0.01 em. Mark alone for the favicon and avatars.
- Clear space around the mark: the width of the main stem.
- Minimum size 20 px. Below 24 px the leaves smear; the favicon needs a simplified glyph, the "R" without leaves.
- Only ink, paper, or currentColor. Never stretched, rotated, outlined, gradient-filled, or placed on a busy background.
- The wordmark is always lowercase, one word.

### Assets to produce

| Asset | Status |
| --- | --- |
| Mark, currentColor, tight viewBox | done: `docs/images/reedright-mark.svg`, inlined by `app/components/mark.tsx` |
| Wordmark | set in type by the `Lockup` component |
| Favicon and touch icon: the leafless glyph in paper on an ink square | done: `public/favicon.svg`, `public/apple-touch-icon.png` |
| Social card 1200 × 630 | done: `public/og.png` (system humanist font; regenerate with the site font once it is worth it) |
| Color tokens in `app.css` `@theme` | done: `--color-reed`, `--color-reed-light`; paper and ink stay the stone scale |
| Font: `@fontsource-variable/source-sans-3` | done, imported in `root.tsx` |
| Hub diagram SVG | done, `Hub` in `app/components/landing.tsx` |
| Entry-with-paper-trail mock, approve-page mock, website mock | done in HTML, same file |
| Weekly-email mock | not on the page until the feature exists |
| Commissioned illustrations | done 2026-09-16: Cam rendered the three prompts in Midjourney; traced with potrace to `public/art/{band,stalk,reeds}.svg` (currentColor symbols drawn through `<use>` by `app/components/art.tsx`). Band behind the closing call to action, reeds along the footer, stalk beside the sign-up and log-in forms. Sources stay in `~/Downloads/mj prompts` |

### Illustration prompts (Midjourney)

The rule from Imagery still holds: ink on paper, one color, the mark's language. Ask for silhouettes so the result traces to a clean single-color SVG, as the mark did. Keep the whitespace; we can crop but not add it.

1. **Closing band, wide.** "sparse sumi-e ink drawing of three reeds and one bamboo stalk with joints, two leaf clusters, solid black ink silhouette on plain off-white paper, generous empty space, no text, no gradients, no gray wash, wide composition --ar 3:1 --style raw"
2. **Section spot, square.** "single bamboo stalk with one leaf cluster, solid black ink silhouette, clean edges, plain off-white paper, centered, lots of empty space, no text --ar 1:1 --style raw"
3. **Page rule, very wide.** "a thin horizontal row of reed silhouettes of uneven height, black ink on off-white paper, like a decorative rule under a heading, no text --ar 8:1 --style raw"

Where they went: 1 sits behind the closing call to action at 20 percent ink (25 in dark). 2 stands bottom-left of the sign-up and log-in pages on wide screens. 3 runs along the footer at 30 percent, cropped to width rather than shrunk. Tracing recipe: grayscale, threshold (190 for the white-background band, 120 for paper), crop to ink, `potrace -s -t <turdsize 6-28> -a 1.2 -O 0.8`, wrap the group in a `<symbol id="art">` with `fill="currentColor"`.

### Where the page lives

At `/` in the app, for visitors who are not logged in. The current placeholder index becomes the landing page. Fonts and tokens are shared, so the app inherits the type and gets the mark in its nav in the same change.

---

## 14. Brand worksheet

Answers to the Kennedy Design brand worksheet, locked 2026-09-16.

**Adjectives:** Straightforward, Trustworthy, Human, Natural, Restrained, Considerate, Clean. Restrained rather than Minimalist: one is a temperament, the other a style statement. Explicitly not: Techie, Geeky, Futuristic, Cutting-edge, Sleek, Bold, Swanky.

**Who are you?** Shared context for AI-forward teams. One thing: we keep the context your AI tools share correct, current, and yours.

**What do you have to say?** Every agent reads it. Anyone can add to it. The right person approves it.

**Why should people listen to you?** Because you don't have to. The brain is plain files in your own repository, the protocol is a public document, the code is Apache 2.0, and a demo brain is open to read. Listen to the files, not to us. It was built for a real company running agents and an agency, and the review model came from that.

**What do you believe that competitors don't?** Memory should not belong to the AI vendor or to one person. It belongs to the company, in files a human can read. Every vendor builds memory inside its product. Every wiki treats agents as readers only. We think agents should write and people should approve. Small and reviewed beats big and searched.

**Values we'd lose money over.** We never store prompts or conversation content, though it would make reports richer. You can leave any day and lose nothing, though lock-in would raise retention. A human owner always has the last word; we will not auto-approve rules to make adoption look better. The files stay readable without our software; we will not move the brain into a private database to go faster.

**What we stand against.** Lock-in. Black-box memory. Agents as unaccountable authors. "Search everything" as a feature. Features for their own sake. Techie mystique: making simple things look complex to seem powerful.

**The defensible synonyms, and whether we still reject them.**

| Anti-value | Its best synonym | Verdict |
| --- | --- | --- |
| Lock-in | Deep integration | Rejected. The test is whether leaving costs you your data. |
| Black-box memory | Zero-setup personalization | Fine for a person. Rejected for a company. |
| Agents write freely | Frictionless capture | Rejected. Friction at the owner's click is the product. |
| Search everything | Comprehensive | Rejected. Refs point outward for the rest. |
| Techie | Expert-grade | Keep the substance, reject the look. The engine may be sophisticated; the page may not. |
| Dashboards | Visibility | Accepted only when it answers an owner's question: who reads what, what is stale. |

**Most likely misinterpretation.** "It's a GitHub tool for developers." That is the colleague's read, and every git word on the page feeds it. Second: "another wiki or knowledge base." Third: "an AI memory app like the vendors'." The page pre-empts all three: GitHub appears once, below the fold; "reviewed" and "owner" land in the first 20 words; a person approving and a website to browse are the first two visuals; the FAQ names wiki and vendor memory outright.

**Design decisions locked with the worksheet:** Source Sans 3; reed green as the single accent, doubling as the approved color; the page at the app root for logged-out visitors, with the app taking the font and the mark at the same time; hero left-aligned with the hub diagram on the right; the "one thing" line under the hero sub.
