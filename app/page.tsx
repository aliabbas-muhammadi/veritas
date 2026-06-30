import Link from "next/link";
import { Assay } from "@/components/Assay";
import { Reveal } from "@/components/ui/Reveal";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { DiagramFrame, Node, Pipeline, FlowArrow } from "@/components/diagrams/parts";

const METRICS = [
  { value: "1.00", label: "cache precision (guarded)" },
  { value: "0%", label: "false-positive rate" },
  { value: "0.97", label: "recall at 0% FP" },
  { value: "3.0×", label: "judge vs. threshold" },
];

const PRINCIPLES = [
  {
    title: "Measured, not asserted",
    body: "An adversarial golden set of 75 pairs — paraphrases that should hit, negations and scope-flips that must not. The harness reports precision, recall, and a false-positive rate, and the CI gate fails the build if the cache would serve a wrong answer.",
  },
  {
    title: "A two-tier guard",
    body: "A keyless deterministic check catches polarity, scope, and number flips for free; a Haiku judge catches the semantic inversions cosine can't see. Together they hold precision at 1.00 across the whole threshold curve.",
  },
  {
    title: "Honest failure",
    body: "Provider failover commits on the first token — a failure before it is rescued by the chain; after it, the partial answer plus an error is surfaced, never a faked seamless retry. The wall is documented, not hidden.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="blueprint blueprint--alive pointer-events-none absolute inset-0 opacity-70"
        />
        <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-16 sm:px-8 sm:pb-16 sm:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
            <div>
              <Reveal>
                <p className="eyebrow flex items-center gap-2">
                  <span className="verdigris--dot inline-block h-1.5 w-1.5">
                    <span className="block h-full w-full rounded-full bg-accent" />
                  </span>
                  LLM gateway · proven cache
                </p>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-6 max-w-2xl text-display font-serif text-ink">
                  A semantic cache you can prove is correct.
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
                  The whole industry reports a cache <em>hit rate</em>. Almost nobody
                  reports cache-hit <em>precision</em> — so a &ldquo;90% hit
                  rate&rdquo; can quietly include wrong answers. Veritas measures the
                  metric they omit, and gates CI on it.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Link
                    href="/playground"
                    className="group inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong"
                  >
                    Open the live playground
                    <span aria-hidden className="arrow-nudge">
                      →
                    </span>
                  </Link>
                  <a
                    href="https://github.com/aliabbas-muhammadi/veritas"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
                  >
                    Source &amp; eval
                    <span aria-hidden>↗</span>
                  </a>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <Assay />
            </Reveal>
          </div>
        </div>

        <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal delay={0.25}>
            <dl className="grid grid-cols-2 divide-line border-y border-line sm:grid-cols-4 sm:divide-x">
              {METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className={"px-1 py-5 sm:px-6" + (i < 2 ? " border-b border-line sm:border-b-0" : "")}
                >
                  <dt className="font-serif text-2xl text-ink sm:text-3xl">{m.value}</dt>
                  <dd className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-faint">
                    {m.label}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Principles + architecture */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <RevealOnScroll>
          <p className="eyebrow">Why this matters</p>
          <h2 className="mt-2 max-w-3xl font-serif text-2xl text-ink sm:text-3xl">
            A fast wrong answer is worse than a slow right one.
          </h2>
          <p className="mt-3 max-w-2xl text-ink-muted">
            A semantic cache turns a paraphrase into a free, instant answer — but two
            questions can embed close yet need opposite answers. The only honest way to
            ship one is to measure how often it serves the wrong thing, and refuse to if
            it&apos;s too often.
          </p>
        </RevealOnScroll>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-12">
          <div className="space-y-7">
            {PRINCIPLES.map((p, i) => (
              <RevealOnScroll key={p.title}>
                <div className="border-l-2 border-accent/30 pl-5">
                  <h3 className="flex items-baseline gap-2 font-serif text-xl text-ink">
                    <span className="font-mono text-[0.7rem] text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {p.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{p.body}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          <RevealOnScroll>
            <DiagramFrame
              label="LLM Gateway — request lifecycle"
              caption="A scoped key gates every cache decision; Tier-1 exact and Tier-2 semantic (behind the two-tier intent guard) serve a hit at $0, or a miss streams from the provider chain with pre-first-token failover."
            >
              <div className="space-y-4">
                <Node title="Request" sub="scoped key · system · query · model · params" />
                <FlowArrow />
                <div className="rounded-xl border border-line bg-paper-raised p-4">
                  <p className="eyebrow mb-3">Two-tier cache + guard</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Node title="Tier-1 exact" sub="scoped hash · free · 100% precise" />
                    <Node title="Tier-2 semantic" sub="embedding cosine ≥ τ" accent />
                  </div>
                  <div className="mt-3">
                    <FlowArrow />
                    <Node title="Intent guard" sub="deterministic flips → Haiku judge" accent />
                  </div>
                </div>
                <FlowArrow />
                <Pipeline
                  stages={[
                    { title: "Cache hit → replay", sub: "$0 · ~0 ms" },
                    { title: "or Miss → provider chain", sub: "anthropic → openai → mock", accent: true },
                  ]}
                />
              </div>
            </DiagramFrame>
          </RevealOnScroll>
        </div>

        <RevealOnScroll>
          <div className="mt-16 flex flex-col items-start gap-4 rounded-2xl border border-line bg-paper-sunken/40 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h2 className="font-serif text-2xl text-ink">See it prove itself.</h2>
              <p className="mt-2 max-w-xl text-ink-muted">
                A guided tour over the real gateway: a paraphrase reused at $0, a
                negation correctly blocked, an outage rescued by failover — with a live
                metrics strip.
              </p>
            </div>
            <Link
              href="/playground"
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong"
            >
              Open the playground
              <span aria-hidden className="arrow-nudge">
                →
              </span>
            </Link>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
