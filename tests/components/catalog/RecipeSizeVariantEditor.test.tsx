import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { RecipeSizeVariantEditor } from "../../../src/features/catalog/RecipeSizeVariantEditor";

const GRAMATURA_LABEL = "Gramatura";

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
  it("offers only active Ingredients and Materials in its pickers, with a placeholder example", () => {
    const stub = createSupabaseStub();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    expect(screen.getByLabelText(GRAMATURA_LABEL)).toHaveAttribute(
      "placeholder",
      "Ex: Cento de festa tradicional 13-15g",
    );

    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.click(screen.getByRole("button", { name: "+ material" }));

    const ingredientOptions = screen.getByLabelText("Ingrediente").querySelectorAll("option");
    expect(Array.from(ingredientOptions).map((option) => option.textContent)).toEqual([
      "(selecione)",
      "Leite condensado",
    ]);

    const materialOptions = screen.getByLabelText("Material").querySelectorAll("option");
    expect(Array.from(materialOptions).map((option) => option.textContent)).toEqual([
      "(selecione)",
      "Forminha branca",
    ]);
  });

  it("does not preselect an Ingredient or Material, and shows a dynamic unit once one is chosen", () => {
    const stub = createSupabaseStub();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    expect(screen.getByLabelText("Ingrediente")).toHaveValue("");
    expect(screen.getByText("Quantidade")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    expect(screen.getByText("Quantidade (g)")).toBeInTheDocument();
  });

  it("removes an Ingredient or Material row via its own remove action", () => {
    const stub = createSupabaseStub();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    expect(screen.getByLabelText("Ingrediente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover ingrediente" }));
    expect(screen.queryByLabelText("Ingrediente")).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(GRAMATURA_LABEL), {
      target: { value: "Tamanho Festa Tradicional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "+ material" }));
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "mat-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar gramatura" }));

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

    fireEvent.change(screen.getByLabelText(GRAMATURA_LABEL), { target: { value: "Tamanho A" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "+ material" }));
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "mat-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar gramatura" }));

    await vi.waitFor(() => {
      expect(screen.queryByLabelText("Quantidade do ingrediente")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(GRAMATURA_LABEL), { target: { value: "Tamanho B" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "+ material" }));
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "mat-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar gramatura" }));

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
      errors: { recipe_variant_ingredients: { message: "ingredient already in this Size Variant" } },
    });
    const onSaved = vi.fn();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText(GRAMATURA_LABEL), { target: { value: "Tamanho A" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "+ material" }));
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "mat-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do material"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar gramatura" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("ingredient already in this Size Variant");
    });

    expect(screen.getByLabelText(GRAMATURA_LABEL)).toHaveValue("Tamanho A");
    expect(screen.getByLabelText("Quantidade do ingrediente")).toHaveValue(10);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("refuses to save a Gramatura without at least one Ingredient and one Material", async () => {
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

    fireEvent.change(screen.getByLabelText(GRAMATURA_LABEL), { target: { value: "Tamanho A" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar gramatura" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Adicione ao menos um ingrediente e um material.",
    );
    expect(stub.calls.some((call) => call.method === "recipe_size_variants.insert")).toBe(false);
  });

  it("does not offer an Ingredient or Material already picked by another row", () => {
    const stub = createSupabaseStub();
    const twoIngredients = [
      ...ingredients,
      {
        id: "ing-active-2",
        name: "Chocolate em pó",
        unit: "g" as const,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={twoIngredients}
        materials={materials}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    fireEvent.change(screen.getByLabelText("Ingrediente"), { target: { value: "ing-active" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));

    const selects = screen.getAllByLabelText("Ingrediente");
    const secondRowOptions = Array.from(selects[1].querySelectorAll("option")).map(
      (option) => option.textContent,
    );
    expect(secondRowOptions).toEqual(["(selecione)", "Chocolate em pó"]);
  });

  it("requires an amount greater than zero on every composition row", () => {
    const stub = createSupabaseStub();

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ ingrediente" }));
    const amountInput = screen.getByLabelText("Quantidade do ingrediente");
    expect(amountInput).toBeRequired();
    expect(amountInput).toHaveAttribute("type", "number");
    expect(amountInput).toHaveAttribute("min", "0.0001");
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

    expect(screen.getByRole("button", { name: "+ ingrediente" })).toBeDisabled();
  });

  it("edits an existing Size Variant, prefilling its name and composition, replacing rows on save", async () => {
    const stub = createSupabaseStub({
      tables: { recipe_size_variants: [{ id: "var-1", recipe_id: "rec-1", name: "Tamanho A" }] },
    });
    const onSaved = vi.fn();
    const variant = {
      id: "var-1",
      recipe_id: "rec-1",
      name: "Tamanho A",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
        variant={variant}
        initialIngredientRows={[{ key: "row-1", ingredientId: "ing-active", amount: "10" }]}
        initialMaterialRows={[{ key: "row-2", materialId: "mat-active", amount: "1" }]}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByLabelText(GRAMATURA_LABEL)).toHaveValue("Tamanho A");
    expect(screen.getByLabelText("Quantidade do ingrediente")).toHaveValue(10);
    expect(screen.queryByRole("button", { name: "Salvar gramatura" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Quantidade do ingrediente"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar gramatura" }));

    await vi.waitFor(() => {
      const variantUpdate = stub.calls.find((call) => call.method === "recipe_size_variants.update");
      expect(variantUpdate?.args[0]).toEqual({ name: "Tamanho A" });

      expect(
        stub.calls.some((call) => call.method === "recipe_variant_ingredients.delete"),
      ).toBe(true);
      expect(
        stub.calls.some((call) => call.method === "recipe_variant_materials.delete"),
      ).toBe(true);

      const ingredientInsert = stub.calls.find(
        (call) => call.method === "recipe_variant_ingredients.insert",
      );
      expect(ingredientInsert?.args[0]).toEqual({
        variant_id: "var-1",
        ingredient_id: "ing-active",
        amount: 20,
      });
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("invokes onCancel when editing a Size Variant is cancelled", () => {
    const stub = createSupabaseStub();
    const onCancel = vi.fn();
    const variant = {
      id: "var-1",
      recipe_id: "rec-1",
      name: "Tamanho A",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <RecipeSizeVariantEditor
        client={stub.client}
        recipeId="rec-1"
        ingredients={ingredients}
        materials={materials}
        variant={variant}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
