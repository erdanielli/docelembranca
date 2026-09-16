import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

type Ingredient = Tables<"ingredients">;

export function IngredientList({
  client,
  ingredients,
  onEdit,
  onChanged,
}: {
  client: DataClient;
  ingredients: readonly Ingredient[];
  onEdit?: (ingredient: Ingredient) => void;
  onChanged?: () => void;
}) {
  const toggleActive = async (ingredient: Ingredient) => {
    await client.from("ingredients").update({ active: !ingredient.active }).eq("id", ingredient.id);
    onChanged?.();
  };

  return (
    <ul className="list">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="list__row">
          <span className="list__title">{ingredient.name}</span>
          <span className="list__meta">{ingredient.unit}</span>
          {!ingredient.active && <span className="list__badge">Inativo</span>}
          <button type="button" className="list__action" onClick={() => onEdit?.(ingredient)}>
            Editar
          </button>
          <button type="button" className="list__action" onClick={() => toggleActive(ingredient)}>
            {ingredient.active ? "Desativar" : "Reativar"}
          </button>
        </li>
      ))}
    </ul>
  );
}
