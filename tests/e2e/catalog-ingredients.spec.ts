import { test, expect } from "@playwright/test";
import { gotoAuthenticatedApp, uniqueName } from "./helpers";

test("creates, edits, deactivates, and reactivates an ingredient", async ({ page }) => {
  await gotoAuthenticatedApp(page);

  const name = uniqueName("Leite condensado");
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();

  const row = page.locator(".list__row").filter({ hasText: name });
  await expect(row).toBeVisible();

  const editedName = uniqueName("Leite integral");
  await row.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome").fill(editedName);
  await page.getByRole("button", { name: "Atualizar" }).click();

  // The form resets to create mode once the edit is saved.
  await expect(page.getByRole("button", { name: "Salvar" })).toBeVisible();
  const editedRow = page.locator(".list__row").filter({ hasText: editedName });
  await expect(editedRow).toBeVisible();
  await expect(row).toHaveCount(0);

  await editedRow.getByRole("button", { name: "Desativar" }).click();
  await expect(editedRow).toBeHidden();

  await page.getByLabel("Mostrar excluídos").check();
  await expect(editedRow).toBeVisible();
  await expect(editedRow.getByRole("button", { name: "Editar" })).toHaveCount(0);

  await editedRow.getByRole("button", { name: "Reativar" }).click();
  await expect(editedRow.getByRole("button", { name: "Editar" })).toBeVisible();

  await page.getByLabel("Mostrar excluídos").uncheck();
  await expect(editedRow).toBeVisible();
});
