# Contract: Client-side costing engine (`src/lib/costing`)

Pure, side-effect-free TypeScript functions the Order Budgeting UI calls on every input change (FR-021) to render the cost breakdown instantly, with **no network round trip**. They operate on data already loaded for the Order screen: its Recipe lines, the chosen Recipe Size Variants' compositions, the line's Material overrides, and the rows of `stock_batch_availability` for the items involved.

**Division of labour** (research.md §7): these functions *preview* what the reservation will be; `reserve_stock_for_order` (see rpc-reserve-stock-for-order.md) *is* the reservation. `selectBatchesForNeed` and the RPC's `ORDER BY` implement the same FR-022 rule and must stay in lockstep — the same deliberate mirroring already accepted for `convert` / `convert_unit` (research.md §3). The RPC is always the authority: what it returns after a save replaces whatever was previewed.

**Amounts**: every quantity below is an amount in the item's canonical unit (see data-model.md, "Amounts vs. packages"), never a package count. Every cost below is per canonical unit.

## `scaleVariantComposition`

```ts
function scaleVariantComposition(
  variant: RecipeSizeVariantComposition, // per-unit ingredient + material amounts
  requestedQuantity: number,
  materialOverrides?: MaterialOverride[],
): ScaledComposition
// { ingredients: {ingredientId, requiredAmount}[], materials: {materialId, requiredAmount}[] }
```

Scales the variant's per-unit amounts to the line's `requestedQuantity`. When `materialOverrides` is non-empty it **replaces** the variant's materials entirely for this line (FR-020). A material whose unit is `un` is rounded **up** to the next whole unit (FR-021a); mass/volume amounts are not rounded.

## `selectBatchesForNeed`

```ts
function selectBatchesForNeed(
  need: { itemId: string, requiredAmount: number },
  batches: StockBatchAvailability[], // rows of the stock_batch_availability view, for this item
  today: Date,
): BatchSelection
// {
//   draws: Array<{ stockBatchId, amount, costPerUnitAmount }>,
//   shortfallAmount: number, // 0 when fully covered
// }
```

Implements FR-022 exactly as the RPC does:

1. Discard batches where `available_amount <= 0`, and batches already expired (`expirationDate !== null && expirationDate < today`) — expired stock is never chosen automatically.
2. Order by: batches expiring within the next 15 days first (`expirationDate !== null && expirationDate <= today + 15 days`), cheapest first within that group; then the rest, cheapest first. Ties broken by earliest `expirationDate` with `null` sorting **last**, then by `stockBatchId` so the preview and the RPC cannot disagree.
3. Draw greedily until the need is met; whatever is left over is `shortfallAmount`.

**The `null` `expirationDate` case needs an explicit guard at all three points above.** An undated Batch is the normal case for Materials (FR-011): never expired, never "expiring soon", and it loses a price tie. This is the one place where a naive port between the two implementations diverges. The SQL side gets it from the view's `coalesce` plus an explicit `NULLS LAST` (data-model.md, rpc-reserve-stock-for-order.md); the TypeScript side needs the `!== null` guards written out, because JavaScript will not fail loudly on `null < today` or `null <= today + 15` — it coerces `null` to `0` and quietly returns whichever answer the operand's type happens to produce, so an undated Batch would silently land on one side of the boundary or the other without anything raising.

Pure and `today`-injected, so the 15-day boundary is testable without mocking the clock.

## `computeLineCost`

```ts
function computeLineCost(
  composition: ScaledComposition,
  draws: CostedDraw[], // previewed draws, or the reservations returned by reserve_stock_for_order
): LineCost
// { ingredientCost, materialCost, hasEstimatedCost: boolean }
```

Sums `amount * costPerUnitAmount` across the line's draws, split into ingredient vs. material subtotals. `hasEstimatedCost` is true when any draw came from a Future/Pending placeholder's estimated price, so the UI can mark that part of the quote as a guess (FR-015, FR-035).

## `computeOrderBreakdown`

```ts
function computeOrderBreakdown(
  lines: Array<{ lineCost: LineCost, profitPercent: number | null, requestedQuantity: number }>,
  laborCost: number | null,
  discountPercent: number | null,
): OrderBreakdown
// {
//   perLine: Array<{
//     ingredientCost, materialCost, cost,
//     profitAmount, laborAllocation, discountAmount,
//     subtotal, finalPrice, pricePerUnit,
//   }>,
//   totalIngredientCost, totalMaterialCost, totalCost, laborCost,
//   totalProfit, subtotalBeforeDiscount, discountAmount, finalPrice,
// }
```

Implements FR-024/FR-025/FR-026/FR-027 in this order:

1. `cost` = ingredient + material cost for the line.
2. `profitAmount` = `cost * profitPercent / 100` (per line, FR-025).
3. `laborAllocation` = the Order's single labor cost split across lines **in proportion to each line's `cost`** (FR-027). When every line's cost is 0, it is split evenly instead, so labor is never silently dropped.
4. `subtotal` = `cost + profitAmount + laborAllocation`; `subtotalBeforeDiscount` = the sum of those.
5. `discountAmount` = `subtotalBeforeDiscount * discountPercent / 100` (once for the Order, FR-026), allocated per line in proportion to each line's `subtotal`.
6. `finalPrice` = `subtotalBeforeDiscount − discountAmount`; per line, `subtotal − discountAmount`, and `pricePerUnit` = that divided by `requestedQuantity` — the number the confectioner actually quotes ("R$ X the hundred").

Allocations are computed on unrounded values; rounding to centavos happens only at display, so the per-line figures always add back up to the Order total.

## `computeActualVsBudget`

```ts
function computeActualVsBudget(
  budget: OrderBreakdown,
  reservations: OrderStockReservation[],   // what was quoted: reserved_amount * unit_cost_snapshot
  consumptions: CostedConsumption[],       // what was used: consumed_amount * the batch's real cost
): BudgetVsActual
// {
//   budgetedCost, actualCost, costVariance,
//   budgetedProfit, actualProfit, profitVariance,
//   estimatedShareOfBudget: number, // fraction of budgetedCost that came from placeholder estimates
//   perItem: Array<{ ingredientId, materialId, budgetedAmount, consumedAmount, budgetedCost, actualCost }>,
// }
```

Implements FR-035. Profit here is **realized** profit, not the FR-025 markup: `finalPrice − cost − laborCost` on each side, so the variance isolates exactly what the confectioner wants to see — how much the real shelf differed from the quote. `estimatedShareOfBudget` tells her how much of that quote rested on Future/Pending guesses rather than real prices.

## `convert` (from `src/lib/units`, used by the above)

```ts
function convert(value: number, fromUnit: Unit, toUnit: Unit): number
```

Throws if `fromUnit`/`toUnit` are not in the same measurement dimension (research.md §3). Used whenever a Stock Product's `package_unit` differs from its linked Ingredient's/Material's canonical `unit`.
