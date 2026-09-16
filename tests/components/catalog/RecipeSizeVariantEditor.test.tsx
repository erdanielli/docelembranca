import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { RecipeSizeVariantEditor } from "../../../src/features/catalog/RecipeSizeVariantEditor";

const ingredients = [
  {
    id: "ing-active",
    name: "Leite condensado",
    unit: "g" as const,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "ing-inactive",
    name: "Ingrediente descontinuado",
    unit: "g" as const,
    active: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const materials = [
  {
    id: "mat-active",
    name: "Forminha branca",
    unit: "un" as const,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "mat-inactive",
    name: "Material descontinuado",
    unit: "un" as const,
    active: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("RecipeSizeVariantEditor", () => {
  it("offers only active Ingredients and Materials in its pickers", () => {
    const stub = createSupabaseStub();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));

    const ingredientOptions = screen.getByLabelText("Ingrediente").querySelectorAll("option");
    expect(Array.from(ingredientOptions).map((option) => option.textContent)).toEqual([
      "Leite condensado",
    ]);

    const materialOptions = screen.getByLabelText("Material").querySelectorAll("option");
    expect(Array.from(materialOptions).map((option) => option.textContent)).toEqual([
      "Forminha branca",
    ]);
  });

  it("adds a Size Variant with Ingredient amounts and Material choices", async () => {
    const stub = createSupabaseStub({
      tables: { recipe_size_variants: [{ id: "var-1", recipe_id: "rec-1", name: "seed" }] },
    });

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome do tamanho"), {
      target: { value: "Tamanho Festa Tradicional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar tamanho" }));

    await vi.waitFor(() => {
      const variantInsert = stub.calls.find((call) => call.method === "recipe_size_variants.insert");
      expect(variantInsert?.args[0]).toEqual({ recipe_id: "rec-1", name: "Tamanho Festa Tradicional" });

      const ingredientInsert = stub.calls.find(
        (call) => call.method === "recipe_variant_ingredients.insert",
      );
      expect(ingredientInsert?.args[0]).toEqual({
        variant_id: "var-1",
        ingredient_id: "ing-active",
        amount: 15,
      });

      const materialInsert = stub.calls.find((call) => call.method === "recipe_variant_materials.insert");
      expect(materialInsert?.args[0]).toEqual({
        variant_id: "var-1",
        material_id: "mat-active",
        amount: 1,
      });
    });
  });

  it("adds a second Size Variant with different amounts that coexists independently of the first", async () => {
    const stub = createSupabaseStub({
      tables: { recipe_size_variants: [{ id: "var-1", recipe_id: "rec-1", name: "seed" }] },
    });

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome do tamanho"), { target: { value: "Tamanho A" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tamanho" }));

    await vi.waitFor(() => {
      expect(screen.queryByLabelText("Quantidade do ingrediente")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nome do tamanho"), { target: { value: "Tamanho B" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tamanho" }));

    await vi.waitFor(() => {
      const variantInserts = stub.calls.filter((call) => call.method === "recipe_size_variants.insert");
      expect(variantInserts).toHaveLength(2);
      expect(variantInserts.map((call) => call.args[0])).toEqual([
        { recipe_id: "rec-1", name: "Tamanho A" },
        { recipe_id: "rec-1", name: "Tamanho B" },
      ]);

      const ingredientInserts = stub.calls.filter(
        (call) => call.method === "recipe_variant_ingredients.insert",
      );
      expect(ingredientInserts.map((call) => call.args[0])).toEqual([
        { variant_id: "var-1", ingredient_id: "ing-active", amount: 10 },
        { variant_id: "var-1", ingredient_id: "ing-active", amount: 30 },
      ]);
    });
  });

  it("shows an error and does not clear the form when a composition row fails to save", async () => {
    const stub = createSupabaseStub({
      tables: { recipe_size_variants: [{ id: "var-1", recipe_id: "rec-1", name: "seed" }] },
      errors: { recipe_variant_ingredients: { message: "amount must be greater than 0" } },
    });
    const onAdded = vi.fn();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
        onAdded={onAdded}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome do tamanho"), { target: { value: "Tamanho A" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tamanho" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("amount must be greater than 0");
    });

    expect(screen.getByLabelText("Nome do tamanho")).toHaveValue("Tamanho A");
    expect(screen.getByLabelText("Quantidade do ingrediente")).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("disables adding a row when there are no active Ingredients or Materials to pick", () => {
    const stub = createSupabaseStub();
    const inactiveOnly = ingredients.filter((ingredient) => !ingredient.active);

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={inactiveOnly}
        materials={materials}
      />,
    );

    expect(screen.getByRole("button", { name: "Adicionar ingrediente" })).toBeDisabled();
  });
});
