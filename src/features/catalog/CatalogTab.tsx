import { useCallback, useEffect, useState } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { IngredientForm } from "./IngredientForm";
import { IngredientList } from "./IngredientList";
import { MaterialForm } from "./MaterialForm";
import { MaterialList } from "./MaterialList";
import { RecipeForm } from "./RecipeForm";
import { RecipeSizeVariantEditor } from "./RecipeSizeVariantEditor";

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

  useEffect(() => {
    void refreshIngredients();
    void refreshMaterials();
    void refreshRecipes();
  }, [refreshIngredients, refreshMaterials, refreshRecipes]);

  useEffect(() => {
    if (selectedRecipe) {
      void refreshVariants(selectedRecipe.id);
    } else {
      setVariants([]);
    }
  }, [selectedRecipe, refreshVariants]);

  return (
    <div className="catalog-tab">
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
            client={client}
            ingredient={editingIngredient}
            onSaved={(ingredient) => {
              setEditingIngredient(undefined);
              setIngredients((current) => upsertByName(current, ingredient));
            }}
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
            client={client}
            material={editingMaterial}
            onSaved={(material) => {
              setEditingMaterial(undefined);
              setMaterials((current) => upsertByName(current, material));
            }}
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
            client={client}
            recipe={selectedRecipe}
            variants={variants}
            onSaved={(recipe) => {
              setSelectedRecipe(recipe);
              setRecipes((current) => upsertByName(current, recipe));
            }}
          />
          <ul className="list" aria-label="Lista de receitas">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="list__row">
                <button
                  type="button"
                  className="list__action"
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  {recipe.name}
                </button>
              </li>
            ))}
          </ul>
          {selectedRecipe && (
            <RecipeSizeVariantEditor
              client={client}
              recipeId={selectedRecipe.id}
              ingredients={ingredients}
              materials={materials}
              onAdded={() => void refreshVariants(selectedRecipe.id)}
            />
          )}
        </section>
      )}
    </div>
  );
}
