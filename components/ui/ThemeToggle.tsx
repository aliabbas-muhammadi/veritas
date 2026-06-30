"use client";

/**
 * Toggles the .dark class on <html> and persists the choice. No React state —
 * the icon swap is pure CSS (dark: variant), so there's no hydration mismatch
 * with the inline no-flash theme script in the layout.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const el = document.documentElement;
    const isDark = el.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={
        "flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:text-ink active:bg-paper-sunken " +
        className
      }
    >
      <span className="relative block h-5 w-5">
        {/* Moon — light mode */}
        <svg
          className="absolute inset-0 h-5 w-5 opacity-100 transition-opacity duration-150 dark:opacity-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        {/* Sun — dark mode */}
        <svg
          className="absolute inset-0 h-5 w-5 opacity-0 transition-opacity duration-150 dark:opacity-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
    </button>
  );
}
