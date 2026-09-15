// Near-duplicate detection (RFC §5). Word 3-gram Jaccard: cheap, dependency-free, good enough for short entries.

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function shingles(text: string, k = 3): Set<string> {
  const words = normalize(text);
  const out = new Set<string>();
  if (words.length < k) {
    if (words.length) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface Similar {
  path: string;
  score: number;
}

export function mostSimilar(body: string, others: Array<{ path: string; body: string }>): Similar | null {
  const mine = shingles(body);
  let best: Similar | null = null;
  for (const o of others) {
    const score = jaccard(mine, shingles(o.body));
    if (!best || score > best.score) best = { path: o.path, score };
  }
  return best;
}
