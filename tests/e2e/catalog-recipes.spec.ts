import { test, expect } from "@playwright/test";
import { gotoAuthenticatedApp, switchCatalogSection, uniqueName } from "./helpers";

test("builds a recipe with two size variants and edits/deletes them", async ({ page }) => {
  await gotoAuthenticatedApp(page);

  const ingredientName = uniqueName("Leite condensado");
  await switchCatalogSection(page, "Ingredientes");
  await page.getByLabel("Nome").fill(ingredientName);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator(".list__row").filter({ hasText: ingredientName })).toBeVisible();

  const materialName = uniqueName("Forminha branca");
  await switchCatalogSection(page, "Materiais");
  await page.getByLabel("Nome").fill(materialName);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator(".list__row").filter({ hasText: materialName })).toBeVisible();

  const recipeName = uniqueName("Brigadeiro Gourmet");
  await switchCatalogSection(page, "Receitas");
  await page.getByLabel("Nome").fill(recipeName);
  await page.getByRole("button", { name: "Salvar" }).click();

  const sizes = page.getByRole("list", { name: "Tamanhos" });

  // The empty "Tamanhos" list has no visible box yet; the composition editor
  // mounting is what confirms the recipe was created and selected.
  await expect(page.getByLabel("Gramatura")).toBeVisible();

  // First size variant.
  const variant1Name = uniqueName("Tamanho Festa Tradicional");
  await page.getByLabel("Gramatura").fill(variant1Name);
  await page.getByRole("button", { name: "+ ingrediente" }).click();
  await page.getByLabel("Ingrediente", { exact: true }).selectOption({ label: ingredientName });
  await page.getByLabel("Quantidade do ingrediente").fill("15");
  await page.getByRole("button", { name: "+ material" }).click();
  await page.getByLabel("Material", { exact: true }).selectOption({ label: materialName });
  await page.getByLabel("Quantidade do material").fill("1");
  await page.getByRole("button", { name: "Salvar gramatura" }).click();

  await expect(sizes.locator("li").filter({ hasText: variant1Name })).toBeVisible();

  // Second size variant persists independently of the first.
  const variant2Name = uniqueName("Comercial Médio");
  await page.getByLabel("Gramatura").fill(variant2Name);
  await page.getByRole("button", { name: "+ ingrediente" }).click();
  await page.getByLabel("Ingrediente", { exact: true }).selectOption({ label: ingredientName });
  await page.getByLabel("Quantidade do ingrediente").fill("10");
  await page.getByRole("button", { name: "+ material" }).click();
  await page.getByLabel("Material", { exact: true }).selectOption({ label: materialName });
  await page.getByLabel("Quantidade do material").fill("1");
  await page.getByRole("button", { name: "Salvar gramatura" }).click();

  await expect(sizes.locator("li").filter({ hasText: variant1Name })).toBeVisible();
  await expect(sizes.locator("li").filter({ hasText: variant2Name })).toBeVisible();

  // Editing the first variant loads its saved composition and updates it in place.
  await sizes.locator("li").filter({ hasText: variant1Name }).getByRole("button", { name: "Editar tamanho" }).click();
  await expect(page.getByLabel("Gramatura")).toHaveValue(variant1Name);
  await expect(page.getByLabel("Quantidade do ingrediente")).toHaveValue("15");
  await page.getByLabel("Quantidade do ingrediente").fill("20");
  await page.getByRole("button", { name: "Atualizar gramatura" }).click();

  await expect(sizes.locator("li").filter({ hasText: variant1Name })).toBeVisible();

  // Deleting the second variant leaves the first untouched.
  await sizes.locator("li").filter({ hasText: variant2Name }).getByRole("button", { name: "Excluir tamanho" }).click();
  await expect(sizes.locator("li").filter({ hasText: variant2Name })).toHaveCount(0);
  await expect(sizes.locator("li").filter({ hasText: variant1Name })).toBeVisible();
});
