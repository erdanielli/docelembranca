import { useState } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import type { CatalogEntityTable } from "./CatalogEntityForm";

// See CatalogEntityForm: ingredients and materials share an identical shape.
type Entity = Tables<"ingredients">;

export function CatalogEntityList({
  client,
  table,
  entities,
  onEdit,
  onChanged,
}: {
  client: DataClient;
  table: CatalogEntityTable;
  entities: readonly Entity[];
  onEdit?: (entity: Entity) => void;
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const toggleActive = async (entity: Entity) => {
    setError(null);
    const { error: toggleError } = await client
      .from(table as "ingredients")
      .update({ active: !entity.active })
      .eq("id", entity.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    onChanged?.();
  };

  return (
    <>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <ul className="list">
        {entities.map((entity) => (
          <li key={entity.id} className="list__row">
            <span className="list__title">{entity.name}</span>
            <span className="list__meta">{entity.unit}</span>
            {!entity.active && <span className="list__badge">Inativo</span>}
            <button type="button" className="list__action" onClick={() => onEdit?.(entity)}>
              Editar
            </button>
            <button type="button" className="list__action" onClick={() => toggleActive(entity)}>
              {entity.active ? "Desativar" : "Reativar"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
