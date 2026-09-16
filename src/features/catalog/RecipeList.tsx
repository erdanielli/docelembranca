import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityList } from "./CatalogEntityList";

type Recipe = Tables<"recipes">;

export function RecipeList({
  client,
  recipes,
  onEdit,
  onChanged,
}: {
  client: DataClient;
  recipes: readonly Recipe[];
  onEdit?: (recipe: Recipe) => void;
  onChanged?: () => void;
}) {
  return (
    <CatalogEntityList
      client={client}
      table="recipes"
      entities={recipes}
      onEdit={onEdit}
      onChanged={onChanged}
    />
  );
}
