/**
 * A learned alternative to a fixed similarity threshold — the vCache question:
 * can a judge-free, *learned* decision match the LLM judge's precision, and save
 * its latency/cost?
 *
 * vCache (arXiv:2502.03771) shows a single global cosine threshold can't separate
 * correct from incorrect cache hits — the similarity distributions overlap (on
 * this corpus negations even score HIGHER than paraphrases). Its fix is online
 * per-embedding learned boundaries; with only pairwise labels here we instead fit
 * a tiny logistic regression on cheap features and grade it LEAVE-ONE-OUT (each
 * row predicted by a model trained on the other rows, never on itself). Two
 * feature sets answer the question:
 *   - similarity only        → the decision is monotonic in similarity, so it
 *     degenerates to a fixed threshold and can't beat the sweep — confirming no
 *     similarity threshold is safe here.
 *   - similarity + the deterministic polarity/scope flip → recovers most of the
 *     guard's precision cheaply, but not all; the residual false positives are
 *     semantic flips no cheap feature sees — which is exactly the judge's job.
 *
 * Pure TypeScript, no deps — runs in the keyless eval over committed embeddings.
 */

export type Logistic = { w: number[]; b: number; mean: number[]; std: number[] };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Standardized batch-gradient-descent logistic regression. */
export function fitLogistic(X: number[][], y: number[], iters = 1200, lr = 0.5): Logistic {
  const n = X.length;
  const d = X[0]!.length;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j]!;
  for (let j = 0; j < d; j++) mean[j] /= n;
  for (const x of X) for (let j = 0; j < d; j++) std[j] += (x[j]! - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) || 1;

  const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]));
  const w = new Array(d).fill(0);
  let b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += Z[i]![j]! * w[j]!;
      const e = sigmoid(z) - y[i]!;
      for (let j = 0; j < d; j++) gw[j] += e * Z[i]![j]!;
      gb += e;
    }
    for (let j = 0; j < d; j++) w[j] -= (lr * gw[j]) / n;
    b -= (lr * gb) / n;
  }
  return { w, b, mean, std };
}

export function predict(m: Logistic, x: number[]): number {
  let z = m.b;
  for (let j = 0; j < x.length; j++) z += ((x[j]! - m.mean[j]!) / m.std[j]!) * m.w[j]!;
  return sigmoid(z);
}

/** Leave-one-out probabilities: row i predicted by a model trained on all but i. */
export function looProbs(X: number[][], y: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < X.length; i++) {
    const Xt = X.filter((_, k) => k !== i);
    const yt = y.filter((_, k) => k !== i);
    out.push(predict(fitLogistic(Xt, yt), X[i]!));
  }
  return out;
}
