# Contract: `release_reserved_stock` (Postgres RPC)

Called when an Order is canceled (FR-036), and internally by `reserve_stock_for_order` when a line's reservations must be rebuilt.

## Invocation

```ts
const { data, error } = await supabase.rpc('release_reserved_stock', {
  p_order_id: string, // uuid — releases every reservation across every line of this Order
});
```

## Behavior

For every `order_stock_reservations` row belonging to any `order_recipe_lines` row of the given Order:

1. The reservation row is deleted. No `stock_batches.remaining_amount` adjustment is needed or wanted (see the note below) — deleting the row is itself what frees the amount for other Orders.
2. If it referenced a `future_stock_placeholders` row, that placeholder is deleted too, unless it has already been resolved (`resolved_stock_batch_id IS NOT NULL`), in which case it is kept as a record of what was estimated and what was eventually bought.
3. All deletions happen in a single transaction.

**Note on amounts**: `stock_batches.remaining_amount` is decremented only by `consolidate_order_stock`, when stock is really used. Reservations live in their own table, and `stock_batch_availability.available_amount` is defined as `remaining_amount` minus the reservations of **still-active** Orders (`quoting`, `awaiting_production`, `in_production`, `awaiting_consolidation`). So releasing a reservation needs no compensating write, and an Order leaving the active set — by cancellation here, or by reaching `consolidated` after its real consumption was deducted — stops holding stock automatically, with no double counting either way.

## Output

```ts
{ released_count: number }
```

## Errors

- `order_id` not found → error, no changes made.
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
