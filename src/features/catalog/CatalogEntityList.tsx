import { useState, type ReactNode } from "react";
import type { DataClient } from "../../lib/dataClient";
import { PencilIcon, RestoreIcon, TrashIcon } from "../../components/icons";

export type CatalogEntityTable = "ingredients" | "materials" | "recipes";

type BaseEntity = { id: string; name: string; active: boolean };

export function CatalogEntityList<T extends BaseEntity>({
  client,
  table,
  entities,
  renderMeta,
  onEdit,
  onChanged,
}: {
  client: DataClient;
  table: CatalogEntityTable;
  entities: readonly T[];
  renderMeta?: (entity: T) => ReactNode;
  onEdit?: (entity: T) => void;
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const toggleActive = async (entity: T) => {
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

  const visible = showInactive ? entities : entities.filter((entity) => entity.active);

  return (
    <>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <label className="list__filter">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
        />
        Mostrar excluídos
      </label>
      <ul className="list">
        {visible.map((entity) => (
          <li
            key={entity.id}
            className={`list__row${entity.active ? "" : " list__row--inactive"}`}
          >
            <span className="list__title">{entity.name}</span>
            {renderMeta && <span className="list__meta">{renderMeta(entity)}</span>}
            {entity.active && (
              <button
                type="button"
                className="list__icon-btn list__icon-btn--accent"
                aria-label="Editar"
                onClick={() => onEdit?.(entity)}
              >
                <PencilIcon />
              </button>
            )}
            <button
              type="button"
              className={`list__icon-btn${entity.active ? " list__icon-btn--danger" : " list__icon-btn--accent"}`}
              aria-label={entity.active ? "Desativar" : "Reativar"}
              onClick={() => toggleActive(entity)}
            >
              {entity.active ? <TrashIcon /> : <RestoreIcon />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
