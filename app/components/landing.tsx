// The landing page, shown at / to visitors who are not logged in.
// Copy, voice, and design rules live in docs/positioning.md. Above the fold these words never appear:
// pull request, merge, lint, frontmatter, YAML, MCP, token, git, GitHub.
import { Link } from "react-router";
import { Badge } from "./ui";
import { Lockup } from "./mark";
import { Art } from "./art";
import { Footer } from "./shell";

const primary = "inline-flex items-center justify-center rounded-md bg-stone-900 px-4 py-2.5 text-base font-semibold text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300";
const secondary = "inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2.5 text-base font-semibold text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800";
const muted = "text-stone-600 dark:text-stone-400";
const card = "rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900";
const accent = "text-reed dark:text-reed-light";

export function Landing() {
  return (
    <div className="text-[17px] leading-[1.55]">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Lockup />
          <nav className="flex items-center gap-5 text-base">
            <a href="#how" className="hidden hover:underline sm:inline">How it works</a>
            <a href="#faq" className="hidden hover:underline sm:inline">Questions</a>
            <Link to="/login" className="hover:underline">Log in</Link>
            <Link to="/signup" className={`${primary} px-3 py-1.5 text-sm`}>Sign up free</Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />

        <section className="border-y border-stone-200 dark:border-stone-800">
          <p className="mx-auto max-w-5xl px-6 py-4 text-base">
            <span className="font-semibold">reedright does one thing.</span> It keeps the context your AI tools share correct, current, and yours.
          </p>
        </section>

        <Sidekick n="1" title="Every tool reads the same thing." visual={<ConnectionsMock />}>
          <p>Connect Claude, ChatGPT, Cursor, or an agent you built. Each person connects with their own login, so every read and every addition has a name on it.</p>
          <p>Your agent reads the brain before it answers. When it learns something, it adds an entry.</p>
        </Sidekick>

        <Sidekick n="2" title="Anyone can add. The owner decides what stays." visual={<ApproveMock />} flip>
          <p>Quick observations go in right away, with limits: short, no numbers, no duplicates. Rules and procedures wait for the owner of that topic.</p>
          <p>The owner reads the change on one page and clicks approve or reject. No code, no engineers. The approval is written into the entry: who, when, and a link.</p>
          <p>Each week, owners get a summary of what changed and what is waiting.</p>
        </Sidekick>

        <Sidekick n="3" title="Browse it like a website. Own it like a file." visual={<SiteMock />}>
          <p>Every brain gets a clickable, searchable website, free. Managers read what the agents know without a chat window. Search it. Click through it. Send a link to a colleague.</p>
          <p>Pull in Google Docs. See who reads what and what is due for review. Underneath, it is plain text in a repository your company owns. Leave any time and keep everything.</p>
        </Sidekick>

        <section id="how" className="scroll-mt-6 border-y border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3">
              {steps.map(([head, body], i) => (
                <li key={head} className="flex gap-4">
                  <span className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-sm font-semibold ${accent}`}>{i + 1}</span>
                  <div>
                    <p className="font-semibold">{head}</p>
                    <p className={`mt-1 text-base ${muted}`}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight">How teams use it</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {uses.map(([role, quote]) => (
              <li key={role} className={card}>
                <p className={`text-sm font-semibold ${accent}`}>{role}</p>
                <p className="mt-2">{quote}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="scroll-mt-6 border-t border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Questions</h2>
            <dl className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {faq.map(([q, a]) => (
                <div key={q}>
                  <dt className="font-semibold">{q}</dt>
                  <dd className={`mt-1 text-base ${muted}`}>{a}</dd>
                </div>
              ))}
            </dl>
            <p className={`mt-10 text-base ${muted}`}>
              For engineers: every addition is a pull request opened by the reedright GitHub App on the person's behalf. Observations merge when lint passes; rules, procedures, and refs wait for a domain owner in OWNERS.yaml. The approval is stamped into the file's frontmatter. The server speaks MCP over Streamable HTTP with OAuth 2.1. The layout is the Shared Context Protocol, in every brain as SCHEMA.md. Apache 2.0.{" "}
              <a className="underline" href="https://github.com/reedright/reedright#readme" target="_blank" rel="noreferrer">Read the README</a>.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14">
          <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-900 md:min-h-[17rem] md:p-10">
            <Art name="band" preserveAspectRatio="xMaxYMax meet" className="pointer-events-none absolute inset-y-4 right-0 hidden h-[calc(100%-1rem)] w-auto text-stone-900 opacity-20 sm:block dark:text-stone-100 dark:opacity-25" />
            <div className="relative max-w-md">
              <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Give every AI tool the same brain.</h2>
              <p className={`mt-2 ${muted}`}>Free for small teams. 2 minutes to connect the first tool.</p>
              <Link to="/signup" className={`${primary} mt-6`}>Sign up free</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer>
        <Link className="hover:underline" to="/signup">Sign up</Link>
        <Link className="hover:underline" to="/login">Log in</Link>
      </Footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-[1.25fr_1fr] md:items-center md:py-24">
      <div>
        <p className={`text-sm font-semibold tracking-wide uppercase ${accent}`}>Shared context for AI-forward teams</p>
        <h1 className="mt-3 text-[2rem] leading-[1.15] font-bold tracking-tight md:text-[2.5rem]">
          Every agent reads it.<br className="hidden md:block" /> Anyone can add to it.<br className="hidden md:block" /> The right person approves it.
        </h1>
        <p className={`mt-5 max-w-xl text-lg ${muted}`}>
          reedright is your company's brain: one reviewed source of what you know. Claude, ChatGPT, and the agents you build read it before they answer. Your team browses it on a website. Underneath, it is plain files you own.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/signup" className={primary}>Sign up free</Link>
          <a href="#how" className={secondary}>See how it works</a>
        </div>
        <p className="mt-4 text-sm text-stone-500">2 minutes to connect your first tool. No credit card. Nothing for your teammates to install.</p>
      </div>
      <Hub />
    </section>
  );
}

function Sidekick({ n, title, children, visual, flip = false }: { n: string; title: string; children: React.ReactNode; visual: React.ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-6 py-14 md:grid-cols-2 md:items-center md:py-20">
      <div className={flip ? "md:order-2" : ""}>
        <p className={`text-sm font-semibold ${accent}`}>{n}</p>
        <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">{title}</h2>
        <div className={`mt-4 space-y-3 ${muted}`}>{children}</div>
      </div>
      <div className={flip ? "md:order-1" : ""}>{visual}</div>
    </section>
  );
}

const steps: Array<[string, string]> = [
  ["Sign up and connect a repository.", "We lay it out for you."],
  ["Invite your team. Connect your tools.", "One login per person. Nothing to install."],
  ["Agents read and add. Owners approve.", "Everyone browses the same brain."],
];

// Illustrative role cards, not testimonials, until real quotes exist (docs/positioning.md §9).
const uses: Array<[string, string]> = [
  ["Ops lead, consumer brand", "Every Monday I approve five or six things the agents noticed last week. Ten minutes. Before, nobody wrote them down."],
  ["Marketing manager", "I have never opened a repository. I get a link, read the change, click approve. When I want to know what the agents think about our brand, I open the site and search."],
  ["Founder working with an agency", "The agency's Claude and our ChatGPT finally agree on our brand voice, because they read the same entry."],
  ["Automation builder", "My agent adds an observation after every run. The good ones get kept. The bad ones get rejected before anyone acts on them."],
];

const faq: Array<[string, string]> = [
  ["What is shared context?", "The things your company knows that an AI tool needs before it answers: how you talk, what you decided, how you do things, where the numbers live. reedright keeps it in one place that every tool reads."],
  ["Which AI tools work with it?", "Claude (claude.ai and Claude Code), ChatGPT, Cursor, and any agent that speaks MCP, the standard way tools connect to outside context. One connection per person. The tool reads and adds on your behalf."],
  ["Do my teammates need GitHub?", "No. They sign up with an email. They approve from a web page. They browse the brain on its website. Only the first person connects the repository."],
  ["What stops an agent from adding nonsense?", "Limits. Observations are short, cannot contain numbers, and are rejected if they duplicate an existing entry. Rules, procedures, and references wait for an owner. Every entry has an author, a source, and a review date. Anything can be rejected before it lands and removed after."],
  ["Why not ChatGPT memory or a Claude project?", "Those belong to one person and one vendor. Nobody reviews them. They leave with the account. reedright is shared, reviewed, and yours."],
  ["Why not a wiki?", "Agents cannot write to a wiki safely, and nobody keeps it current. In reedright, agents add, owners approve, and every entry has a review date. And you still get the website."],
  ["Where is my data? What do you store?", "Your brain lives in your repository. reedright stores accounts, who added and approved what, and which entries were read. Never prompts. Never conversation content. Delete an entry by deleting the file. Uninstall and keep everything."],
  ["What does it cost?", "Free for small teams, with no credit card. Larger teams will pay per member, and we will say so before anything changes."],
  ["How long does setup take?", "About 2 minutes to sign up and connect your first tool. Inviting the team and pulling in documents takes as long as you want to spend."],
  ["Can I leave?", "Any time. Uninstall reedright and the files stay in your repository, readable without us."],
];

/**
 * Tools on the left, the brain on the right, the owner's gate on the add path. Reads in reed green, adds dashed in ink.
 * On load it draws itself in the order of the headline (reads, adds, the owner's check, the keep), then the add lines
 * drift toward the owner. The timing and the reduced-motion switch live in app.css under .hub-draw and .hub-drift.
 */
function Hub() {
  const tools = [
    { label: "Claude", cy: 60 },
    { label: "ChatGPT", cy: 140 },
    { label: "Cursor", cy: 220 },
    { label: "Your agent", cy: 300 },
  ];
  const step = 0.08;
  const reads = { at: 0.2, over: 0.7 };
  const adds = { at: reads.at + reads.over + 0.1, over: 0.8 };
  const check = { at: adds.at + 3 * step + adds.over - 0.05, over: 0.3 };
  const keep = { at: check.at + check.over - 0.05, over: 0.35 };
  return (
    <svg viewBox="0 0 560 350" className="h-auto w-full" role="img" aria-labelledby="hub-title">
      <title id="hub-title">Claude, ChatGPT, Cursor, and your agent read one brain. What they add passes the owner before it is kept.</title>
      <defs>
        <marker id="hub-read" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" stroke="none" />
        </marker>
        <marker id="hub-add" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" stroke="none" />
        </marker>
      </defs>
      {/* reads: brain to tools */}
      <g className="text-reed dark:text-reed-light" fill="none" stroke="currentColor" strokeWidth="2">
        {tools.map((t, i) => {
          const d = `M340 205 C 260 205, 220 ${t.cy + 7}, 148 ${t.cy + 7}`;
          return (
            <Drawn key={t.label} id={`hub-read-${i}`} d={d} at={reads.at + i * step} over={reads.over}>
              <path d={d} markerEnd="url(#hub-read)" />
            </Drawn>
          );
        })}
      </g>
      {/* adds: tools to the gate, gate to the brain */}
      <g className="text-stone-700 dark:text-stone-300" fill="none" stroke="currentColor" strokeWidth="2">
        {tools.map((t, i) => {
          const d = `M140 ${t.cy - 7} C 240 ${t.cy - 7}, 300 44, 389 44`;
          return (
            <Drawn key={t.label} id={`hub-add-${i}`} d={d} at={adds.at + i * step} over={adds.over}>
              <path d={d} strokeDasharray="5 5" markerEnd="url(#hub-add)" className="hub-drift" />
            </Drawn>
          );
        })}
        <Drawn id="hub-keep" d="M415 66 V 132" at={keep.at} over={keep.over}>
          <path d="M415 66 V 132" markerEnd="url(#hub-add)" />
        </Drawn>
      </g>
      {/* tools */}
      <g className="text-stone-900 dark:text-stone-100" fontSize="15">
        {tools.map((t) => (
          <g key={t.label}>
            <rect x="16" y={t.cy - 18} width="124" height="36" rx="6" className="fill-white stroke-stone-300 dark:fill-stone-900 dark:stroke-stone-700" strokeWidth="1.5" />
            <text x="78" y={t.cy + 5} textAnchor="middle" fill="currentColor">{t.label}</text>
          </g>
        ))}
      </g>
      {/* the owner's gate */}
      <g className="text-stone-900 dark:text-stone-100">
        <circle cx="415" cy="44" r="20" className="fill-white stroke-current dark:fill-stone-900" strokeWidth="1.5" />
        <Drawn id="hub-check" d="M405 45 l7 7 l13 -14" at={check.at} over={check.over}>
          <path d="M405 45 l7 7 l13 -14" className="stroke-reed dark:stroke-reed-light" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Drawn>
        <text x="442" y="49" fontSize="13" className="fill-stone-500">the owner approves</text>
      </g>
      {/* the brain: three sheets */}
      <g className="text-stone-900 dark:text-stone-100">
        <rect x="354" y="154" width="150" height="105" rx="6" className="fill-stone-100 stroke-current dark:fill-stone-800" strokeWidth="1.5" />
        <rect x="347" y="147" width="150" height="105" rx="6" className="fill-stone-50 stroke-current dark:fill-stone-800" strokeWidth="1.5" />
        <rect x="340" y="140" width="150" height="105" rx="6" className="fill-white stroke-current dark:fill-stone-900" strokeWidth="1.5" />
        <path d="M356 164 h80 M356 180 h118 M356 196 h100 M356 212 h60 M356 228 h90" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <text x="415" y="288" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">Your brain</text>
      </g>
      {/* legend */}
      <g fontSize="13" className="fill-stone-500">
        <path d="M16 331 H46" className="stroke-reed dark:stroke-reed-light" strokeWidth="2" />
        <text x="54" y="335">reads</text>
        <path d="M118 331 H148" className="stroke-stone-700 dark:stroke-stone-300" strokeWidth="2" strokeDasharray="5 5" />
        <text x="156" y="335">adds</text>
        <path d="M222 332 l5 5 l9 -10" className="stroke-reed dark:stroke-reed-light" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="244" y="335">approved by the owner, then kept</text>
      </g>
    </svg>
  );
}

/**
 * Reveals its children along `d` as if a pen drew them, starting `at` seconds in and taking `over` seconds. The mask
 * is a wide stroke on the same path whose dash offset animates (app.css, .hub-draw), so whatever sits on the path,
 * including a dashed line and its arrowhead, appears from start to end.
 */
function Drawn({ id, d, at, over, children }: { id: string; d: string; at: number; over: number; children: React.ReactNode }) {
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="350">
        <path d={d} pathLength="100" fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" className="hub-draw" style={{ animationDelay: `${at}s`, animationDuration: `${over}s` }} />
      </mask>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}

function ConnectionsMock() {
  const rows: Array<[string, string, string, string, string]> = [
    ["maria", "Claude", "read", "brand voice", "2 min ago"],
    ["jules", "ChatGPT", "read", "refund policy", "14 min ago"],
    ["ops-agent", "agent", "added", "an observation about returns", "1 h ago"],
    ["dev", "Cursor", "read", "release checklist", "today"],
  ];
  return (
    <figure>
      <div className={card}>
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Acme brain · who is connected</span>
          <span>last 24 hours</span>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map(([who, tool, verb, what, when]) => (
              <tr key={who} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-2 pr-3 font-mono text-xs">{who}</td>
                <td className="py-2 pr-3"><Badge>{tool}</Badge></td>
                <td className="py-2 pr-3">{verb} <span className="font-medium">{what}</span></td>
                <td className="py-2 text-right text-xs whitespace-nowrap text-stone-500">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-xs text-stone-500">Every read and every addition has a name on it.</figcaption>
    </figure>
  );
}

function ApproveMock() {
  return (
    <figure>
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">rule</Badge>
          <Badge>marketing</Badge>
          <span className="font-medium">How we describe the membership</span>
          <span className="ml-auto text-xs text-stone-500">waiting for <span className="font-mono">maria</span></span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_11rem]">
          <div className="space-y-2 text-sm">
            <p>Say "membership", never "subscription". Members join; they do not subscribe.</p>
            <p>Mention that a member can pause any month. Do not quote a price; link to the plans page instead.</p>
          </div>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs">
            <dt className="text-stone-500">added by</dt><dd className="font-mono">ops-agent</dd>
            <dt className="text-stone-500">source</dt><dd>support calls, week 37</dd>
            <dt className="text-stone-500">added</dt><dd>12 Sep 2026</dd>
            <dt className="text-stone-500">review by</dt><dd>11 Mar 2027</dd>
          </dl>
        </div>
        <div className="mt-4 flex justify-end gap-2" aria-hidden="true">
          <span className={`${secondary} px-3 py-1.5 text-sm`}>Reject</span>
          <span className={`${primary} px-3 py-1.5 text-sm`}>Approve</span>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-stone-500">The owner's whole job: read it, click once.</figcaption>
    </figure>
  );
}

function SiteMock() {
  const results: Array<[string, string]> = [
    ["Refunds: what we promise", "rule · support"],
    ["Issue a refund", "procedure · support"],
    ["Refund volume by month", "ref · finance"],
  ];
  const tree = ["rules/support/refunds-what-we-promise.md", "procedures/support/issue-a-refund.md", "refs/finance/refund-volume.md", "observations/support/2026-09-12-returns-spike.md", "MANIFEST.md"];
  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 text-xs text-stone-500 dark:border-stone-800">
          <span className="flex gap-1" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" /><i className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" /><i className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" /></span>
          <span className="ml-1 font-mono">brain.acme.com</span>
        </div>
        <div className="p-4">
          <div className="rounded-md border border-stone-300 px-2 py-1 text-sm dark:border-stone-700">refund</div>
          <ul className="mt-3 divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {results.map(([t, meta]) => (
              <li key={t} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="font-medium underline decoration-stone-300 dark:decoration-stone-600">{t}</span>
                <span className="text-xs whitespace-nowrap text-stone-500">{meta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3 min-w-0 rounded-lg border border-stone-200 bg-white p-3 font-mono text-[11px] leading-5 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
        <div className="text-stone-900 dark:text-stone-100">acme-brain/</div>
        {tree.map((p) => <div key={p} className="truncate pl-3">{p}</div>)}
      </div>
      <figcaption className="mt-2 text-xs text-stone-500">The same brain: a website for people, files for the company.</figcaption>
    </figure>
  );
}
