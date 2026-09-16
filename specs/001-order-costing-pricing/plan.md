# Implementation Plan: Order Costing & Pricing

**Branch**: `001-order-costing-pricing` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-order-costing-pricing/spec.md`

**Revised**: 2026-09-15 — second pass after `/speckit-analyze`, which found the stock accounting, the live-cost path, and the Future/Pending resolution path inconsistent across artifacts. spec.md, data-model.md, contracts/, research.md and quickstart.md were revised together; tasks.md was brought in line afterwards by amendment rather than regeneration (see revision 3 below).

## Summary

The confectioner needs an accurate, real-time way to price party-sweet orders. This feature adds: (1) an agnostic catalog of Ingredients, Materials, and Recipes with commercial Size Variants; (2) a batch-tracked Stock/shelf that links real market products to catalog items, including a quick bulk-pack entry mode; (3) an Order flow that computes ingredient/material cost in real time from the cheapest and soonest-expiring Stock Batches (falling back to user-estimated Future/Pending Stock when nothing covers a need), adds labor cost, per-recipe profit %, and an order-level discount % to produce a final price; and (4) a six-status Order lifecycle (Awaiting Quote → Quoting/Budgeting → Awaiting Production → In Production → Awaiting Consolidation → Consolidated, plus Canceled) with stock reservation, consolidation of real consumption, and a full, immutable status-change history.

Technical approach: this stays within the existing static Vite + React + TypeScript frontend backed by Supabase Postgres (Principle II). The Budgeting screen **previews** batch selection and pricing in pure client-side TypeScript over already-loaded data, so the breakdown redraws with no round trip, and **commits** it through Postgres RPC functions (`supabase.rpc(...)`) when a line is saved — the RPC is always the authority (research.md §7). Everything that must be atomic — reserving stock at Budgeting, releasing it on cancellation, resolving a Future/Pending placeholder onto the real Batch, and deducting actual consumption at Consolidation — lives in those RPCs rather than in multi-step client writes, keeping the "backend" entirely inside Supabase per Principle II while avoiding partial-write bugs. Coverage (is this line's need met?) is derived by `security_invoker` views rather than trusted from the client, so the status gates cannot be talked around (research.md §8), and all stock quantities are kept as amounts in each item's own unit of measure rather than package counts (research.md §9).

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode), React 19.3, targeting ES2020 (existing `tsconfig.json`), on Node 24 in the devcontainer

**Primary Dependencies**: React 19.3, Vite 8.3, `@vitejs/plugin-react` 6.1, `@supabase/supabase-js` 2.116. The React/Vite upgrade was not optional: Vitest 5 requires Vite ≥ 6.4, so the testing stack this feature needs could not be installed on Vite 5.4 — Eduardo consented to taking the upgrade rather than pinning an older runner (research.md §6). New dev dependencies: Vitest 5.0, `@testing-library/react` 16.3, `@testing-library/dom` 10.4, `@testing-library/jest-dom` 7.0, `jsdom` 30.0, plus the ESLint 10 / typescript-eslint 8.70 flat config the repo was missing entirely. No new runtime dependency (no state-management or data-fetching library, no UI kit) — plain React state/hooks and `supabase-js` are sufficient (Principle IV).

**Storage**: Supabase Postgres, via new migrations under `supabase/migrations/` — 16 tables, 4 derived views, 5 RPC functions, and the triggers that derive batch amounts, log Order creation, and freeze terminal Orders. No Supabase Storage bucket is needed for this feature (no file/photo uploads in scope).

**Testing**: Vitest + React Testing Library for component and pure-logic (costing engine, unit conversion) unit tests. Postgres RPC functions, views, triggers, and RLS policies are tested directly in the database with pgTAP, run via `npm run test:db`, which drives `pg_prove` straight at the local database (research.md §1 and §11). This requires a local Supabase stack that the repo does not have yet: `supabase init` (committing `config.toml`) and `supabase start` are prerequisites of the first test task (research.md §10). The client-side `selectBatchesForNeed` and its SQL counterpart are driven by the same fixtures on both sides, so a divergence fails a test (research.md §7). Every user story's user-facing flow additionally carries Playwright end-to-end coverage under `tests/e2e/`, run via `npm run test:e2e` against the local Supabase stack, authenticated through the local `dev-preview.html` entry point rather than real Google OAuth (constitution v1.5.0, Principle I; research.md §12). Every story now carries one: T041a–T041c (US1, backfilled), T058a (US2), T108a (US3), T136a (US4). Per Principle I as clarified in v1.6.1, these are regression specs written against the story's completed implementation and confirmed passing — they are not failing-first pairs like the Vitest and pgTAP tasks.

**Target Platform**: Static GitHub Pages build, used from a mobile browser styled to feel iOS-native (Principle IX), single authorized user (`giselypasquini@gmail.com`).

**Project Type**: Single-project web frontend (no `backend/` directory — Supabase is the only backend, per Principle II).

**Performance Goals**: Order budget recalculation reflects any input change (quantity, variant, material override, labor/profit/discount) with no network access at all — it is synchronous client-side arithmetic over data already loaded for the Order, so the only cost is a React re-render. The authoritative `reserve_stock_for_order` round trip happens once per line **save**, where a spinner is acceptable.

**Constraints**: Static hosting only, no custom server (Principle II); single user, so no multi-tenant/authorization complexity beyond the existing RLS-gated single email (Principle III); offline use is not required.

**Scale/Scope**: Single user; expected data volumes are small (tens of Ingredients/Materials/Recipes, tens of Stock Batches, a handful of open Orders at a time) — no performance engineering beyond straightforward indexed Postgres queries is warranted.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Every new component — including the navigation shell and every list/history view, not just forms — the costing/unit-conversion logic, and every Postgres RPC, view, trigger, and RLS policy gets a failing test before implementation (Vitest+RTL for frontend, pgTAP in Postgres). tasks.md pairs a test task with *every* implementation task; the generation before it left six untested, which is what the analyze pass caught and the amendment fixed. As of constitution v1.5.0 this also requires Playwright e2e coverage under `tests/e2e/` for every user-facing flow (research.md §12), and every story now has a task for it: T041a–T041c (US1), T058a (US2), T108a (US3), T136a (US4). Those four are deliberately *not* failing-first pairs — v1.6.1 clarified Principle I so that an e2e spec is regression coverage confirmed passing against a completed flow, which is also what makes the US1 backfill the correct shape rather than a violation. | PASS |
| II. Serverless, Static-First | No new backend/service introduced. Stock reservation/consolidation logic lives in Postgres functions (Supabase-native), not a custom server. | PASS |
| III. RLS Is the Only Real Access Control (NON-NEGOTIABLE) | Every new table (customers, ingredients, materials, recipes, recipe_size_variants, recipe_variant_ingredients, recipe_variant_materials, stock_products, stock_batches, future_stock_placeholders, orders, order_recipe_lines, order_recipe_line_material_overrides, order_stock_reservations, order_stock_consumptions, order_status_history) ships with RLS enabled and a policy restricting to the single allowed user, in the same migration that creates it, via the shared `is_allowed_user()` helper. The four derived views are created `WITH (security_invoker = true)` so they inherit those policies instead of bypassing them as owner (research.md §8), and `order_status_history`'s policy grants INSERT/SELECT only — never UPDATE/DELETE (FR-040), with pgTAP asserting the denial rather than assuming it. | PASS |
| IV. Simplicity and YAGNI | No new UI kit, state-management, or data-fetching library. Bulk-pack entry stays a UI-only convenience, not a table. Every table maps to an FR/Key Entity. The four views added in this revision replace logic that would otherwise have been written three times (reserve RPC, FR-028 gate, FR-016 pre-fill); `initial_amount` and `unit_cost_is_estimated` are each required by a current FR (FR-014's partial remainders, FR-035's honest budget-vs-actual), not anticipated ones. | PASS |
| V. Strict Type Safety | TypeScript types for the schema are generated via `supabase gen types typescript` rather than hand-written/`any`; costing engine functions are fully typed. | PASS (enforced in tasks) |
| VI. Language Split | Schema identifiers, code, comments, and this plan/spec are en_US; all user-facing pt_BR strings are deferred to implementation and require Eduardo's consent before shipping, per the Development Workflow section. | PASS |
| VII. Human-Friendly, Maintainable Code | Costing/priority-selection logic will be broken into small, named pure functions; guard clauses over nested conditionals (max 2 levels), enforced at review/implementation time. | PASS (design intent; enforced in tasks/review) |
| VIII. Latest Stack | Everything is on current latest stable as of 2026-09-15: Node 24.21, Vite 8.3, plugin-react 6.1, React 19.3, supabase-js 2.116, Vitest 5.0.x, RTL 16.3.x, jest-dom 7.0.x, jsdom 30.0.x, ESLint 10. TypeScript stays on 5.x because typescript-eslint caps it below 6.1 — recorded as a separate decision, not an oversight (research.md §6). | PASS |
| IX. iOS-Native Look and Feel | New screens (catalog forms, stock/shelf views, Order budgeting wizard, status timeline) reuse `src/ios.css` conventions; no new visual language introduced. | PASS (enforced in tasks) |
| X. Deliberate Tool Selection with Consent Gate | The testing stack was researched (Vitest+RTL vs. adding pgTAP) and presented to Eduardo. He initially chose Vitest+RTL only (RPC/RLS via supabase-js integration tests), then reconsidered: testing the database directly matters, so pgTAP is adopted for RPC/RLS testing alongside Vitest+RTL for the frontend. This revision's architecture decision — mirroring batch selection client-side for the live preview versus making every edit a round trip — was likewise presented with both options and their trade-offs before being adopted (research.md §7). No new dependency is introduced by either. | PASS |
| XI. Follow and Document Per-Stack Best Practices | This plan's research.md records the conventions adopted (RLS helper pattern, RPC-for-atomicity pattern, unit-conversion approach, testing approach); a task in `/speckit-tasks` must fold these into a durable conventions reference (e.g. `docs/conventions.md`), not leave them implicit in code only. | PASS (tracked as a task) |
| XII. UI Prototyping Before Implementation | US1 (Catalog) was implemented before this principle existed (constitution v1.6.0) and is grandfathered — not retroactively blocked. US2 (Stock/shelf views), US3 (Order Budgeting wizard), and US4 (status timeline) each introduce new UI screens per Project Structure below, so each needs a throwaway React prototype under `prototypes/` (gitignored, mock data only, no tests, no Supabase wiring) built and approved by Eduardo after that story's tasks are generated and before its implementation tasks begin (research.md §13). Each gate is now an explicit blocking task in tasks.md — T041d (US2, blocks T042), T058b (US3, blocks T059), T108b (US4, blocks T109) — and `prototypes/` is gitignored at the repo root. | PASS (US1 grandfathered; US2–US4 gates enforced in tasks.md) |

No violations requiring justification — Complexity Tracking is not needed for this plan.

**Post-Phase-1 re-check**: data-model.md's 16 tables and 4 views, the five RPC contracts, and the client costing-engine contract were reviewed against every principle above after design — no new violations were introduced (every table and view maps to an FR/Key Entity per Principle IV; every table's RLS policy is specified via the shared helper and every view is `security_invoker` per Principle III; no additional dependency beyond the already-consented testing stack was introduced per Principle X). Constitution Check remains PASS.

**Post-analyze re-check (revision 2)**: `/speckit-analyze` found four CRITICAL issues in the first design — a package-count/canonical-amount mismatch running through the stock math, a Future/Pending resolution path with no implementation at all, and two Principle I violations in tasks.md. The first two are fixed here (research.md §9, `resolve_future_stock`); the Principle I violations are task-level and are why tasks.md must be regenerated rather than patched. The gates above are re-evaluated against the revised design and still PASS.

**Post-amendment re-check (revision 3)**: two constitution amendments landed after US1 (Catalog) shipped, triggered by issues found in that delivery. v1.5.0 extended Principle I to require Playwright e2e coverage per user-facing flow — US1 already has it retroactively (research.md §12), but tasks.md has no task IDs for it and US2–US4 have none planned. v1.6.0 added Principle XII, requiring an approved throwaway UI prototype before each UI-bearing user story's implementation tasks begin — US1 predates it and is grandfathered, but US2–US4 are in scope. Both gates are now closed in tasks.md, which was amended in place rather than regenerated: renumbering would have invalidated the GitHub Issues already raised from it, so the new tasks carry letter suffixes anchored to the preceding ID (T041a–d, T058a–b, T108a–b, T136a) and the file is read in document order, not by numeric ID.

**Post-analyze re-check (revision 4)**: a later `/speckit-analyze` pass found two CRITICAL issues in this revision. First, tasks.md had carved out an exception to Principle I for e2e tasks while citing a research.md §12 paragraph that demanded the opposite — resolved upward by amending Principle I itself (v1.6.1), since whether e2e is failing-first is the constitution's call and not a task file's; research.md §12 and the rows above now follow it. Second, `is_expired`/`expires_soon` were defined without NULL handling, which would have silently dropped every undated Material Batch out of stock selection under `where is_expired = false` and promoted it to the front under `order by expires_soon desc` — fixed in data-model.md and contracts/, with the undated cases added to T077's shared fixtures so T078 and T080 can actually catch a future regression.

Three further design-level fixes from the same pass: `stock_batches.unit_price` is renamed `package_price`, since it was the only price in the feature not expressed per canonical unit and the old name made it indistinguishable from `estimated_unit_price` and `unit_cost_snapshot` (the mirrored client helper becomes `costPerUnitAmount` to match its view column); `stock_batch_availability.reserved_amount` now excludes reservations whose consumption is already confirmed, because `consolidate_order_stock` decrements `remaining_amount` one item at a time while the Order sits in `awaiting_consolidation` — an active status — so the old definition held both the deducted amount and the original commitment against the same Batch for the length of that window; and T095a/T103a add the `awaiting_quote → quoting` client action, which had an RPC edge and a pgTAP test but nothing to invoke it. All of it lands in artifacts only; no implemented code changes, and US2 remains blocked at T041d.

## Project Structure

### Documentation (this feature)

```text
specs/001-order-costing-pricing/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── supabaseClient.ts        # existing
│   ├── database.types.ts        # generated via `supabase gen types typescript`
│   ├── units/                   # unit-of-measure conversion (mass/volume/count)
│   └── costing/                 # pure functions: scaleVariantComposition,
│                                 # selectBatchesForNeed (mirrors the RPC's FR-022
│                                 # ordering), costPerUnitAmount, computeLineCost,
│                                 # computeOrderBreakdown, computeActualVsBudget
├── features/
│   ├── catalog/                 # Ingredients, Materials, Recipes, Size Variants CRUD
│   ├── stock/                   # Stock Products, Batches, bulk-pack entry, future stock
│   ├── customers/                # Customer registry + order history lookup
│   └── orders/                  # Order wizard across the 6-status lifecycle,
│                                 # budgeting UI, status history timeline
├── components/                  # existing + new shared UI (e.g. LoginGate)
├── App.tsx, main.tsx, ios.css   # existing
└── vite-env.d.ts                # existing

supabase/
├── config.toml                  # created by `supabase init` (not in the repo yet — research.md §10)
├── migrations/                  # new migrations: tables + views + triggers + RPCs + `pgtap`
│   # RPCs: reserve_stock_for_order, release_reserved_stock, resolve_future_stock,
│   #       consolidate_order_stock, transition_order_status
│   # views: stock_batch_availability, order_line_requirements,
│   #        order_line_coverage, order_item_shortfalls (all security_invoker)
│   # each table with RLS enabled in its creating migration
└── tests/
    └── database/                 # pgTAP test files (*.sql), run via `npm run test:db`
                                  # (RPC functions, RLS policies — tested directly in Postgres)

tests/
├── unit/                        # costing/units pure-function tests (Vitest)
├── components/                  # React Testing Library component tests
└── e2e/                         # Playwright e2e specs, run via `npm run test:e2e`
                                  # (constitution v1.5.0 — one per user-facing flow;
                                  # catalog-*.spec.ts exist for US1, US2-US4 pending)

prototypes/                      # gitignored, never committed — throwaway React
                                  # prototypes per constitution v1.6.0 (Principle XII),
                                  # built and Eduardo-approved before each UI-bearing
                                  # user story's implementation tasks begin
```

**Structure Decision**: Single Vite/React project (no `backend/`) since Supabase is the only backend (Principle II). New domain logic is grouped under `src/features/<domain>` (catalog, stock, customers, orders) with shared pure logic in `src/lib/costing` and `src/lib/units`, mirroring the feature's four independently-testable user stories (P1–P4). Database logic that must be atomic lives in Postgres functions under `supabase/migrations/`, tested directly against the database with pgTAP from `supabase/tests/database/` (`npm run test:db`) rather than indirectly through the JS client. `tests/e2e/` and the gitignored `prototypes/` directory are repo-root-level, not per-feature, since both are shared infrastructure (constitution v1.5.0/v1.6.0) rather than this feature's own structure.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
