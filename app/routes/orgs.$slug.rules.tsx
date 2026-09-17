// Rules: org-wide checks on what gets written to the brain, run in the repository's CI. Admins turn them on and off.
import { Form, data } from "react-router";
import type { Route } from "./+types/orgs.$slug.rules";
import { RULES, RULES_WORKFLOW_PATH, parseEnabledRules } from "~/lib/brain/rules";
import { setRuleEnabled } from "~/lib/brain/rules.server";
import { BrainRepo } from "~/lib/github/repo.server";
import { requireAdmin, requireMember } from "~/lib/session.server";
import { str } from "~/lib/validate";
import { Alert, Badge, Card, Empty, Page, Switch } from "~/components/ui";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { org, membership } = await requireMember(request, params.slug);
  const connected = Boolean(org.githubInstallationId && org.repoName);
  const enabled = new Set(parseEnabledRules(org.enabledRules).map((r) => r.id));
  let workflow: "present" | "missing" | "unknown" = "unknown";
  let error: string | null = null;
  if (connected) {
    try {
      workflow = (await (await BrainRepo.forOrg(org)).readFile(RULES_WORKFLOW_PATH)) ? "present" : "missing";
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const repoUrl = connected ? `https://github.com/${org.repoOwner}/${org.repoName}` : null;
  return {
    isAdmin: membership.role === "admin",
    connected,
    error,
    rules: RULES.map((r) => ({ id: r.id, name: r.name, description: r.description, pattern: r.pattern, enabled: enabled.has(r.id) })),
    workflow: {
      state: workflow,
      path: RULES_WORKFLOW_PATH,
      fileUrl: repoUrl ? `${repoUrl}/blob/${org.defaultBranch}/${RULES_WORKFLOW_PATH}` : null,
      runsUrl: repoUrl ? `${repoUrl}/actions/workflows/${RULES_WORKFLOW_PATH.split("/").pop()}` : null,
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { org } = await requireAdmin(request, params.slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "enable" && intent !== "disable") return data({ error: "Unknown action." }, { status: 400 });
  try {
    const r = await setRuleEnabled(org, str(form, "rule"), intent === "enable");
    const workflow = {
      written: `${RULES_WORKFLOW_PATH} was committed to the brain repository and runs on the next pull request.`,
      removed: `No rules are on, so ${RULES_WORKFLOW_PATH} was removed from the brain repository.`,
      unchanged: "The workflow in the brain repository was already up to date.",
    }[r.workflow];
    return data({ ok: `${r.rule.name} is ${r.enabled ? "on" : "off"}. ${workflow}` });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 500 });
  }
}

export default function Rules({ loaderData, actionData }: Route.ComponentProps) {
  const { isAdmin, connected, error, rules, workflow } = loaderData;
  const msg = actionData as { ok?: string; error?: string } | undefined;
  return (
    <Page title="Rules">
      {msg?.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg?.error && <div className="mb-4"><Alert>{msg.error}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!connected && <div className="mb-4"><Alert kind="info">Connect a brain repository before turning rules on.</Alert></div>}
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        A rule is a check on what gets written to the brain, whatever the entry type. Turning one on commits a GitHub Actions workflow to the brain repository that runs the rule as its own job on every pull request: a match annotates the line and fails the job, and the request's review page shows the result. reedright also runs the same check the moment a proposal is made, so flags appear in the approvals queue before CI finishes, and an observation that trips a rule waits for a domain owner instead of merging on its own.
      </p>
      <ul className="space-y-4">
        {rules.map((r) => (
          <li key={r.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 grow basis-80">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{r.name}</h2>
                    <Badge tone={r.enabled ? "green" : "neutral"}>{r.enabled ? "on" : "off"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{r.description}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    pattern <code className="font-mono">{r.pattern}</code> · job <code className="font-mono">{r.id}</code> · scans entry files the pull request adds or changes
                  </p>
                </div>
                {isAdmin && (
                  <Form method="post" className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="rule" value={r.id} />
                    <input type="hidden" name="intent" value={r.enabled ? "disable" : "enable"} />
                    <Switch checked={r.enabled} label={`${r.name}: ${r.enabled ? "turn off" : "turn on"}`} match={{ rule: r.id }} disabled={!connected} />
                  </Form>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {connected && (
        <Card className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-stone-500">Workflow</h2>
          {workflow.state === "present" ? (
            <p className="text-sm">
              <a className="font-mono underline" href={workflow.fileUrl!} target="_blank" rel="noreferrer">{workflow.path}</a> is in the brain repository.{" "}
              <a className="underline" href={workflow.runsUrl!} target="_blank" rel="noreferrer">Runs</a>
            </p>
          ) : workflow.state === "missing" ? (
            <Empty>No workflow in the brain repository. Turning a rule on writes one.</Empty>
          ) : (
            <Empty>Could not check the brain repository.</Empty>
          )}
          <p className="mt-2 text-xs text-stone-500">
            Reading a job's result back needs the "Checks: read-only" permission on the reedright GitHub App; writing the workflow needs "Workflows: read and write".
          </p>
        </Card>
      )}
    </Page>
  );
}
