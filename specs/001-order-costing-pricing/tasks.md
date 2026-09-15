---

description: "Task list template for feature implementation"
---

# Tasks: Order Costing & Pricing

> **⚠️ STALE — regenerate before implementing.** This task list was generated against the first version of the design. After `/speckit-analyze`, spec.md, plan.md, data-model.md, contracts/ and quickstart.md were revised (canonical-unit stock accounting, client-side cost preview with RPC-on-save, the `resolve_future_stock` path, coverage views, the Order-creation history entry) and six implementation tasks here have no paired test, violating Principle I. Run `/speckit-tasks` to regenerate, then `/speckit-taskstoissues`.

**Input**: Design documents from `/specs/001-order-costing-pricing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included and REQUIRED — Constitution Principle I (Test-First Development) is NON-NEGOTIABLE for this project: every failing test MUST exist before its implementation task.

**Organization**: Tasks are grouped by user story (P1–P4 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task description

## Path Conventions

Single Vite/React project (no `backend/`) per plan.md's Project Structure:

- `src/lib/`, `src/features/`, `src/components/` — frontend
- `supabase/migrations/`, `supabase/tests/database/` — Postgres schema + pgTAP tests
- `tests/unit/`, `tests/components/` — Vitest + React Testing Library

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the testing stack this feature is the first to need (research.md §1) before any test-first task can run.

- [ ] T001 Add `vitest@^5.0.0`, `@testing-library/react@^16.3.0`, `@testing-library/jest-dom@^7.0.0`, and `jsdom@^30.0.0` as devDependencies in `package.json` (pinned versions per research.md §1)
- [ ] T002 [P] Create `vitest.config.ts` at repo root: `test.environment = "jsdom"`, `test.globals = true`, `test.setupFiles = ["tests/setup.ts"]`
- [ ] T003 [P] Create `tests/setup.ts` importing `@testing-library/jest-dom/vitest`
- [ ] T004 Add `"test": "vitest run"` and `"gen:types": "supabase gen types typescript --local > src/lib/database.types.ts"` scripts to `package.json`
- [ ] T005 Run `supabase migration new enable_pgtap` and enable the `pgtap` extension in the generated `supabase/migrations/<timestamp>_enable_pgtap.sql`
- [ ] T006 Create `supabase/tests/database/000_sanity.test.sql`: a one-assertion pgTAP smoke test (`has_extension('pgtap')`) proving `supabase test db` is wired up; confirm it passes after T005

**Checkpoint**: `npm test` and `supabase test db` are both runnable before any feature code exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting pieces every user story's tables/RPCs/UI depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 [P] Write pgTAP test `supabase/tests/database/010_is_allowed_user.test.sql` asserting `is_allowed_user()` returns true when `auth.jwt() ->> 'email'` matches the allowed email and false otherwise — must fail (function doesn't exist yet)
- [ ] T008 Run `supabase migration new is_allowed_user_helper` and implement the `is_allowed_user()` SQL helper per research.md §4 in the generated migration; confirm T007 passes
- [ ] T009 [P] Write Vitest unit test `tests/unit/units/convert.test.ts` for `convert(value, fromUnit, toUnit)` covering mass (`mg`/`g`/`kg`), volume (`ml`/`l`), count (`un`) conversions, and asserting it throws on a cross-dimension conversion (research.md §3) — must fail
- [ ] T010 Implement `src/lib/units/convert.ts` + `src/lib/units/index.ts` with the fixed unit/dimension table from data-model.md, satisfying T009
- [ ] T011 [P] Write pgTAP test `supabase/tests/database/020_convert_unit.test.sql` for the mirrored Postgres `convert_unit(value, from_unit, to_unit)` function (same dimension table as T010) — must fail
- [ ] T012 Run `supabase migration new convert_unit_function` and implement `convert_unit(...)` per research.md §3, mirroring T010's table exactly; confirm T011 passes
- [ ] T013 [P] Add an iOS-style tab navigation shell to `src/App.tsx` (tabs: Catálogo, Estoque, Clientes, Pedidos) reusing `src/ios.css` conventions (Principle IX) inside the existing `<main className="content" />`, rendering an empty placeholder per tab; flag the pt_BR tab labels for Eduardo's consent before shipping (Constitution VI / Development Workflow)
- [ ] T014 [P] Scaffold `src/features/catalog/index.ts`, `src/features/stock/index.ts`, `src/features/customers/index.ts`, `src/features/orders/index.ts` per plan.md's Project Structure
- [ ] T015 Run `npm run gen:types` once to confirm the script from T004 works against the current (empty) schema

**Checkpoint**: `is_allowed_user()` and `convert_unit()` exist and are tested, the client-side `convert()` is tested, the nav shell exists, and type generation is wired — user story work can now begin.

---

## Phase 3: User Story 1 - Maintain the Ingredient, Material & Recipe Catalog (Priority: P1) 🎯 MVP

**Goal**: Register Ingredients and Materials in agnostic form, and Recipes composed of them with one or more named Size Variants.

**Independent Test**: Create Ingredients/Materials, create a Recipe referencing them with two differing Size Variants, and confirm the data is saved and editable — independent of Stock or Orders.

### Tests for User Story 1

- [ ] T016 [P] [US1] Write pgTAP test `supabase/tests/database/100_ingredients_rls.test.sql` asserting RLS blocks a non-allowed user and permits the allowed user to insert/select `ingredients` — must fail
- [ ] T018 [P] [US1] Write pgTAP test `supabase/tests/database/101_materials_rls.test.sql` mirroring T016 for `materials` — must fail
- [ ] T020 [P] [US1] Write pgTAP test `supabase/tests/database/102_recipes_and_variants.test.sql` asserting: `recipes`/`recipe_size_variants` RLS; unique constraint on (`recipe_id`, `name`) for variants; the FK on `recipe_variant_ingredients.ingredient_id` rejects a non-existent ingredient (FR-007); the FK on `recipe_variant_materials.material_id` rejects a non-existent material — must fail
- [ ] T023 [P] [US1] Write RTL test `tests/components/catalog/IngredientForm.test.tsx` for creating an Ingredient with a name and a unit of measure (mass/volume/count) — must fail
- [ ] T025 [P] [US1] Write RTL test `tests/components/catalog/MaterialForm.test.tsx` mirroring T023 for Materials — must fail
- [ ] T027 [P] [US1] Write RTL test `tests/components/catalog/RecipeForm.test.tsx` covering: creating a Recipe, adding a Size Variant with Ingredient quantities and Material choices, and adding a second Size Variant with different quantities that coexists independently (FR-003–FR-006) — must fail

### Implementation for User Story 1

- [ ] T017 [US1] Run `supabase migration new ingredients_table` and create `ingredients` (`id` uuid pk, `name` text required unique, `unit` enum of `mg|g|kg|ml|l|un` required, `active` boolean default true, `created_at`, `updated_at`) with RLS enabled and a policy using `is_allowed_user()` in the same migration (FR-001); confirm T016 passes
- [ ] T019 [US1] Run `supabase migration new materials_table` and create `materials` with the same shape as `ingredients` (FR-002), RLS via `is_allowed_user()`; confirm T018 passes
- [ ] T021 [US1] Run `supabase migration new recipes_and_variants` and create `recipes` (`id`, `name` required, `active` default true), `recipe_size_variants` (`id`, `recipe_id` fk required, `name` required, unique on (`recipe_id`,`name`)), `recipe_variant_ingredients` (`id`, `variant_id` fk required, `ingredient_id` fk required, `quantity` numeric > 0 required, unique on (`variant_id`,`ingredient_id`)), `recipe_variant_materials` (`id`, `variant_id` fk required, `material_id` fk required, `quantity` numeric > 0 required, unique on (`variant_id`,`material_id`)) — every table RLS-enabled via `is_allowed_user()` in this migration (FR-003–FR-007); confirm T020 passes
- [ ] T022 [US1] Run `npm run gen:types` to refresh `src/lib/database.types.ts` after T017/T019/T021
- [ ] T024 [P] [US1] Implement `src/features/catalog/IngredientForm.tsx` + `src/features/catalog/IngredientList.tsx` (create/edit/deactivate, FR-001) satisfying T023, styled per `src/ios.css`
- [ ] T026 [P] [US1] Implement `src/features/catalog/MaterialForm.tsx` + `src/features/catalog/MaterialList.tsx` (FR-002) satisfying T025
- [ ] T028 [US1] Implement `src/features/catalog/RecipeForm.tsx` + `src/features/catalog/RecipeSizeVariantEditor.tsx` satisfying T027, restricting Ingredient/Material selection to what already exists in the catalog (FR-007 mirrored client-side)
- [ ] T029 [US1] Wire the Phase 3 screens into the "Catálogo" tab from T013

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Track Real Stock as Purchased Batches (Priority: P2)

**Goal**: Link real market products to catalog Ingredients/Materials and track independent purchase Batches, including a fast bulk-pack entry mode.

**Independent Test**: Link a Stock Product, register two Batches with different prices/expiration dates, and register one bulk pack that auto-derives its per-unit price — all without creating an Order.

### Tests for User Story 2

- [ ] T030 [P] [US2] Write pgTAP test `supabase/tests/database/110_stock_products.test.sql` asserting RLS and the check constraint rejecting a row with both `ingredient_id`/`material_id` set or neither set (FR-009) — must fail
- [ ] T032 [P] [US2] Write pgTAP test `supabase/tests/database/111_stock_batches.test.sql` asserting RLS, `quantity_remaining` defaulting to `quantity_purchased` on insert, and positive-value checks on `unit_price`/`quantity_purchased` — must fail
- [ ] T035 [P] [US2] Write Vitest unit test `tests/unit/units/packageConversion.test.ts` verifying a Stock Product's `package_amount`/`package_unit` converts correctly to its linked Ingredient's/Material's canonical unit via `convert()` (FR-010), including a kg-product/g-ingredient case — must fail
- [ ] T037 [P] [US2] Write RTL test `tests/components/stock/StockProductForm.test.tsx` for linking a Stock Product to exactly one Ingredient or Material and registering a Batch (package amount/unit, unit price, quantity, expiration date, optional purchase date/location) — must fail
- [ ] T039 [P] [US2] Write RTL test `tests/components/stock/BulkPackEntry.test.tsx` asserting that entering a pack size (e.g., 24) and total price derives and stores `unit_price = total / 24` (FR-013) — must fail

### Implementation for User Story 2

- [ ] T031 [US2] Run `supabase migration new stock_products_table` and create `stock_products` (`id`, `name` required, `ingredient_id` fk nullable, `material_id` fk nullable, check exactly-one-of, `package_amount` numeric > 0 required, `package_unit` enum required, `created_at`, `updated_at`) with RLS; confirm T030 passes
- [ ] T033 [US2] Run `supabase migration new stock_batches_table` and create `stock_batches` (`id`, `stock_product_id` fk required, `unit_price` numeric > 0 required, `quantity_purchased` integer > 0 required, `quantity_remaining` integer ≥ 0 defaulting to `quantity_purchased`, `expiration_date` date required, `purchase_date`/`purchase_location` nullable, `created_at`, `updated_at`) with RLS (FR-011/FR-012); confirm T032 passes
- [ ] T034 [US2] Run `npm run gen:types` to refresh types after T031/T033
- [ ] T036 [US2] Implement `src/lib/costing/packageUnitCost.ts`, deriving an Ingredient's/Material's per-canonical-unit cost from a Stock Batch using `convert()` (T010), satisfying T035
- [ ] T038 [P] [US2] Implement `src/features/stock/StockProductForm.tsx` + `src/features/stock/BatchList.tsx` satisfying T037 (FR-009–FR-012)
- [ ] T040 [US2] Implement `src/features/stock/BulkPackEntry.tsx` satisfying T039, feeding the derived `unit_price` into the same Batch-creation path as T038
- [ ] T041 [US2] Wire the Phase 4 screens into the "Estoque" tab from T013

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Get an Accurate, Real-Time Order Budget (Priority: P3)

**Goal**: Budget an Order's Recipe lines against real Stock (with 15-day-expiry/cheapest priority and Future/Pending fallback), plus labor, per-line profit %, and order-level discount %, computed live with no network round trip per keystroke.

**Independent Test**: Create an Order, add a Recipe line against existing stock, confirm the computed cost matches the cheapest/soonest-expiring eligible Batches, enter labor/profit/discount, and confirm the final price and margin display and update instantly.

### Tests for User Story 3

- [ ] T042 [P] [US3] Write pgTAP test `supabase/tests/database/120_customers_rls.test.sql` for `customers` RLS — must fail
- [ ] T044 [P] [US3] Write pgTAP test `supabase/tests/database/121_orders_table.test.sql` asserting RLS, `status` defaulting to `awaiting_quote`, `order_date` defaulting to the current date while accepting a past-date override (FR-018), and a required `customer_id` FK — must fail
- [ ] T046 [P] [US3] Write pgTAP test `supabase/tests/database/122_order_recipe_lines.test.sql` asserting RLS, `requested_quantity > 0`, and rejection of a `variant_id` that does not belong to the row's `recipe_id` — must fail
- [ ] T048 [P] [US3] Write pgTAP test `supabase/tests/database/123_material_overrides.test.sql` for `order_recipe_line_material_overrides` RLS + `quantity > 0` — must fail
- [ ] T050 [P] [US3] Write pgTAP test `supabase/tests/database/124_future_stock_placeholders.test.sql` asserting RLS and the exactly-one-of(`ingredient_id`,`material_id`) check constraint — must fail
- [ ] T052 [P] [US3] Write pgTAP test `supabase/tests/database/125_order_stock_reservations.test.sql` asserting RLS and the exactly-one-of(`stock_batch_id`,`future_stock_placeholder_id`) check constraint — must fail
- [ ] T054 [P] [US3] Write pgTAP test `supabase/tests/database/130_reserve_stock_for_order.test.sql` per contracts/rpc-reserve-stock-for-order.md: idempotent re-run releases prior reservations; batches ordered by 15-day-expiry then cheapest (FR-022); greedy multi-batch consumption; uncovered shortfall returned when no matching `future_stock_placeholders` row exists yet; error when the line's Order is not `quoting` — must fail
- [ ] T056 [P] [US3] Write pgTAP test `supabase/tests/database/131_release_reserved_stock.test.sql` per contracts/rpc-release-reserved-stock.md: deletes reservations without touching `quantity_remaining`; deletes unresolved `future_stock_placeholders` rows but preserves resolved ones — must fail
- [ ] T058 [P] [US3] Write pgTAP test `supabase/tests/database/132_transition_order_status_v1.test.sql` asserting `awaiting_quote → quoting` succeeds and writes an `order_status_history` row; `quoting → awaiting_production` is blocked while any line has an uncovered shortfall (FR-028) and succeeds once none remain; any other requested target status is rejected as not-yet-legal — must fail
- [ ] T060 [P] [US3] Write Vitest unit test `tests/unit/costing/scaleVariantComposition.test.ts` per contracts/costing-engine.md — must fail
- [ ] T062 [P] [US3] Write Vitest unit test `tests/unit/costing/computeLineCost.test.ts` per contracts/costing-engine.md — must fail
- [ ] T064 [P] [US3] Write Vitest unit test `tests/unit/costing/computeOrderBreakdown.test.ts` per contracts/costing-engine.md, matching quickstart.md's US3 hand-computed example — must fail
- [ ] T066 [P] [US3] Write RTL test `tests/components/customers/CustomerPicker.test.tsx` for searching/selecting an existing Customer or registering a new one (name/phone) (FR-017/FR-017a) — must fail
- [ ] T068 [P] [US3] Write RTL test `tests/components/orders/OrderCreateForm.test.tsx`: creates an Order in Awaiting Quote with summary + delivery deadline; `order_date` defaults to today and is editable to a past date (FR-018) — must fail
- [ ] T070 [P] [US3] Write RTL test `tests/components/orders/OrderRecipeLineEditor.test.tsx`: adding a Recipe line, overriding Materials for that line only (FR-020), and seeing the cost breakdown recompute instantly on any input change (FR-021) — must fail
- [ ] T072 [P] [US3] Write RTL test `tests/components/orders/FutureStockPrompt.test.tsx`: when `reserve_stock_for_order` returns `uncovered_shortfalls`, the UI prompts creating a Future/Pending placeholder pre-filled with the exact shortfall (FR-016/FR-023) — must fail
- [ ] T074 [P] [US3] Write RTL test `tests/components/orders/OrderBudgetSummary.test.tsx`: entering labor cost, per-line profit %, and order-level discount % updates the displayed breakdown and final price live (FR-024–FR-027) — must fail

### Implementation for User Story 3

- [ ] T043 [US3] Run `supabase migration new customers_table` and create `customers` (`id`, `name` required, `phone` required, `created_at`, `updated_at`) with RLS (FR-017a); confirm T042 passes
- [ ] T045 [US3] Run `supabase migration new orders_table` and create `orders` exactly per data-model.md (`customer_id` fk required, `summary` required, `order_date` default = current date, `delivery_deadline` required, `status` enum with all 7 values defaulting to `awaiting_quote`, `labor_cost` nullable ≥ 0, `discount_percent` nullable 0–100, `delivered_at`, `payment_method` enum, `cancel_reason`, `cancel_impact_note`, `created_at`, `updated_at`) with RLS (FR-017/FR-018/FR-029); confirm T044 passes
- [ ] T047 [US3] Run `supabase migration new order_recipe_lines_table` and create `order_recipe_lines` (`id`, `order_id` fk required, `recipe_id` fk required, `variant_id` fk required, `requested_quantity` numeric > 0 required, `profit_percent` nullable ≥ 0, `created_at`, `updated_at`) plus a trigger validating `variant_id` belongs to `recipe_id`, with RLS (FR-019/FR-025); confirm T046 passes
- [ ] T049 [US3] Run `supabase migration new order_recipe_line_material_overrides_table` and create the table per data-model.md with RLS (FR-020); confirm T048 passes
- [ ] T051 [US3] Run `supabase migration new future_stock_placeholders_table` and create the table per data-model.md (FR-015/FR-016) with RLS; confirm T050 passes
- [ ] T053 [US3] Run `supabase migration new order_stock_reservations_table` and create the table per data-model.md with RLS; confirm T052 passes
- [ ] T055 [US3] Run `supabase migration new reserve_stock_for_order_rpc` and implement `reserve_stock_for_order(p_order_recipe_line_id)` exactly per contracts/rpc-reserve-stock-for-order.md, using `convert_unit()` (T012) for unit-compatible comparisons; confirm T054 passes
- [ ] T057 [US3] Run `supabase migration new release_reserved_stock_rpc` and implement `release_reserved_stock(p_order_id)` per the contract; confirm T056 passes
- [ ] T059 [US3] Run `supabase migration new order_status_history_and_transition_v1` and create `order_status_history` per data-model.md (RLS granting INSERT/SELECT only, never UPDATE/DELETE — FR-040) plus `transition_order_status(p_order_id, p_new_status, ...)` supporting exactly the `awaiting_quote→quoting` and `quoting→awaiting_production` edges (FR-029/FR-038); confirm T058 passes
- [ ] T061 [US3] Implement `src/lib/costing/scaleVariantComposition.ts` satisfying T060
- [ ] T063 [US3] Implement `src/lib/costing/computeLineCost.ts` satisfying T062
- [ ] T065 [US3] Implement `src/lib/costing/computeOrderBreakdown.ts` satisfying T064
- [ ] T067 [P] [US3] Implement `src/features/customers/CustomerPicker.tsx` + `src/features/customers/CustomerOrderHistory.tsx` (FR-017b) satisfying T066
- [ ] T069 [US3] Implement `src/features/orders/OrderCreateForm.tsx` satisfying T068
- [ ] T071 [US3] Implement `src/features/orders/OrderRecipeLineEditor.tsx`, calling `reserve_stock_for_order` (T055) on line add/edit and feeding the result through T061/T063/T065, satisfying T070
- [ ] T073 [US3] Implement `src/features/orders/FutureStockPrompt.tsx` satisfying T072, inserting into `future_stock_placeholders` (T051) then re-invoking `reserve_stock_for_order`
- [ ] T075 [US3] Implement `src/features/orders/OrderBudgetSummary.tsx` satisfying T074
- [ ] T076 [US3] Wire the "Advance to Awaiting Production" action to call `transition_order_status` (T059), surfacing the FR-028 blocking error inline when unmet
- [ ] T077 [US3] Wire the Phase 5 screens (Customer picker, Order create form, budgeting screen) into the "Pedidos" tab from T013

**Checkpoint**: User Stories 1, 2, and 3 all work independently — an Order can be fully budgeted end to end.

---

## Phase 6: User Story 4 - Move an Order Through Production to Consolidated Actuals (Priority: P4)

**Goal**: Move a budgeted Order through Production, Delivery, and Consolidation (reconciling real vs. budgeted cost/profit), plus cancellation from any non-terminal status and a full status-history timeline.

**Independent Test**: Take a budgeted Order through Awaiting Production (blocked until real stock) → In Production → Awaiting Consolidation → Consolidated, viewing the real-vs-budgeted comparison; separately, cancel an Order and confirm its reserved stock is released.

### Tests for User Story 4

- [ ] T078 [P] [US4] Write pgTAP test `supabase/tests/database/140_transition_order_status_v2.test.sql` extending T058's coverage: `awaiting_production → in_production` blocked while any reservation references an unresolved `future_stock_placeholders` row (FR-030) and succeeds once resolved; `* → canceled` releases reservations via `release_reserved_stock` first (FR-036) and is reachable from every non-terminal status; a transition attempted from `consolidated` or `canceled` is rejected (FR-037) — must fail
- [ ] T080 [P] [US4] Write pgTAP test `supabase/tests/database/141_order_stock_consumptions.test.sql` for `order_stock_consumptions` RLS + `consumed_quantity > 0` — must fail
- [ ] T082 [P] [US4] Write pgTAP test `supabase/tests/database/142_consolidate_order_stock.test.sql` per contracts/rpc-consolidate-order-stock.md: rejects a `stock_batch_id` not reserved for the line; decrements `quantity_remaining` by `consumed_quantity` (may differ from reserved, FR-033); rejects a call when the parent Order is not `awaiting_consolidation`; rejects a `consumed_quantity` that would drive `quantity_remaining` negative; auto-transitions the Order to `consolidated` once every reservation has a matching consumption (FR-034) — must fail
- [ ] T084 [P] [US4] Write RTL test `tests/components/orders/ProductionStartAction.test.tsx`: starting production is blocked with an inline message while a Future/Pending dependency remains, and succeeds once resolved (FR-030) — must fail
- [ ] T086 [P] [US4] Write RTL test `tests/components/orders/ConsolidationForm.test.tsx`: recording delivery date + payment method (pix/cash/deferred) advances to Awaiting Consolidation (FR-032); confirming actual consumption per reserved item, filtered to the Order, deducts stock and only reaches Consolidated once every item is confirmed (FR-033/FR-034), then shows budgeted-vs-actual cost/profit (FR-035) — must fail
- [ ] T088 [P] [US4] Write RTL test `tests/components/orders/CancelOrderAction.test.tsx`: canceling from any non-terminal status with an optional reason/impact note archives the Order read-only and releases its reserved stock (FR-036); a Consolidated Order offers no cancel action (FR-037) — must fail
- [ ] T090 [P] [US4] Write RTL test `tests/components/orders/StatusHistoryTimeline.test.tsx`: renders every `order_status_history` row chronologically with exact timestamps and no gaps, viewable from any Order state (FR-038/FR-039, SC-007) — must fail

### Implementation for User Story 4

- [ ] T079 [US4] Run `supabase migration new transition_order_status_v2` and `CREATE OR REPLACE` the function from T059 to add the `awaiting_production→in_production`, `in_production→awaiting_consolidation`, and `*→canceled` edges plus the terminal-state guard, per contracts/rpc-transition-order-status.md; confirm T078 (and T058) still pass
- [ ] T081 [US4] Run `supabase migration new order_stock_consumptions_table` and create the table per data-model.md with RLS; confirm T080 passes
- [ ] T083 [US4] Run `supabase migration new consolidate_order_stock_rpc` and implement `consolidate_order_stock(...)` per the contract, calling `transition_order_status` (T079) internally for the final step; confirm T082 passes
- [ ] T085 [US4] Implement `src/features/orders/ProductionStartAction.tsx` satisfying T084, calling `transition_order_status`
- [ ] T087 [US4] Implement `src/features/orders/DeliveryPaymentForm.tsx` + `src/features/orders/ConsolidationChecklist.tsx` + `src/features/orders/BudgetVsActualSummary.tsx` satisfying T086, calling `transition_order_status` (delivery step) and `consolidate_order_stock` (T083) per confirmed item
- [ ] T089 [US4] Implement `src/features/orders/CancelOrderAction.tsx` satisfying T088, calling `transition_order_status` with `p_new_status = 'canceled'`
- [ ] T091 [US4] Implement `src/features/orders/StatusHistoryTimeline.tsx` satisfying T090
- [ ] T092 [US4] Wire T085/T087/T089/T091 into the Order detail screen from T077

**Checkpoint**: All four user stories are independently functional; the full lifecycle from Awaiting Quote to Consolidated (or Canceled) works end to end.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T093 [P] Write `docs/conventions.md` documenting the RLS-helper pattern, RPC-for-atomicity pattern, unit-conversion approach, and testing approach adopted in research.md (Constitution Principle XI)
- [ ] T094 Present the full set of pt_BR UI strings introduced across T024–T091 to Eduardo for consent before shipping (Constitution VI / Development Workflow) — a review checkpoint, not code
- [ ] T095 Run `npm run lint`, `npm run build`, `npm test`, and `supabase test db`; fix any failures (Development Workflow gate)
- [ ] T096 Execute quickstart.md's four manual validation scenarios (US1–US4) end-to-end against a local Supabase stack and record the results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only (independent of US1's tables, though the app's nav shell from T013 is shared).
- **User Story 3 (Phase 5)**: Depends on Foundational, and reads Recipes/Size Variants (US1) and Stock Batches (US2) at runtime — build after US1 and US2 for a meaningful Order budget, though its own tables/RPCs have no schema dependency on US1/US2's tables beyond FKs to `recipes`/`recipe_size_variants`/`stock_batches` already existing.
- **User Story 4 (Phase 6)**: Depends on User Story 3 (extends its `orders`/`transition_order_status`/reservation machinery — cannot be built first).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- pgTAP/Vitest/RTL tests are written and confirmed failing before their corresponding implementation task.
- Tables before RPCs that reference them; RPCs before the UI that calls them.
- Story complete and checkpoint-validated before moving to the next priority.

### Parallel Opportunities

- All Setup [P] tasks (T002, T003) can run together.
- All Foundational [P] tasks (T007, T009, T011, T013, T014) can run together once T001/T004 land.
- Within Phase 3/4, all listed "Tests for User Story N" tasks are [P] against each other (independent files); their matching implementation tasks are sequential relative to their own test but [P] against sibling implementation tasks in different files (e.g., T024 and T026).
- User Story 1 and User Story 2 (Phases 3–4) can be built in parallel by different sessions once Phase 2 is done, since their tables/components don't intersect.
- User Story 4 (Phase 6) cannot start in parallel with User Story 3 — it extends US3's `transition_order_status` function and tables.

---

## Parallel Example: User Story 1

```bash
# Launch all pgTAP/RTL tests for User Story 1 together:
Task: "pgTAP RLS test for ingredients in supabase/tests/database/100_ingredients_rls.test.sql"
Task: "pgTAP RLS test for materials in supabase/tests/database/101_materials_rls.test.sql"
Task: "pgTAP test for recipes/variants in supabase/tests/database/102_recipes_and_variants.test.sql"
Task: "RTL test for IngredientForm in tests/components/catalog/IngredientForm.test.tsx"
Task: "RTL test for MaterialForm in tests/components/catalog/MaterialForm.test.tsx"
Task: "RTL test for RecipeForm in tests/components/catalog/RecipeForm.test.tsx"

# Once tests fail as expected, launch independent implementation tasks together:
Task: "Implement IngredientForm/IngredientList in src/features/catalog/"
Task: "Implement MaterialForm/MaterialList in src/features/catalog/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 — Catalog).
3. **STOP and VALIDATE**: run the US1 Independent Test from spec.md.
4. This alone is a usable "recipe book," even before Stock or Orders exist.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate independently (MVP).
3. User Story 2 → validate independently (digital shelf, usable standalone).
4. User Story 3 → validate independently (the feature's core value: accurate order pricing).
5. User Story 4 → validate independently (closes the loop to real cost/profit).
6. Polish (Phase 7).

Each story adds value without breaking the previous ones; per spec.md, US3 is the primary reason this feature exists, so it should not be deferred long after US1/US2 land.

---

## Notes

- [P] tasks touch different files with no unmet dependency.
- [Story] labels map every user-story-phase task to US1–US4 for traceability.
- Every test task MUST be run and confirmed **failing** before its paired implementation task starts (Constitution Principle I, non-negotiable).
- Commit after each task or logical group; `npm run build` and `npm run lint` MUST pass before any commit is considered done (Development Workflow).
- Per the Development Workflow, these tasks MUST be pushed to GitHub Issues via `/speckit-taskstoissues` after this file is generated, and implementation MUST go through a PR reviewed via `/code-review` (or `ultrareview` for larger changes) before merging to `main`.
