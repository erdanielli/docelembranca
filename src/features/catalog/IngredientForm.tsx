import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityForm } from "./CatalogEntityForm";

type Ingredient = Tables<"ingredients">;

export function IngredientForm({
  client,
  ingredient,
  onSaved,
}: {
  client: DataClient;
  ingredient?: Ingredient;
  onSaved?: (ingredient: Ingredient) => void;
}) {
  return (
    <CatalogEntityForm client={client} table="ingredients" entity={ingredient} onSaved={onSaved} />
  );
}
