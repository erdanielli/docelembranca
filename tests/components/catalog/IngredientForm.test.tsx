import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { IngredientForm } from "../../../src/features/catalog/IngredientForm";
import type { DataClient } from "../../../src/lib/dataClient";

describe("IngredientForm", () => {
  it("creates a new Ingredient with a name and a unit of measure", async () => {
    const stub = createSupabaseStub();
    const onSaved = vi.fn();

    render(<IngredientForm client={stub.client as unknown as DataClient} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Leite condensado" } });
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "kg" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const insertCall = stub.calls.find((call) => call.method === "ingredients.insert");
      expect(insertCall?.args[0]).toEqual({ name: "Leite condensado", unit: "kg" });
    });
  });

  it("edits an existing Ingredient, prefilling its current name and unit", async () => {
    const stub = createSupabaseStub();
    const ingredient = {
      id: "ing-1",
      name: "Açúcar",
      unit: "g" as const,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(<IngredientForm client={stub.client as unknown as DataClient} ingredient={ingredient} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Açúcar");
    expect(screen.getByLabelText("Unidade")).toHaveValue("g");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Açúcar refinado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "ingredients.update");
      expect(updateCall?.args[0]).toEqual({ name: "Açúcar refinado", unit: "g" });
      const eqCall = stub.calls.find((call) => call.method === "ingredients.eq");
      expect(eqCall?.args).toEqual(["id", "ing-1"]);
    });
  });
});
