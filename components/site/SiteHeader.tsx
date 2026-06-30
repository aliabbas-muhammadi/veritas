import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/**
 * Slim sticky header — the wordmark with the verdigris brand dot, demo + source
 * links, and the theme toggle. Server component; only the toggle is a client
 * island. The translucent paper + backdrop-blur sits above the ambient layer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group inline-flex items-baseline gap-2">
          <span className="verdigris--dot inline-block h-1.5 w-1.5 self-center">
            <span className="block h-full w-full rounded-full bg-accent" />
          </span>
          <span className="font-serif text-lg leading-none text-ink">Veritas</span>
          <span className="hidden font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-faint sm:inline">
            LLM gateway
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/playground"
            className="rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:px-3"
          >
            Playground
          </Link>
          <a
            href="https://github.com/aliabbas-muhammadi/veritas"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-md px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            Source
          </a>
          <a
            href="https://alimuhammadi.com"
            className="ml-0.5 inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:px-3"
            title="Back to Ali Muhammadi's portfolio"
          >
            <span aria-hidden>←</span> Portfolio
          </a>
          <ThemeToggle className="ml-1" />
        </nav>
      </div>
    </header>
  );
}
