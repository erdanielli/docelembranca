# Phase 0 Research: Order Costing & Pricing

## 1. Testing stack

**Decision**: Vitest 5.0.x + `@testing-library/react` 16.3.x + `@testing-library/jest-dom` 7.0.x + `jsdom` 30.0.x for component and pure-logic unit tests. Postgres RPC functions and RLS policies are tested directly in the database with **pgTAP**, run by `pg_prove` (via `npm run test:db`) against SQL test files under `supabase/tests/database/` — see §11 for why not `supabase test db`.

**Rationale**: The project has zero test tooling today, and Principle I (TDD, non-negotiable) requires coverage for every layer, UI and data/logic alike. Vitest is Vite-native (no separate transform config needed) and is explicitly the kind of "latest, deliberately chosen" tool Principle VIII calls for. This was presented to Eduardo as a consent-gated tech-stack decision (Principle X) with two options — Vitest+RTL+pgTAP vs. Vitest+RTL only with RPC/RLS covered via `supabase-js` integration tests against a local Supabase stack. He initially chose the latter, then reconsidered: testing the database directly matters more here than testing it indirectly through the JS client, since RLS (Principle III, non-negotiable) is the app's *only* real access-control boundary — a policy bug that a client-level integration test happens not to exercise (e.g., a missing `WITH CHECK` clause, or a policy that only fails under a specific role) is exactly the kind of thing pgTAP, running assertions inside Postgres itself, is built to catch precisely. Final decision: pgTAP for RPC/RLS, Vitest+RTL for the frontend.

**Versions confirmed against the npm registry on 2026-09-15** (task T001): `vitest` 5.0.1, `@testing-library/react` 16.3.3, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.0.1. Two things the first pass missed: `@testing-library/react` 16 declares `@testing-library/dom` ^10 as a **non-optional** peer, so 10.4.2 is installed explicitly; and the repository had no ESLint config or dependency at all, so `npm run lint` — a Development Workflow gate — could never have passed. ESLint 10 with `typescript-eslint` 8.70 and the React hooks/refresh plugins was added in flat-config form to close that.

Tests run with `globals: false`: each test imports `describe`/`it`/`expect` from `vitest`, which keeps TypeScript and ESLint honest without ambient declarations or an extra lint plugin.

**Alternatives considered**:
- *Jest*: mature, but requires extra config to work with Vite's ESM/TS pipeline that Vitest gets for free; no advantage over Vitest here.
- *supabase-js integration tests against a local stack (no pgTAP)*: the initially-chosen simpler single-framework approach; superseded because it tests RLS/RPC behavior through an extra layer of indirection (the JS client and its own error handling) rather than asserting on the database's actual behavior directly.
- *Cypress/Playwright E2E*: valuable eventually for full user-journey coverage of the Order wizard, but out of scope for this feature's first pass; component tests + pgTAP are sufficient to satisfy Principle I for now. Can be reconsidered in a future feature if needed.

## 2. Where business logic lives: client TypeScript vs. Postgres functions

**Decision**: Split by atomicity need. (a) Cost/price computation — scaling a Recipe Size Variant's ingredient/material quantities to a requested Order quantity, selecting which Stock Batches to draw from (15-day-expiry priority then cheapest), and rolling up labor/profit/discount into a final price — is pure, side-effect-free TypeScript that runs client-side over data already fetched for the Order screen. (b) Anything that mutates shared state across multiple rows atomically — reserving Stock Batch quantities during Budgeting, releasing them on cancellation, and deducting real consumption at Consolidation — is a Postgres RPC function (`supabase.rpc(...)`), so a network hiccup mid-operation can never leave stock partially reserved/deducted.

**Rationale**: FR-021 requires the cost breakdown to update in real time as the user edits quantities, variants, material overrides, labor, profit %, or discount % — a network round trip per keystroke would violate the "instant" feel Principle IX expects from an iOS-native UI. Pure client-side calculation avoids that entirely. Conversely, FR-031/FR-033/FR-036 (reserve, consolidate, release stock) touch multiple `stock_batches` rows and must not partially apply; Postgres functions running in a single transaction are the Supabase-native way to guarantee that (Principle II explicitly prefers Postgres functions/triggers over introducing a custom server for exactly this kind of need).

See §7 for how the two halves meet: the client previews the batch selection, the RPC commits it.

**Alternatives considered**:
- *All calculation in Postgres (a "get quote" RPC called on every edit)*: rejected — reintroduces per-keystroke latency and network dependency for what is otherwise pure arithmetic.
- *All mutations done as sequential client-side `update` calls*: rejected — a dropped connection between two `update` calls could leave a Batch's remaining amount reserved without the Order recording it (or vice versa), corrupting stock accuracy, which is the feature's core value proposition.

## 3. Unit-of-measure conversion

**Decision**: Each Ingredient/Material stores one canonical unit from a fixed set grouped by measurement dimension: mass `{mg, g, kg}`, volume `{ml, l}`, count `{un}`. A small `src/lib/units` module holds a pure conversion function (`convert(value, fromUnit, toUnit)`) that only allows conversion within the same dimension; the same conversion factors are mirrored in a Postgres `convert_unit(...)` SQL function used inside the reservation/consolidation RPCs so cost math is consistent whether computed client-side (for display) or server-side (for the atomic stock deduction). A Stock Product's package amount may be entered in any unit of its linked item's dimension (FR-010) and is converted to the Ingredient's/Material's canonical unit before any cost comparison.

**Rationale**: FR-010 requires automatic conversion between compatible units (e.g., a product bought in kg linked to an Ingredient tracked in g) per the user's explicit answer during specification. Keeping the conversion table tiny (three dimensions, a handful of units) keeps this well within Principle IV's simplicity bar — no general-purpose units-of-measure library is needed.

**Alternatives considered**:
- *A general-purpose npm units-conversion library*: rejected as unnecessary — the domain only ever needs mass/volume/count conversions among a handful of units, a ~20-line lookup table is simpler and fully under test control (Principle IV).
- *Store everything already normalized to canonical unit at data-entry time (no conversion function)*: rejected — this is exactly what FR-010 asked the system to do for the user rather than require manual conversion by hand.

## 4. Row-Level Security pattern for the new tables

**Decision**: A single reusable SQL helper, `is_allowed_user()`, wraps the existing single-email check (`auth.jwt() ->> 'email' = '<allowed email>'`) and every new table's RLS policy calls it (`USING (is_allowed_user())` / `WITH CHECK (is_allowed_user())`), created and enabled in the same migration as the table itself.

**Rationale**: Principle III (non-negotiable) requires RLS enabled with a restrictive policy in the same migration that creates each table, for all ~15 new tables in this feature. A shared helper avoids duplicating the same email-comparison expression 15+ times (Principle VII: avoid needless repetition) and gives a single place to update if the allowed email ever changes (already documented in the constitution's Security & Secrets Requirements as "a configuration change, not something requiring a constitution amendment").

**Alternatives considered**:
- *Repeating the raw `auth.jwt() ->> 'email' = '...'` expression per policy*: rejected — 15+ copies of the same literal is exactly the duplication Principle VII warns against, and makes the future "change the allowed email" configuration change more error-prone.

## 5. TypeScript types for the schema

**Decision**: Generate `src/lib/database.types.ts` via `supabase gen types typescript --local` (or `--project-id` against the linked project) as part of the workflow whenever migrations change, and use the generated types for all `supabase-js` query results.

**Rationale**: Principle V forbids treating Supabase query results as `any`. Generated types stay in sync with the actual schema automatically, which is more reliable than hand-maintained interfaces as the schema grows across ~15 tables.

**Alternatives considered**:
- *Hand-written TypeScript interfaces mirroring the schema*: rejected — drifts from the real schema over time with no compiler-enforced sync, exactly the silent-mistake risk Principle V exists to prevent.

## 6. Existing dependency versions (React, Vite, supabase-js)

**Superseded — the upgrade turned out to be a prerequisite, and was taken.** The original note said React 18.3.1 / Vite 5.4.1 / supabase-js 2.45.4 should eventually be updated under Principle VIII, but that doing so was out of this feature's scope. Installing the testing stack proved otherwise: **Vitest 5 requires `vite ^6.4 || ^7 || ^8`**, and even Vitest 4 requires Vite ≥ 6, so the last Vite-5-compatible runner is Vitest 3 — two majors behind on day one, which is exactly what Principle VIII exists to prevent. Presented to Eduardo with three options (full current stack / Vite only / keep the app stack and pin an older Vitest); he chose the full upgrade.

Adopted: Node 24.21 (the devcontainer already declared `typescript-node:24-bookworm` but had been built from a stale cached layer holding Node 22.16, which is also below `jsdom` 30's floor of `^22.22.2 || ^24.15.0`), Vite 8.3, `@vitejs/plugin-react` 6.1, React and React DOM 19.3, `@supabase/supabase-js` 2.116. The app itself needed no code changes: `main.tsx` already used `createRoot`, and nothing used `React.FC`, `defaultProps`, or `propTypes`. `npm run build` and `npm run lint` both pass on the new stack.

**TypeScript stays on 5.x.** TypeScript 7.0 is current, but `typescript-eslint` 8.70 declares `typescript: >=4.8.4 <6.1.0`, so adopting it now would break linting. That is a separate decision for a later feature, recorded here rather than silently skipped.

## 7. Live preview vs. authoritative reservation

**Decision**: The Order Budgeting screen previews batch selection **client-side** and commits it **server-side**. A pure `selectBatchesForNeed` in `src/lib/costing` applies FR-022's ordering (not expired; expiring within 15 days first, cheapest within each group) to the `stock_batch_availability` rows already loaded for the Order, so the cost breakdown redraws with zero network latency as the user edits quantity, variant, overrides, labor, profit %, or discount. When the line is **saved**, `reserve_stock_for_order` runs the same ordering inside Postgres and its result replaces the preview. The RPC is always the authority; the preview never writes anything.

**Rationale**: Presented to Eduardo as an architecture decision (Principle X) after a cross-artifact analysis found the original design self-contradictory: `computeLineCost` read its prices from `reserve_stock_for_order`'s output, which would have meant a round trip per edit — exactly what plan.md, research.md §2, and quickstart.md all promised would not happen, and what Principle IX's native feel rules out. He chose mirroring over dropping the promise. The cost is one rule expressed twice (TypeScript and SQL), the same trade-off already accepted for `convert` / `convert_unit` in §3, and it is contained the same way: both sides implement a fully specified total ordering (ties broken by expiration date then batch id), and the same fixture set drives the Vitest and pgTAP tests, so a divergence shows up as a failing test rather than a silently different quote.

**Alternatives considered**:
- *Call `reserve_stock_for_order` on every edit, debounced*: one implementation of the rule, but it makes the headline interaction of the feature network-bound, and a debounce long enough to be cheap is long enough to feel laggy. Rejected by Eduardo.
- *Move the whole quote to a read-only `preview_order_cost` RPC*: same latency problem as above, and it would still need the reservation RPC for the commit — two SQL implementations instead of one SQL and one TypeScript.

## 8. Coverage as a derived view, not a returned value

**Decision**: Whether a Recipe line's need is covered is computed by two `security_invoker` views — `order_line_requirements` (variant composition scaled to the requested quantity, material overrides substituted, count units rounded up) and `order_line_coverage` (requirements minus reservations) — plus `order_item_shortfalls`, their Order-wide aggregate. The FR-028 gate, the FR-016 placeholder pre-fill, and `reserve_stock_for_order` itself all read those views.

**Rationale**: FR-028 blocks an Order from leaving Budgeting until every line is covered, but shortfalls were previously only a value `reserve_stock_for_order` returned to the client — nothing persisted them, so the gate had no source of truth to test and would have had to re-derive the need in SQL anyway, duplicating the scaling logic a third time. A view derives it once, always current, and cannot be bypassed by a client that simply doesn't call the RPC. It also makes FR-016's "sum across every Recipe line of the Order" a one-line `GROUP BY` instead of an aggregation the client would have to assemble from per-line responses.

**Alternatives considered**:
- *Persist `shortfall_amount` on `order_recipe_lines`*: a denormalized copy that goes stale the moment a Batch elsewhere is consumed, reserved, or deleted. Rejected.
- *Have the client pass its computed coverage into `transition_order_status`*: the gate would then trust the caller, which on a public static frontend is no gate at all (Principle III).

**Note**: `security_invoker = true` is required on every view here (PostgreSQL 15+). Without it a view runs as its owner and silently bypasses the RLS policies of the tables underneath — a hole in the project's only real access boundary.

## 9. Stock accounting in canonical amounts, not package counts

**Decision**: A Batch records `packages_purchased` (an integer, describing the purchase) and `unit_price` (per package), and from those a trigger derives `initial_amount` and `remaining_amount` in the linked Ingredient's/Material's canonical unit. Every other quantity in the feature — a line's requirement, a reservation, a consumption, a shortfall, a placeholder's need — is an amount in that same canonical unit, and every cost is per canonical unit (`cost_per_unit_amount = unit_price / package content`).

**Rationale**: The first design had `quantity_remaining` as an integer package count while reservations and consumptions were canonical-unit numerics, and `consolidate_order_stock` decremented one by the other. Beyond the type mismatch, a package counter cannot represent the normal case: a 395 g can used for 200 g leaves 195 g, and FR-014 requires that remainder to be tracked for the next Order to cost against. Deriving amounts once at insert keeps the per-unit cost and the remaining content in the same currency of measurement everywhere they meet, so no comparison in the feature needs to remember which of the two it is holding. `initial_amount` is kept alongside `remaining_amount` both for "how much of this batch is left" display and so a later edit to the product's `package_amount` cannot retroactively change a batch already partly consumed.

**Alternatives considered**:
- *Keep package counts and convert at every comparison*: every query touching stock would carry a conversion, and fractional package counts (0.494 of a can) are meaningless to store and awkward to display.
- *Store both a package count and an amount, kept in sync*: two sources of truth for the same fact, guaranteed to drift.

## 10. Running the database tests locally

**Decision**: pgTAP tests run against a local Supabase stack, which this repository does not yet have: `supabase/config.toml` is absent, so `supabase init` (committing the generated `config.toml`) and `supabase start` are prerequisites of the very first test task, before `supabase test db` or `supabase gen types typescript --local` can run at all. The hosted project stays the deployment target via the existing `supabase link` + `supabase db push` flow in README.md; the local stack is for tests and type generation only.

**Rationale**: README.md documents only the linked hosted project, and the testing decision in §1 (pgTAP, asserted inside Postgres) silently assumed a local stack that nothing sets up. Running these tests against the hosted project is not an option — they create and destroy rows and impersonate roles.

**Devcontainer networking (learned by doing)**: `supabase init` alone was not enough. With docker-outside-of-docker the CLI runs inside the container while the stack is created by the host daemon and published on the host's `127.0.0.1:54321-54324`; the container's own loopback stays empty, so the CLI's health check failed with `ECONNREFUSED` on 54322 and stopped the stack it had just started. The listed `forwardPorts` did not help — they forward *from* the container, and nothing was listening there. The fix is `"runArgs": ["--network=host"]` in `.devcontainer/devcontainer.json`, giving both sides one localhost — **and removing `forwardPorts`**, which is not merely redundant once the namespace is shared: the IDE binds every listed port on the host loopback, so `supabase start` then fails with `address already in use` on the very ports it needs. The alternatives (starting the stack from a host shell and joining the stack's docker network, or `--ignore-health-check` plus a `--db-url` override on every command) were rejected: the first splits where commands run and needs re-joining after every rebuild, and the second silences real health failures and leaves the host browser unable to reach Studio.

**Alternatives considered**:
- *Run pgTAP against the hosted Supabase project*: destructive tests against the only real database, with no staging environment to absorb mistakes. Rejected outright.

## 11. Running pgTAP from the devcontainer

**Decision**: the pgTAP suite is run by `pg_prove` directly against the local database (`npm run test:db`), with `postgresql-client` and `libtap-parser-sourcehandler-pgtap-perl` installed in the devcontainer image. `supabase test db` is not used.

**Rationale**: `supabase test db` runs pg_prove inside a container it creates through the host's Docker daemon, bind-mounting the tests directory by the path it sees. In this devcontainer that path is `/IdeaProjects/docelembranca/supabase/tests`, while the project actually lives at `/home/liberty/code/docelembranca` on the host. Docker created the missing host path as empty directories and mounted those, so every run reported `no pgTAP tests found` with `Files=0` — a silent, pass-shaped failure, which is the worst possible behaviour for a test runner under a test-first constitution. Driving `pg_prove` from inside the container removes the indirection: it connects to `127.0.0.1:54322` (reachable thanks to the shared network namespace, §10) and reads the test files from the filesystem it is already running on, so no path translation happens anywhere.

**Alternatives considered**:
- *A host-side symlink from `/IdeaProjects/docelembranca` to the real project path*: one line, and it keeps `supabase test db` working, but it fixes the machine rather than the repository — a fresh clone, a second checkout, or another machine would each need the same manual step, with nothing in the repo to say so.
- *Aligning the paths with `workspaceMount`/`workspaceFolder` in devcontainer.json*: the general fix for this class of problem, but it depends on the IDE honouring those keys, and it would move the in-container project path, which also rekeys per-project tooling state that is addressed by path.
- *Piping each test file into `psql` via `docker exec`*: no new packages, but it gives up TAP parsing, so a failing assertion would have to be found by grepping output.

**Note**: the runner is `pg_prove --recurse --ext .sql supabase/tests`; `--ext` is required, since pg_prove's recursive search otherwise looks for its default `.t` extension and silently finds nothing.
