# Contract: Client-side costing engine (`src/lib/costing`)

Pure, side-effect-free TypeScript functions the Order Budgeting UI calls on every input change (FR-021) to render the cost breakdown instantly, without a network round trip. These operate on data already fetched for the Order (its Recipe lines, the chosen Recipe Size Variants' compositions, and the current reservation snapshot returned by `reserve_stock_for_order` — see rpc-reserve-stock-for-order.md).

## `scaleVariantComposition`

```ts
function scaleVariantComposition(
  variant: RecipeSizeVariantComposition, // ingredients + materials with base quantities
  requestedQuantity: number,
  materialOverrides?: MaterialOverride[],
): ScaledComposition // { ingredients: {ingredientId, quantity}[], materials: {materialId, quantity}[] }
```
Scales a Recipe Size Variant's per-unit ingredient/material quantities to the Order line's `requestedQuantity`, substituting any Material overrides (FR-020) in place of the variant's defaults for that line only.

## `computeLineCost`

```ts
function computeLineCost(
  composition: ScaledComposition,
  reservations: OrderStockReservation[], // from reserve_stock_for_order's last result, carrying unit_cost_snapshot
): LineCost // { ingredientCost: number, materialCost: number }
```
Sums `reserved_quantity * unit_cost_snapshot` across all reservations belonging to this line, split into ingredient vs. material subtotals.

## `computeOrderBreakdown`

```ts
function computeOrderBreakdown(
  lines: Array<{ lineCost: LineCost, profitPercent: number | null }>,
  laborCost: number | null,
  discountPercent: number | null,
): OrderBreakdown
// {
//   perLine: Array<{ ingredientCost, materialCost, profitAmount, subtotal }>,
//   totalIngredientCost, totalMaterialCost, laborCost,
//   totalProfit, subtotalBeforeDiscount, discountAmount, finalPrice
// }
```
Implements FR-024/FR-025/FR-026/FR-027: labor cost applies once to the whole Order; profit % applies per line to that line's ingredient+material cost; discount % applies once to the Order's subtotal (sum of line subtotals + labor).

## `convert` (from `src/lib/units`, used by the above)

```ts
function convert(value: number, fromUnit: Unit, toUnit: Unit): number
```
Throws if `fromUnit`/`toUnit` are not in the same measurement dimension (research.md §3). Used whenever a Stock Product's `package_unit` differs from its linked Ingredient's/Material's canonical `unit`.
