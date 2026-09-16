import { useCallback, useEffect, useState } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { IngredientForm } from "./IngredientForm";
import { IngredientList } from "./IngredientList";
import { MaterialForm } from "./MaterialForm";
import { MaterialList } from "./MaterialList";
import { RecipeForm } from "./RecipeForm";
import { RecipeList } from "./RecipeList";
import { RecipeSizeVariantEditor, type IngredientRow, type MaterialRow } from "./RecipeSizeVariantEditor";

type Section = "ingredients" | "materials" | "recipes";

const SECTIONS: readonly { readonly id: Section; readonly label: string }[] = [
  { id: "ingredients", label: "Ingredientes" },
  { id: "materials", label: "Materiais" },
  { id: "recipes", label: "Receitas" },
];

/** Inserts or replaces `item` by id, keeping the list sorted by name like the server does. */
function upsertByName<T extends { id: string; name: string }>(list: readonly T[], item: T): T[] {
  const next = list.some((existing) => existing.id === item.id)
    ? list.map((existing) => (existing.id === item.id ? item : existing))
    : [...list, item];
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function CatalogTab({ client }: { client: DataClient }) {
  const [section, setSection] = useState<Section>("ingredients");

  const [ingredients, setIngredients] = useState<readonly Tables<"ingredients">[]>([]);
  const [materials, setMaterials] = useState<readonly Tables<"materials">[]>([]);
  const [recipes, setRecipes] = useState<readonly Tables<"recipes">[]>([]);
  const [variants, setVariants] = useState<readonly Tables<"recipe_size_variants">[]>([]);

  const [editingIngredient, setEditingIngredient] = useState<Tables<"ingredients"> | undefined>();
  const [editingMaterial, setEditingMaterial] = useState<Tables<"materials"> | undefined>();
  const [selectedRecipe, setSelectedRecipe] = useState<Tables<"recipes"> | undefined>();

  const [editingVariant, setEditingVariant] = useState<Tables<"recipe_size_variants"> | undefined>();
  const [editingVariantIngredientRows, setEditingVariantIngredientRows] = useState<readonly IngredientRow[]>(
    [],
  );
  const [editingVariantMaterialRows, setEditingVariantMaterialRows] = useState<readonly MaterialRow[]>([]);

  // A failed refetch leaves the previously-loaded list on screen rather than
  // clearing it — a transient network error shouldn't make the catalog look empty.
  const refreshIngredients = useCallback(async () => {
    try {
      const { data } = await client.from("ingredients").select("*").order("name");
      if (data) {
        setIngredients(data);
      }
    } catch {
      // keep showing what was already loaded
    }
  }, [client]);

  const refreshMaterials = useCallback(async () => {
    try {
      const { data } = await client.from("materials").select("*").order("name");
      if (data) {
        setMaterials(data);
      }
    } catch {
      // keep showing what was already loaded
    }
  }, [client]);

  const refreshRecipes = useCallback(async () => {
    try {
      const { data } = await client.from("recipes").select("*").order("name");
      if (data) {
        setRecipes(data);
      }
    } catch {
      // keep showing what was already loaded
    }
  }, [client]);

  const refreshVariants = useCallback(
    async (recipeId: string) => {
      try {
        const { data } = await client
          .from("recipe_size_variants")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("name");
        if (data) {
          setVariants(data);
        }
      } catch {
        // keep showing what was already loaded
      }
    },
    [client],
  );

  // Fetches a Variant's composition and enters edit mode in one state update,
  // so RecipeSizeVariantEditor mounts already populated instead of flashing
  // an empty "add" form while the round trip is in flight.
  const startEditingVariant = useCallback(
    async (variant: Tables<"recipe_size_variants">) => {
      try {
        const [{ data: ingredientRows }, { data: materialRows }] = await Promise.all([
          client.from("recipe_variant_ingredients").select("*").eq("variant_id", variant.id),
          client.from("recipe_variant_materials").select("*").eq("variant_id", variant.id),
        ]);
        setEditingVariant(variant);
        setEditingVariantIngredientRows(
          (ingredientRows ?? []).map((row) => ({
            key: row.id,
            ingredientId: row.ingredient_id,
            amount: String(row.amount),
          })),
        );
        setEditingVariantMaterialRows(
          (materialRows ?? []).map((row) => ({
            key: row.id,
            materialId: row.material_id,
            amount: String(row.amount),
          })),
        );
      } catch {
        setEditingVariant(variant);
      }
    },
    [client],
  );

  useEffect(() => {
    void refreshIngredients();
    void refreshMaterials();
    void refreshRecipes();
  }, [refreshIngredients, refreshMaterials, refreshRecipes]);

  useEffect(() => {
    setEditingVariant(undefined);
    if (selectedRecipe) {
      void refreshVariants(selectedRecipe.id);
    } else {
      setVariants([]);
    }
  }, [selectedRecipe, refreshVariants]);

  return (
    <div className="catalog-tab" data-section={section}>
      <div className="segmented" role="group" aria-label="Seções do catálogo">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === section}
            className={`segmented__item${item.id === section ? " segmented__item--active" : ""}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "ingredients" && (
        <section aria-label="Ingredientes" className="catalog-tab__section">
          <IngredientForm
            key={editingIngredient?.id ?? "new"}
            client={client}
            ingredient={editingIngredient}
            onSaved={(ingredient) => {
              setEditingIngredient(undefined);
              setIngredients((current) => upsertByName(current, ingredient));
            }}
            onCancel={() => setEditingIngredient(undefined)}
          />
          <IngredientList
            client={client}
            ingredients={ingredients}
            onEdit={setEditingIngredient}
            onChanged={refreshIngredients}
          />
        </section>
      )}

      {section === "materials" && (
        <section aria-label="Materiais" className="catalog-tab__section">
          <MaterialForm
            key={editingMaterial?.id ?? "new"}
            client={client}
            material={editingMaterial}
            onSaved={(material) => {
              setEditingMaterial(undefined);
              setMaterials((current) => upsertByName(current, material));
            }}
            onCancel={() => setEditingMaterial(undefined)}
          />
          <MaterialList
            client={client}
            materials={materials}
            onEdit={setEditingMaterial}
            onChanged={refreshMaterials}
          />
        </section>
      )}

      {section === "recipes" && (
        <section aria-label="Receitas" className="catalog-tab__section">
          <RecipeForm
            key={selectedRecipe?.id ?? "new"}
            client={client}
            recipe={selectedRecipe}
            variants={variants}
            onSaved={(recipe) => {
              setSelectedRecipe(recipe);
              setRecipes((current) => upsertByName(current, recipe));
            }}
            onCancel={() => setSelectedRecipe(undefined)}
            onEditVariant={(variant) => void startEditingVariant(variant)}
            onVariantsChanged={() => {
              setEditingVariant(undefined);
              if (selectedRecipe) {
                void refreshVariants(selectedRecipe.id);
              }
            }}
          />
          {selectedRecipe && (
            <RecipeSizeVariantEditor
              key={editingVariant?.id ?? "new"}
              client={client}
              recipeId={selectedRecipe.id}
              ingredients={ingredients}
              materials={materials}
              variant={editingVariant}
              initialIngredientRows={editingVariant ? editingVariantIngredientRows : []}
              initialMaterialRows={editingVariant ? editingVariantMaterialRows : []}
              onSaved={() => {
                setEditingVariant(undefined);
                void refreshVariants(selectedRecipe.id);
              }}
              onCancel={() => setEditingVariant(undefined)}
            />
          )}
          <RecipeList client={client} recipes={recipes} onEdit={setSelectedRecipe} onChanged={refreshRecipes} />
        </section>
      )}
    </div>
  );
}
