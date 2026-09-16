import { useState, type SubmitEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { PencilIcon, TrashIcon } from "../../components/icons";

type Recipe = Tables<"recipes">;
type RecipeSizeVariant = Tables<"recipe_size_variants">;

export function RecipeForm({
  client,
  recipe,
  variants = [],
  onSaved,
  onCancel,
  onEditVariant,
  onVariantsChanged,
}: {
  client: DataClient;
  recipe?: Recipe;
  variants?: readonly RecipeSizeVariant[];
  onSaved?: (recipe: Recipe) => void;
  onCancel?: () => void;
  onEditVariant?: (variant: RecipeSizeVariant) => void;
  onVariantsChanged?: () => void;
}) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const { data, error: saveError } = recipe
      ? await client.from("recipes").update({ name }).eq("id", recipe.id).select().single()
      : await client.from("recipes").insert({ name }).select().single();

    if (saveError || !data) {
      setError(saveError?.message ?? "Não foi possível salvar.");
      return;
    }

    onSaved?.(data);
    if (!recipe) {
      setName("");
    }
  };

  const deleteVariant = async (variant: RecipeSizeVariant) => {
    setVariantError(null);

    // recipe_variant_ingredients/materials cascade on variant_id (migration
    // 20260916030000), so this single delete removes the variant's
    // composition rows atomically instead of three separate round trips
    // that could leave the variant partially deleted if one failed.
    const { error: deleteError } = await client.from("recipe_size_variants").delete().eq("id", variant.id);
    if (deleteError) {
      setVariantError(deleteError.message);
      return;
    }

    onVariantsChanged?.();
  };

  return (
    <div className="recipe-form">
      <form className="form" onSubmit={handleSubmit}>
        <label className="form__field">
          <span className="form__label">Nome</span>
          <input
            className="form__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Ninho com Nutella"
            required
          />
        </label>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        {recipe ? (
          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              Atualizar
            </button>
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="submit" className="btn btn--primary">
            Salvar
          </button>
        )}
      </form>

      {recipe && (
        <>
          {variantError && (
            <p className="form__error" role="alert">
              {variantError}
            </p>
          )}
          <ul className="list" aria-label="Tamanhos">
            {variants.map((variant) => (
              <li key={variant.id} className="list__row">
                <span className="list__title">{variant.name}</span>
                <button
                  type="button"
                  className="list__icon-btn list__icon-btn--accent"
                  aria-label="Editar tamanho"
                  onClick={() => onEditVariant?.(variant)}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="list__icon-btn list__icon-btn--danger"
                  aria-label="Excluir tamanho"
                  onClick={() => void deleteVariant(variant)}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
