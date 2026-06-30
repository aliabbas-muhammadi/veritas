import type { Metadata } from "next";
import { Playground } from "@/components/Playground";

export const metadata: Metadata = {
  title: "Playground — Veritas LLM Gateway",
  description:
    "Watch the two-tier semantic cache live: a paraphrase reused for free, a near-identical negation correctly blocked by the intent guard, and pre-first-token failover — with real precision, cost, and latency.",
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="eyebrow flex items-center gap-2">
        <span className="verdigris--dot inline-block h-1.5 w-1.5">
          <span className="block h-full w-full rounded-full bg-accent" />
        </span>
        Live playground
      </p>
      <h1 className="mt-4 max-w-2xl font-serif text-3xl text-ink sm:text-4xl">
        The cache, proving itself.
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-ink-muted">
        This is the real gateway, not a mockup. A paraphrase reuses a cached answer at $0; a
        near-identical question with the <em>opposite</em> answer embeds just as close, but the
        intent guard turns it into a correct miss instead of a confident wrong answer — the
        failure mode the commercial tier never measures. Flip the outage switch to see
        pre-first-token failover. Every number below is measured, live.
      </p>

      <div className="mt-9">
        <Playground />
      </div>

      <p className="mt-10 border-t border-line pt-6 text-[11px] leading-relaxed text-ink-faint">
        Public demo over cheap models (Claude Haiku + gpt-4o-mini), IP rate-limited. The cache,
        metrics, and rate limiter are per-instance and in-memory, so figures reflect this
        server&rsquo;s recent traffic. A mid-stream provider failure (after the first token) is
        surfaced as a partial answer plus an error, never a faked seamless retry — once headers
        commit, clean failover is impossible, and the demo doesn&rsquo;t pretend otherwise.
      </p>
    </div>
  );
}
