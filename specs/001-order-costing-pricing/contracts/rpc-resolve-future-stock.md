# Contract: `resolve_future_stock` (Postgres RPC)

Called from the Stock screen or from the Order's production gate (User Story 4) once the confectioner has actually bought what a Future/Pending placeholder stood for (FR-030a). This is the step that lets an Order which was quoted with an estimate reach production — without it, any Order that ever needed a placeholder would be stuck in Awaiting Production forever.

## Invocation

```ts
const { data, error } = await supabase.rpc('resolve_future_stock', {
  p_future_stock_placeholder_id: string, // uuid
  p_stock_batch_id: string,              // uuid — the Batch actually purchased
});
```

## Behavior

1. Validates the placeholder is still unresolved (`resolved_stock_batch_id IS NULL`) and its Order is not terminal.
2. Validates the Batch is linked, through its Stock Product, to the **same** Ingredient/Material as the placeholder.
3. Validates the Batch's `available_amount` (from `stock_batch_availability`) covers the total `reserved_amount` currently held against the placeholder — the placeholder's reservations do not count against that Batch yet, so this is a genuine check that the purchase is big enough.
4. Sets `resolved_stock_batch_id` on the placeholder.
5. Rewrites every `order_stock_reservations` row referencing the placeholder to reference the Batch instead (`stock_batch_id` set, `future_stock_placeholder_id` nulled), **keeping** `reserved_amount` and `unit_cost_snapshot` unchanged and leaving `unit_cost_is_estimated = true`.
6. Runs in a single transaction.

**Why the quoted price is kept**: the Order was quoted with the estimate, and FR-031 freezes quoted prices. Re-pricing here would silently rewrite an agreed quote. The `unit_cost_is_estimated` flag survives so the Consolidation screen can say which part of the budget was a guess, and FR-035's budgeted-vs-actual comparison is what finally reports the difference against the real purchase price.

**Why reservations are rewritten rather than left pointing at the placeholder**: after this call, every reservation in the system references a real `stock_batches` row. That keeps FR-030's gate a simple "no reservation references a placeholder" test, and lets `consolidate_order_stock` confirm consumption per (line, Batch) without having to walk a resolution link.

## Output

```ts
{
  placeholder_id: string,
  stock_batch_id: string,
  reservations_rewritten: number,
  order_id: string,
}
```

## Errors

- Placeholder not found, or already resolved → error, no changes made.
- The Batch's Ingredient/Material differs from the placeholder's → error.
- The Batch has less `available_amount` than the placeholder's committed total → error naming the missing amount, so the user can register the rest.
- The placeholder's Order is `consolidated` or `canceled` → error (FR-037).
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
