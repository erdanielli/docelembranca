import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// dev-preview.tsx signs in on load, so opening it is enough to reach the
// authenticated app — see src/dev-preview.tsx. LoginGate briefly shows its
// blank loading screen until that sign-in resolves, so tests wait for a tab
// that only renders once LoginGate lets the real app through.
export async function gotoAuthenticatedApp(page: Page): Promise<void> {
  await page.goto("dev-preview.html");
  await expect(page.getByRole("tab", { name: "Catálogo" })).toBeVisible();
}

export async function switchCatalogSection(
  page: Page,
  section: "Ingredientes" | "Materiais" | "Receitas",
): Promise<void> {
  await page.getByRole("button", { name: section }).click();
}

// Tests write real rows to the local Postgres database and run in parallel
// across files, so every name needs to be unique across the whole run, not
// just within one test.
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
