import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { IngredientList } from "../../../src/features/catalog/IngredientList";

const ingredient = (overrides: Partial<Parameters<typeof IngredientList>[0]["ingredients"][number]>) => ({
  id: "ing-1",
  name: "Leite condensado",
  unit: "g" as const,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("IngredientList", () => {
  it("lists Ingredients and invokes onEdit when Editar is pressed", () => {
    const stub = createSupabaseStub();
    const onEdit = vi.fn();
    const item = ingredient({});

    render(
      <IngredientList
        client={stub.client}
        ingredients={[item]}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Leite condensado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("deactivates an Ingredient via Desativar and notifies the caller", async () => {
    const stub = createSupabaseStub();
    const onChanged = vi.fn();
    const item = ingredient({});

    render(
      <IngredientList
        client={stub.client}
        ingredients={[item]}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "ingredients.update");
      expect(updateCall?.args[0]).toEqual({ active: false });
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("keeps a deactivated Ingredient visible in the list, flagged as inactive", () => {
    const stub = createSupabaseStub();
    const item = ingredient({ active: false });

    render(<IngredientList client={stub.client} ingredients={[item]} />);

    expect(screen.getByText("Leite condensado")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
  });
});
