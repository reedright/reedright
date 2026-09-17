// The frame around every page after the landing: the lockup, the page's links, who is signed in, and the footer the
// landing page uses, so the app and the page read as one document. Rules: docs/positioning.md §13.
import type { ReactNode } from "react";
import { Form, NavLink } from "react-router";
import { Art } from "./art";
import { Lockup, Mark } from "./mark";
import { ThemeToggle } from "./theme";

export interface NavItem {
  to: string;
  label: string;
  /** Match the path exactly, for the index link. */
  end?: boolean;
}

/**
 * Header, content, footer. `user` puts the account and a log-out link on the right; `right` is what goes there
 * otherwise (a sign-up link on the log-in page). Pages that are a single form pass `footer={false}` and keep the
 * stalk illustration instead.
 */
export function Shell({ nav = [], user, right, footer = true, children }: { nav?: NavItem[]; user?: { email: string; handle?: string } | null; right?: ReactNode; footer?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Lockup />
          {nav.length > 0 && (
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => (isActive ? "text-stone-900 underline underline-offset-4 dark:text-stone-100" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100")}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
            {user ? (
              <>
                <span>
                  {user.email}
                  {user.handle && (
                    <>
                      {" · "}
                      <span className="font-mono">{user.handle}</span>
                    </>
                  )}
                </span>
                <Form method="post" action="/logout">
                  <button className="underline">Log out</button>
                </Form>
              </>
            ) : (
              right
            )}
          </span>
        </div>
      </header>
      <div className="grow">{children}</div>
      {footer && <Footer art="slim" />}
    </div>
  );
}

/**
 * Reeds along the bottom, then the mark, the line, the links, and the appearance switch. `children` are links that
 * go before the standing ones. The landing page runs the reeds full height; the app keeps them lower.
 */
export function Footer({ art = "full", children }: { art?: "full" | "slim"; children?: ReactNode }) {
  const reeds = art === "full" ? "h-20 opacity-30 md:h-28 dark:opacity-35" : "h-14 opacity-20 md:h-20 dark:opacity-25";
  return (
    <footer>
      <Art name="reeds" preserveAspectRatio="xMidYMax slice" className={`block w-full text-stone-900 dark:text-stone-100 ${reeds}`} />
      <div className="border-t border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-stone-500">
          <div className="flex items-center gap-3">
            <Mark className="h-8" />
            <span>Read. Write. Right.</span>
          </div>
          <nav className="flex flex-wrap gap-5">
            {children}
            <a className="hover:underline" href="https://github.com/reedright/reedright" target="_blank" rel="noreferrer">Source code</a>
            <span>Apache 2.0</span>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </footer>
  );
}
