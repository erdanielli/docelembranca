# Contract: `consolidate_order_stock` (Postgres RPC)

Called repeatedly from the Consolidation screen (User Story 4) as the user confirms actual consumption per reserved item (FR-033), and once more implicitly when the last item is confirmed to complete the transition (FR-034).

## Invocation

```ts
const { data, error } = await supabase.rpc('consolidate_order_stock', {
  p_order_recipe_line_id: string, // uuid
  p_stock_batch_id: string,       // uuid — must be one this line actually reserved
  p_consumed_quantity: number,    // actual amount used, may differ from reserved_quantity
});
```

## Behavior

1. Validates `stock_batch_id` was reserved for `order_recipe_line_id` (via `order_stock_reservations`); rejects otherwise.
2. Inserts an `order_stock_consumptions` row with the given `consumed_quantity` and `confirmed_at = now()`.
3. Decrements `stock_batches.quantity_remaining` by `consumed_quantity` (allowed to differ from what was reserved — the spec's real-vs-budgeted comparison depends on this).
4. Checks whether every `order_stock_reservations` row for the parent Order now has a matching `order_stock_consumptions` confirmation; if so, calls `transition_order_status` internally to move the Order to `consolidated` (FR-034).
5. Runs in a single transaction per call.

## Output

```ts
{
  consumption_recorded: boolean,
  order_fully_consolidated: boolean, // true if this call completed FR-034 and transitioned the Order
}
```

## Errors

- `stock_batch_id` was not reserved for `order_recipe_line_id` → error, no changes made.
- Parent Order is not in `awaiting_consolidation` status → error.
- `consumed_quantity` would drive `quantity_remaining` negative → error (data-entry mistake guard).
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
