// OWNERS.yaml (RFC §7): the only source of truth for identity and ownership. Pure.
import YAML from "yaml";
import { z } from "zod";
import { HANDLE_RE } from "./schema";

const OwnersSchema = z.object({
  identities: z.record(z.string().regex(HANDLE_RE), z.object({ name: z.string().optional(), channels: z.array(z.string()).optional() }).passthrough()).default({}),
  domains: z.record(z.string().regex(HANDLE_RE), z.object({ owners: z.array(z.string()) })).default({}),
  paths: z.record(z.string(), z.object({ owners: z.array(z.string()) })).default({}),
});
export type Owners = z.infer<typeof OwnersSchema>;

export function parseOwners(text: string): Owners {
  const raw = YAML.parse(text);
  const r = OwnersSchema.safeParse(raw ?? {});
  if (!r.success) throw new Error(`OWNERS.yaml is invalid: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

export function domainsOf(owners: Owners): string[] {
  return Object.keys(owners.domains);
}

/** Handles that may approve a file: owners of its domain, plus owners of any matching `paths:` prefix. */
export function resolveApprovers(owners: Owners, file: { domain?: string | null; path: string }): string[] {
  const set = new Set<string>();
  if (file.domain && owners.domains[file.domain]) for (const h of owners.domains[file.domain].owners) set.add(h);
  for (const [prefix, rule] of Object.entries(owners.paths)) {
    const matches = prefix.endsWith("/") ? file.path.startsWith(prefix) : file.path === prefix;
    if (matches) for (const h of rule.owners) set.add(h);
  }
  return [...set];
}

export function domainsOwnedBy(owners: Owners, handle: string): string[] {
  return Object.entries(owners.domains).filter(([, d]) => d.owners.includes(handle)).map(([name]) => name);
}

/** Initial OWNERS.yaml for a fresh brain: the creating admin owns everything. */
export function initialOwnersYaml(admin: { handle: string; name: string; email: string }, domains: string[]): string {
  const doc = {
    identities: { [admin.handle]: { name: admin.name, channels: [`email:${admin.email}`] } },
    domains: Object.fromEntries(domains.map((d) => [d, { owners: [admin.handle] }])),
    paths: {
      "refs/": { owners: [admin.handle] },
      "SCHEMA.md": { owners: [admin.handle] },
      "OWNERS.yaml": { owners: [admin.handle] },
    },
  };
  return `# Ownership and identity for this brain (RFC §7). Handles here are reedright handles, not git identities.\n# A change to this file needs approval from all current owners of OWNERS.yaml.\n${YAML.stringify(doc, { lineWidth: 0 })}`;
}
