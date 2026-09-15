import { serializeEntry } from "~/lib/brain/frontmatter";
import { parseOwners } from "~/lib/brain/owners";
import type { Frontmatter } from "~/lib/brain/schema";

export const TODAY = "2026-09-15";

export const owners = parseOwners(`
identities:
  growth-lead: { name: "RoadRunner", channels: ["email:roadrunner@example.com"] }
  eng-lead: { name: "Cam", channels: ["email:cam@example.com"] }
  bamboo: { name: "Bamboo" }
domains:
  marketing: { owners: [growth-lead, bamboo] }
  compliance: { owners: [eng-lead] }
  engineering: { owners: [eng-lead] }
  ops: { owners: [eng-lead] }
paths:
  refs/: { owners: [eng-lead] }
  SCHEMA.md: { owners: [eng-lead, growth-lead] }
  OWNERS.yaml: { owners: [eng-lead, growth-lead] }
`);

export function observation(over: Partial<Frontmatter> = {}, body = "# Klaviyo flows renamed\n\nThe welcome series is now called Onboarding in Klaviyo. Old references in procedures should be read as that."): { path: string; raw: string } {
  const fm: Frontmatter = {
    type: "observation", domain: "marketing", author: "bamboo", run: "run-1", source: "reasoning",
    created: TODAY, review_by: "2026-10-15", approved_by: null, approved_at: null, approval_ref: null, supersedes: null, ...over,
  };
  return { path: `observations/${fm.domain}/${fm.created}-klaviyo-flows-renamed.md`, raw: serializeEntry(fm, body) };
}

export function rule(over: Partial<Frontmatter> = {}, body = "# Brand voice\n\nWrite like a friend who knows nutrition. No exclamation marks in subject lines."): { path: string; raw: string } {
  const fm: Frontmatter = {
    type: "rule", domain: "marketing", author: "growth-lead", run: "manual", source: "https://docs.example.com/voice",
    created: TODAY, review_by: "2027-03-14", approved_by: null, approved_at: null, approval_ref: null, supersedes: null, ...over,
  };
  return { path: `rules/${fm.domain}/${fm.created}-brand-voice.md`, raw: serializeEntry(fm, body) };
}

export const approved = { approved_by: "growth-lead", approved_at: "2026-09-15T10:00:00Z", approval_ref: "https://reedright.example/orgs/liu/approvals/abc" } as const;
