// Google Drive v3, read-only, through the service account. People share files or folders with its address.
import { driveAccessToken } from "./auth.server";

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const FIELDS = "id,name,mimeType,modifiedTime,size,md5Checksum,webViewLink,shortcutDetails(targetId,targetMimeType)";
const API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: number | null;
  md5Checksum: string | null;
  webViewLink: string;
  shortcutTargetId?: string;
}

export interface WalkedFile extends DriveFile {
  /** Folder path inside the shared root, e.g. "Brand/Voice/Guidelines" (root folder name included). */
  drivePath: string;
}

export class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call(path: string, params: Record<string, string> = {}, raw = false): Promise<unknown> {
  const token = await driveAccessToken();
  const url = `${API}/${path}?${new URLSearchParams({ supportsAllDrives: "true", ...params })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) message = j.error.message;
    } catch {
      /* not json */
    }
    throw new DriveError(res.status, message);
  }
  return raw ? res.text() : res.json();
}

function toFile(f: Record<string, unknown>): DriveFile {
  const sd = f.shortcutDetails as { targetId?: string } | undefined;
  return {
    id: String(f.id),
    name: String(f.name ?? "untitled"),
    mimeType: String(f.mimeType ?? "application/octet-stream"),
    modifiedTime: String(f.modifiedTime ?? ""),
    size: f.size != null ? Number(f.size) : null,
    md5Checksum: (f.md5Checksum as string | undefined) ?? null,
    webViewLink: String(f.webViewLink ?? `https://drive.google.com/open?id=${f.id}`),
    ...(sd?.targetId ? { shortcutTargetId: sd.targetId } : {}),
  };
}

export async function getFile(id: string): Promise<DriveFile> {
  return toFile((await call(`files/${encodeURIComponent(id)}`, { fields: FIELDS })) as Record<string, unknown>);
}

async function list(q: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = (await call("files", {
      q,
      fields: `nextPageToken,files(${FIELDS})`,
      pageSize: "200",
      includeItemsFromAllDrives: "true",
      orderBy: "folder,name",
      ...(pageToken ? { pageToken } : {}),
    })) as { files?: Record<string, unknown>[]; nextPageToken?: string };
    out.push(...(page.files ?? []).map(toFile));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export const listChildren = (folderId: string) => list(`'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`);
export const listSharedWithMe = () => list("sharedWithMe and trashed=false");

/** Export a Google-native file (Docs, Sheets, Slides) as text. */
export async function exportText(id: string, mimeType: string): Promise<string> {
  return (await call(`files/${encodeURIComponent(id)}/export`, { mimeType }, true)) as string;
}

/** Download a regular (non-Google-native) file's bytes as UTF-8 text. */
export async function downloadText(id: string): Promise<string> {
  return (await call(`files/${encodeURIComponent(id)}`, { alt: "media" }, true)) as string;
}

/** Accepts a bare id or any Drive URL (file, folder, open?id=). */
export function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  const m = /\/(?:d|folders)\/([A-Za-z0-9_-]{10,})/.exec(s) ?? /[?&]id=([A-Za-z0-9_-]{10,})/.exec(s);
  return m ? m[1] : null;
}

export interface WalkResult {
  files: WalkedFile[];
  folders: number;
  truncated: boolean;
}

/** Breadth-first walk of a folder. Shortcuts to files are followed; folder shortcuts are not. */
export async function walkFolder(root: DriveFile, opts: { maxFiles: number; maxDepth: number }): Promise<WalkResult> {
  const files: WalkedFile[] = [];
  let folders = 0;
  let truncated = false;
  const queue: Array<{ folder: DriveFile; path: string; depth: number }> = [{ folder: root, path: root.name, depth: 0 }];
  const seen = new Set<string>([root.id]);
  while (queue.length) {
    const { folder, path, depth } = queue.shift()!;
    folders++;
    for (const child of await listChildren(folder.id)) {
      if (child.mimeType === FOLDER_MIME) {
        if (depth + 1 > opts.maxDepth || seen.has(child.id)) continue;
        seen.add(child.id);
        queue.push({ folder: child, path: `${path}/${child.name}`, depth: depth + 1 });
        continue;
      }
      let file = child;
      if (child.mimeType === SHORTCUT_MIME && child.shortcutTargetId) {
        try {
          const target = await getFile(child.shortcutTargetId);
          if (target.mimeType === FOLDER_MIME) continue;
          file = { ...target, name: child.name };
        } catch {
          continue;
        }
      }
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      if (files.length >= opts.maxFiles) {
        truncated = true;
        return { files, folders, truncated };
      }
      files.push({ ...file, drivePath: `${path}/${file.name}` });
    }
  }
  return { files, folders, truncated };
}
