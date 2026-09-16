import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityList } from "./CatalogEntityList";

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
  return (
    <CatalogEntityList
      client={client}
      table="ingredients"
      entities={ingredients}
      onEdit={onEdit}
      onChanged={onChanged}
    />
  );
}
