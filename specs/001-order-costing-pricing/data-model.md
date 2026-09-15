# Phase 1 Data Model: Order Costing & Pricing

All tables live in Supabase Postgres, one creating migration per table (or tightly-coupled group), each enabling RLS and attaching a policy built on the shared `is_allowed_user()` helper (see research.md §4) in that same migration, per Principle III. All identifiers are en_US per Principle VI; user-facing labels shown in the UI are a separate pt_BR concern handled at implementation time.

## Measurement dimensions & units

A fixed, small set, referenced by `unit` columns below:

| Dimension | Units |
|---|---|
| mass | `mg`, `g`, `kg` |
| volume | `ml`, `l` |
| count | `un` |

Conversion is only ever valid within the same dimension (see research.md §3).

## Amounts vs. packages (the one invariant to keep straight)

Every quantity of an Ingredient/Material — what a Recipe line needs, what is reserved, what is consumed, what is left in a Batch — is an **amount in that item's own canonical `unit`** and lives in a column named `*_amount` (numeric). The only place a *package count* appears is `stock_batches.packages_purchased`, which describes the purchase, not the shelf: it is an input for deriving the Batch's starting amount and its per-unit cost, and is never subtracted from or compared against an amount (research.md §7).

This matters because a 395 g can used for 200 g of brigadeiro leaves 195 g, which a whole-package counter cannot express — and FR-014 requires exactly that partial remainder to be tracked.

## Catalog entities (User Story 1)

### `ingredients`
- `id` (uuid, pk)
- `name` (text, required, unique)
- `unit` (enum of all units above, required) — this Ingredient's canonical unit
- `active` (boolean, default true) — deactivated Ingredients are hidden from new Recipe composition and new Order selections but remain fully valid for the Recipes, Orders, and Stock Products that already reference them (FR-008a)
- `created_at`, `updated_at`

### `materials`
- `id` (uuid, pk)
- `name` (text, required, unique)
- `unit` (enum of all units above, required)
- `active` (boolean, default true) — same semantics as `ingredients.active` (FR-008a)
- `created_at`, `updated_at`

### `recipes`
- `id` (uuid, pk)
- `name` (text, required)
- `active` (boolean, default true)
- `created_at`, `updated_at`

### `recipe_size_variants`
- `id` (uuid, pk)
- `recipe_id` (fk → recipes, required)
- `name` (text, required) — e.g. "Traditional Party Size"
- `created_at`, `updated_at`
- Unique on (`recipe_id`, `name`)

### `recipe_variant_ingredients`
- `id` (uuid, pk)
- `variant_id` (fk → recipe_size_variants, required)
- `ingredient_id` (fk → ingredients, required)
- `amount` (numeric > 0, required) — per produced unit, in the Ingredient's own `unit`
- Unique on (`variant_id`, `ingredient_id`)
- **Validation**: FR-007 — insert/update rejected (fk constraint) if `ingredient_id` doesn't exist
- **Trigger** (`touch_open_orders`): an insert/update/delete here bumps `updated_at` on the parent `recipe_size_variants` row, which is what FR-021b's "needs recalculation" flag compares against (see `order_recipe_lines.costed_at`)

### `recipe_variant_materials`
- `id` (uuid, pk)
- `variant_id` (fk → recipe_size_variants, required)
- `material_id` (fk → materials, required)
- `amount` (numeric > 0, required) — per produced unit, in the Material's own `unit`
- Unique on (`variant_id`, `material_id`)
- Same `touch_open_orders` trigger as above (FR-021b)

## Stock entities (User Story 2)

### `stock_products`
- `id` (uuid, pk)
- `name` (text, required) — the real market product's label
- `ingredient_id` (fk → ingredients, nullable)
- `material_id` (fk → materials, nullable)
- **Validation**: exactly one of `ingredient_id` / `material_id` is set (check constraint) — FR-009
- `package_amount` (numeric > 0, required) — the linked item's weight/volume/count per package
- `package_unit` (enum of all units, required)
- **Validation** (trigger `assert_package_unit_dimension`): `package_unit` MUST share a measurement dimension with the linked Ingredient's/Material's `unit`, so a `ml` product can never be attached to a `g` ingredient (FR-010). A cross-table rule, so a check constraint cannot express it; the trigger fires on insert and update.
- `created_at`, `updated_at`

### `stock_batches`
- `id` (uuid, pk)
- `stock_product_id` (fk → stock_products, required)
- `packages_purchased` (integer > 0, required) — how many packages this purchase brought in (FR-011)
- `unit_price` (numeric > 0, required) — price paid **per package** (FR-011); the bulk-pack quick entry (FR-013) derives it as `total_price / pack_size` in the UI before insert, so it is not a separate schema concept
- `initial_amount` (numeric > 0, required) — the Batch's starting content in the linked item's canonical unit, computed by trigger `derive_batch_amounts` as `packages_purchased * convert_unit(package_amount, package_unit, item.unit)`; immutable afterwards, so a later edit to the product's `package_amount` cannot silently rewrite history
- `remaining_amount` (numeric ≥ 0, required, default = `initial_amount`) — reduced only by `consolidate_order_stock` (FR-014); reservations never touch it
- `expiration_date` (date, **nullable**) — NULL means "does not expire", which is the normal case for Materials such as molds and mats (FR-011); a NULL-dated Batch never qualifies for FR-022's expiry priority
- `purchase_date` (date, nullable)
- `purchase_location` (text, nullable)
- `created_at`, `updated_at`

## Customer & Order entities (User Stories 3 & 4)

### `customers`
- `id` (uuid, pk)
- `name` (text, required)
- `phone` (text, required)
- `created_at`, `updated_at`
- (FR-017a/FR-017b: reusable across Orders, with an Order list derivable via `orders.customer_id`)

### `orders`
- `id` (uuid, pk)
- `customer_id` (fk → customers, required)
- `summary` (text, required) — free-text request summary (Awaiting Quote step)
- `order_date` (date, required, default = current date, user-editable incl. past dates — FR-018)
- `delivery_deadline` (date, required)
- `status` (enum: `awaiting_quote`, `quoting`, `awaiting_production`, `in_production`, `awaiting_consolidation`, `consolidated`, `canceled`; default `awaiting_quote`)
- `labor_cost` (numeric ≥ 0, nullable) — FR-024
- `discount_percent` (numeric 0–100, nullable) — FR-026
- `delivered_at` (date, nullable) — set entering Awaiting Consolidation (FR-032)
- `payment_method` (enum: `pix`, `cash`, `deferred`, nullable) — FR-032, informational only
- `cancel_reason` (text, nullable) — FR-036
- `cancel_impact_note` (text, nullable) — FR-036
- `created_at`, `updated_at`
- **Trigger** (`log_order_creation`, AFTER INSERT): writes the opening `order_status_history` row (`previous_status` NULL → `new_status` `awaiting_quote`) so the timeline starts at creation with no gap (FR-038, SC-007)
- **Trigger** (`assert_order_mutable`, BEFORE UPDATE/DELETE): rejects any change when the row's **previous** status is already `consolidated` or `canceled` — entering a terminal status is allowed, editing afterwards is not (FR-037)

### `order_recipe_lines`
- `id` (uuid, pk)
- `order_id` (fk → orders, required)
- `recipe_id` (fk → recipes, required)
- `variant_id` (fk → recipe_size_variants, required)
- `requested_quantity` (numeric > 0, required) — FR-019
- `profit_percent` (numeric ≥ 0, nullable) — FR-025
- `costed_at` (timestamptz, nullable) — when `reserve_stock_for_order` last ran for this line; compared against `recipe_size_variants.updated_at` to raise FR-021b's "needs recalculation" flag
- `created_at`, `updated_at`
- **Validation** (trigger): `variant_id` must belong to `recipe_id`
- **Trigger** (`assert_parent_order_mutable`): rejects writes when the parent Order is `consolidated` or `canceled` (FR-037); applies equally to `order_recipe_line_material_overrides` and `order_stock_reservations`

### `order_recipe_line_material_overrides`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `material_id` (fk → materials, required)
- `amount` (numeric > 0, required) — per produced unit, in the Material's own `unit`
- Unique on (`order_recipe_line_id`, `material_id`)
- Presence of **any** row here for a line replaces the Recipe Size Variant's material defaults **entirely** for that line, for cost and consumption purposes, without affecting other Orders (FR-020)

### `future_stock_placeholders`
- `id` (uuid, pk)
- `order_id` (fk → orders, required) — the Order whose shortfall triggered it (FR-016)
- `ingredient_id` (fk → ingredients, nullable)
- `material_id` (fk → materials, nullable)
- **Validation**: exactly one of `ingredient_id` / `material_id` is set
- Unique on (`order_id`, `ingredient_id`) and on (`order_id`, `material_id`) — at most one placeholder per Order per item, so multi-line shortfalls aggregate instead of duplicating (FR-016)
- `estimated_unit_price` (numeric > 0, required) — user-entered, **per canonical unit** of the linked item (FR-015)
- `needed_amount` (numeric > 0, required) — the Order-wide shortfall summed across every Recipe line, read from the `order_item_shortfalls` view at creation time (FR-016)
- `resolved_stock_batch_id` (fk → stock_batches, nullable) — set by `resolve_future_stock` once the real purchase is registered, which also rewrites the dependent reservations onto that Batch (FR-030a)
- `created_at`, `updated_at`

### `order_stock_reservations`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `ingredient_id` (fk → ingredients, nullable) / `material_id` (fk → materials, nullable) — exactly one set; denormalized from the batch/placeholder so coverage can be computed without walking `stock_products` (FR-028's gate reads this on every transition)
- `stock_batch_id` (fk → stock_batches, nullable)
- `future_stock_placeholder_id` (fk → future_stock_placeholders, nullable)
- **Validation**: exactly one of `stock_batch_id` / `future_stock_placeholder_id` is set
- `reserved_amount` (numeric > 0, required) — in the item's canonical unit
- `unit_cost_snapshot` (numeric > 0, required) — cost **per canonical unit** at Budgeting time, frozen so a later purchase price never silently rewrites an already-quoted Order (see spec Assumptions)
- `unit_cost_is_estimated` (boolean, default false) — true when the figure came from a Future/Pending placeholder's estimate; **survives** `resolve_future_stock`, which is what lets FR-035 say honestly which parts of the quote were guesses
- `created_at`
- Written/deleted only via the `reserve_stock_for_order` / `release_reserved_stock` / `resolve_future_stock` RPCs (see contracts/), never directly

### `order_stock_consumptions`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `stock_batch_id` (fk → stock_batches, required)
- `consumed_amount` (numeric > 0, required) — in the item's canonical unit, directly comparable to `stock_batches.remaining_amount`
- `confirmed_at` (timestamptz, required, default now())
- Unique on (`order_recipe_line_id`, `stock_batch_id`) — one confirmation per reserved pair, which is what makes FR-034's completeness check a simple count comparison
- Written only via the `consolidate_order_stock` RPC (FR-033)

### `order_status_history`
- `id` (uuid, pk)
- `order_id` (fk → orders, required)
- `previous_status` (enum as in `orders.status`, nullable — NULL only on the creation row)
- `new_status` (enum as in `orders.status`, required)
- `changed_at` (timestamptz, required, default now())
- Insert-only: no `updated_at`, and the RLS policy grants `INSERT`/`SELECT` but never `UPDATE`/`DELETE` (FR-038/FR-040)
- Written by the `log_order_creation` trigger (opening row) and the `transition_order_status` RPC (every subsequent row), never directly by the client

## Derived views (the single source of truth for coverage)

All views are created `WITH (security_invoker = true)` so the querying user's RLS policies still apply — a view is otherwise evaluated as its owner and would become a hole in Principle III.

### `stock_batch_availability`
One row per Batch, resolving everything batch selection needs:
- `stock_batch_id`, `ingredient_id`/`material_id`, `unit` (the item's canonical unit)
- `remaining_amount`
- `reserved_amount` — sum of `order_stock_reservations.reserved_amount` against this Batch from **active** Orders only (`quoting`, `awaiting_production`, `in_production`, `awaiting_consolidation`); canceled Orders have had theirs deleted, and consolidated Orders have already had their real consumption deducted from `remaining_amount`
- `available_amount` = `remaining_amount` − `reserved_amount` (FR-031; this is what stops two open Orders from double-booking the same Batch)
- `cost_per_unit_amount` = `unit_price / convert_unit(package_amount, package_unit, unit)` — price per canonical unit
- `is_expired` = `expiration_date < current_date`
- `expires_soon` = `expiration_date` between today and `current_date + 15 days`

### `order_line_requirements`
One row per (Recipe line × Ingredient/Material), the scaled need:
- ingredients: `recipe_variant_ingredients.amount * requested_quantity`
- materials: the line's `order_recipe_line_material_overrides` when it has any, otherwise `recipe_variant_materials`, scaled the same way (FR-020)
- `required_amount`, rounded **up** to a whole number when the item's `unit` is `un` (FR-021a)

### `order_line_coverage`
`order_line_requirements` left-joined to the line's reservations:
- `reserved_amount`, `shortfall_amount` = `greatest(required_amount − reserved_amount, 0)`
- `has_estimated_cost`, `has_unresolved_placeholder`
This is what `transition_order_status` reads for the FR-028 and FR-030 gates, rather than trusting a value the client passed in (research.md §8).

### `order_item_shortfalls`
`order_line_coverage` aggregated to (`order_id`, item): `sum(shortfall_amount)` — the Order-wide figure FR-016 pre-fills a placeholder with.

## State transitions: Order status

```
(order created) --(log_order_creation trigger)--> awaiting_quote
awaiting_quote --(FR-019 begins budgeting)--> quoting
quoting --(FR-028: order_line_coverage shows no shortfall)--> awaiting_production
awaiting_production --(FR-030: manual + no reservation on a placeholder)--> in_production
in_production --(delivery recorded)--> awaiting_consolidation
awaiting_consolidation --(FR-034: all items confirmed)--> consolidated

any of {awaiting_quote, quoting, awaiting_production, in_production, awaiting_consolidation}
  --(FR-036: user cancels)--> canceled

consolidated: terminal, read-only (FR-037)
canceled: terminal, read-only (FR-037)
```

Every arrow except the first is executed via the `transition_order_status` RPC (see contracts/), which performs the status update and writes the `order_status_history` row in the same transaction; the first is the `log_order_creation` trigger, so the timeline has no gap at its start (SC-007).

`resolve_future_stock` is not a status transition: it rewrites placeholder-backed reservations onto a real Batch (FR-030a), which is what eventually lets the `awaiting_production → in_production` gate pass.

## Entity relationship summary

```
customers 1───* orders
recipes 1───* recipe_size_variants
recipe_size_variants 1───* recipe_variant_ingredients ───* ingredients
recipe_size_variants 1───* recipe_variant_materials ───* materials
ingredients 1───* stock_products ───* stock_batches
materials 1───* stock_products ───* stock_batches
orders 1───* order_recipe_lines ───1 recipe_size_variants
order_recipe_lines 1───* order_recipe_line_material_overrides ───* materials
order_recipe_lines 1───* order_stock_reservations ───1 (stock_batches | future_stock_placeholders)
order_recipe_lines 1───* order_stock_consumptions ───1 stock_batches
orders 1───* future_stock_placeholders ───0..1 stock_batches (resolved_stock_batch_id)
orders 1───* order_status_history
```
