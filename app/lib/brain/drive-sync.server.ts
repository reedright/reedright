// Drive ingestion orchestration: walk the shared file or folder, render refs, open one PR listing every document.
import { randomBytes } from "node:crypto";
import type { Membership, Org, User } from "../../../generated/prisma/client";
import { prisma, now } from "../db.server";
import { env } from "../env.server";
import { BrainRepo, REEDRIGHT_LABELS } from "../github/repo.server";
import { FOLDER_MIME, downloadText, exportText, getFile, walkFolder, type WalkedFile } from "../google/drive.server";
import { MAX_DEPTH, MAX_FILES_PER_RUN, RENDER_VERSION, exportMimeFor, modeFor, prBody, prTitle, refPathFor, renderRef, statsOf, type SyncEntry, type SyncStats } from "./drive-sync";
import { splitFrontmatter } from "./frontmatter";
import { lint } from "./lint";
import { parseOwners, resolveApprovers } from "./owners";
import { OWNERS_PATH, archivePath } from "./paths";
import { todayUTC } from "./schema";

const DRIVE_LABEL = { name: "drive-sync", color: "5319e7", description: "Google Drive ingestion" };

export interface RunResult {
  changed: boolean;
  rootName: string;
  requestId?: string;
  prUrl?: string;
  stats: SyncStats;
  entries: SyncEntry[];
  truncated: boolean;
  message: string;
}

export async function runDriveSync(input: { org: Org; user: User; membership: Membership; syncId: string }): Promise<RunResult> {
  const { org } = input;
  const sync = await prisma().driveSync.findUnique({ where: { id: input.syncId }, include: { items: true } });
  if (!sync || sync.orgId !== org.id) throw new Error("No such Drive sync in this organization.");
  if (sync.status === "running") throw new Error("This sync is already running.");
  await prisma().driveSync.update({ where: { id: sync.id }, data: { status: "running", lastError: null } });
  try {
    const result = await run(sync, input);
    await prisma().driveSync.update({
      where: { id: sync.id },
      data: { status: "idle", lastRunAt: now(), name: result.rootName, lastRequestId: result.requestId ?? sync.lastRequestId },
    });
    return result;
  } catch (e) {
    await prisma().driveSync.update({ where: { id: sync.id }, data: { status: "error", lastRunAt: now(), lastError: (e as Error).message } });
    throw e;
  }
}

type SyncWithItems = NonNullable<Awaited<ReturnType<typeof loadSync>>>;
const loadSync = (id: string) => prisma().driveSync.findUnique({ where: { id }, include: { items: true } });

async function run(sync: SyncWithItems, input: { org: Org; user: User; membership: Membership }): Promise<RunResult> {
  const { org, user, membership } = input;
  const handle = membership.handle;
  const repo = await BrainRepo.forOrg(org);
  const ownersFile = await repo.readFile(OWNERS_PATH);
  if (!ownersFile) throw new Error("OWNERS.yaml is missing; scaffold the repository first.");
  const owners = parseOwners(ownersFile.content);
  if (!owners.domains[sync.domain]) throw new Error(`Domain "${sync.domain}" is not in OWNERS.yaml.`);

  const root = await getFile(sync.driveId);
  let files: WalkedFile[];
  let truncated = false;
  if (root.mimeType === FOLDER_MIME) {
    const walked = await walkFolder(root, { maxFiles: MAX_FILES_PER_RUN, maxDepth: MAX_DEPTH });
    files = walked.files;
    truncated = walked.truncated;
  } else {
    files = [{ ...root, drivePath: root.name }];
  }

  const today = todayUTC();
  const syncedAt = now();
  const runId = `drive-sync-${sync.id.slice(-6)}-${syncedAt}`;
  const itemsById = new Map(sync.items.map((i) => [i.fileId, i]));
  // A previous run whose PR is still open gets superseded by this one, so nothing it proposed may count as unchanged.
  const requestIds = [...new Set(sync.items.map((i) => i.requestId).filter((x): x is string => Boolean(x)))];
  const openRequests = requestIds.length ? await prisma().writeRequest.findMany({ where: { id: { in: requestIds }, orgId: org.id, kind: "sync", status: "open" } }) : [];
  const pending = new Set(openRequests.map((r) => r.id));
  const existingPaths = new Set(await repo.listPaths());
  const entries: SyncEntry[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const deletes: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    seen.add(file.id);
    const item = itemsById.get(file.id);
    const path = item?.path ?? refPathFor(sync.domain, file);
    const mode = modeFor(file.mimeType, file.size);
    const base = { fileId: file.id, name: file.name, drivePath: file.drivePath, webViewLink: file.webViewLink, path, mode };
    const unchanged =
      item && !item.archivedAt && item.renderVersion === RENDER_VERSION && !(item.requestId && pending.has(item.requestId)) &&
      item.modifiedTime === file.modifiedTime && (file.md5Checksum == null || item.checksum === file.md5Checksum) && existingPaths.has(path);
    if (unchanged) {
      entries.push({ ...base, action: "unchanged" });
      continue;
    }
    let content: string | null = null;
    let note: string | undefined;
    try {
      const exportMime = exportMimeFor(mode);
      if (exportMime) content = await exportText(file.id, exportMime);
      else if (mode === "download-text") content = await downloadText(file.id);
      else note = "binary or unsupported type";
    } catch (e) {
      content = null;
      note = `could not fetch content (${(e as Error).message})`;
    }
    let created = today;
    if (existingPaths.has(path)) {
      const prev = await repo.readFile(path);
      const d = prev ? splitFrontmatter(prev.content).data?.created : null;
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) created = d;
    }
    const raw = renderRef({ file, domain: sync.domain, handle, run: runId, mode, content, contentNote: note, created, syncedAt });
    const report = lint({ path, raw, owners, mode: "proposal", today });
    if (!report.ok) {
      entries.push({ ...base, action: "skipped", note: report.errors.map((e) => e.message).join("; ") });
      continue;
    }
    writes.push({ path, content: raw });
    entries.push({ ...base, action: existingPaths.has(path) ? "updated" : "added", note });
  }

  for (const item of sync.items) {
    // An archive proposed by a superseded (still open) PR never reached main, so it is proposed again here.
    const archivedOnMain = item.archivedAt && !(item.requestId && pending.has(item.requestId));
    if (seen.has(item.fileId) || archivedOnMain || !existingPaths.has(item.path)) continue;
    const prev = await repo.readFile(item.path);
    if (!prev) continue;
    writes.push({ path: archivePath(item.path), content: prev.content });
    deletes.push(item.path);
    entries.push({ fileId: item.fileId, name: item.path.split("/").pop() ?? item.path, drivePath: "(no longer in Drive)", webViewLink: "", path: item.path, action: "archived", mode: "pointer" });
  }

  const stats = statsOf(entries);
  if (!writes.length && !deletes.length) {
    return { changed: false, rootName: root.name, stats, entries, truncated, message: `Everything is up to date (${stats.unchanged} unchanged${stats.skipped ? `, ${stats.skipped} skipped` : ""}).` };
  }

  const baseSha = await repo.headSha();
  if (!baseSha) throw new Error("The brain repository is empty; scaffold it first.");
  const branch = `reedright/${handle}/drive-${randomBytes(4).toString("hex")}`;
  await repo.createBranch(branch, baseSha);
  await repo.commit({ branch, message: `ref(${sync.domain}): drive sync ${root.name}\n\nAuthor: ${handle} (reedright)\nRun: ${runId}`, writes, deletes });
  const approvers = resolveApprovers(owners, { domain: sync.domain, path: `refs/${sync.domain}/` });
  const requestId = `wr_${randomBytes(8).toString("hex")}`;
  await repo.ensureLabels([...REEDRIGHT_LABELS, DRIVE_LABEL]);
  const pr = await repo.openPR({
    title: prTitle(root, sync.domain, stats),
    body: prBody({ root, handle, run: runId, domain: sync.domain, entries, truncated, approvers, orgSlug: org.slug, appUrl: env.APP_URL, requestId }),
    head: branch,
  });
  await repo.addLabels(pr.number, ["reedright", "type:ref", "drive-sync"]);

  const superseded: number[] = [];
  for (const old of openRequests) {
    try {
      await repo.comment(old.prNumber, `Superseded by ${pr.htmlUrl} (a newer run of this Drive sync). Closed by reedright.`);
      await repo.closePR(old.prNumber);
      await repo.deleteBranch(old.branch);
      await prisma().writeRequest.update({ where: { id: old.id }, data: { status: "closed", updatedAt: now() } });
      superseded.push(old.prNumber);
    } catch (e) {
      console.warn(`[reedright] could not close superseded sync PR #${old.prNumber}: ${(e as Error).message}`);
    }
  }

  const refPaths = writes.map((w) => w.path).filter((p) => !p.startsWith("archive/"));
  const ts = now();
  await prisma().writeRequest.create({
    data: {
      id: requestId, orgId: org.id, userId: user.id, handle, run: runId, type: "ref", domain: sync.domain, title: `Drive sync: ${root.name}`,
      path: refPaths[0] ?? `refs/${sync.domain}/`, branch, prNumber: pr.number, prUrl: pr.htmlUrl, status: "open",
      lintReport: JSON.stringify({ errors: [], warnings: [] }), kind: "sync", paths: JSON.stringify(refPaths), summary: JSON.stringify(stats),
      createdAt: ts, updatedAt: ts,
    },
  });
  for (const e of entries) {
    const key = { syncId_fileId: { syncId: sync.id, fileId: e.fileId } };
    if (e.action === "added" || e.action === "updated") {
      const f = files.find((x) => x.id === e.fileId)!;
      const data = { path: e.path, modifiedTime: f.modifiedTime, checksum: f.md5Checksum, requestId, renderVersion: RENDER_VERSION, archivedAt: null, updatedAt: ts };
      await prisma().driveSyncItem.upsert({ where: key, create: { syncId: sync.id, fileId: e.fileId, ...data }, update: data });
    } else if (e.action === "archived") {
      await prisma().driveSyncItem.update({ where: key, data: { archivedAt: ts, requestId, updatedAt: ts } });
    }
  }
  return {
    changed: true, rootName: root.name, requestId, prUrl: pr.htmlUrl, stats, entries, truncated,
    message: `Opened ${pr.htmlUrl}: ${stats.added} added, ${stats.updated} updated, ${stats.archived} archived${stats.skipped ? `, ${stats.skipped} skipped` : ""}.${superseded.length ? ` Closed the earlier open sync PR ${superseded.map((n) => `#${n}`).join(", ")} as superseded.` : ""} It needs approval from an owner of ${sync.domain}: ${approvers.join(", ") || "nobody listed in OWNERS.yaml"}.`,
  };
}
