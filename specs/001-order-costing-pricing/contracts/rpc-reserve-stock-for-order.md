# Contract: `reserve_stock_for_order` (Postgres RPC)

Called from the Order Budgeting screen (User Story 3) whenever a Recipe line's ingredient/material need must be matched against Stock Batches and turned into a reservation, per FR-021/FR-022/FR-031.

## Invocation

```ts
const { data, error } = await supabase.rpc('reserve_stock_for_order', {
  p_order_recipe_line_id: string, // uuid
});
```

## Behavior

For the given `order_recipe_line_id`, and for every Ingredient/Material required by its Recipe Size Variant (scaled to `requested_quantity`, minus any Material overrides applied per FR-020):

1. Release any reservations this line already holds (idempotent re-run when the user edits quantity/variant/overrides).
2. Select eligible `stock_batches` for that Ingredient/Material (`quantity_remaining > 0`), ordered by: (a) `expiration_date <= now() + 15 days` first, (b) then lowest `unit_price` — per FR-022.
3. Greedily consume Batches in that order until the need is fully covered, writing one `order_stock_reservations` row per Batch drawn from, with `unit_cost_snapshot` = that Batch's `unit_price` (converted to the need's canonical unit — research.md §3).
4. If Batches are insufficient to cover the full need, write a single `order_stock_reservations` row referencing a `future_stock_placeholders` row for the shortfall (per FR-016/FR-023) — but only if one already exists for this Order+Ingredient/Material combination; otherwise, return the shortfall to the caller uncovered (see Errors) so the client can prompt the user to create it (FR-023).
5. All of the above happens in a single transaction — either the line ends up fully reserved (real batches + future placeholder as needed) or nothing changes.

## Output

```ts
{
  reservations: Array<{
    ingredient_id: string | null,
    material_id: string | null,
    stock_batch_id: string | null,
    future_stock_placeholder_id: string | null,
    reserved_quantity: number,
    unit_cost_snapshot: number,
  }>,
  uncovered_shortfalls: Array<{
    ingredient_id: string | null,
    material_id: string | null,
    shortfall_quantity: number, // in canonical unit
  }>,
}
```

## Errors

- `order_recipe_line_id` not found, or its Order is not in `quoting` status → error, no changes made.
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
