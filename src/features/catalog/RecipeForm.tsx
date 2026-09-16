import { useState, type FormEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

type Recipe = Tables<"recipes">;
type RecipeSizeVariant = Tables<"recipe_size_variants">;

export function RecipeForm({
  client,
  recipe,
  variants = [],
  onSaved,
}: {
  client: DataClient;
  recipe?: Recipe;
  variants?: readonly RecipeSizeVariant[];
  onSaved?: (recipe: Recipe) => void;
}) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
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

  return (
    <div className="recipe-form">
      <form className="form" onSubmit={handleSubmit}>
        <label className="form__field">
          <span className="form__label">Nome</span>
          <input
            className="form__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary">
          Salvar
        </button>
      </form>

      {recipe && (
        <ul className="list" aria-label="Tamanhos">
          {variants.map((variant) => (
            <li key={variant.id} className="list__row">
              {variant.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
