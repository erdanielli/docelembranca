import { test, expect } from "@playwright/test";
import { gotoAuthenticatedApp } from "./helpers";

test("logs in and shows the app shell tabs", async ({ page }) => {
  await gotoAuthenticatedApp(page);

  await expect(page.getByRole("tablist")).toBeVisible();
  for (const label of ["Catálogo", "Estoque", "Clientes", "Pedidos"]) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }
});
