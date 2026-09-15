import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppShell } from "../../src/components/AppShell";

describe("AppShell", () => {
  it("renders one tab per area of the app", () => {
    render(<AppShell />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Catálogo",
      "Estoque",
      "Clientes",
      "Pedidos",
    ]);
  });

  it("starts on the first tab", () => {
    render(<AppShell />);

    expect(screen.getByRole("tab", { name: "Catálogo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Catálogo");
  });

  it("switches the visible panel when another tab is pressed", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("tab", { name: "Pedidos" }));

    expect(screen.getByRole("tab", { name: "Pedidos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Catálogo" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Pedidos");
  });
});
