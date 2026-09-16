---

description: "Task list template for feature implementation"
---

# Tasks: Order Costing & Pricing

**Input**: Design documents from `/specs/001-order-costing-pricing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included and REQUIRED — Constitution Principle I (Test-First Development) is NON-NEGOTIABLE for this project. **Every** implementation task below is preceded by a test task that must be run and confirmed failing first, including navigation, list, and wiring components.

**Organization**: Tasks are grouped by user story (P1–P4 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task description
- **Pairing convention**: task IDs run in strict execution order, and a test task always sits immediately before the implementation task it covers. Read them as pairs: odd work ("write the failing test") then even work ("make it pass").

## Path Conventions

Single Vite/React project (no `backend/`) per plan.md's Project Structure:

- `src/lib/`, `src/features/`, `src/components/` — frontend
- `supabase/migrations/`, `supabase/tests/database/` — Postgres schema + pgTAP tests
- `tests/unit/`, `tests/components/`, `tests/fixtures/`, `tests/helpers/` — Vitest + React Testing Library

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the testing stack and the local Supabase stack this feature is the first to need (research.md §1, §10) before any test-first task can run.

- [x] T001 Verify against the npm registry that the majors named in research.md §1 (Vitest 5.0.x, `@testing-library/react` 16.3.x, `@testing-library/jest-dom` 7.0.x, `jsdom` 30.0.x) are still the current stable releases; record the confirmed versions in `specs/001-order-costing-pricing/research.md` §1 and raise any difference with Eduardo before pinning (Principles VIII and X)
- [x] T002 Add the four devDependencies from T001 to `package.json` at the confirmed versions
- [x] T003 [P] Create `vitest.config.ts` at repo root: `test.environment = "jsdom"`, `test.globals = true`, `test.setupFiles = ["tests/setup.ts"]`
- [x] T004 [P] Create `tests/setup.ts` importing `@testing-library/jest-dom/vitest`
- [x] T005 Add `"test": "vitest run"` and `"gen:types": "supabase gen types typescript --local > src/lib/database.types.ts"` scripts to `package.json`
- [x] T006 Run `supabase init` and commit the generated `supabase/config.toml` — the repo has none today, so `supabase test db`, `supabase start`, and `gen types --local` cannot run at all until this lands (research.md §10)
- [x] T007 Add `"runArgs": ["--network=host"]` to `.devcontainer/devcontainer.json` and rebuild the container, then bring the local stack up with `supabase start`, confirm the API (54321) and Studio (54323) are reachable from the host browser, and document the local-database commands in a "Local database (tests)" section of `README.md`, keeping the hosted `supabase link` + `db push` flow as the deployment path (research.md §10 — without the shared network namespace the CLI health-checks an empty loopback and stops the stack it started)
- [x] T008 Run `supabase migration new enable_pgtap` and enable the `pgtap` extension in the generated `supabase/migrations/<timestamp>_enable_pgtap.sql`
- [x] T009 Create `supabase/tests/database/000_sanity.test.sql`: a one-assertion pgTAP smoke test (`has_extension('extensions', 'pgtap')`) proving the harness is wired up, and add the `test:db` script that runs `pg_prove` against the local database; confirm it passes after T008 (research.md §11 — `supabase test db` cannot reach the tests from this container)
- [x] T010 Run `npm run gen:types` against the local stack to confirm the T005 script writes `src/lib/database.types.ts` before any feature table exists

**Checkpoint**: `npm test` and `npm run test:db` are both runnable, against a local stack that exists, before any feature code is written.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting pieces every user story's tables, RPCs, and UI depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T011 [P] Create `tests/helpers/supabaseStub.ts`: a typed stub of the `supabase-js` client (`from`, `rpc`, `auth`) that records every call, so component tests can assert both results and the **absence** of calls; it is exercised by every RTL test that follows rather than having a test of its own
- [x] T012 [P] Write pgTAP test `supabase/tests/database/010_is_allowed_user.test.sql` asserting `is_allowed_user()` returns true when `auth.jwt() ->> 'email'` matches the allowed email and false otherwise — must fail (function doesn't exist yet)
- [x] T013 Run `supabase migration new is_allowed_user_helper` and, in the generated `supabase/migrations/<timestamp>_is_allowed_user_helper.sql`, implement the `is_allowed_user()` SQL helper per research.md §4 in the generated migration; confirm T012 passes
- [x] T014 [P] Write Vitest unit test `tests/unit/units/convert.test.ts` for `convert(value, fromUnit, toUnit)` covering mass (`mg`/`g`/`kg`), volume (`ml`/`l`), and count (`un`) conversions, and asserting it throws on a cross-dimension conversion (research.md §3) — must fail
- [x] T015 Implement `src/lib/units/convert.ts` + `src/lib/units/index.ts` with the fixed unit/dimension table from data-model.md, satisfying T014
- [x] T016 [P] Write pgTAP test `supabase/tests/database/020_convert_unit.test.sql` for the mirrored Postgres `convert_unit(value, from_unit, to_unit)` function, asserting the same cases as T014 — must fail
- [x] T017 Run `supabase migration new convert_unit_function` and, in the generated `supabase/migrations/<timestamp>_convert_unit_function.sql`, create the shared `unit_of_measure` enum (`mg|g|kg|ml|l|un`, which every Phase 3+ table references) plus `unit_dimension()`, `unit_factor()`, and `convert_unit(...)` per research.md §3, mirroring T015's table exactly; confirm T016 passes
- [x] T018 [P] Write RTL test `tests/components/AppShell.test.tsx` asserting the tab shell renders four tabs (Catálogo, Estoque, Clientes, Pedidos), switches the rendered panel on tab press, and marks the active tab — must fail
- [x] T019 Implement the iOS-style tab navigation shell as `src/components/AppShell.tsx` — its own component rather than inline in `src/App.tsx`, so it can be tested without standing up the auth gate — rendering `<main className="content">` as the active tab's panel plus a bottom `.tabbar`, with the tab styles added to `src/ios.css` in its existing BEM idiom (Principle IX); `src/App.tsx` renders it inside `LoginGate`. Satisfies T018; the pt_BR tab labels are flagged for Eduardo's consent (Constitution VI / Development Workflow)
- [x] T020 [P] Scaffold `src/features/catalog/index.ts`, `src/features/stock/index.ts`, `src/features/customers/index.ts`, `src/features/orders/index.ts` per plan.md's Project Structure

**Checkpoint**: `is_allowed_user()` and `convert_unit()` exist and are tested, the client-side `convert()` is tested, the tab shell exists and is tested, and the supabase stub is ready — user story work can now begin.

---

## Phase 3: User Story 1 - Maintain the Ingredient, Material & Recipe Catalog (Priority: P1) 🎯 MVP

**Goal**: Register Ingredients and Materials in agnostic form, and Recipes composed of them with one or more named Size Variants.

**Independent Test**: Create Ingredients/Materials, create a Recipe referencing them with two differing Size Variants, deactivate an item and confirm existing references keep working — all independent of Stock or Orders.

### Schema for User Story 1

- [x] T021 [P] [US1] Write pgTAP test `supabase/tests/database/100_ingredients.test.sql` asserting RLS blocks a non-allowed user and permits the allowed user, `name` is required and unique, `unit` accepts only `mg|g|kg|ml|l|un`, and `active` defaults to true — must fail
- [x] T022 [US1] Run `supabase migration new ingredients_table` and, in the generated `supabase/migrations/<timestamp>_ingredients_table.sql`, create `ingredients` (`id` uuid pk, `name` text required unique, `unit` enum required, `active` boolean default true, `created_at`, `updated_at`) with RLS enabled and a policy using `is_allowed_user()` in the same migration (FR-001); confirm T021 passes
- [x] T023 [P] [US1] Write pgTAP test `supabase/tests/database/101_materials.test.sql` mirroring T021 for `materials` — must fail
- [x] T024 [US1] Run `supabase migration new materials_table` and, in the generated `supabase/migrations/<timestamp>_materials_table.sql`, create `materials` with the same shape and RLS as `ingredients` (FR-002); confirm T023 passes
- [x] T025 [P] [US1] Write pgTAP test `supabase/tests/database/102_recipes_and_variants.test.sql` asserting: RLS on all four tables; unique (`recipe_id`, `name`) on variants; the FK on `recipe_variant_ingredients.ingredient_id` rejects a non-existent ingredient (FR-007); the FK on `recipe_variant_materials.material_id` rejects a non-existent material; `amount` must be > 0; unique (`variant_id`, `ingredient_id`) and (`variant_id`, `material_id`); and the `touch_open_orders` trigger bumps `recipe_size_variants.updated_at` when a composition row changes (FR-021b) — must fail
- [x] T026 [US1] Run `supabase migration new recipes_and_variants` and, in the generated `supabase/migrations/<timestamp>_recipes_and_variants.sql`, create `recipes` (`id`, `name` required, `active` default true), `recipe_size_variants` (`id`, `recipe_id` fk required, `name` required, unique on (`recipe_id`,`name`)), `recipe_variant_ingredients` (`id`, `variant_id` fk required, `ingredient_id` fk required, `amount` numeric > 0 required, unique on (`variant_id`,`ingredient_id`)), `recipe_variant_materials` (same shape for materials), plus the `touch_open_orders` trigger — every table RLS-enabled via `is_allowed_user()` in this migration (FR-003–FR-007); confirm T025 passes
- [x] T027 [US1] Run `npm run gen:types` to refresh `src/lib/database.types.ts` after T022/T024/T026

### Components for User Story 1

- [X] T028 [P] [US1] Write RTL test `tests/components/catalog/IngredientForm.test.tsx` for creating and editing an Ingredient with a name and a unit of measure — must fail
- [X] T029 [P] [US1] Write RTL test `tests/components/catalog/IngredientList.test.tsx` for listing, editing, and deactivating an Ingredient, and asserting a deactivated one is hidden from new selections while remaining visible on rows that already reference it (FR-008a) — must fail
- [X] T030 [P] [US1] Write RTL test `tests/components/catalog/MaterialForm.test.tsx` mirroring T028 for Materials — must fail
- [X] T031 [P] [US1] Write RTL test `tests/components/catalog/MaterialList.test.tsx` mirroring T029 for Materials — must fail
- [X] T032 [P] [US1] Write RTL test `tests/components/catalog/RecipeForm.test.tsx` for creating and editing a Recipe and listing its Size Variants (FR-003) — must fail
- [X] T033 [P] [US1] Write RTL test `tests/components/catalog/RecipeSizeVariantEditor.test.tsx` covering: adding a Size Variant with Ingredient amounts and Material choices, adding a second variant with different amounts that coexists independently, and Ingredient/Material pickers offering only active catalog entries (FR-004–FR-007) — must fail
- [X] T034 [P] [US1] Write RTL test `tests/components/catalog/CatalogTab.test.tsx` asserting the Catálogo tab renders the Ingredient, Material, and Recipe sections and navigates between them — must fail
- [X] T035 [P] [US1] Implement `src/features/catalog/IngredientForm.tsx` satisfying T028, styled per `src/ios.css`
- [X] T036 [P] [US1] Implement `src/features/catalog/IngredientList.tsx` satisfying T029
- [X] T037 [P] [US1] Implement `src/features/catalog/MaterialForm.tsx` satisfying T030
- [X] T038 [P] [US1] Implement `src/features/catalog/MaterialList.tsx` satisfying T031
- [X] T039 [US1] Implement `src/features/catalog/RecipeForm.tsx` satisfying T032
- [X] T040 [US1] Implement `src/features/catalog/RecipeSizeVariantEditor.tsx` satisfying T033, restricting selection to existing catalog entries (FR-007 mirrored client-side)
- [X] T041 [US1] Implement `src/features/catalog/CatalogTab.tsx` and wire it into the Catálogo tab from T019, satisfying T034

**Checkpoint**: User Story 1 is fully functional and independently testable — a usable recipe book before Stock or Orders exist.

---

## Phase 4: User Story 2 - Track Real Stock as Purchased Batches (Priority: P2)

**Goal**: Link real market products to catalog Ingredients/Materials and track independent purchase Batches in canonical amounts, including a fast bulk-pack entry mode.

**Independent Test**: Link a Stock Product, register two Batches at different prices/expiration dates, register one bulk pack that auto-derives its per-package price, and register a Material batch with no expiration date — all without creating an Order.

### Schema for User Story 2

- [ ] T042 [P] [US2] Write pgTAP test `supabase/tests/database/110_stock_products.test.sql` asserting RLS, the check constraint rejecting a row with both `ingredient_id`/`material_id` set or neither set (FR-009), `package_amount` > 0, and the `assert_package_unit_dimension` trigger rejecting a `ml` product linked to a `g` Ingredient while accepting a `kg` one (FR-010) — must fail
- [ ] T043 [US2] Run `supabase migration new stock_products_table` and, in the generated `supabase/migrations/<timestamp>_stock_products_table.sql`, create `stock_products` (`id`, `name` required, `ingredient_id` fk nullable, `material_id` fk nullable, check exactly-one-of, `package_amount` numeric > 0 required, `package_unit` enum required, `created_at`, `updated_at`) plus the `assert_package_unit_dimension` trigger, with RLS; confirm T042 passes
- [ ] T044 [P] [US2] Write pgTAP test `supabase/tests/database/111_stock_batches.test.sql` asserting RLS; that `derive_batch_amounts` computes `initial_amount = packages_purchased * convert_unit(package_amount, package_unit, item unit)` (10 × 395 g = 3950 g) and defaults `remaining_amount` to it; that `expiration_date` accepts NULL for a non-perishable Material (FR-011); and the `unit_price` > 0, `packages_purchased` > 0, `remaining_amount` ≥ 0 checks — must fail
- [ ] T045 [US2] Run `supabase migration new stock_batches_table` and, in the generated `supabase/migrations/<timestamp>_stock_batches_table.sql`, create `stock_batches` (`id`, `stock_product_id` fk required, `packages_purchased` integer > 0 required, `unit_price` numeric > 0 required per package, `initial_amount` numeric > 0, `remaining_amount` numeric ≥ 0 default = `initial_amount`, `expiration_date` date **nullable**, `purchase_date`/`purchase_location` nullable, `created_at`, `updated_at`) plus the `derive_batch_amounts` trigger, with RLS (FR-011/FR-012/FR-014); confirm T044 passes
- [ ] T046 [US2] Run `npm run gen:types` to refresh `src/lib/database.types.ts` after T043/T045

### Costing helper and components for User Story 2

- [ ] T047 [P] [US2] Write Vitest unit test `tests/unit/costing/packageUnitCost.test.ts` asserting the per-canonical-unit cost of a Batch (`unit_price` ÷ package content converted via `convert()`), including a kg-product/g-ingredient case (FR-010) — must fail
- [ ] T048 [US2] Implement `src/lib/costing/packageUnitCost.ts` satisfying T047, mirroring the `cost_per_unit_amount` expression the `stock_batch_availability` view will use (T076)
- [ ] T049 [P] [US2] Write RTL test `tests/components/stock/StockProductForm.test.tsx` for linking a Stock Product to exactly one Ingredient or Material, with the package-unit picker offering only units in the linked item's dimension (FR-009/FR-010) — must fail
- [ ] T050 [P] [US2] Write RTL test `tests/components/stock/BatchForm.test.tsx` for registering a Batch (packages purchased, price per package, optional expiration date left empty for a mold, optional purchase date/location) — must fail
- [ ] T051 [P] [US2] Write RTL test `tests/components/stock/BatchList.test.tsx` asserting each Batch shows its remaining amount in the linked item's unit (not a package count) and that an expired Batch is flagged as expired (FR-014/FR-022) — must fail
- [ ] T052 [P] [US2] Write RTL test `tests/components/stock/BulkPackEntry.test.tsx` asserting that entering a pack size (24) and a total price stores `unit_price = total / 24` (FR-013) — must fail
- [ ] T053 [P] [US2] Write RTL test `tests/components/stock/StockTab.test.tsx` asserting the Estoque tab lists the shelf by catalog item and opens the product/batch forms — must fail
- [ ] T054 [P] [US2] Implement `src/features/stock/StockProductForm.tsx` satisfying T049
- [ ] T055 [P] [US2] Implement `src/features/stock/BatchForm.tsx` satisfying T050
- [ ] T056 [P] [US2] Implement `src/features/stock/BatchList.tsx` satisfying T051
- [ ] T057 [US2] Implement `src/features/stock/BulkPackEntry.tsx` satisfying T052, feeding the derived `unit_price` into the same Batch-creation path as T055
- [ ] T058 [US2] Implement `src/features/stock/StockTab.tsx` and wire it into the Estoque tab from T019, satisfying T053

**Checkpoint**: User Stories 1 AND 2 both work independently — a digital shelf that is usable on its own.

---

## Phase 5: User Story 3 - Get an Accurate, Real-Time Order Budget (Priority: P3)

**Goal**: Budget an Order's Recipe lines against real Stock (15-day-expiry then cheapest, expired excluded, Future/Pending fallback), plus labor, per-line profit %, and an order-level discount %, previewed client-side with no network round trip and committed by RPC on save.

**Independent Test**: Create an Order, add Recipe lines against existing stock, confirm the cost matches the eligible Batches and updates with no network call between edits, create a Future/Pending placeholder pre-filled with the shortfall summed across lines, and confirm the final price, per-line allocation, and per-unit price display.

### Schema for User Story 3

- [ ] T059 [P] [US3] Write pgTAP test `supabase/tests/database/120_customers.test.sql` asserting RLS and that `name`/`phone` are required — must fail
- [ ] T060 [US3] Run `supabase migration new customers_table` and, in the generated `supabase/migrations/<timestamp>_customers_table.sql`, create `customers` (`id`, `name` required, `phone` required, `created_at`, `updated_at`) with RLS (FR-017a); confirm T059 passes
- [ ] T061 [P] [US3] Write pgTAP test `supabase/tests/database/121_orders.test.sql` asserting RLS; `status` enum holds all 7 values and defaults to `awaiting_quote`; `order_date` defaults to the current date and accepts a past-date override (FR-018); `customer_id`/`summary`/`delivery_deadline` required; `labor_cost` ≥ 0 and `discount_percent` between 0 and 100; the `log_order_creation` trigger writes a `NULL → awaiting_quote` history row on insert (FR-038, SC-007); and `assert_order_mutable` rejects an UPDATE whose previous status is `consolidated` or `canceled` while permitting the write that enters a terminal status (FR-037) — must fail
- [ ] T062 [P] [US3] Write pgTAP test `supabase/tests/database/122_order_status_history_rls.test.sql` asserting the allowed user can SELECT and INSERT, that UPDATE and DELETE are denied **even for the allowed user** (FR-040), and that a non-allowed user sees nothing — must fail
- [ ] T063 [US3] Run `supabase migration new orders_and_status_history` and, in the generated `supabase/migrations/<timestamp>_orders_and_status_history.sql`, create `order_status_history` (`id`, `order_id` fk required, `previous_status` nullable, `new_status` required, `changed_at` timestamptz default now(); RLS granting INSERT/SELECT only) and `orders` exactly per data-model.md, plus the `log_order_creation` and `assert_order_mutable` triggers; confirm T061 and T062 pass
- [ ] T064 [P] [US3] Write pgTAP test `supabase/tests/database/123_order_recipe_lines.test.sql` asserting RLS, `requested_quantity` > 0, `profit_percent` ≥ 0, rejection of a `variant_id` that does not belong to the row's `recipe_id`, and that writes are rejected when the parent Order is terminal (FR-037) — must fail
- [ ] T065 [US3] Run `supabase migration new order_recipe_lines_table` and, in the generated `supabase/migrations/<timestamp>_order_recipe_lines_table.sql`, create `order_recipe_lines` (`id`, `order_id` fk required, `recipe_id` fk required, `variant_id` fk required, `requested_quantity` numeric > 0 required, `profit_percent` numeric ≥ 0 nullable, `costed_at` timestamptz nullable, `created_at`, `updated_at`) plus the variant-belongs-to-recipe and `assert_parent_order_mutable` triggers, with RLS (FR-019/FR-025); confirm T064 passes
- [ ] T066 [P] [US3] Write pgTAP test `supabase/tests/database/124_material_overrides.test.sql` asserting RLS, `amount` > 0, unique (`order_recipe_line_id`, `material_id`), and the terminal-order guard — must fail
- [ ] T067 [US3] Run `supabase migration new order_recipe_line_material_overrides_table` and, in the generated `supabase/migrations/<timestamp>_order_recipe_line_material_overrides_table.sql`, create the table per data-model.md with RLS (FR-020); confirm T066 passes
- [ ] T068 [P] [US3] Write pgTAP test `supabase/tests/database/125_future_stock_placeholders.test.sql` asserting RLS, the exactly-one-of(`ingredient_id`,`material_id`) check, `estimated_unit_price` > 0, `needed_amount` > 0, and the unique constraint allowing at most one placeholder per (`order_id`, item) so multi-line shortfalls cannot duplicate (FR-016) — must fail
- [ ] T069 [US3] Run `supabase migration new future_stock_placeholders_table` and, in the generated `supabase/migrations/<timestamp>_future_stock_placeholders_table.sql`, create the table per data-model.md with RLS (FR-015/FR-016); confirm T068 passes
- [ ] T070 [P] [US3] Write pgTAP test `supabase/tests/database/126_order_stock_reservations.test.sql` asserting RLS, exactly-one-of(`stock_batch_id`,`future_stock_placeholder_id`), exactly-one-of(`ingredient_id`,`material_id`), `reserved_amount` > 0, `unit_cost_snapshot` > 0, and `unit_cost_is_estimated` defaulting to false — must fail
- [ ] T071 [US3] Run `supabase migration new order_stock_reservations_table` and, in the generated `supabase/migrations/<timestamp>_order_stock_reservations_table.sql`, create the table per data-model.md with RLS (FR-031); confirm T070 passes

### Derived views for User Story 3

- [ ] T072 [P] [US3] Write pgTAP test `supabase/tests/database/127_views_security_invoker.test.sql` asserting all four views exist, each has `security_invoker = true`, and each returns zero rows for a non-allowed user even when the underlying tables hold data (Principle III, research.md §8) — must fail
- [ ] T073 [P] [US3] Write pgTAP test `supabase/tests/database/128_order_line_requirements.test.sql` asserting the view scales a variant's composition by `requested_quantity`, that any Material override **replaces** the variant's material defaults for that line only (FR-020), and that a count-unit (`un`) requirement is rounded up to the next whole unit (FR-021a) — must fail
- [ ] T074 [P] [US3] Write pgTAP test `supabase/tests/database/129_stock_batch_availability.test.sql` asserting `cost_per_unit_amount` = `unit_price` ÷ converted package content; `available_amount` = `remaining_amount` minus reservations from **active** Orders only, so a canceled Order's reservations free their amount and a consolidated Order's are not double-counted (FR-031, spec edge case); and the `is_expired`/`expires_soon` flags — must fail
- [ ] T075 [P] [US3] Write pgTAP test `supabase/tests/database/130_order_line_coverage.test.sql` asserting `shortfall_amount` = required minus reserved floored at 0, the `has_unresolved_placeholder` flag, and that `order_item_shortfalls` sums an item's shortfall across **every** Recipe line of the Order (FR-016) — must fail
- [ ] T076 [US3] Run `supabase migration new coverage_views` and, in the generated `supabase/migrations/<timestamp>_coverage_views.sql`, create `stock_batch_availability`, `order_line_requirements`, `order_line_coverage`, and `order_item_shortfalls` per data-model.md, every one `WITH (security_invoker = true)`; confirm T072–T075 pass

### Batch selection and RPCs for User Story 3

- [ ] T077 [P] [US3] Create the shared batch-selection scenario set as `tests/fixtures/batchSelection.ts` and its SQL twin `supabase/tests/database/fixtures/batch_selection.sql`, covering: a cheap late-expiring Batch vs. a dearer one expiring in 10 days, an already-expired Batch, two Batches tied on price and expiry, and a need larger than all Batches combined — both T078 and T080 assert against these same cases so the TypeScript and SQL orderings cannot drift (research.md §7)
- [ ] T078 [P] [US3] Write Vitest unit test `tests/unit/costing/selectBatchesForNeed.test.ts` driven by T077's fixtures: expired Batches are never drawn; Batches expiring within 15 days come first, cheapest first within that group; remaining Batches cheapest first; ties broken by expiration date then batch id; greedy draw across several Batches; leftover reported as `shortfallAmount` (FR-022) — must fail
- [ ] T079 [US3] Implement `src/lib/costing/selectBatchesForNeed.ts` satisfying T078, with `today` injected rather than read from the clock
- [ ] T080 [P] [US3] Write pgTAP test `supabase/tests/database/131_reserve_stock_for_order.test.sql` per contracts/rpc-reserve-stock-for-order.md, driven by the same T077 fixtures: identical ordering to T078; idempotent re-run rebuilds the line's reservations; a placeholder is used for the remainder only when one already exists for that Order + item, with `unit_cost_is_estimated = true`; otherwise the shortfall is returned uncovered while the real-Batch reservations are kept; `uncovered_shortfalls` is Order-wide, not line-local (FR-016); `costed_at` is set; and the call errors when the Order is not `quoting` — must fail
- [ ] T081 [US3] Run `supabase migration new reserve_stock_for_order_rpc` and, in the generated `supabase/migrations/<timestamp>_reserve_stock_for_order_rpc.sql`, implement `reserve_stock_for_order(p_order_recipe_line_id)` exactly per its contract, reading `order_line_requirements` and `stock_batch_availability`; confirm T080 passes
- [ ] T082 [P] [US3] Write pgTAP test `supabase/tests/database/132_release_reserved_stock.test.sql` per contracts/rpc-release-reserved-stock.md: deletes every reservation of the Order without touching `remaining_amount`; deletes unresolved `future_stock_placeholders` rows but preserves resolved ones; returns `released_count` — must fail
- [ ] T083 [US3] Run `supabase migration new release_reserved_stock_rpc` and, in the generated `supabase/migrations/<timestamp>_release_reserved_stock_rpc.sql`, implement `release_reserved_stock(p_order_id)` per its contract; confirm T082 passes
- [ ] T084 [P] [US3] Write pgTAP test `supabase/tests/database/133_transition_order_status_v1.test.sql` asserting `awaiting_quote → quoting` succeeds and writes a history row whose `previous_status` is the prior status; `quoting → awaiting_production` is blocked while any `order_line_coverage` row has `shortfall_amount > 0` (FR-028), blocked while any line's `costed_at` predates its variant's `updated_at` (FR-021b), and succeeds once neither holds; and any other target status is rejected as not-yet-legal — must fail
- [ ] T085 [US3] Run `supabase migration new transition_order_status_v1` and, in the generated `supabase/migrations/<timestamp>_transition_order_status_v1.sql`, implement `transition_order_status(...)` supporting exactly the `awaiting_quote→quoting` and `quoting→awaiting_production` edges with those gates, per contracts/rpc-transition-order-status.md; confirm T084 passes
- [ ] T086 [US3] Run `npm run gen:types` to refresh `src/lib/database.types.ts` after T060–T085 (six tables, four views, three functions)

### Client costing engine for User Story 3

- [ ] T087 [P] [US3] Write Vitest unit test `tests/unit/costing/scaleVariantComposition.test.ts` per contracts/costing-engine.md: scaling to `requestedQuantity`, overrides replacing the variant's materials entirely, and `un` amounts rounded up (FR-021a) — must fail
- [ ] T088 [US3] Implement `src/lib/costing/scaleVariantComposition.ts` satisfying T087
- [ ] T089 [P] [US3] Write Vitest unit test `tests/unit/costing/computeLineCost.test.ts`: ingredient vs. material subtotals, and `hasEstimatedCost` true when any draw came from a placeholder estimate — must fail
- [ ] T090 [US3] Implement `src/lib/costing/computeLineCost.ts` satisfying T089
- [ ] T091 [P] [US3] Write Vitest unit test `tests/unit/costing/computeOrderBreakdown.test.ts` per contracts/costing-engine.md: per-line profit; labor allocated in proportion to line cost and split evenly when every line's cost is 0; discount allocated in proportion to line subtotal; `pricePerUnit`; per-line figures summing back to the Order totals; matching quickstart.md's US3 hand-computed example (FR-024–FR-027) — must fail
- [ ] T092 [US3] Implement `src/lib/costing/computeOrderBreakdown.ts` satisfying T091

### Components for User Story 3

- [ ] T093 [P] [US3] Write RTL test `tests/components/customers/CustomerPicker.test.tsx` for searching/selecting an existing Customer or registering a new one (FR-017/FR-017a) — must fail
- [ ] T094 [P] [US3] Write RTL test `tests/components/customers/CustomerOrderHistory.test.tsx` asserting a Customer's past and current Orders are listed with their statuses (FR-017b) — must fail
- [ ] T095 [P] [US3] Write RTL test `tests/components/orders/OrderCreateForm.test.tsx`: creates an Order in Awaiting Quote with summary + delivery deadline, `order_date` defaulting to today and editable to a past date (FR-017/FR-018) — must fail
- [ ] T096 [P] [US3] Write RTL test `tests/components/orders/OrderRecipeLineEditor.test.tsx`: adding a Recipe line, overriding Materials for that line only (FR-020), the breakdown recomputing on every edit, and — using the T011 stub's call log — **no** `rpc` call between edits, with exactly one `reserve_stock_for_order` call on save (FR-021) — must fail
- [ ] T097 [P] [US3] Write RTL test `tests/components/orders/FutureStockPrompt.test.tsx`: when `reserve_stock_for_order` reports `uncovered_shortfalls`, the prompt pre-fills the Order-wide shortfall, and creating the placeholder re-invokes the RPC (FR-016/FR-023) — must fail
- [ ] T098 [P] [US3] Write RTL test `tests/components/orders/OrderBudgetSummary.test.tsx`: entering labor cost, per-line profit %, and an order-level discount % updates the order totals and each line's own labor allocation, discount share, and price per unit (FR-024–FR-027) — must fail
- [ ] T099 [P] [US3] Write RTL test `tests/components/orders/AdvanceToProductionAction.test.tsx`: the action surfaces the FR-028 shortfall error and the FR-021b stale-line error inline, naming what is unmet, and succeeds once neither applies — must fail
- [ ] T100 [P] [US3] Write RTL test `tests/components/orders/OrdersTab.test.tsx` asserting the Pedidos tab lists Orders by status and opens the create/budget flow — must fail
- [ ] T101 [P] [US3] Implement `src/features/customers/CustomerPicker.tsx` satisfying T093
- [ ] T102 [P] [US3] Implement `src/features/customers/CustomerOrderHistory.tsx` satisfying T094
- [ ] T103 [US3] Implement `src/features/orders/OrderCreateForm.tsx` satisfying T095
- [ ] T104 [US3] Implement `src/features/orders/OrderRecipeLineEditor.tsx` satisfying T096: previews cost through T079/T088/T090 on every edit and calls `reserve_stock_for_order` only on save, replacing the preview with the RPC's result
- [ ] T105 [US3] Implement `src/features/orders/FutureStockPrompt.tsx` satisfying T097, inserting into `future_stock_placeholders` then re-invoking `reserve_stock_for_order`
- [ ] T106 [US3] Implement `src/features/orders/OrderBudgetSummary.tsx` satisfying T098
- [ ] T107 [US3] Implement `src/features/orders/AdvanceToProductionAction.tsx` satisfying T099, calling `transition_order_status`
- [ ] T108 [US3] Implement `src/features/orders/OrdersTab.tsx` and wire it into the Pedidos tab from T019, satisfying T100

**Checkpoint**: User Stories 1, 2, and 3 all work independently — an Order can be budgeted end to end, which is the feature's core value.

---

## Phase 6: User Story 4 - Move an Order Through Production to Consolidated Actuals (Priority: P4)

**Goal**: Resolve Future/Pending stock against real purchases, move a budgeted Order through Production and Delivery to Consolidation (reconciling real vs. budgeted cost/profit), cancel from any non-terminal status, and read the full status timeline.

**Independent Test**: Take a budgeted Order through Awaiting Production (blocked until its placeholder is resolved) → In Production → Awaiting Consolidation → Consolidated, confirming a partial-package consumption and the real-vs-budgeted comparison; separately cancel an Order and confirm its stock frees up.

### Schema and RPCs for User Story 4

- [ ] T109 [P] [US4] Write pgTAP test `supabase/tests/database/140_order_stock_consumptions.test.sql` asserting RLS, `consumed_amount` > 0, and the unique (`order_recipe_line_id`, `stock_batch_id`) constraint that makes FR-034's completeness check a count comparison — must fail
- [ ] T110 [US4] Run `supabase migration new order_stock_consumptions_table` and, in the generated `supabase/migrations/<timestamp>_order_stock_consumptions_table.sql`, create the table per data-model.md with RLS; confirm T109 passes
- [ ] T111 [P] [US4] Write pgTAP test `supabase/tests/database/141_resolve_future_stock.test.sql` per contracts/rpc-resolve-future-stock.md: sets `resolved_stock_batch_id`; rewrites every reservation on that placeholder to the real Batch, keeping `reserved_amount`, keeping the quoted `unit_cost_snapshot`, and leaving `unit_cost_is_estimated` true; rejects a Batch linked to a different Ingredient/Material; rejects a Batch whose `available_amount` is short of the committed total, naming the missing amount; rejects an already-resolved placeholder; rejects a terminal Order (FR-030a) — must fail
- [ ] T112 [US4] Run `supabase migration new resolve_future_stock_rpc` and, in the generated `supabase/migrations/<timestamp>_resolve_future_stock_rpc.sql`, implement `resolve_future_stock(p_future_stock_placeholder_id, p_stock_batch_id)` per its contract; confirm T111 passes
- [ ] T113 [P] [US4] Write pgTAP test `supabase/tests/database/142_transition_order_status_v2.test.sql`: `awaiting_production → in_production` is blocked while any reservation references a `future_stock_placeholders` row and succeeds after `resolve_future_stock` (FR-030); `in_production → awaiting_consolidation` requires `p_delivered_at` and `p_payment_method` and accepts `pix`/`cash`/`deferred` (FR-032); `* → canceled` releases reservations first and is reachable from every non-terminal status (FR-036); any transition attempted from `consolidated` or `canceled` is rejected (FR-037); and T084's v1 edges still behave — must fail
- [ ] T114 [US4] Run `supabase migration new transition_order_status_v2` and, in the generated `supabase/migrations/<timestamp>_transition_order_status_v2.sql`, `CREATE OR REPLACE` the function from T085 to add the remaining edges and the terminal guard, per contracts/rpc-transition-order-status.md; confirm T113 and T084 both pass
- [ ] T115 [P] [US4] Write pgTAP test `supabase/tests/database/143_consolidate_order_stock.test.sql` per contracts/rpc-consolidate-order-stock.md: rejects a `stock_batch_id` not reserved for the line; decrements `remaining_amount` by `consumed_amount` including a partial package (395 g batch, 200 g consumed, 195 g left) and when it differs from what was reserved (FR-033); rejects a duplicate confirmation of the same (line, Batch) pair; rejects an amount that would drive `remaining_amount` negative; rejects a call when the Order is not `awaiting_consolidation`; and auto-transitions to `consolidated` once every reservation has a matching consumption (FR-034) — must fail
- [ ] T116 [US4] Run `supabase migration new consolidate_order_stock_rpc` and, in the generated `supabase/migrations/<timestamp>_consolidate_order_stock_rpc.sql`, implement `consolidate_order_stock(...)` per its contract, calling `transition_order_status` internally for the final step; confirm T115 passes
- [ ] T117 [P] [US4] Write pgTAP test `supabase/tests/database/144_terminal_order_readonly.test.sql` asserting that once an Order is `consolidated` or `canceled`, UPDATE and DELETE are rejected on `orders`, `order_recipe_lines`, `order_recipe_line_material_overrides`, and `order_stock_reservations` alike (FR-037) — must fail, then confirm the Phase 5 guards already satisfy it and add whatever is missing in `supabase migration new terminal_order_guards`
- [ ] T118 [US4] Run `npm run gen:types` to refresh `src/lib/database.types.ts` after T110–T117

### Costing and components for User Story 4

- [ ] T119 [P] [US4] Write Vitest unit test `tests/unit/costing/computeActualVsBudget.test.ts` per contracts/costing-engine.md: cost and realized-profit variance when consumption exceeds and falls short of what was reserved, `estimatedShareOfBudget`, and the per-item rows — must fail
- [ ] T120 [US4] Implement `src/lib/costing/computeActualVsBudget.ts` satisfying T119
- [ ] T121 [P] [US4] Write RTL test `tests/components/orders/FutureStockResolution.test.tsx`: lists the Order's unresolved placeholders, lets the user pick a registered Batch of the same item, calls `resolve_future_stock`, and surfaces the wrong-item and insufficient-amount errors inline (FR-030a) — must fail
- [ ] T122 [P] [US4] Write RTL test `tests/components/orders/ProductionStartAction.test.tsx`: blocked with an inline message naming the unresolved dependency, and succeeding once resolved (FR-030) — must fail
- [ ] T123 [P] [US4] Write RTL test `tests/components/orders/DeliveryPaymentForm.test.tsx`: recording delivery date and payment method (pix/cash/deferred) advances the Order to Awaiting Consolidation (FR-032) — must fail
- [ ] T124 [P] [US4] Write RTL test `tests/components/orders/ConsolidationChecklist.test.tsx`: lists only this Order's reserved items, confirms an actual amount that differs from the reserved one, and reaches Consolidated only once every item is confirmed (FR-033/FR-034) — must fail
- [ ] T125 [P] [US4] Write RTL test `tests/components/orders/BudgetVsActualSummary.test.tsx`: shows budgeted vs. actual cost and profit side by side and how much of the budget rested on estimates (FR-035, SC-004) — must fail
- [ ] T126 [P] [US4] Write RTL test `tests/components/orders/CancelOrderAction.test.tsx`: cancelling from a non-terminal status with an optional reason and impact note archives the Order and releases its stock (FR-036), and no cancel action is offered on a Consolidated Order (FR-037) — must fail
- [ ] T127 [P] [US4] Write RTL test `tests/components/orders/StatusHistoryTimeline.test.tsx`: renders every `order_status_history` row chronologically starting at the creation entry, with exact timestamps and no gaps, viewable from any Order state (FR-038/FR-039, SC-007) — must fail
- [ ] T128 [P] [US4] Write RTL test `tests/components/orders/OrderDetail.test.tsx`: offers exactly the actions legal for the Order's current status and renders a terminal Order read-only (FR-029/FR-037) — must fail
- [ ] T129 [P] [US4] Implement `src/features/orders/FutureStockResolution.tsx` satisfying T121
- [ ] T130 [P] [US4] Implement `src/features/orders/ProductionStartAction.tsx` satisfying T122, calling `transition_order_status`
- [ ] T131 [P] [US4] Implement `src/features/orders/DeliveryPaymentForm.tsx` satisfying T123
- [ ] T132 [US4] Implement `src/features/orders/ConsolidationChecklist.tsx` satisfying T124, calling `consolidate_order_stock` per confirmed item
- [ ] T133 [US4] Implement `src/features/orders/BudgetVsActualSummary.tsx` satisfying T125, using T120
- [ ] T134 [P] [US4] Implement `src/features/orders/CancelOrderAction.tsx` satisfying T126, calling `transition_order_status` with `p_new_status = 'canceled'`
- [ ] T135 [P] [US4] Implement `src/features/orders/StatusHistoryTimeline.tsx` satisfying T127
- [ ] T136 [US4] Implement `src/features/orders/OrderDetail.tsx` wiring T129–T135 into the Order screen from T108, satisfying T128

**Checkpoint**: All four user stories are independently functional; the lifecycle runs from Awaiting Quote to Consolidated (or Canceled) end to end.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T137 [P] Write `docs/conventions.md` documenting the conventions this feature establishes: the `is_allowed_user()` RLS helper, RPC-for-atomicity, `security_invoker` on every view, canonical amounts vs. package counts, the mirrored `convert`/`convert_unit` and `selectBatchesForNeed`/`ORDER BY` pairs and how their shared fixtures keep them honest, and the Vitest/pgTAP split (Constitution Principle XI)
- [ ] T138 Collect every pt_BR string introduced across T035–T136 into `docs/ui-strings.md` and present it to Eduardo for consent before shipping (Constitution VI / Development Workflow) — a review checkpoint, not code
- [ ] T139 Run `npm run lint`, `npm run build`, `npm test`, and `npm run test:db`; fix any failures (Development Workflow gate)
- [ ] T140 Execute quickstart.md's four manual validation scenarios end to end against the local stack, recording the outcome on the feature PR and folding any deviation back into `specs/001-order-costing-pricing/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T006/T007 (`supabase init`, `supabase start`) block every pgTAP task in the repo.
- **Foundational (Phase 2)**: Depends on **all** of Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only; independent of US1's tables, though both share the nav shell from T019.
- **User Story 3 (Phase 5)**: Depends on Foundational, and on US1 and US2 having created `recipe_size_variants` and `stock_batches`, which its FKs and its `order_line_requirements`/`stock_batch_availability` views reference. Note that `stock_batch_availability` is created here rather than in US2, because `available_amount` is defined against `order_stock_reservations`; US2's shelf UI reads `stock_batches.remaining_amount` directly and stays independently deliverable.
- **User Story 4 (Phase 6)**: Depends on User Story 3 — it extends `transition_order_status` and the reservation machinery, and cannot be built first.
- **Polish (Phase 7)**: Depends on all four user stories.

### Within Each User Story

- Each test task is written and confirmed **failing** before the implementation task that follows it.
- Tables before the views that read them; views before the RPCs that read the views; RPCs before the UI that calls them.
- `npm run gen:types` runs after every phase that adds migrations (T027, T046, T086, T118), so no component is written against stale generated types (Principle V).
- Story complete and checkpoint-validated before moving to the next priority.

### Parallel Opportunities

- Setup: T003 and T004 can run together; everything else in Phase 1 is sequential.
- Foundational: T011, T012, T014, T016, T018, and T020 can run together once Phase 1 is **complete** — T012/T016 need the pgTAP stack from T006–T009, and T014/T018 need the Vitest config from T003–T005.
- Within a user story, all test tasks marked [P] are independent files and can be written together; implementation tasks marked [P] touch different files and can follow together once their tests fail.
- User Story 1 and User Story 2 (Phases 3–4) can be built in parallel by different sessions once Phase 2 is done — their tables and components do not intersect.
- User Story 4 cannot run in parallel with User Story 3.

---

## Parallel Example: User Story 1

```bash
# Write all failing tests for User Story 1 together:
Task: "pgTAP ingredients test in supabase/tests/database/100_ingredients.test.sql"
Task: "pgTAP materials test in supabase/tests/database/101_materials.test.sql"
Task: "pgTAP recipes/variants test in supabase/tests/database/102_recipes_and_variants.test.sql"
Task: "RTL IngredientForm test in tests/components/catalog/IngredientForm.test.tsx"
Task: "RTL IngredientList test in tests/components/catalog/IngredientList.test.tsx"
Task: "RTL MaterialForm test in tests/components/catalog/MaterialForm.test.tsx"
Task: "RTL MaterialList test in tests/components/catalog/MaterialList.test.tsx"

# Once they fail as expected, run the independent implementations together:
Task: "Implement IngredientForm in src/features/catalog/IngredientForm.tsx"
Task: "Implement IngredientList in src/features/catalog/IngredientList.tsx"
Task: "Implement MaterialForm in src/features/catalog/MaterialForm.tsx"
Task: "Implement MaterialList in src/features/catalog/MaterialList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 — Catalog).
3. **STOP and VALIDATE**: run the US1 Independent Test and quickstart.md's US1 scenario.
4. This alone is a usable "recipe book," even before Stock or Orders exist.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate independently (MVP).
3. User Story 2 → validate independently (digital shelf, usable standalone).
4. User Story 3 → validate independently (accurate order pricing — the reason this feature exists).
5. User Story 4 → validate independently (closes the loop to real cost and profit).
6. Polish (Phase 7).

Each story adds value without breaking the previous ones; per spec.md, US3 is the primary reason this feature exists, so it should not be deferred long after US1/US2 land.

---

## Notes

- [P] tasks touch different files with no unmet dependency.
- [Story] labels map every user-story-phase task to US1–US4 for traceability.
- Every test task MUST be run and confirmed **failing** before its paired implementation task starts (Constitution Principle I, non-negotiable). No implementation task in this list is unpaired.
- Commit after each task or logical group; `npm run build` and `npm run lint` MUST pass before any commit is considered done (Development Workflow).
- Per the Development Workflow, these tasks MUST be pushed to GitHub Issues via `/speckit-taskstoissues` after this file is generated, and implementation MUST go through a PR reviewed via `/code-review` (or `ultrareview` for larger changes) before merging to `main`.
