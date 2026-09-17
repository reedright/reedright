// The app's building blocks. Paper, ink, a 1 px rule, and reed green for what an owner said yes to; amber is waiting
// and red is rejected. No other hue. Rules: docs/positioning.md §13.
import type { ComponentProps, ReactNode } from "react";
import { useNavigation, useOutletContext } from "react-router";

/** What a layout hands its pages through <Outlet context>. The org layout passes the organization's name. */
export interface PageContext {
  eyebrow?: string;
}

/**
 * A page title with the landing page's eyebrow above it. The eyebrow is the prop if given, else what the enclosing
 * layout put in its outlet context, else nothing.
 */
export function Page({ title, eyebrow, children, aside }: { title: ReactNode; eyebrow?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  const ctx = useOutletContext<PageContext | null>();
  const above = eyebrow ?? ctx?.eyebrow;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {above && <p className="text-xs font-semibold tracking-wide text-reed uppercase dark:text-reed-light">{above}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900 ${className}`}>{children}</section>;
}

export function Label(props: ComponentProps<"label">) {
  return <label {...props} className={`block text-sm font-medium text-stone-700 dark:text-stone-300 ${props.className ?? ""}`} />;
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-stone-700 dark:bg-stone-950 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm shadow-sm dark:border-stone-700 dark:bg-stone-950 ${props.className ?? ""}`}
    />
  );
}

export function Button({ variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-stone-900 text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300",
    secondary: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
    danger: "bg-red-700 text-white hover:bg-red-600",
  }[variant];
  return <button {...props} className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${styles} ${props.className ?? ""}`} />;
}

/** Success is reed, the approved color. Info is ink on paper with a rule, like a card. */
export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    success: "border-reed/50 bg-reed/10 text-stone-900 dark:border-reed-light/40 dark:bg-reed-light/10 dark:text-stone-100",
    info: "border-stone-200 bg-white text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300",
  }[kind];
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function Code({ children }: { children: ReactNode }) {
  return <pre className="overflow-x-auto rounded-md bg-stone-100 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all dark:bg-stone-950">{children}</pre>;
}

/** `green` is reed, for what an owner approved; `ink` is solid, for a role or a state that is not a verdict. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ink" | "green" | "amber" | "red" }) {
  const styles = {
    neutral: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
    ink: "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900",
    green: "bg-reed/10 text-reed dark:bg-reed-light/10 dark:text-reed-light",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs ${styles}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}

/** An on/off switch that submits its form. Flips optimistically while the action runs; `match` scopes it like SubmitButton. */
export function Switch({ checked, label, match, ...props }: Omit<ComponentProps<"button">, "type"> & { checked: boolean; label: string; match?: Record<string, string> }) {
  const nav = useNavigation();
  const fd = nav.formData;
  const pending = nav.state !== "idle" && Boolean(fd) && (!match || Object.entries(match).every(([k, v]) => fd!.get(k) === v));
  const on = pending ? !checked : checked;
  return (
    <button
      {...props}
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      aria-busy={pending}
      disabled={pending || props.disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-reed dark:bg-reed-light" : "bg-stone-300 dark:bg-stone-700"} ${props.className ?? ""}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
    </button>
  );
}

/** A submit button that shows progress while its form action runs. `match` scopes it to one form on a page with many. */
export function SubmitButton({ pendingText = "Working…", match, children, ...props }: ComponentProps<typeof Button> & { pendingText?: string; match?: Record<string, string> }) {
  const nav = useNavigation();
  const fd = nav.formData;
  const pending = nav.state !== "idle" && Boolean(fd) && (!match || Object.entries(match).every(([k, v]) => fd!.get(k) === v));
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
