import { useState, type SubmitEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { TrashIcon } from "../../components/icons";

type Ingredient = Tables<"ingredients">;
type Material = Tables<"materials">;
type RecipeSizeVariant = Tables<"recipe_size_variants">;

export type IngredientRow = { key: string; ingredientId: string; amount: string };
export type MaterialRow = { key: string; materialId: string; amount: string };

let rowKeySeq = 0;
const nextRowKey = () => `row-${++rowKeySeq}`;

export function RecipeSizeVariantEditor({
  client,
  recipeId,
  ingredients,
  materials,
  variant,
  initialIngredientRows = [],
  initialMaterialRows = [],
  onSaved,
  onCancel,
}: {
  client: DataClient;
  recipeId: string;
  ingredients: readonly Ingredient[];
  materials: readonly Material[];
  variant?: RecipeSizeVariant;
  initialIngredientRows?: readonly IngredientRow[];
  initialMaterialRows?: readonly MaterialRow[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const activeIngredients = ingredients.filter((ingredient) => ingredient.active);
  const activeMaterials = materials.filter((material) => material.active);

  const [name, setName] = useState(variant?.name ?? "");
  const [ingredientRows, setIngredientRows] = useState<readonly IngredientRow[]>(initialIngredientRows);
  const [materialRows, setMaterialRows] = useState<readonly MaterialRow[]>(initialMaterialRows);
  const [error, setError] = useState<string | null>(null);

  const addIngredientRow = () => {
    setIngredientRows((rows) => [...rows, { key: nextRowKey(), ingredientId: "", amount: "" }]);
  };

  const addMaterialRow = () => {
    setMaterialRows((rows) => [...rows, { key: nextRowKey(), materialId: "", amount: "" }]);
  };

  const removeIngredientRow = (index: number) => {
    setIngredientRows((rows) => rows.filter((_, i) => i !== index));
  };

  const removeMaterialRow = (index: number) => {
    setMaterialRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (ingredientRows.length === 0 || materialRows.length === 0) {
      setError("Adicione ao menos um ingrediente e um material.");
      return;
    }

    let variantId: string;

    if (variant) {
      const { data: updated, error: updateError } = await client
        .from("recipe_size_variants")
        .update({ name })
        .eq("id", variant.id)
        .select()
        .single();
      if (updateError || !updated) {
        setError(updateError?.message ?? "Não foi possível salvar a gramatura.");
        return;
      }
      variantId = updated.id;

      const { error: deleteIngredientsError } = await client
        .from("recipe_variant_ingredients")
        .delete()
        .eq("variant_id", variantId);
      if (deleteIngredientsError) {
        setError(deleteIngredientsError.message);
        return;
      }

      const { error: deleteMaterialsError } = await client
        .from("recipe_variant_materials")
        .delete()
        .eq("variant_id", variantId);
      if (deleteMaterialsError) {
        setError(deleteMaterialsError.message);
        return;
      }
    } else {
      const { data: created, error: createError } = await client
        .from("recipe_size_variants")
        .insert({ recipe_id: recipeId, name })
        .select()
        .single();
      if (createError || !created) {
        setError(createError?.message ?? "Não foi possível salvar a gramatura.");
        return;
      }
      variantId = created.id;
    }

    // Inserted as one array, not row-by-row: PostgREST runs a multi-row
    // insert as a single INSERT statement, so on update (after the old rows
    // were just deleted) a rejected row aborts the whole insert instead of
    // leaving the variant with only some of its new composition rows.
    const { error: ingredientsInsertError } = await client.from("recipe_variant_ingredients").insert(
      // Amounts round-trip through Number() here and back on read — Postgres
      // `numeric` columns come back from PostgREST as strings, not numbers,
      // despite what the generated types say.
      ingredientRows.map((row) => ({
        variant_id: variantId,
        ingredient_id: row.ingredientId,
        amount: Number(row.amount),
      })),
    );
    if (ingredientsInsertError) {
      setError(ingredientsInsertError.message);
      return;
    }

    const { error: materialsInsertError } = await client.from("recipe_variant_materials").insert(
      materialRows.map((row) => ({
        variant_id: variantId,
        material_id: row.materialId,
        amount: Number(row.amount),
      })),
    );
    if (materialsInsertError) {
      setError(materialsInsertError.message);
      return;
    }

    if (!variant) {
      setName("");
      setIngredientRows([]);
      setMaterialRows([]);
    }
    onSaved?.();
  };

  const usedIngredientIds = new Set(ingredientRows.map((row) => row.ingredientId).filter(Boolean));
  const usedMaterialIds = new Set(materialRows.map((row) => row.materialId).filter(Boolean));

  // Counting rows (rather than active ingredients/materials not yet used)
  // would undercount availability once a row's ingredient/material has since
  // been deactivated: that row still occupies a slot but no longer accounts
  // for one of the active options being unavailable.
  const addIngredientDisabled = activeIngredients.every((ingredient) =>
    usedIngredientIds.has(ingredient.id),
  );
  const addMaterialDisabled = activeMaterials.every((material) => usedMaterialIds.has(material.id));

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span className="form__label">Gramatura</span>
        <input
          className="form__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex: Cento de festa tradicional 13-15g"
          required
        />
      </label>

      <fieldset className="form__fieldset">
        <legend>Ingredientes</legend>
        {ingredientRows.map((row, index) => {
          const selectedUnit = activeIngredients.find(
            (ingredient) => ingredient.id === row.ingredientId,
          )?.unit;
          const selectableIngredients = activeIngredients.filter(
            (ingredient) => ingredient.id === row.ingredientId || !usedIngredientIds.has(ingredient.id),
          );
          const isLast = index === ingredientRows.length - 1;
          return (
            <div className="form__row form__row--stacked" key={row.key}>
              <div className="form__row--between">
                <select
                  aria-label="Ingrediente"
                  className="form__select"
                  value={row.ingredientId}
                  required
                  onChange={(event) =>
                    setIngredientRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, ingredientId: event.target.value } : r)),
                    )
                  }
                >
                  <option value="" disabled>
                    (selecione)
                  </option>
                  {selectableIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="list__icon-btn list__icon-btn--danger"
                  aria-label="Remover ingrediente"
                  onClick={() => removeIngredientRow(index)}
                >
                  <TrashIcon />
                </button>
              </div>
              <label className="form__field">
                <span className="form__label">Quantidade{selectedUnit ? ` (${selectedUnit})` : ""}</span>
                <div className="form__row--between">
                  <input
                    aria-label="Quantidade do ingrediente"
                    className="form__input"
                    type="number"
                    min="0.0001"
                    step="any"
                    value={row.amount}
                    required
                    onChange={(event) =>
                      setIngredientRows((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)),
                      )
                    }
                  />
                  {isLast && (
                    <button
                      type="button"
                      className="btn btn--add"
                      onClick={addIngredientRow}
                      disabled={addIngredientDisabled}
                    >
                      + ingrediente
                    </button>
                  )}
                </div>
              </label>
            </div>
          );
        })}
        {ingredientRows.length === 0 && (
          <button
            type="button"
            className="btn btn--add btn--add-right"
            onClick={addIngredientRow}
            disabled={addIngredientDisabled}
          >
            + ingrediente
          </button>
        )}
      </fieldset>

      <fieldset className="form__fieldset">
        <legend>Materiais</legend>
        {materialRows.map((row, index) => {
          const selectedUnit = activeMaterials.find((material) => material.id === row.materialId)?.unit;
          const selectableMaterials = activeMaterials.filter(
            (material) => material.id === row.materialId || !usedMaterialIds.has(material.id),
          );
          const isLast = index === materialRows.length - 1;
          return (
            <div className="form__row form__row--stacked" key={row.key}>
              <div className="form__row--between">
                <select
                  aria-label="Material"
                  className="form__select"
                  value={row.materialId}
                  required
                  onChange={(event) =>
                    setMaterialRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, materialId: event.target.value } : r)),
                    )
                  }
                >
                  <option value="" disabled>
                    (selecione)
                  </option>
                  {selectableMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="list__icon-btn list__icon-btn--danger"
                  aria-label="Remover material"
                  onClick={() => removeMaterialRow(index)}
                >
                  <TrashIcon />
                </button>
              </div>
              <label className="form__field">
                <span className="form__label">Quantidade{selectedUnit ? ` (${selectedUnit})` : ""}</span>
                <div className="form__row--between">
                  <input
                    aria-label="Quantidade do material"
                    className="form__input"
                    type="number"
                    min="0.0001"
                    step="any"
                    value={row.amount}
                    required
                    onChange={(event) =>
                      setMaterialRows((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)),
                      )
                    }
                  />
                  {isLast && (
                    <button
                      type="button"
                      className="btn btn--add"
                      onClick={addMaterialRow}
                      disabled={addMaterialDisabled}
                    >
                      + material
                    </button>
                  )}
                </div>
              </label>
            </div>
          );
        })}
        {materialRows.length === 0 && (
          <button
            type="button"
            className="btn btn--add btn--add-right"
            onClick={addMaterialRow}
            disabled={addMaterialDisabled}
          >
            + material
          </button>
        )}
      </fieldset>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      {variant ? (
        <div className="form__actions">
          <button type="submit" className="btn btn--primary">
            Atualizar gramatura
          </button>
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="submit" className="btn btn--primary">
          Salvar gramatura
        </button>
      )}
    </form>
  );
}
