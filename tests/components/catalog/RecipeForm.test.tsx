import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { RecipeForm } from "../../../src/features/catalog/RecipeForm";

const NAME_LABEL = "Nome";

const recipe = {
  id: "rec-1",
  name: "Brigadeiro Gourmet",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const variants = [
  {
    id: "var-1",
    recipe_id: "rec-1",
    name: "Tamanho Festa Tradicional",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "var-2",
    recipe_id: "rec-1",
    name: "Comercial/Gourmet Médio",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("RecipeForm", () => {
  it("creates a new Recipe with a name", async () => {
    const stub = createSupabaseStub();
    const onSaved = vi.fn();

    render(<RecipeForm client={stub.client} onSaved={onSaved} />);

    expect(screen.getByLabelText(NAME_LABEL)).toHaveAttribute("placeholder", "Ex: Ninho com Nutella");

    fireEvent.change(screen.getByLabelText(NAME_LABEL), { target: { value: "Brigadeiro Gourmet" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const insertCall = stub.calls.find((call) => call.method === "recipes.insert");
      expect(insertCall?.args[0]).toEqual({ name: "Brigadeiro Gourmet" });
    });
  });

  it("edits an existing Recipe, prefilling its current name, with Update and Cancel actions", async () => {
    const stub = createSupabaseStub();
    const onCancel = vi.fn();

    render(<RecipeForm client={stub.client} recipe={recipe} onCancel={onCancel} />);

    expect(screen.getByLabelText(NAME_LABEL)).toHaveValue("Brigadeiro Gourmet");
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(NAME_LABEL), { target: { value: "Brigadeiro Gourmet Extra" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "recipes.update");
      expect(updateCall?.args[0]).toEqual({ name: "Brigadeiro Gourmet Extra" });
      const eqCall = stub.calls.find((call) => call.method === "recipes.eq");
      expect(eqCall?.args).toEqual(["id", "rec-1"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("lists an existing Recipe's Size Variants with edit and delete actions", () => {
    const stub = createSupabaseStub();
    const onEditVariant = vi.fn();

    render(
      <RecipeForm client={stub.client} recipe={recipe} variants={variants} onEditVariant={onEditVariant} />,
    );

    expect(screen.getByText("Tamanho Festa Tradicional")).toBeInTheDocument();
    expect(screen.getByText("Comercial/Gourmet Médio")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Editar tamanho" })[0]);
    expect(onEditVariant).toHaveBeenCalledWith(variants[0]);
  });

  it("deletes a Size Variant, relying on the DB to cascade its composition rows, and notifies the caller", async () => {
    const stub = createSupabaseStub();
    const onVariantsChanged = vi.fn();

    render(
      <RecipeForm
        client={stub.client}
        recipe={recipe}
        variants={variants}
        onVariantsChanged={onVariantsChanged}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Excluir tamanho" })[0]);

    await vi.waitFor(() => {
      const variantDelete = stub.calls.find((call) => call.method === "recipe_size_variants.delete");
      expect(variantDelete).toBeDefined();
      expect(onVariantsChanged).toHaveBeenCalled();
    });

    // recipe_variant_ingredients/materials cascade on variant_id (migration
    // 20260916030000), so the app no longer needs to delete them itself.
    expect(stub.calls.some((call) => call.method === "recipe_variant_ingredients.delete")).toBe(false);
    expect(stub.calls.some((call) => call.method === "recipe_variant_materials.delete")).toBe(false);
  });
});
