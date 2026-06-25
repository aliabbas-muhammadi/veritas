export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
        Veritas · LLM gateway
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        A semantic cache you can prove is correct.
      </h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        A provider-agnostic LLM gateway whose two-tier cache is measured the way
        the commercial tier never is: not just a hit rate, but the{" "}
        <em>precision</em> and <em>false-positive rate</em> of those hits — so a
        paraphrase reuses an answer, but a near-identical question with the
        opposite answer does not.
      </p>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
        Most semantic caches report only how often they hit. GPTCache, for one,
        publishes hit-ratio and recall but no precision — so a high hit rate can
        quietly include wrong answers. Veritas scores the metric they omit and
        gates CI on it.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <li>· Two-tier cache: exact (scoped hash) + semantic (embedding cosine)</li>
        <li>· An eval harness scores cache-hit precision, recall, and false-positive rate</li>
        <li>· Adversarial golden set: paraphrases should hit; negations must not</li>
        <li>· Provider-agnostic over Anthropic + OpenAI, with a deterministic offline path</li>
      </ul>
      <div className="mt-8 flex items-center gap-3">
        <span className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Interactive playground — coming soon
        </span>
      </div>
      <p className="mt-6 text-xs text-zinc-400">
        Runs fully offline with no API key (deterministic mock provider + committed
        eval embeddings). Add an <code>ANTHROPIC_API_KEY</code> or{" "}
        <code>OPENAI_API_KEY</code> to route to a live model.
      </p>
    </main>
  );
}
