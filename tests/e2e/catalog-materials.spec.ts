import { test, expect } from "@playwright/test";
import { gotoAuthenticatedApp, switchCatalogSection, uniqueName } from "./helpers";

test("creates, deactivates, and reactivates a material", async ({ page }) => {
  await gotoAuthenticatedApp(page);
  await switchCatalogSection(page, "Materiais");

  const name = uniqueName("Forminha branca");
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();

  const row = page.locator(".list__row").filter({ hasText: name });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Desativar" }).click();
  await expect(row).toBeHidden();

  await page.getByLabel("Mostrar excluídos").check();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Reativar" }).click();
  await page.getByLabel("Mostrar excluídos").uncheck();
  await expect(row).toBeVisible();
});
