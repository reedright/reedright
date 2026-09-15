// Regenerate MANIFEST.md on the default branch after a merge (the CI-equivalent step from RFC §5).
import { entriesFromFiles, renderManifest } from "./manifest";
import { MANIFEST_PATH, parseEntryPath } from "./paths";
import type { BrainRepo } from "../github/repo.server";

export async function regenerateManifest(repo: BrainRepo): Promise<string> {
  const paths = (await repo.listPaths()).filter((p) => parseEntryPath(p));
  const files = (await repo.readMany(paths)).filter((f): f is { path: string; raw: string } => typeof f.raw === "string");
  const { entries, skipped } = entriesFromFiles(files);
  const content = renderManifest(entries, new Date().toISOString(), skipped);
  const existing = await repo.readFile(MANIFEST_PATH);
  if (existing?.content === content) return content;
  await repo.commit({ branch: repo.defaultBranch, message: "manifest: regenerate", writes: [{ path: MANIFEST_PATH, content }] });
  return content;
}
