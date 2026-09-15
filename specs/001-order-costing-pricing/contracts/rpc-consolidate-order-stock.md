# Contract: `consolidate_order_stock` (Postgres RPC)

Called repeatedly from the Consolidation screen (User Story 4) as the user confirms actual consumption per reserved item (FR-033), and completing the Order automatically when the last one is confirmed (FR-034).

## Invocation

```ts
const { data, error } = await supabase.rpc('consolidate_order_stock', {
  p_order_recipe_line_id: string, // uuid
  p_stock_batch_id: string,       // uuid — must be one this line actually reserved
  p_consumed_amount: number,      // actual amount used, in the item's canonical unit;
                                  // may differ from what was reserved
});
```

By the time an Order reaches `awaiting_consolidation`, every one of its reservations references a real Batch — placeholders were rewritten by `resolve_future_stock` before production could start — so every confirmation is a plain (line, Batch) pair.

## Behavior

1. Validates `p_stock_batch_id` was reserved for `p_order_recipe_line_id` (via `order_stock_reservations`); rejects otherwise.
2. Inserts an `order_stock_consumptions` row with `consumed_amount` and `confirmed_at = now()`. The unique (line, Batch) constraint makes re-confirming the same pair an error rather than a silent double deduction.
3. Decrements `stock_batches.remaining_amount` by `consumed_amount` — same unit on both sides (data-model.md, "Amounts vs. packages"), so a 200 g draw from a 395 g can leaves 195 g. The amount may differ from what was reserved; that difference is precisely what FR-035's comparison reports.
4. Checks whether every `order_stock_reservations` row for the parent Order now has a matching `order_stock_consumptions` row; if so, calls `transition_order_status` internally to move the Order to `consolidated` (FR-034).
5. Runs in a single transaction per call.

## Output

```ts
{
  consumption_recorded: boolean,
  order_fully_consolidated: boolean, // true if this call completed FR-034 and transitioned the Order
}
```

## Errors

- `p_stock_batch_id` was not reserved for `p_order_recipe_line_id` → error, no changes made.
- Parent Order is not in `awaiting_consolidation` status → error.
- This (line, Batch) pair was already confirmed → error.
- `p_consumed_amount` would drive `remaining_amount` negative → error (data-entry mistake guard).
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
