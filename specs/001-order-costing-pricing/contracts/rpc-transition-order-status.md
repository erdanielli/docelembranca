# Contract: `transition_order_status` (Postgres RPC)

The single entry point for every Order status change (FR-029), guaranteeing `order_status_history` (FR-038/FR-039/FR-040) is written for every transition without relying on client-side discipline. Called directly by the UI for user-initiated transitions, and internally by `consolidate_order_stock` for the final `awaiting_consolidation → consolidated` step.

## Invocation

```ts
const { data, error } = await supabase.rpc('transition_order_status', {
  p_order_id: string,   // uuid
  p_new_status: 'quoting' | 'awaiting_production' | 'in_production'
              | 'awaiting_consolidation' | 'consolidated' | 'canceled',
  p_delivered_at?: string,     // required when new_status = 'awaiting_consolidation'
  p_payment_method?: 'pix' | 'cash' | 'deferred', // required when new_status = 'awaiting_consolidation'
  p_cancel_reason?: string,    // optional, only used when new_status = 'canceled'
  p_cancel_impact_note?: string, // optional, only used when new_status = 'canceled'
});
```

## Behavior

1. Validates the requested transition is legal from the Order's current status per the state diagram in data-model.md (rejects skips, backward moves, and any transition out of `consolidated`/`canceled`).
2. Enforces the per-transition gates from the spec:
   - `quoting → awaiting_production`: every `order_recipe_lines` row for this Order must be fully reserved with no `uncovered_shortfalls` remaining (FR-028).
   - `awaiting_production → in_production`: every reservation for this Order must reference a real `stock_batches` row, none may reference an unresolved `future_stock_placeholders` row (FR-030).
   - `* → canceled`: calls `release_reserved_stock` for this Order first (FR-036), then proceeds.
3. Updates `orders.status` (and `delivered_at`/`payment_method` or `cancel_reason`/`cancel_impact_note` as applicable).
4. Inserts one `order_status_history` row: `previous_status` = the Order's status before this call, `new_status` = the new status, `changed_at = now()`.
5. Steps 3–4 run in a single transaction.

## Output

```ts
{ order_id: string, new_status: string, history_entry_id: string }
```

## Errors

- Requested transition is not legal from the current status → error, no changes made, no history row written.
- A required gate (FR-028 / FR-030) is not satisfied → error naming the unmet condition.
- `new_status = 'awaiting_consolidation'` without `p_delivered_at`/`p_payment_method` → error.
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
