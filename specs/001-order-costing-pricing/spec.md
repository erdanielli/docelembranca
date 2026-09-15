# Feature Specification: Order Costing & Pricing

**Feature Branch**: `001-order-costing-pricing`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "trabalho de forma autonoma (nao tenho empresa forma) como doceira. Atendo pedidos para pequenas festas e estabelecimentos. Faco principalmente doces de festa (tipo brigadeiro e beijinho) gourmet, com receita propria. Nao tenho um cardapio fixo, estou constantemente criando novas receitas. Minha maior dificuldade hoje é em precificar corretamente meus pedidos. Preciso calcular da forma mais precisa possível o quanto eu gasto com ingredientes e materiais (futuramente também incluir o consumo de energia aproximado dos equipamentos utilizados). Para isso preciso de um cadastro de ingredientes (representação agnóstica com unidade de medida, ex: Leite condensado semidesnatado (g); Leite integral (ml)), materiais (também de forma agnóstica - ex: Forminha branca (un), Tapete simples (un)) e das receitas. Cada receita é composta somente por ingredientes e materiais (por enquanto não vamos nos preocupar com o modo de preparo). Cada receita pode possuir variações de gramatura de acordo com a classificação comercial (ex: Tamanho Festa Tradicional, Comercial/Gourmet Médio, etc) - essas variações podem implicar quantidades diferentes de ingredientes e na escolha dos materiais (ex: uma forminha maior ou uma embalagem específica). Depois vem o estoque, que é onde eu vinculo um produto real do mercado com o ingrediente/meterial. É praticamente a minha prateleira. Sobre o estoque é importante: permitir vários lotes distintos de um mesmo ingrediente, porque eu posso comprar um pouco de cada coisa conforme ofertas aparecem; o produto precisa estar vinculado a um ingrediente ou material e precisa informar o seu valor individual de peso/volume utilizando a unidade de medida compativel com a do vínculo; também é preciso informar o preço pago na unidade, o total de unidades, data de validade e data/local da compra (opcional); se possível, criar uma forma rápida de cadastrar 'fardos' (um fardo de 24 unidades de leite condensado pelo seu preço total já pode deduzir o preço unitário). Por último vem o pedido do cliente. Nele eu informo os dados básicos do cliente (nome/telefone), as receitas envolvidas, data do pedido e o prazo da entrega. Sobre o pedido: cada receita deve especificar a variante de gramatura, a quantidade total solicitada (ex: um cento; 50 unidades); também deve ser possível customizar os materiais solicitados; o cálculo do custo com ingredientes e materiais deve ser calculado de forma precisa e em tempo real; cada pedido deve permitir informar um valor de mão-de-obra; cada receita do pedido deve permitir informar um valor percentual de lucro; cada pedido deve permitir informar um valor percentual de desconto total; o sistema deve calcular o custo de uma receita a partir dos dados informados e dos itens disponíveis em estoque, priorizando o estoque mais barato ou com data de vencimento inferior a 15 dias (com prioridade); se não houver estoque que atenda, o sistema redireciona o usuário a fazer um cadastro de estoque 'futuro' com valor estimado, com quantidade calculada automaticamente. O pedido passa por: 1. Aguardando orçamento (cliente, resumo textual, prazo de entrega, data sugerida como hoje mas editável para retroativo); 2. Orçamento (receitas detalhadas, estoque empenhado, conclusão só quando todos os valores forem calculados); 3. Aguardando produção (orçamento aprovado); 4. Em produção (início manual, só se todos os itens existirem em estoque real); 5. Aguardando consolidação (data de entrega e forma de pagamento: pix, dinheiro, fiado); 6. Consolidado (abate do estoque real consumido, com filtros rápidos, resultado é custo real vs orçado e lucro real); 7. Cancelado (a qualquer momento, com motivo e relato opcional de impacto financeiro)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain the Ingredient, Material & Recipe Catalog (Priority: P1)

As the confectioner, I register every Ingredient and Material I use in an agnostic form (name + unit of measure only, no brand), and I register each Recipe as a combination of Ingredients and Materials, optionally with multiple named Size Variants that each have their own quantities and material choices. Since I have no fixed menu and I am constantly inventing new recipes, I need to be able to add to this catalog at any time.

**Why this priority**: Every other capability (stock linking, order costing) depends on this catalog existing first. Without it there is nothing to cost.

**Independent Test**: Can be fully tested by creating a handful of Ingredients and Materials, creating a Recipe that references them, adding a second Size Variant with different quantities, and confirming the data is saved and editable — independent of stock or orders existing.

**Acceptance Scenarios**:

1. **Given** no catalog data exists, **When** I register an Ingredient with a name and a unit of measure (e.g., "Leite condensado semidesnatado", grams), **Then** it becomes available to reference from any Recipe.
2. **Given** an existing Ingredient and Material, **When** I create a Recipe and add a Size Variant specifying a quantity of that Ingredient and a choice of that Material, **Then** the Recipe Size Variant stores that composition.
3. **Given** a Recipe with one Size Variant, **When** I add a second Size Variant with different quantities and a different Material, **Then** both variants coexist independently under the same Recipe.

---

### User Story 2 - Track Real Stock as Purchased Batches (Priority: P2)

As the confectioner, I link real market products to my Ingredients/Materials catalog ("the shelf"). Each purchase becomes its own Batch, since I buy opportunistically whenever I find good prices, so the same Ingredient can have several Batches at different prices and expiration dates. I also want a fast way to register a bulk pack (e.g., a case of 24 units) by total price, and have the per-unit price calculated for me.

**Why this priority**: Order costing (P3) is meaningless without real purchase data to cost against. This is independently valuable on its own as a "digital shelf" even before any order exists.

**Independent Test**: Can be fully tested by linking a Stock Product to an existing Ingredient, registering two separate purchase Batches with different prices/expiration dates, and registering one bulk pack that auto-derives its per-unit price — all without creating an Order.

**Acceptance Scenarios**:

1. **Given** an Ingredient exists in the catalog, **When** I register a Stock Product linked to it with its package weight/volume, unit price, quantity purchased, and expiration date, **Then** it appears as an available Batch for that Ingredient.
2. **Given** an Ingredient already has one Batch, **When** I register a second purchase of the same Ingredient at a different price and expiration date, **Then** both Batches remain tracked separately with independent remaining quantities.
3. **Given** I want to register a case of 24 units for a total price, **When** I use the bulk-pack entry and provide the pack size and total price paid, **Then** the system computes and stores the per-unit price automatically.

---

### User Story 3 - Get an Accurate, Real-Time Order Budget (Priority: P3)

As the confectioner, when a client asks for a quote, I want to add the requested Recipes (with size variant and quantity), optionally customize materials, and see the total ingredient/material cost computed automatically from my real stock — prioritizing Batches close to expiring or cheapest — plus my labor cost, profit margin, and discount, so I know exactly what to charge and what my margin is. When stock is missing, I want the system to help me record an estimated cost for what I still need to buy instead of leaving the budget incomplete.

**Why this priority**: This directly addresses the stated core problem — pricing orders correctly — and is the primary reason for building this feature.

**Independent Test**: Can be fully tested by creating an Order, adding a Recipe line with a Size Variant and quantity against existing stock, confirming the computed ingredient/material cost matches the cheapest/soonest-expiring eligible Batches, entering labor cost, per-line profit %, and order-level discount %, and confirming the final price and margin are displayed.

**Acceptance Scenarios**:

1. **Given** a Recipe Size Variant and sufficient matching stock Batches, **When** I add that Recipe/Variant with a requested quantity to an Order, **Then** the system computes the ingredient and material cost for that line using the cheapest Batches, prioritizing any Batch expiring within 15 days.
2. **Given** an Order line whose required Ingredient has no covering Batch, **When** I attempt to complete the Order Budget, **Then** the system prompts me to register a Future/Pending Stock entry with an estimated price, pre-filled with the total shortfall quantity across all affected Recipe lines.
3. **Given** an Order with all lines costed, **When** I enter a labor cost, a profit percentage per Recipe line, and an overall discount percentage, **Then** the system shows the detailed cost breakdown, profit, discount, and final price to charge, updating instantly as I change any value.

---

### User Story 4 - Move an Order Through Production to Consolidated Actuals (Priority: P4)

As the confectioner, once a budget is approved I want to move the order through production and delivery, and afterward reconcile exactly what stock was actually consumed, so I know my real cost and real profit versus what I originally budgeted — and I want to be able to cancel an order at any point with a reason.

**Why this priority**: This closes the loop from quote to real financial outcome, but depends on P1–P3 existing first; it is the natural final increment.

**Independent Test**: Can be fully tested by taking a fully budgeted Order through Awaiting Production → In Production (blocked until all stock is real, not Future/Pending) → Awaiting Consolidation (recording delivery date and payment method) → Consolidated (confirming actual stock consumed) and viewing the real-vs-budgeted comparison; and separately by canceling an Order and confirming its reserved stock is released.

**Acceptance Scenarios**:

1. **Given** an Order in Awaiting Production still depending on a Future/Pending Stock item, **When** I try to start production, **Then** the system blocks the transition until that dependency is replaced with a real Stock Batch.
2. **Given** an Order In Production has been delivered, **When** I record the delivery date and payment method, **Then** the Order moves to Awaiting Consolidation.
3. **Given** an Order in Awaiting Consolidation, **When** I confirm, for each reserved item filtered to this Order, the actual quantity consumed, **Then** the corresponding Stock Batches are deducted and the Order becomes Consolidated, showing budgeted vs. actual cost and profit.
4. **Given** an Order in any non-terminal status, **When** I cancel it and optionally provide a reason and financial-impact note, **Then** the Order becomes Canceled, archived, and any stock it had reserved is released back to available stock.
5. **Given** an Order that has moved through several statuses over time, **When** I open its status history, **Then** I see every transition it went through with the exact date/time each one happened, from creation to its current status.

---

### Edge Cases

- What happens when a requested Order quantity implies a fractional Material count (e.g., a mold count that doesn't divide evenly)?
- What happens to open (non-Consolidated) Orders that reference a Recipe Size Variant whose composition is edited after the Order was budgeted?
- What happens when two open Orders both reserve stock from the same Batch and together would exceed its remaining quantity?
- How does the system handle an Ingredient/Material being deactivated while still referenced by an open Order or an active Recipe?
- What happens when actual consumption confirmed at Consolidation differs (more or less) from what was reserved during Budgeting?
- What happens when a client-requested Material customization references a Material not yet in the catalog?
- What happens if the user attempts to cancel an Order that has already reached Consolidated?

## Requirements *(mandatory)*

### Functional Requirements

**Catalog (Ingredients, Materials, Recipes)**

- **FR-001**: System MUST allow creating, editing, and deactivating Ingredients, each with a name and a unit of measure (mass, volume, or count), independent of any specific market brand/product.
- **FR-002**: System MUST allow creating, editing, and deactivating Materials, each with a name and a unit of measure, independent of any specific market brand/product.
- **FR-003**: System MUST allow creating, editing, and deactivating Recipes, where a Recipe is composed only of Ingredients and Materials (no preparation-method content).
- **FR-004**: System MUST allow a Recipe to have one or more named Size Variants (commercial classifications, e.g., "Traditional Party Size", "Medium Gourmet"), each representing a distinct combination of ingredient quantities and material choices.
- **FR-005**: Each Recipe Size Variant MUST specify the required quantity of each Ingredient it uses, expressed in that Ingredient's unit of measure.
- **FR-006**: Each Recipe Size Variant MUST specify the default Material(s) it uses (e.g., a specific mold size or packaging).
- **FR-007**: System MUST prevent a Recipe or Recipe Size Variant from referencing an Ingredient or Material that does not exist in the catalog.
- **FR-008**: System MUST allow adding new Recipes, Recipe Size Variants, Ingredients, and Materials at any time, without requiring a fixed or predefined catalog.

**Stock (Batches)**

- **FR-009**: System MUST allow linking a real market Stock Product to exactly one catalog Ingredient or one catalog Material.
- **FR-010**: Each Stock Product MUST record its individual package weight/volume/count value in any unit compatible with its linked Ingredient's or Material's unit of measure (e.g., a product may be entered in kg while linked to an Ingredient tracked in g), and System MUST automatically convert between compatible units for all cost calculations.
- **FR-011**: Each Stock Product purchase MUST record the price paid, the total number of packages purchased, the expiration date, and, optionally, the purchase date and purchase location.
- **FR-012**: Each purchase MUST be tracked as its own distinct Batch, so multiple Batches of the same Ingredient/Material can coexist with independent prices, expiration dates, and remaining quantities.
- **FR-013**: System MUST provide a quick "bulk pack" entry mode where the user enters the pack size (e.g., 24 units) and the total price paid, and the system derives and stores the per-unit price automatically.
- **FR-014**: System MUST track the remaining available quantity of each Batch as it is consumed by Orders.
- **FR-015**: System MUST allow registering a Future/Pending Stock placeholder for an Ingredient or Material that has no covering Batch, capturing a user-entered estimated unit price.
- **FR-016**: When a Future/Pending Stock placeholder is created from an Order Budget, System MUST automatically pre-fill its needed quantity as the sum of that Ingredient's/Material's shortfall across every Recipe line of that Order.

**Order Budgeting & Pricing**

- **FR-017**: System MUST allow creating an Order in the "Awaiting Quote" status by selecting an existing Customer or registering a new one (name and phone number), plus a free-text summary of the request and the delivery deadline.
- **FR-017a**: System MUST persist Customers as a reusable entity, independent of any single Order, and MUST let the user search/select a previously registered Customer when creating a new Order.
- **FR-017b**: System MUST let the user view, for a given Customer, the list of past and current Orders associated with them.
- **FR-018**: System MUST default a new Order's date to the current date while allowing the user to override it, including to a past date.
- **FR-019**: System MUST allow an Order, once advanced to "Quoting/Budgeting," to include one or more Recipe lines, each specifying a Recipe, a Size Variant, and a requested total quantity.
- **FR-020**: System MUST allow overriding the Materials used on a specific Order's Recipe line (e.g., a client-requested mold or custom packaging), without changing the underlying Recipe Size Variant's defaults for other Orders.
- **FR-021**: System MUST recompute, in real time as inputs change, the total ingredient cost and total material cost for each Order Recipe line, based on catalog quantities scaled to the requested total quantity and on available Stock Batch prices.
- **FR-022**: When selecting which Stock Batch(es) to draw from for a Recipe line's Ingredient/Material need, System MUST prioritize, in order: (a) Batches expiring within 15 days of the current date, then (b) the lowest unit price among the remaining eligible Batches.
- **FR-023**: If no existing Batch can fully cover an Ingredient's/Material's required quantity for an Order, System MUST prompt the user to create a Future/Pending Stock placeholder (per FR-015/FR-016) before that Recipe line's cost can be treated as complete.
- **FR-024**: System MUST allow entering a single labor-cost estimate for the whole Order.
- **FR-025**: System MUST allow entering a profit margin percentage for each Recipe line within the Order.
- **FR-026**: System MUST allow entering a single overall discount percentage applied to the whole Order.
- **FR-027**: System MUST display, for the Order as a whole and per Recipe line, the detailed cost breakdown (ingredient cost, material cost, labor allocation, profit amount, discount amount) and the final price to charge.
- **FR-028**: The "Quoting/Budgeting" status MUST NOT be marked complete until every Recipe line's Ingredient/Material need is covered by a real or Future/Pending Stock reference with a price.

**Order Lifecycle**

- **FR-029**: System MUST support the Order status sequence Awaiting Quote → Quoting/Budgeting → Awaiting Production → In Production → Awaiting Consolidation → Consolidated, with a Canceled status reachable from any non-terminal status.
- **FR-030**: System MUST only allow a manual, user-initiated transition from "Awaiting Production" to "In Production," and only when every needed Ingredient/Material is covered by real (non-Future/Pending) Stock Batches.
- **FR-031**: System MUST reserve ("commit") the specific Stock Batch quantities identified during Budgeting for an Order, distinguishing reserved quantity from freely available quantity, for as long as the Order remains active.
- **FR-032**: At "Awaiting Consolidation," System MUST allow recording the actual delivery date and the payment method used (e.g., Pix, cash, or deferred/store-credit payment) as an informational record; settlement/payoff tracking for deferred payments over time is out of scope for this feature.
- **FR-033**: At "Consolidated," System MUST let the user confirm, filtered to only the Batches reserved for that Order, the actual quantity of each Ingredient/Material consumed, deducting it from the corresponding Batch's remaining quantity.
- **FR-034**: The "Consolidated" status MUST NOT be reached until the user has confirmed actual consumption for every item reserved on the Order.
- **FR-035**: Once "Consolidated," System MUST display the comparison between budgeted cost/profit and actual cost/profit based on confirmed consumption.
- **FR-036**: System MUST allow canceling an Order from any non-terminal status, optionally capturing a cancellation reason and a brief financial-impact note, and MUST release any Stock Batch quantities reserved for that Order back to available stock.
- **FR-037**: A Canceled Order MUST be archived as read-only, with no further status transitions possible.
- **FR-038**: System MUST record a timestamped history entry every time an Order transitions from one status to another, capturing the previous status, the new status, and the exact date/time of the change.
- **FR-039**: System MUST let the user view an Order's full status history as a chronological timeline at any point in the Order's lifecycle, including after it reaches Consolidated or Canceled.
- **FR-040**: System MUST retain an Order's complete status history permanently; history entries MUST NOT be editable or deletable by the user.

### Key Entities

- **Ingredient**: An agnostic consumable used in Recipes, identified by name and unit of measure (e.g., mass, volume, count), independent of any specific market brand.
- **Material**: An agnostic supply/packaging item used in Recipes, identified by name and unit of measure, independent of any specific market brand.
- **Recipe**: A named composition of Ingredients and Materials; has no preparation-method content; groups one or more Size Variants.
- **Recipe Size Variant**: A commercial-size classification of a Recipe (e.g., "Traditional Party Size"), defining specific Ingredient quantities and default Material choices.
- **Stock Product**: A real market product linked to exactly one Ingredient or Material, recording its package's weight/volume/count value.
- **Stock Batch**: One purchase instance of a Stock Product, with its own price, expiration date, purchased quantity, remaining quantity, and optional purchase date/location.
- **Future/Pending Stock**: A placeholder representing an Ingredient/Material need not yet covered by a real Batch, with a user-estimated price and an auto-calculated needed quantity.
- **Customer**: A reusable record of a client (name, phone number), independent of any single Order, whose past and current Orders can be looked up.
- **Order**: A client request moving through a defined status lifecycle, linked to a Customer, capturing delivery deadline, one or more Recipe lines, labor cost, discount, and computed pricing.
- **Order Recipe Line**: An Order's request for a specific Recipe, Size Variant, and total quantity, with its own profit percentage and optional Material overrides.
- **Order Status History Entry**: An immutable, timestamped record of a single Order status transition (previous status, new status, and when it happened), preserved for the life of the Order regardless of its current status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can register a new Ingredient, Material, or Recipe Size Variant in under 2 minutes without needing to look up information outside the system.
- **SC-002**: For an Order with multiple Recipe lines, the user can reach a complete cost breakdown and final price without performing any manual calculation outside the system.
- **SC-003**: 100% of Orders that reach "In Production" have zero remaining dependency on Future/Pending stock.
- **SC-004**: For every Consolidated Order, the user can view both the budgeted cost/profit and the real cost/profit side by side.
- **SC-005**: When a Batch is within 15 days of expiring, it is selected ahead of cheaper, later-expiring Batches in cost calculations, with zero exceptions.
- **SC-006**: The user can identify the full cost breakdown (ingredients, materials, labor, profit, discount) for any Order line without cross-referencing a spreadsheet or external notes.
- **SC-007**: For any Order, at any time, the user can reconstruct the exact date/time it entered and left each status, with zero gaps in the timeline.

## Assumptions

- Approximate equipment energy consumption cost is explicitly out of scope for this feature; the source request calls it out as a future enhancement.
- Preparation steps/method are not part of a Recipe in this feature; Recipes are composition-only (Ingredients + Materials).
- The system has a single authorized user (the confectioner); no multi-user roles, permissions, or collaboration are in scope.
- Batches and Future/Pending Stock apply equally to both Ingredients and Materials (the "shelf" concept is agnostic to the two).
- Batch selection rule: among Batches expiring within 15 days, the cheapest of those is chosen first; if none expire within 15 days, the cheapest available Batch overall is chosen.
- An Order may include the same Recipe more than once with different Size Variants.
- Order status history is system-generated only (recorded automatically on every transition); the user cannot manually add, edit, or back-date history entries. This traceability matters because it is the only reliable record of how long an Order actually spent in each stage (e.g., time awaiting production, time in production), which underpins future analysis of lead times, accountability for delays, and reconstructing what happened on a disputed or problem Order after the fact.
- Monetary values are in Brazilian Reais (BRL).
- Deferred/store-credit ("fiado") payments are recorded as an informational payment method only; tracking whether/when such a debt is later settled is out of scope for this feature and may be addressed by a future accounts-receivable feature.
- Currency/locale formatting and all user-facing text will be Portuguese (pt-BR), per project convention; this specification is written in English per project convention for AI-authored artifacts.
