/**
 * A switch that forces the primary provider "down" for the next request, to
 * demonstrate pre-first-token failover. Honest by construction: it sets
 * `forceOutage`, which makes `establishStream` skip the primary and commit to the
 * backup — the same code path a real outage takes.
 */
export function OutageToggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="group inline-flex items-center gap-2 text-xs text-zinc-600 disabled:opacity-50 dark:text-zinc-400"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="select-none">
        Simulate primary outage{" "}
        <span className="font-mono text-[11px] text-zinc-400">
          {on ? "(on)" : "(off)"}
        </span>
      </span>
    </button>
  );
}
