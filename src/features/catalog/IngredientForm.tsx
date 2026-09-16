import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityForm } from "./CatalogEntityForm";

type Ingredient = Tables<"ingredients">;

export function IngredientForm({
  client,
  ingredient,
  onSaved,
  onCancel,
}: {
  client: DataClient;
  ingredient?: Ingredient;
  onSaved?: (ingredient: Ingredient) => void;
  onCancel?: () => void;
}) {
  return (
    <CatalogEntityForm
      client={client}
      table="ingredients"
      entity={ingredient}
      namePlaceholder="Ex: Leite condensado semi-integral"
      defaultUnit="g"
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
