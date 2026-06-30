/**
 * Slim footer — ties the product back to the author's broader work (cohesion
 * with alimuhammadi.com) and the source. Static server component.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>An LLM gateway whose semantic cache is proven correct.</p>
        <div className="flex items-center gap-5 font-mono text-[0.68rem] uppercase tracking-[0.1em]">
          <a
            href="https://alimuhammadi.com"
            target="_blank"
            rel="noreferrer"
            className="text-ink-faint transition-colors hover:text-accent"
          >
            alimuhammadi.com ↗
          </a>
          <a
            href="https://github.com/aliabbas-muhammadi/veritas"
            target="_blank"
            rel="noreferrer"
            className="text-ink-faint transition-colors hover:text-accent"
          >
            Source ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
