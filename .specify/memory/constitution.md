# docelembranca Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)
Every feature and bug fix MUST follow strict red-green-refactor TDD: a failing test that
captures the desired behavior MUST exist before any implementation code is written, then the
minimum code to pass it, then refactoring with tests green throughout. This applies to UI
components (via component-level tests, e.g. React Testing Library) and to data/logic code
alike — no layer is exempt for being "just UI" or "just a script." A task is not done if its
test was written after, or alongside without first failing against, the implementation.
This principle extends to full user-facing flows: every feature that adds or changes one MUST
also carry Playwright end-to-end regression coverage under `tests/e2e/`, authenticated via the
local `dev-preview.html` entry point (see README.md) since the real Google OAuth flow cannot be
driven by automation — a feature is not done with only unit/component tests if it exposes a
user-facing flow. Unlike unit and component tests, an e2e spec is **regression** coverage for a
flow that already works: it is written against that story's completed implementation and
confirmed **passing**, not red-green failing-first. The failing-first rule above is what drives
the implementation; the e2e spec is what locks the finished flow against later drift, so
requiring it to fail first would only mean asserting against a flow nobody has built yet.
Rationale: with a single developer and no code review from a second person, an
automated, test-first record of intended behavior is the only reliable defense against
regressions introduced weeks or months apart; e2e coverage closes the gap unit/component tests
leave, since those run against a stub client and never exercise the real Supabase network layer,
RLS policies, or `LoginGate` together.

### II. Serverless, Static-First Architecture
The application MUST remain a static frontend (Vite + React + TypeScript) deployed to GitHub
Pages, with Supabase (Postgres, Auth, Storage) as the only backend for persistence,
authentication, and file storage. No custom backend server, API, or additional hosted service
MAY be introduced. A requirement that appears to need server-side logic MUST first be
re-evaluated against Supabase-native tools (Row Level Security, Postgres functions/triggers,
Supabase Edge Functions) before this principle is treated as a blocker requiring amendment.
Rationale: keeps operational surface, cost, and ongoing maintenance at zero, matching a project
with one developer and one end user.

### III. Row-Level Security Is the Only Real Access Control (NON-NEGOTIABLE)
Every Postgres table and Storage bucket MUST ship with Row Level Security enabled and policies
that restrict access to the allowed user's account in the same migration that creates it —
never left default-open "temporarily." Client-side checks (such as `LoginGate`'s email
comparison) are permitted only as UX affordances, MUST be documented in code as non-security,
and MUST NOT be treated as a substitute for an RLS policy anywhere in specs, plans, or reviews.
Rationale: the frontend source is public on static hosting, so the database's own policies are
the only real enforcement boundary.

### IV. Simplicity and YAGNI
Every change MUST use the simplest design that satisfies the current spec — no speculative
abstractions, configuration layers, or generalized frameworks for features not yet specified.
A new dependency, table, or component MUST be justified by a current requirement, not an
anticipated one; prefer extending an existing table or component over introducing a new one
when a spec's requirements allow it. Rationale: for a solo maintainer, accumulated incidental
complexity is a bigger risk than any near-term duplication.

### V. Strict Type Safety
TypeScript strict mode MUST remain enabled (`tsconfig.json`'s `strict: true` MUST NOT be
weakened), and new code MUST NOT use `any` or the non-null assertion operator (`!`) without an
inline comment explaining why the type system cannot express the invariant. Supabase query
results MUST be typed via generated or explicit types rather than treated as `any`. Rationale:
without a second engineer's review, the compiler is the primary safety net against silent
mistakes.

### VI. Language Split: en_US Code, pt_BR Business/UI
All source code — identifiers, function/variable names, code comments, commit messages, and
AI-authored artifacts (specs, plans, tasks, this constitution) — MUST be written in en_US. All
business-facing code and user-facing text — UI labels, buttons, error messages, any string the
end user reads — MUST be written in pt_BR. A file or component MAY mix both only where this
split requires it (e.g. an en_US variable holding a pt_BR string constant). Rationale: the end
user and business analyst (Gisely) speaks only pt_BR; the developer (Eduardo) is bilingual and
prefers en_US for code, so splitting by audience serves both without compromise.

### VII. Human-Friendly, Maintainable Code (SOLID / Clean Code)
Code MUST favor readability and maintainability, applying SOLID and clean-code practices at a
scope appropriate to a small solo codebase: single responsibility, meaningful names, small
functions over clever ones. Conditional logic MUST avoid deep nesting — no more than two levels
of nested `if`/branching — preferring early returns and guard clauses to flatten control flow
beyond that depth. Comments MUST be short and objective; avoid comments that restate what the
code already says, and only comment where the rationale is non-obvious. Rationale: low-noise,
shallow, well-structured code reduces the cognitive load on the sole maintainer returning to it
after time away.

### VIII. Latest Stack, Deliberately Chosen
Dependencies and language features MUST track the latest stable versions available at the time
of use — the latest React, TypeScript, Vite, Supabase client, etc. — rather than staying pinned
to older APIs out of habit; upgrades MUST be adopted proactively, not deferred until forced.
Rationale: a solo personal project carries no legacy-compatibility burden, so there is no reason
to run a stale toolchain.

### IX. iOS-Native Look and Feel
The UI MUST visually and behaviorally resemble a native iOS app — typography, spacing, motion,
and controls — rather than a generic web app. Existing conventions such as `src/ios.css`
establish this baseline, and any new UI work MUST match it rather than introduce a different
visual language. Rationale: consistency with the end user's native platform feel matters more
here than generic cross-platform styling, since there is only one end user and one target
context.

### X. Deliberate Tool Selection with Consent Gate
Before adopting a tool, library, framework, or approach for a job — a test runner, a
prototyping tool, a UI kit — options MUST be researched and compared for fit rather than
defaulting to the first familiar choice. Any decision that commits the project to a new
tech-stack choice (a new dependency, framework, service, or architecture-affecting library)
MUST be presented to Eduardo for explicit consent before it is committed to code or
configuration; research and recommend, but never commit a stack decision unilaterally.
Rationale: keeps the project owner in control of the stack's direction while still benefiting
from research-driven recommendations.

### XI. Follow and Document Per-Stack Best Practices
Code MUST follow the idiomatic best practices of each language, tool, and framework in use —
React/TypeScript conventions, PostgreSQL/SQL conventions, shell-script conventions for
devcontainer/CI scripts, and so on. The adopted conventions MUST be documented in an organized,
summarized, human-friendly reference, kept up to date as practices are adopted or changed,
rather than left implicit in code alone. Rationale: idiomatic code is easier for tooling and a
returning solo maintainer to reason about, and a written reference prevents conventions from
being reinvented or forgotten between work sessions.

### XII. UI Prototyping Before Implementation
For any user story whose tasks include new or changed UI screens or components, a working
throwaway React prototype — real components and screens driven by mock/static data only, with
no tests and no Supabase wiring — MUST be built once that story's tasks exist (after
`/speckit-tasks`) and explicitly approved by Eduardo before any of that story's implementation
tasks begin in `/speckit-implement`. Prototype code lives under `prototypes/` at the repo root,
which MUST be gitignored and MUST NOT be committed to `main` or any feature branch; it exists
only long enough for Eduardo to click through it locally before it is discarded. The prototype
MUST NOT be promoted into production code or extended with tests — the real implementation is
written from scratch afterward via Principle I's full red-green-refactor TDD, even where it ends
up visually resembling the approved prototype. Rationale: too many issues surfaced only after
User Story 1 (Catalog) was fully implemented and tested, when they were already expensive to
change; a cheap, disposable prototype surfaces layout, interaction, and UX problems before the
costlier test-first implementation locks in a structure.

## Security & Secrets Requirements

`.env` holding real Supabase credentials MUST NOT be committed; only `.env.example` with
placeholder values is tracked. The Supabase anon key is safe to expose in the static build only
as long as Principle III holds; if RLS is ever disabled for local debugging, it MUST be
re-enabled before the next deploy. Google OAuth is the only supported sign-in method — no
password-based auth path may be added. Access is restricted to a single allowed email
(currently `giselypasquini@gmail.com`, enforced via Supabase RLS per Principle III); changing
that email is a configuration change, not something requiring a constitution amendment.

## Development Workflow

All feature work MUST go through the Spec Kit cycle — `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → [UI prototype + Eduardo approval per Principle XII, for each user story with
UI work] → `/speckit-implement` — in that order; ad hoc feature code without a spec is not
permitted beyond a trivial one-line fix. `npm run lint`, `npm run build`, `npm test`,
`npm run test:db`, and `npm run test:e2e` MUST all pass before a commit is considered done;
`.github/workflows/ci.yml` runs the same checks on every pull request. Deployment is automatic
on push to `main` via `.github/workflows/deploy.yml`, and there is no separate staging
environment, so `main` MUST always be deployable. Schema changes MUST be added as migration
files under `supabase/migrations/` and applied via `supabase db push`; hand-editing schema
directly in the Supabase dashboard is not permitted. All end-user-facing pt_BR text — UI labels,
buttons, confirmation dialogs, and error messages — MUST be presented to Eduardo for consent
before shipping, to support accurate translation and wording review with Gisely's usage in mind;
Principle XII's prototype approval reuses this same explicit-consent pattern before implementation
starts. The devcontainer MUST make every port the app and any local Supabase stack use reachable from
the host machine's browser at `localhost`, since the container itself has no graphical
interface; `npm run dev` (and local Supabase emulation, if used) MUST be reachable this way.
Docker port publishing (`forwardPorts`) is the default mechanism, but sharing the host's network
namespace outright (`--network=host`) is an acceptable substitute when per-port forwarding
conflicts with a tool that also binds those ports from the host side, such as an IDE's own
port forwarder. Spec Kit work MUST stay integrated with GitHub's own tooling rather than living
only in local files: tasks generated by `/speckit-tasks` MUST be pushed to GitHub Issues via
`/speckit-taskstoissues` so progress is tracked there, and non-trivial changes MUST go through a
GitHub pull request reviewed with the `/code-review` skill (or the cloud `ultrareview` flow for
larger changes) before merging to `main`.

## Governance

This constitution supersedes any other ad hoc project convention. Amendments are made by
updating this file via `/speckit-constitution`, including its Sync Impact Report, before the
new version is committed. Versioning follows semantic versioning: MAJOR for backward-incompatible
principle removals or redefinitions, MINOR for new principles or materially expanded guidance,
PATCH for wording or clarification fixes. Before `/speckit-implement` executes a task, its plan
MUST be checked against these principles; a plan that conflicts with a NON-NEGOTIABLE principle
(I or III) MUST be revised, not implemented as written. `README.md` remains the source for
setup and runtime instructions; this constitution governs process and non-negotiable
constraints only.

**Version**: 1.6.2 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-16
