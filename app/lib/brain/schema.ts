// The RFC §4 frontmatter schema and the entry-type vocabulary. Pure; shared by lint, propose, manifest.
import { z } from "zod";

export const ENTRY_TYPES = ["rule", "procedure", "ref", "observation"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** Directory for each type (RFC §2). */
export const TYPE_DIR: Record<EntryType, string> = {
  rule: "rules",
  procedure: "procedures",
  ref: "refs",
  observation: "observations",
};
export const DIR_TYPE: Record<string, EntryType> = Object.fromEntries(Object.entries(TYPE_DIR).map(([t, d]) => [d, t as EntryType]));

/** Types that need a person's approval before merge (RFC §3). Observations auto-merge on lint. */
export const NEEDS_APPROVAL: Record<EntryType, boolean> = { rule: true, procedure: true, ref: true, observation: false };

export const OBSERVATION_MAX_REVIEW_DAYS = 30;
export const OBSERVATION_MAX_WORDS = 300;
export const DEFAULT_REVIEW_DAYS: Record<EntryType, number> = { rule: 180, procedure: 180, ref: 180, observation: 30 };

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;
export const ENTRY_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function isValidDate(s: string) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const DateString = z.string().refine(isValidDate, "must be a valid YYYY-MM-DD date");
export const DateTimeString = z.string().regex(DATETIME_RE, "must be YYYY-MM-DDTHH:MM:SSZ").refine((s) => !Number.isNaN(new Date(s).getTime()), "must be a valid datetime");

export const FrontmatterSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  domain: z.string().regex(HANDLE_RE, "must be lowercase letters, digits, hyphens"),
  author: z.string().min(1),
  run: z.string().min(1),
  source: z.string().min(1),
  created: DateString,
  review_by: DateString,
  approved_by: z.string().min(1).nullable(),
  approved_at: DateTimeString.nullable(),
  approval_ref: z.string().min(1).nullable(),
  supersedes: z.string().min(1).nullable(),
  // ref-only keys (RFC §4)
  system: z.string().min(1).optional(),
  locator: z.string().min(1).optional(),
});
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

/** Key order for serialization, matching the RFC listing. */
export const FRONTMATTER_KEYS = [
  "type", "domain", "author", "run", "source", "created", "review_by",
  "approved_by", "approved_at", "approval_ref", "supersedes", "system", "locator",
] as const;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400e3);
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
