# Quickstart: Validating Order Costing & Pricing

This is a validation guide, not a test suite — it proves the feature works end-to-end for each of the four user stories in spec.md. Implementation details (migrations, component code) live in tasks.md and the source tree, not here.

## Prerequisites

- `.env` populated per README.md (Supabase URL + anon key).
- Local Supabase stack running for database testing: `supabase start` (see contracts/ for the RPCs it must expose: `reserve_stock_for_order`, `release_reserved_stock`, `consolidate_order_stock`, `transition_order_status`).
- Migrations applied: `supabase db push` (or `supabase migration up` against the local stack).
- Dependencies installed: `npm install` (after tasks.md adds Vitest/RTL to `package.json`).
- Dev server running: `npm run dev`, reachable from the host browser (devcontainer port forwarding, per constitution).

## Automated checks

```bash
npm run lint    # must pass
npm run build   # must pass (tsc -b && vite build)
npm test        # Vitest: unit (src/lib/costing, src/lib/units) + component (RTL)
supabase test db  # pgTAP: RPC functions + RLS policies, tested directly in Postgres
```

## Manual validation scenarios

### US1 — Catalog (P1)

1. Create Ingredient "Leite condensado semidesnatado" (g), Material "Forminha branca" (un).
2. Create Recipe "Brigadeiro Gourmet" with Size Variant "Tamanho Festa Tradicional": 15g of the Ingredient + 1 of the Material per unit.
3. Add a second Size Variant "Comercial/Gourmet Médio" with different quantities.
4. **Expected**: both variants persist independently and are selectable later from an Order; data-model.md's `recipe_variant_ingredients`/`recipe_variant_materials` rows exist for each.

### US2 — Stock (P2)

1. Link a Stock Product "Leite Moça 395g" to the Ingredient above; register two Batches at different prices/expiration dates.
2. Use the bulk-pack entry to register a case of 24 units of the Material at a total price; confirm the derived per-unit price matches `total / 24`.
3. **Expected**: both Batches of the Ingredient are visible with independent `quantity_remaining`; the bulk-pack Batch's `unit_price` is pre-filled correctly (FR-013).

### US3 — Order Budgeting (P3)

1. Create a Customer, then an Order in Awaiting Quote (summary + delivery deadline); confirm `order_date` defaults to today and is editable to a past date (FR-018).
2. Advance to Quoting; add a Recipe line: "Brigadeiro Gourmet" / "Tamanho Festa Tradicional" / 100 units.
3. **Expected** (per contracts/rpc-reserve-stock-for-order.md + costing-engine.md): the line's ingredient cost draws from whichever eligible Batch is within 15 days of expiring, else the cheapest; changing the requested quantity updates the cost instantly with no network delay.
4. Remove/adjust stock so the line's Ingredient need exceeds all Batches combined; confirm the UI prompts to create a Future/Pending Stock placeholder, pre-filled with the exact shortfall (FR-016/FR-023).
5. Enter labor cost, a profit % on the line, and an order-level discount %; confirm `computeOrderBreakdown` output matches a hand-computed expectation (ingredient+material cost → + profit% → sum lines + labor → − discount% → final price).
6. Attempt to advance to Awaiting Production before every line is fully covered; confirm it is blocked (FR-028).

### US4 — Lifecycle (P4)

1. With the Order above fully budgeted and moved to Awaiting Production, attempt to start production while a Future/Pending Stock dependency remains unresolved; confirm it is blocked (FR-030).
2. Register a real Stock Batch covering that shortfall and link it to the `future_stock_placeholders` row; retry starting production; confirm it now succeeds.
3. Record delivery date + payment method (try `pix`, `cash`, and `deferred`/fiado — confirm all three are accepted purely as a record, with no follow-up "settled" tracking, per spec Assumptions).
4. In Consolidation, confirm actual consumption per reserved item (try a quantity different from what was reserved); confirm the Order only reaches Consolidated once every item is confirmed (FR-034), and that it then displays budgeted-vs-actual cost and profit (FR-035).
5. Open the Order's status history; confirm every transition from Awaiting Quote through Consolidated appears with an exact timestamp and no gaps (FR-038/FR-039, SC-007).
6. On a separate new Order, cancel it mid-flow with a reason and impact note; confirm its reserved stock becomes available again for other Orders (FR-036), and that it is archived with no further transitions possible, including from Consolidated (FR-037).
