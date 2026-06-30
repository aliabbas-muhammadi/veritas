import { cn } from "@/lib/cn";

/** A single labelled box in an architecture diagram. */
export function Node({
  title,
  sub,
  accent = false,
  className,
}: {
  title: string;
  sub?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-center rounded-lg border px-4 py-3.5 text-center shadow-sm",
        accent
          ? "border-accent bg-accent-soft"
          : "border-line-strong bg-paper-raised",
        className,
      )}
    >
      <div
        className={cn(
          "text-[0.95rem] font-semibold leading-snug",
          accent ? "text-accent-strong" : "text-ink",
        )}
      >
        {title}
      </div>
      {sub && (
        <div
          className={cn(
            "mt-1 font-mono text-[0.66rem] uppercase leading-tight tracking-[0.04em]",
            accent ? "text-accent" : "text-ink-muted",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Connector that points right on wide screens, down when stacked. */
export function FlowArrow() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center text-base font-semibold text-accent"
    >
      <span className="hidden sm:block">→</span>
      <span className="sm:hidden">↓</span>
    </div>
  );
}

type Stage = { title: string; sub?: string; accent?: boolean };

/** A horizontal (responsive) pipeline of nodes with arrows between. */
export function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {stages.map((s, i) => (
        <div
          key={s.title}
          className="flex flex-col items-stretch gap-2 sm:flex-1 sm:flex-row sm:items-center"
        >
          <Node title={s.title} sub={s.sub} accent={s.accent} />
          {i < stages.length - 1 && <FlowArrow />}
        </div>
      ))}
    </div>
  );
}

/** Wraps a diagram in an accessible figure with a caption. */
export function DiagramFrame({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line-strong bg-paper-raised">
      <div className="flex items-center justify-between border-b border-line-strong bg-paper-sunken/60 px-5 py-3">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-faint">
          Architecture
        </span>
      </div>
      <div className="p-5 sm:p-8">{children}</div>
      {caption && (
        <figcaption className="border-t border-line px-5 py-3.5 text-sm leading-relaxed text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
