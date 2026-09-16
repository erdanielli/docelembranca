import { useState, type FormEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

type Ingredient = Tables<"ingredients">;
type Material = Tables<"materials">;

type IngredientRow = { key: string; ingredientId: string; amount: string };
type MaterialRow = { key: string; materialId: string; amount: string };

let rowKeySeq = 0;
const nextRowKey = () => `row-${++rowKeySeq}`;

export function RecipeSizeVariantEditor({
  client,
  recipeId,
  ingredients,
  materials,
  onAdded,
}: {
  client: DataClient;
  recipeId: string;
  ingredients: readonly Ingredient[];
  materials: readonly Material[];
  onAdded?: () => void;
}) {
  const activeIngredients = ingredients.filter((ingredient) => ingredient.active);
  const activeMaterials = materials.filter((material) => material.active);

  const [name, setName] = useState("");
  const [ingredientRows, setIngredientRows] = useState<readonly IngredientRow[]>([]);
  const [materialRows, setMaterialRows] = useState<readonly MaterialRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addIngredientRow = () => {
    if (activeIngredients.length === 0) {
      return;
    }
    setIngredientRows((rows) => [
      ...rows,
      { key: nextRowKey(), ingredientId: activeIngredients[0].id, amount: "" },
    ]);
  };

  const addMaterialRow = () => {
    if (activeMaterials.length === 0) {
      return;
    }
    setMaterialRows((rows) => [
      ...rows,
      { key: nextRowKey(), materialId: activeMaterials[0].id, amount: "" },
    ]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const { data: variant, error: variantError } = await client
      .from("recipe_size_variants")
      .insert({ recipe_id: recipeId, name })
      .select()
      .single();

    if (variantError || !variant) {
      setError(variantError?.message ?? "Não foi possível salvar o tamanho.");
      return;
    }

    for (const row of ingredientRows) {
      // Amounts round-trip through Number() here and back on read — Postgres
      // `numeric` columns come back from PostgREST as strings, not numbers,
      // despite what the generated types say.
      const { error: rowError } = await client.from("recipe_variant_ingredients").insert({
        variant_id: variant.id,
        ingredient_id: row.ingredientId,
        amount: Number(row.amount),
      });
      if (rowError) {
        setError(rowError.message);
        return;
      }
    }

    for (const row of materialRows) {
      const { error: rowError } = await client.from("recipe_variant_materials").insert({
        variant_id: variant.id,
        material_id: row.materialId,
        amount: Number(row.amount),
      });
      if (rowError) {
        setError(rowError.message);
        return;
      }
    }

    setName("");
    setIngredientRows([]);
    setMaterialRows([]);
    onAdded?.();
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span className="form__label">Nome do tamanho</span>
        <input
          className="form__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <fieldset className="form__fieldset">
        <legend>Ingredientes</legend>
        {ingredientRows.map((row, index) => (
          <div className="form__row" key={row.key}>
            <select
              aria-label="Ingrediente"
              className="form__select"
              value={row.ingredientId}
              onChange={(event) =>
                setIngredientRows((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, ingredientId: event.target.value } : r)),
                )
              }
            >
              {activeIngredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Quantidade do ingrediente"
              className="form__input"
              value={row.amount}
              onChange={(event) =>
                setIngredientRows((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={addIngredientRow}
          disabled={activeIngredients.length === 0}
        >
          Adicionar ingrediente
        </button>
      </fieldset>

      <fieldset className="form__fieldset">
        <legend>Materiais</legend>
        {materialRows.map((row, index) => (
          <div className="form__row" key={row.key}>
            <select
              aria-label="Material"
              className="form__select"
              value={row.materialId}
              onChange={(event) =>
                setMaterialRows((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, materialId: event.target.value } : r)),
                )
              }
            >
              {activeMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Quantidade do material"
              className="form__input"
              value={row.amount}
              onChange={(event) =>
                setMaterialRows((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={addMaterialRow}
          disabled={activeMaterials.length === 0}
        >
          Adicionar material
        </button>
      </fieldset>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary">
        Adicionar tamanho
      </button>
    </form>
  );
}
