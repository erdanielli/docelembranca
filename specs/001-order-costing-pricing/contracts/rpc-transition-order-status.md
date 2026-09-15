# Contract: `transition_order_status` (Postgres RPC)

The single entry point for every Order status **change** (FR-029), guaranteeing `order_status_history` (FR-038/FR-039/FR-040) is written for every one without relying on client-side discipline. Called directly by the UI for user-initiated transitions, and internally by `consolidate_order_stock` for the final `awaiting_consolidation → consolidated` step.

The timeline's **first** row is not written here: the `log_order_creation` trigger on `orders` writes it at insert time (`NULL → awaiting_quote`), so the history covers the Order from creation with no gap (SC-007).

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
2. Enforces the per-transition gates, reading them from the database rather than trusting anything the caller passed:
   - `quoting → awaiting_production`: no row in `order_line_coverage` for this Order may have `shortfall_amount > 0` (FR-028), and no line may be stale — `order_recipe_lines.costed_at` must be at or after its `recipe_size_variants.updated_at`, so a variant edited mid-quote forces a re-costing first (FR-021b).
   - `awaiting_production → in_production`: no reservation for this Order may reference a `future_stock_placeholders` row (FR-030). Since `resolve_future_stock` rewrites resolved placeholders onto their real Batch, this is a single test with no resolution link to follow.
   - `* → canceled`: calls `release_reserved_stock` for this Order first (FR-036), then proceeds.
3. Updates `orders.status` (and `delivered_at`/`payment_method` or `cancel_reason`/`cancel_impact_note` as applicable). The terminal-order guard permits this write because it tests the row's *previous* status, so an Order can enter `consolidated`/`canceled` but nothing can edit it afterwards (FR-037).
4. Inserts one `order_status_history` row: `previous_status` = the Order's status before this call, `new_status` = the new status, `changed_at = now()`.
5. Steps 3–4 run in a single transaction.

## Output

```ts
{ order_id: string, new_status: string, history_entry_id: string }
```

## Errors

- Requested transition is not legal from the current status → error, no changes made, no history row written.
- A required gate (FR-028 / FR-021b / FR-030) is not satisfied → error naming the unmet condition and the lines or items responsible.
- `new_status = 'awaiting_consolidation'` without `p_delivered_at`/`p_payment_method` → error.
- Caller (RLS) is not the allowed user → standard Postgres RLS denial.
