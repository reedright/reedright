import type { ComponentProps, ReactNode } from "react";
import { useNavigation } from "react-router";

export function Page({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
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
  return <button {...props} className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles} ${props.className ?? ""}`} />;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    success: "border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
    info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  }[kind];
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function Code({ children }: { children: ReactNode }) {
  return <pre className="overflow-x-auto rounded-md bg-stone-100 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all dark:bg-stone-950">{children}</pre>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  const styles = {
    neutral: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs ${styles}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
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
