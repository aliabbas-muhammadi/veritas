/** Pure vector math for the semantic cache tier. No I/O, no keys — so it runs
 * identically in the live gateway and in the keyless eval harness. */

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export type Scored<T> = { item: T; score: number };

/** Top-K candidates by cosine to `query`, highest first. */
export function topK<T>(
  query: number[],
  candidates: { item: T; vector: number[] }[],
  k: number,
): Scored<T>[] {
  return candidates
    .map((c) => ({ item: c.item, score: cosine(query, c.vector) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
