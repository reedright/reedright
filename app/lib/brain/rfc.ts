// The Shared Context Protocol RFC v0.2, scaffolded into every brain as SCHEMA.md. Source: semble-data/drafts.
export const RFC_MARKDOWN = `# Shared Context Protocol — RFC v0.2

**Status:** Draft. Comments are open.
**Purpose:** This document gives the standard for the shared context (the "brain"). All agents in the organization read the brain and write to the shared brain. The standard does not depend on a vendor. You can host it yourself.

## 1. Principles

- The brain is a set of flat files in a git repository. Nothing else is the brain.
- All other data is a cache. This includes embeddings, indexes, UUID lists, and summaries. You must be able to make each cache again from the repository only.
- An agent must be able to find its way with one read. The agent does not need an MCP server, a vector database, or a vendor account.
- The brain points to data. The brain does not keep data. A number stays in its system of record. The brain says where the number is and how to get it.
- No file goes into the brain without a lint check. Each write is a pull request. CI applies the schema, which is visible to the git repo's owners.
- GitHub keeps the files. Git/GitHub does not keep the authority. Each file carries its own record of who wrote it, who approved it, and where the content came from. A git identity (commit author, PR reviewer, merge actor) is not evidence of any of these.
- Conformance test: Clone the repository. Do not use vendor credentials. Give an agent a real task. If the agent cannot complete the task, the protocol has a defect.

## 2. Layout

\`\`\`
brain/
  MANIFEST.md            # CI makes this file on each merge. It lists each entry by type, path, owner, and date.
  SCHEMA.md              # This document.
  OWNERS.yaml            # Who owns each domain. See §7.
  rules/<domain>/        # Policy that does not change often. A person must approve.
  procedures/<domain>/   # Skills. Each skill is small and you can test it.
  refs/<domain>/         # Pointers to data in a system of record.
  observations/<domain>/ # Files that agents write. Each file has a review date.
  archive/               # Old or replaced files. Do not delete files.
\`\`\`

Domains: marketing, compliance, engineering, ops. To add a domain, change OWNERS.yaml.

## 3. Entry types

| Type | Directory | Change rate | Merge policy |
| --- | --- | --- | --- |
| rule | rules/ | low | A person must approve. |
| procedure | procedures/ | low | A person must approve. |
| ref | refs/ | low | A person must approve. |
| observation | observations/ | high | Merge is automatic when lint passes. |

## 4. Frontmatter schema

Each file must have this frontmatter. The frontmatter is the chain of custody. It is the only record of provenance that the protocol accepts.

\`\`\`yaml
type: rule | procedure | ref | observation
domain: marketing | compliance | engineering | ops
author: <person handle or agent id>
run: <session id or run id, or "manual">
source: <URL, document, system, or "reasoning">
created: YYYY-MM-DD
review_by: YYYY-MM-DD     # For observations: not more than 30 days after created.
approved_by: <person handle, or null>
approved_at: YYYY-MM-DDTHH:MM:SSZ, or null
approval_ref: <link to the approval event, or null>   # A message, ticket, or form. Not a git URL.
supersedes: <path or null>
\`\`\`

Each ref file must also have these keys.

\`\`\`yaml
system: shopify | recharge | sheets | ...
locator: <endpoint, sheet range, or query>
\`\`\`

Identities in author and approved_by come from the organization identity list, not from git. The identity list is in OWNERS.yaml.

## 5. Lint rules

CI applies these rules. A file that fails a rule cannot merge.

- The frontmatter is present. All required keys are present. Each enum value is valid. Each date is valid.
- The file path agrees with type and domain.
- A rule, procedure, or ref file has approved_by, approved_at, and approval_ref. approved_by is an owner of that domain in OWNERS.yaml.
- approval_ref is not a git or GitHub URL.
- A rule file or an observation file does not contain a number that looks like a metric. Point to a ref file.
- The review_by date is not in the past.
- The file is not almost the same as an existing file. CI uses a similarity check. You can adjust the threshold.
- An observation file has 300 words or fewer.
- CI makes and commits MANIFEST.md. Do not edit MANIFEST.md by hand.

## 6. I/O rules

### Writes

- Each write is a pull request. Do not push to main.
- An agent can open a pull request. An agent can also merge a pull request, but only on behalf of a recorded approval.
- A person approves on any surface: chat, email, a ticket, a form. The person does not need a git account.
- An approval bot records the approval in the file frontmatter (approved_by, approved_at, approval_ref) and then merges. The bot is the git actor. The person is the approver.
- An observation pull request merges automatically when lint passes. It has no approver.
- A rule, procedure, or ref pull request needs an approval from an owner of that domain. See §7.
- Do not use GitHub review, PR approval, or branch protection as the record of approval. You can use them as a safety check.

### Reads

- An agent reads MANIFEST.md first. Then the agent reads entries by path.
- A retrieval layer (vector search, MCP server, Cowork project) is a client of the repository. A retrieval layer is not a dependency.
- Each read must record the paths it loaded. Use a usage/ sidecar or telemetry. If no agent reads a file for 60 days, CI flags the file for archive.

### Lifecycle

- Move an expired file to archive/. Do not delete it.
- To replace a file, set supersedes: in the new file. Move the old file to archive/ in the same pull request.
- Git history is an audit log of file changes. It is not the record of who approved what. That record is in the file.

## 7. Ownership

OWNERS.yaml is the only source of truth for ownership and for identity. It lives in the repository. It does not use git identities. Initial values:

\`\`\`yaml
identities:
  growth-lead:     { name: "...", channels: ["slack:@...", "email:..."] }
  compliance-lead: { name: "...", channels: ["slack:@...", "email:..."] }
  eng-lead:        { name: "...", channels: ["slack:@...", "email:..."] }
  bamboo:          { name: "Bamboo", channels: ["email:..."] }

domains:
  marketing:   { owners: [growth-lead, bamboo] }
  compliance:  { owners: [compliance-lead, eng-lead] }
  engineering: { owners: [eng-lead] }
  ops:         { owners: [eng-lead] }

paths:
  refs/:        { owners: [eng-lead] }
  SCHEMA.md:    { owners: [eng-lead, growth-lead] }
  OWNERS.yaml:  { owners: [eng-lead, growth-lead] }
\`\`\`

A change to OWNERS.yaml needs approval from all current owners of OWNERS.yaml.

## 8. Non-goals

- The brain does not replace Google Drive. Drive keeps documents. The brain keeps distilled context.
- The protocol does not specify a retrieval implementation.
- The protocol does not specify an approval surface. Any surface that the approval bot can read is valid.
- The protocol does not store telemetry content. Usage logs record paths. Usage logs do not record prompts.

## 9. Open questions

- What threshold and what tool do we use for the similarity check?
- Must an observation file have a minimum source quality before automatic merge?
- Where do usage/ logs go if they are not in the repository?
- How does the approval bot verify that an approval message came from the person in OWNERS.yaml?

`;
