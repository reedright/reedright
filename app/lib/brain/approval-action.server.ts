// The approve/reject form handler shared by the approvals queue and the request review page.
import { data } from "react-router";
import { ApproveError, approve, reject } from "./approve.server";
import { requireMember } from "../session.server";
import { str } from "../validate";

export type ApprovalActionData = { ok?: string; error?: string; lint?: string[] };

export async function handleApprovalAction(request: Request, slug: string) {
  const { org, user, membership } = await requireMember(request, slug);
  const form = await request.formData();
  const intent = str(form, "intent");
  const requestId = str(form, "requestId");
  const note = str(form, "note");
  try {
    if (intent === "approve") {
      const r = await approve({ org, approver: { user, membership }, requestId, note });
      return data<ApprovalActionData>({ ok: `Approved and merged. Approval record: ${r.approvalRef}` });
    }
    if (intent === "reject") {
      await reject({ org, approver: { user, membership }, requestId, note });
      return data<ApprovalActionData>({ ok: "Rejected. The pull request was closed with a comment." });
    }
  } catch (e) {
    if (e instanceof ApproveError) return data<ApprovalActionData>({ error: e.message, lint: e.report ? e.report.errors.map((x) => `${x.rule}: ${x.message}`) : [] }, { status: 400 });
    return data<ApprovalActionData>({ error: (e as Error).message, lint: [] }, { status: 500 });
  }
  return data<ApprovalActionData>({ error: "Unknown action.", lint: [] }, { status: 400 });
}
