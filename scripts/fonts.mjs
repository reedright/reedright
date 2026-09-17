// Fetches the fonts the site self-hosts but does not keep in git, and puts them under public/fonts.
//
// Zodiak (the landing page's heading face) comes from Fontshare under the ITF Free Font License, which allows
// self-hosting on your own site but not redistribution through a public repository. So the file is fetched from
// Fontshare when the site is built, not committed. The step is idempotent, and it never fails a build: without the
// file, the headings use the metric-matched Georgia fallback declared in app/app.css.
//
// Usage: pnpm fonts (also runs at the start of pnpm dev and pnpm build).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FONTS = [
  {
    url: "https://api.fontshare.com/v2/fonts/download/zodiak",
    entry: "Zodiak_Complete/Fonts/WEB/fonts/Zodiak-Variable.woff2",
    to: "public/fonts/Zodiak-Variable.woff2",
  },
];

/** Reads one file out of a zip archive held in memory. Enough of the format for a Fontshare download; no zip64. */
function unzipEntry(zip, name) {
  // The end-of-central-directory record is in the last 64 KiB; it ends with a comment of variable length.
  const min = Math.max(0, zip.length - 65_557);
  let eocd = -1;
  for (let i = zip.length - 22; i >= min; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = zip.readUInt16LE(p + 10);
    const compressed = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entryName = zip.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;
    if (entryName !== name) continue;
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error("bad local header");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + compressed);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    throw new Error(`unsupported compression method ${method}`);
  }
  throw new Error(`${name} is not in the archive`);
}

for (const font of FONTS) {
  const target = resolve(ROOT, font.to);
  if (existsSync(target)) {
    console.log(`fonts: ${font.to} is present`);
    continue;
  }
  try {
    const res = await fetch(font.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = unzipEntry(Buffer.from(await res.arrayBuffer()), font.entry);
    if (data.toString("latin1", 0, 4) !== "wOF2") throw new Error("the extracted file is not a WOFF2 font");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    console.log(`fonts: fetched ${font.to} (${data.length} bytes) from ${font.url}`);
  } catch (e) {
    console.warn(`fonts: could not fetch ${font.to} (${e.message}). The site builds anyway; its headings will use the fallback face.`);
  }
}
