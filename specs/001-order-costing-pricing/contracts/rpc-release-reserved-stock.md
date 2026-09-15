# Contract: `release_reserved_stock` (Postgres RPC)

Called when an Order is canceled (FR-036) or when a Recipe line is removed/edited enough to need its reservations rebuilt.

## Invocation

```ts
const { data, error } = await supabase.rpc('release_reserved_stock', {
  p_order_id: string, // uuid — releases every reservation across every line of this Order
});
```

## Behavior

For every `order_stock_reservations` row belonging to any `order_recipe_lines` row of the given Order:
1. If it references a `stock_batches` row, no `quantity_remaining` adjustment is needed (reservations do not decrement `quantity_remaining` directly — see note below) — the reservation row is simply deleted, freeing that quantity for other Orders' `reserve_stock_for_order` calls.
2. If it references a `future_stock_placeholders` row, the placeholder row is deleted along with the reservation, unless it has already been `resolved_stock_batch_id`-linked (in which case only the reservation is removed).
3. All deletions happen in a single transaction.

**Note on `quantity_remaining`**: `stock_batches.quantity_remaining` is only decremented by `consolidate_order_stock` (real consumption), never by reservation. Reservations are tracked separately (`order_stock_reservations`) and `reserve_stock_for_order` treats a Batch's *available* quantity as `quantity_remaining` minus the sum of other Orders' active reservations against it, so releasing a reservation here requires no compensating update to `stock_batches` itself.

## Output

```ts
{ released_count: number }
```

## Errors

- `order_id` not found → error, no changes made.
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
