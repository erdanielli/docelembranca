import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { CatalogEntityList } from "./CatalogEntityList";

type Material = Tables<"materials">;

export function MaterialList({
  client,
  materials,
  onEdit,
  onChanged,
}: {
  client: DataClient;
  materials: readonly Material[];
  onEdit?: (material: Material) => void;
  onChanged?: () => void;
}) {
  return (
    <CatalogEntityList
      client={client}
      table="materials"
      entities={materials}
      onEdit={onEdit}
      onChanged={onChanged}
    />
  );
}
