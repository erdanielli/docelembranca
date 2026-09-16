import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityForm } from "./CatalogEntityForm";

type Material = Tables<"materials">;

export function MaterialForm({
  client,
  material,
  onSaved,
}: {
  client: DataClient;
  material?: Material;
  onSaved?: (material: Material) => void;
}) {
  return <CatalogEntityForm client={client} table="materials" entity={material} onSaved={onSaved} />;
}
