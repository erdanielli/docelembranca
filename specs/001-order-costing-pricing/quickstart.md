# Quickstart: Validating Order Costing & Pricing

This is a validation guide, not a test suite — it proves the feature works end-to-end for each of the four user stories in spec.md. Implementation details (migrations, component code) live in tasks.md and the source tree, not here.

## Prerequisites

- `.env` populated per README.md (Supabase URL + anon key).
- **Local Supabase stack**: `supabase/config.toml` is committed (T006), so `supabase start` is all that is needed to bring the stack up. The devcontainer shares the host's network namespace (`runArgs: ["--network=host"]`, with `forwardPorts` deliberately absent), so 54321–54324 are already on the host's loopback — nothing is forwarded or published, and re-adding `forwardPorts` makes `supabase start` fail with `address already in use` (research.md §10).
- Migrations applied: `supabase migration up` against the local stack (`supabase db push` for the hosted project).
- Dependencies installed: `npm install`.
- Dev server running: `npm run dev`, reachable from the host browser over that same shared namespace.

The local stack is for tests and type generation only; the hosted project stays the deployment target.

## Automated checks

```bash
npm run lint      # must pass
npm run build     # must pass (tsc -b && vite build)
npm test          # Vitest: unit (src/lib/costing, src/lib/units) + component (RTL)
npm run test:db   # pgTAP: RPCs, views, triggers, and RLS policies, tested inside Postgres
npm run test:e2e  # Playwright: browser regression tests against the local stack — see README.md
```

All four are required — `.github/workflows/ci.yml` runs them on every PR — and a feature isn't done
until its user-facing flows have Playwright coverage in `tests/e2e/`, not just Vitest coverage.

## Manual validation scenarios

### US1 — Catalog (P1)

1. Create Ingredient "Leite condensado semidesnatado" (g), Material "Forminha branca" (un).
2. Create Recipe "Brigadeiro Gourmet" with Size Variant "Tamanho Festa Tradicional": 15 g of the Ingredient + 1 of the Material per unit.
3. Add a second Size Variant "Comercial/Gourmet Médio" with different quantities.
4. Deactivate an Ingredient that the Recipe already uses; confirm it disappears from new composition pickers while the existing Recipe still shows and costs it correctly (FR-008a).
5. **Expected**: both variants persist independently and are selectable later from an Order; data-model.md's `recipe_variant_ingredients`/`recipe_variant_materials` rows exist for each.

### US2 — Stock (P2)

1. Link a Stock Product "Leite Moça 395g" to the Ingredient above (package amount 395, unit `g`); register two Batches at different prices and expiration dates.
2. Try linking a Stock Product measured in `ml` to that same `g` Ingredient; confirm it is rejected (FR-010, dimension check).
3. Use the bulk-pack entry to register a case of 24 units of the Material at a total price, **leaving the expiration date empty** — molds do not expire (FR-011); confirm the derived per-unit price matches `total / 24`.
4. **Expected**: each Ingredient Batch shows `remaining_amount` in grams (e.g. 10 × 395 g = 3950 g), not a package count; the Material Batch persists with no expiration date; the bulk-pack Batch's `package_price` is the derived per-package figure (FR-013).

### US3 — Order Budgeting (P3)

1. Create a Customer, then an Order in Awaiting Quote (summary + delivery deadline); confirm `order_date` defaults to today and is editable to a past date (FR-018), and that its status history **already has a creation entry** before any transition (FR-038).
2. Advance to Quoting; add a Recipe line: "Brigadeiro Gourmet" / "Tamanho Festa Tradicional" / 100 units.
3. **Expected** (per costing-engine.md + rpc-reserve-stock-for-order.md): the line draws from whichever eligible Batch expires within 15 days, else the cheapest; an **already-expired** Batch is never drawn from and is flagged as expired stock instead (FR-022). Changing the requested quantity updates the cost with no network call at all — the RPC runs when the line is saved.
4. Add a second Recipe line needing the same Ingredient, then reduce stock so the two lines together exceed every Batch combined. Confirm the prompt to create a Future/Pending placeholder is pre-filled with the shortfall **summed across both lines**, not just the line you were editing (FR-016).
5. Enter labor cost, a profit % on each line, and an order-level discount %; confirm `computeOrderBreakdown` matches a hand-computed expectation (cost → + profit% per line → + labor allocated by line cost → − discount% → final price) and that each line shows its own labor allocation, discount share, and price per unit (FR-027).
6. Edit the Size Variant's composition while this Order is still in Quoting; confirm the affected line is flagged as needing recalculation and that advancing is blocked until it is re-costed (FR-021b).
7. Attempt to advance to Awaiting Production before every line is fully covered; confirm it is blocked (FR-028).

### US4 — Lifecycle (P4)

1. With the Order above fully budgeted and moved to Awaiting Production, attempt to start production while a Future/Pending placeholder remains unresolved; confirm it is blocked (FR-030).
2. Register the real Stock Batch you eventually bought and resolve the placeholder against it (FR-030a). **Expected** (per rpc-resolve-future-stock.md): every reservation that depended on the placeholder now points at the real Batch, the quoted prices are unchanged, and those reservations stay marked as having been estimated. Retry starting production; confirm it now succeeds.
3. Try resolving a placeholder against a Batch of a *different* Ingredient, and against one too small to cover it; confirm both are rejected with a message naming the problem.
4. Record delivery date + payment method (try `pix`, `cash`, and `deferred`/fiado — all three are accepted purely as a record, with no follow-up "settled" tracking, per spec Assumptions).
5. In Consolidation, confirm actual consumption per reserved item, entering an amount **different** from what was reserved and smaller than one whole package (e.g. 200 g from a 395 g can). Confirm the Batch's `remaining_amount` drops by exactly that amount and keeps the partial remainder (FR-014), that the Order only reaches Consolidated once every item is confirmed (FR-034), and that it then shows budgeted-vs-actual cost and profit, including how much of the budget rested on estimates (FR-035).
6. Try editing the Consolidated Order's labor cost or a Recipe line; confirm it is rejected as read-only (FR-037).
7. Open the Order's status history; confirm it runs from the creation entry through Consolidated with an exact timestamp on each row and no gaps (FR-038/FR-039, SC-007).
8. On a separate new Order, cancel it mid-flow with a reason and impact note; confirm the stock it held becomes available to other Orders again (FR-036), that its unresolved placeholders are gone, and that it is archived with no further transitions or edits possible (FR-037).
