# Contract: `reserve_stock_for_order` (Postgres RPC)

The authoritative counterpart to the client's live preview (costing-engine.md). Called from the Order Budgeting screen (User Story 3) when a Recipe line is **saved** — added, or edited in a way that changes its need (quantity, variant, material overrides) — not on every keystroke, since FR-021's live figures come from the client-side preview instead.

## Invocation

```ts
const { data, error } = await supabase.rpc('reserve_stock_for_order', {
  p_order_recipe_line_id: string, // uuid
});
```

## Behavior

Requirements come from the `order_line_requirements` view (data-model.md), which already scales the variant composition to `requested_quantity`, substitutes Material overrides (FR-020), and rounds count-unit materials up (FR-021a). For each required Ingredient/Material of the line:

1. Delete any reservations this line already holds, so the call is idempotent on re-run.
2. Select eligible rows from `stock_batch_availability` for that item: `available_amount > 0` and not expired (`is_expired = false` — expired stock is never chosen automatically, FR-022). Order by `expires_soon DESC`, then `cost_per_unit_amount ASC`, then `expiration_date ASC NULLS LAST`, then `stock_batch_id` — the same total order `selectBatchesForNeed` applies, ties included.

   Both flags arrive already `coalesce`d to `false` for an undated Batch from the view itself (data-model.md), which is what keeps this step correct for Materials: `is_expired = false` still matches them, so they are not silently filtered out of selection, and `expires_soon = false` places them in the cheapest-first group instead of ahead of it. The explicit `NULLS LAST` on the `expiration_date` tie-break is required for the same reason — under PostgreSQL's ASC default an undated Batch would *win* a price tie against a dated one, when FR-011 says it should lose it.
3. Draw greedily in that order, writing one `order_stock_reservations` row per Batch drawn from, with `reserved_amount` in the item's canonical unit and `unit_cost_snapshot` = that Batch's `cost_per_unit_amount`.
4. If the Batches cannot cover the full need and a `future_stock_placeholders` row already exists for this Order + item, write one reservation against it for the remainder, with `unit_cost_snapshot` = its `estimated_unit_price` and `unit_cost_is_estimated = true`.
5. If no such placeholder exists, the remainder stays **uncovered**: the real-Batch reservations from step 3 are kept, and the shortfall is reported in the result so the client can prompt the user to create the placeholder (FR-023).
6. Set the line's `costed_at = now()`, which clears FR-021b's "needs recalculation" flag for it.

**Atomicity**: one transaction per call. Either the line's reservations are entirely rebuilt (real Batches, plus a placeholder reservation where one exists) or nothing changes. A reported shortfall is a normal, committed outcome — a partially covered line — not a rollback; FR-028's gate, not this call, is what stops a partially covered Order from advancing.

## Output

```ts
{
  reservations: Array<{
    ingredient_id: string | null,
    material_id: string | null,
    stock_batch_id: string | null,
    future_stock_placeholder_id: string | null,
    reserved_amount: number,
    unit_cost_snapshot: number,
    unit_cost_is_estimated: boolean,
  }>,
  uncovered_shortfalls: Array<{
    ingredient_id: string | null,
    material_id: string | null,
    shortfall_amount: number, // Order-wide, in canonical unit
  }>,
}
```

`uncovered_shortfalls` is read from the `order_item_shortfalls` view, so each figure is the shortfall for that item summed across **every** Recipe line of the Order, not just the line being reserved. That is exactly the quantity FR-016 requires the new placeholder to be pre-filled with, and it stays correct as the user works line by line.

## Errors

- `order_recipe_line_id` not found, or its Order is not in `quoting` status → error, no changes made.
- The line's Order is `consolidated` or `canceled` → rejected by the terminal-order guard (FR-037).
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
