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

## Catalog entities (User Story 1)

### `ingredients`
- `id` (uuid, pk)
- `name` (text, required, unique)
- `unit` (enum of all units above, required) — this Ingredient's canonical unit
- `active` (boolean, default true) — deactivated Ingredients are hidden from new Recipe composition but remain valid for historical Orders/Recipes that already reference them (edge case: deactivation must not break existing references)
- `created_at`, `updated_at`

### `materials`
- `id` (uuid, pk)
- `name` (text, required, unique)
- `unit` (enum of all units above, required)
- `active` (boolean, default true)
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
- `quantity` (numeric > 0, required) — in the Ingredient's own `unit`
- Unique on (`variant_id`, `ingredient_id`)
- **Validation**: FR-007 — insert/update rejected (fk constraint) if `ingredient_id` doesn't exist

### `recipe_variant_materials`
- `id` (uuid, pk)
- `variant_id` (fk → recipe_size_variants, required)
- `material_id` (fk → materials, required)
- `quantity` (numeric > 0, required) — in the Material's own `unit`
- Unique on (`variant_id`, `material_id`)

## Stock entities (User Story 2)

### `stock_products`
- `id` (uuid, pk)
- `name` (text, required) — the real market product's label
- `ingredient_id` (fk → ingredients, nullable)
- `material_id` (fk → materials, nullable)
- **Validation**: exactly one of `ingredient_id` / `material_id` is set (check constraint) — FR-009
- `package_amount` (numeric > 0, required) — the linked item's weight/volume/count per package
- `package_unit` (enum of all units, required) — must be in the same dimension as the linked Ingredient's/Material's `unit`; converted via `convert_unit(...)` wherever compared (FR-010)
- `created_at`, `updated_at`

### `stock_batches`
- `id` (uuid, pk)
- `stock_product_id` (fk → stock_products, required)
- `unit_price` (numeric > 0, required) — price paid per package
- `quantity_purchased` (integer > 0, required)
- `quantity_remaining` (integer ≥ 0, required, default = `quantity_purchased` at insert)
- `expiration_date` (date, required)
- `purchase_date` (date, nullable)
- `purchase_location` (text, nullable)
- `created_at`, `updated_at`
- **Note**: the "bulk pack" quick-entry (FR-013) is a UI-level convenience that computes `unit_price = total_price / pack_size` before this row is inserted; it is not a separate schema concept.

### `future_stock_placeholders`
- `id` (uuid, pk)
- `order_id` (fk → orders, required) — the Order whose shortfall triggered it (FR-016)
- `ingredient_id` (fk → ingredients, nullable)
- `material_id` (fk → materials, nullable)
- **Validation**: exactly one of `ingredient_id` / `material_id` is set
- `estimated_unit_price` (numeric > 0, required) — user-entered (FR-015)
- `needed_quantity` (numeric > 0, required) — auto-calculated sum of shortfall across the Order's Recipe lines (FR-016), in the linked item's canonical unit
- `resolved_stock_batch_id` (fk → stock_batches, nullable) — set once the user registers a real Batch that covers this shortfall, unblocking FR-030's production gate
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

### `order_recipe_lines`
- `id` (uuid, pk)
- `order_id` (fk → orders, required)
- `recipe_id` (fk → recipes, required)
- `variant_id` (fk → recipe_size_variants, required)
- `requested_quantity` (numeric > 0, required) — FR-019
- `profit_percent` (numeric ≥ 0, nullable) — FR-025
- `created_at`, `updated_at`
- **Validation**: `variant_id` must belong to `recipe_id` (check via trigger or application-level validation)

### `order_recipe_line_material_overrides`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `material_id` (fk → materials, required)
- `quantity` (numeric > 0, required)
- Presence of any row here for a line means: use these Materials instead of the Recipe Size Variant's defaults for cost/consumption purposes on this line only (FR-020)

### `order_stock_reservations`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `stock_batch_id` (fk → stock_batches, nullable)
- `future_stock_placeholder_id` (fk → future_stock_placeholders, nullable)
- **Validation**: exactly one of `stock_batch_id` / `future_stock_placeholder_id` is set
- `reserved_quantity` (numeric > 0, required) — in canonical unit
- `unit_cost_snapshot` (numeric > 0, required) — the price used at Budgeting time, frozen so a later real-purchase price doesn't silently change an already-quoted Order (see spec Assumptions)
- `created_at`
- Written/deleted only via the `reserve_stock_for_order` / `release_reserved_stock` RPCs (see contracts/), never directly, so `quantity_remaining` on `stock_batches` always stays consistent with reservations

### `order_stock_consumptions`
- `id` (uuid, pk)
- `order_recipe_line_id` (fk → order_recipe_lines, required)
- `stock_batch_id` (fk → stock_batches, required)
- `consumed_quantity` (numeric > 0, required)
- `confirmed_at` (timestamptz, required, default now())
- Written only via the `consolidate_order_stock` RPC (FR-033)

### `order_status_history`
- `id` (uuid, pk)
- `order_id` (fk → orders, required)
- `previous_status` (enum as in `orders.status`, nullable — null for the initial row)
- `new_status` (enum as in `orders.status`, required)
- `changed_at` (timestamptz, required, default now())
- Insert-only: no `updated_at`, and application/RLS policy grants `INSERT`/`SELECT` but never `UPDATE`/`DELETE` (FR-038/FR-040)
- Written automatically by the `transition_order_status` RPC, never directly by the client (guarantees FR-038 fires for every transition without relying on client discipline)

## State transitions: Order status

```
awaiting_quote --(FR-019 begins budgeting)--> quoting
quoting --(FR-028: every line costed)--> awaiting_production
awaiting_production --(FR-030: manual + all real stock)--> in_production
in_production --(delivery recorded)--> awaiting_consolidation
awaiting_consolidation --(FR-034: all items confirmed)--> consolidated

any of {awaiting_quote, quoting, awaiting_production, in_production, awaiting_consolidation}
  --(FR-036: user cancels)--> canceled

consolidated: terminal, no further transitions (including no cancellation, per spec edge case resolution)
canceled: terminal, no further transitions (FR-037)
```

Every arrow above is executed via the `transition_order_status` RPC (see contracts/), which both performs the status update and writes the corresponding `order_status_history` row in the same transaction.

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
orders 1───* future_stock_placeholders
orders 1───* order_status_history
```
