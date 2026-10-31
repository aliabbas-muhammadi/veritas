# CI efficiency

Read this before changing workflows, test parallelism, dependency caching, linting,
or type checking. Repository architecture and release rules still apply.

## Measure before changing tools

Use GitHub Actions runs and job/step timestamps, not headline speedups from another
project. Record the commit, event, runner, sample size, success/failure/cancellation,
dependency cache outcome, and whether a sample is cold or warm. Inventory up to 150
recent runs; fetch detailed jobs from a stated representative subset. Old projects
may have only a few runs. Keep failed and cancelled runs separate from successful
latency. Report job created-to-start delay separately from execution; workflow
created-to-job-start also includes dependency waits and is not pure runner queue.

Compare median/p95 successful PR wall time AND total runner minutes. Matrices can
shorten the critical path while increasing setup, rounded billable minutes, cache
storage and artifact costs. Never present runner seconds as an invoice or project
a percentage saving from a single run. Public hosted-runner pricing can differ
from private repos; verify actual billing and entitlements before changing vendors.

## Default order

1. Cancel superseded **PR verification** runs. Keep event/workflow/ref in the group
   so unrelated work cannot cancel it. Preserve every exact-main run required by a
   release gate. Never apply verification cancellation to deployment, migration,
   data-production, signing, or device-operation lanes.
2. Remove redundant installs and duplicate execution only after proving coverage
   and environment equivalence. Reuse the existing package manager and frozen
   lockfile. Keep secrets scans, supported runtime matrices, native qualification,
   accessibility, evals and contract checks.
3. Cache package-manager downloads with the actual lockfile path. Ensure a trusted
   default/base-branch verification run uses the same key and can seed the cache.
   PR merge-ref caches cannot seed sibling PRs. `setup-node` does not cache
   `node_modules`; restoring that directory before `npm ci` is wasted work because
   `npm ci` removes it. Native modules also depend on OS, architecture and runtime.
   Never cache secrets, production data, signing files or credential-bearing builds.
4. Separate measured long, independent workloads where latency justifies repeated
   setup. Each browser/database partition needs its own process, ports, fixtures
   and artifact name. Keep repetition counts, deadlines and test selection intact.
   Preserve existing required check names with an `always()` aggregate that fails
   unless every dependency succeeded. Test failure, cancellation and skipped cases.
5. Tune workers to actual available CPU/memory, not laptop core count. Benchmark
   cold and warm repetitions. Retain isolation by default: shared workers can leak
   mocks, modules, timers, DOM, environment and fixtures across test files.
6. Use affected-only selection only with dependency coverage, unknown-path fallback,
   changes to workflow/config/lockfiles covered, and negative tests proving a hidden
   relevant change fails. A skipped required workflow can remain pending; a green
   empty shard is not verification. Do not silently move required evidence to a
   nightly run or add recurring spend merely for an optimization experiment.

## Conditional experiments

- **Oxlint:** inventory the effective ESLint rules, custom rules, Next.js, React
  Compiler, accessibility and type-aware plugins. Run both against clean and
  intentionally bad fixtures before replacing an authoritative check. A mixed
  setup may be appropriate; adding a second linter without reducing work is not a
  saving. Do not enable every rule without a project reason.
- **Bun / native TypeScript:** pin versions; compare project file coverage and
  diagnostics, including intentional errors, references, JS, ambient declarations
  and framework plugins. `bun check` follows TypeScript 7 semantics regardless of
  the installed TypeScript version and does not emit declarations. Keep the
  accepted checker until compatibility and repeated gains are demonstrated.
- **`isolate: false`:** require cleanup proof and order/repetition tests before
  adoption. A single green run is insufficient. Prefer module/import improvements
  when they preserve isolation.
- **Larger / external runners:** benchmark queue and execution separately and
  compare real price, supported architecture, secrets/trust and maintenance.
  Adding a paid service or changing billing requires owner approval.
- **Checkout:** shallow is fine when history is unused. Use full history where
  scanners, merge-base or release checks require it. `filter: blob:none` is a
  candidate for history consumers, not a universal replacement: history scanners
  may fetch all blobs anyway.
- **Playwright:** benchmark a version-matched image or browser downloads before
  adding caches; OS packages are not cached by browser binaries. Preserve headed
  WebKit/Xvfb requirements. Playwright does not generally recommend browser caching.
- **Pre-push checks:** reuse repository commands and offer a tracked, opt-in hook
  that does no network/install/data work. Do not silently replace existing hooks.
  Typecheck the project; passing individual changed files to `tsc` can bypass the
  intended project configuration. Hooks supplement required CI and are bypassable.

## Verification and reporting

Read the complete workflow diff and validate YAML/action expressions. For a split,
compare the old/new executable step and environment inventory and test the final
aggregate with unsuccessful and missing results. Publish changes as draft PRs.
Distinguish static/local checks, remote CI, synthetic tests and real-device or
production evidence. A workflow PR passing does not prove its main-only path.
Before merge, obtain successful changed-head CI and representative before/after
timings. Until then, label gains estimates. Roll back a regression by reverting
the focused workflow commit; do not weaken checks to obtain green.

## Primary references (checked 2026-10-31)

- [GitHub cache scope and matching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [setup-node cache behavior](https://github.com/actions/setup-node#caching-global-packages-data)
- [Vitest performance and isolation](https://vitest.dev/guide/improving-performance)
- [Oxlint migration](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html)
- [Bun type checking and compatibility](https://bun.sh/docs/runtime/check)
- [Checkout options](https://github.com/actions/checkout#usage)
- [Playwright CI](https://playwright.dev/docs/ci)
