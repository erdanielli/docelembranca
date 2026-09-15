# Phase 0 Research: Order Costing & Pricing

## 1. Testing stack

**Decision**: Vitest 5.0.x + `@testing-library/react` 16.3.x + `@testing-library/jest-dom` 7.0.x + `jsdom` 30.0.x for component and pure-logic unit tests. Postgres RPC functions and RLS policies are tested directly in the database with **pgTAP**, run via `supabase test db` against SQL test files under `supabase/tests/database/`.

**Rationale**: The project has zero test tooling today, and Principle I (TDD, non-negotiable) requires coverage for every layer, UI and data/logic alike. Vitest is Vite-native (no separate transform config needed) and is explicitly the kind of "latest, deliberately chosen" tool Principle VIII calls for. This was presented to Eduardo as a consent-gated tech-stack decision (Principle X) with two options — Vitest+RTL+pgTAP vs. Vitest+RTL only with RPC/RLS covered via `supabase-js` integration tests against a local Supabase stack. He initially chose the latter, then reconsidered: testing the database directly matters more here than testing it indirectly through the JS client, since RLS (Principle III, non-negotiable) is the app's *only* real access-control boundary — a policy bug that a client-level integration test happens not to exercise (e.g., a missing `WITH CHECK` clause, or a policy that only fails under a specific role) is exactly the kind of thing pgTAP, running assertions inside Postgres itself, is built to catch precisely. Final decision: pgTAP for RPC/RLS, Vitest+RTL for the frontend.

**Alternatives considered**:
- *Jest*: mature, but requires extra config to work with Vite's ESM/TS pipeline that Vitest gets for free; no advantage over Vitest here.
- *supabase-js integration tests against a local stack (no pgTAP)*: the initially-chosen simpler single-framework approach; superseded because it tests RLS/RPC behavior through an extra layer of indirection (the JS client and its own error handling) rather than asserting on the database's actual behavior directly.
- *Cypress/Playwright E2E*: valuable eventually for full user-journey coverage of the Order wizard, but out of scope for this feature's first pass; component tests + pgTAP are sufficient to satisfy Principle I for now. Can be reconsidered in a future feature if needed.

## 2. Where business logic lives: client TypeScript vs. Postgres functions

**Decision**: Split by atomicity need. (a) Cost/price computation — scaling a Recipe Size Variant's ingredient/material quantities to a requested Order quantity, selecting which Stock Batches to draw from (15-day-expiry priority then cheapest), and rolling up labor/profit/discount into a final price — is pure, side-effect-free TypeScript that runs client-side over data already fetched for the Order screen. (b) Anything that mutates shared state across multiple rows atomically — reserving Stock Batch quantities during Budgeting, releasing them on cancellation, and deducting real consumption at Consolidation — is a Postgres RPC function (`supabase.rpc(...)`), so a network hiccup mid-operation can never leave stock partially reserved/deducted.

**Rationale**: FR-021 requires the cost breakdown to update in real time as the user edits quantities, variants, material overrides, labor, profit %, or discount % — a network round trip per keystroke would violate the "instant" feel Principle IX expects from an iOS-native UI. Pure client-side calculation avoids that entirely. Conversely, FR-031/FR-033/FR-036 (reserve, consolidate, release stock) touch multiple `stock_batches` rows and must not partially apply; Postgres functions running in a single transaction are the Supabase-native way to guarantee that (Principle II explicitly prefers Postgres functions/triggers over introducing a custom server for exactly this kind of need).

**Alternatives considered**:
- *All calculation in Postgres (a "get quote" RPC called on every edit)*: rejected — reintroduces per-keystroke latency and network dependency for what is otherwise pure arithmetic.
- *All mutations done as sequential client-side `update` calls*: rejected — a dropped connection between two `update` calls could leave a Batch's `quantity_remaining` reserved without the Order recording it (or vice versa), corrupting stock accuracy, which is the feature's core value proposition.

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

**Observation (not a decision for this feature)**: `package.json` currently pins React 18.3.1, Vite 5.4.1, and `@supabase/supabase-js` 2.45.4. Principle VIII calls for proactively tracking latest stable versions, but upgrading these is an independent, cross-cutting concern that affects the whole app (e.g., `LoginGate`), not something this costing/pricing feature should bundle in as a side effect. Left out of this feature's scope; flagged here so it isn't silently forgotten.
