import { useState, type SubmitEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";
import { ALL_UNITS, type Unit } from "../../lib/units";

export type CatalogEntityTable = "ingredients" | "materials";

// ingredients and materials share an identical row shape (name, unit, active,
// timestamps); this alias stands in for both so the form can stay
// table-agnostic instead of being duplicated per entity.
type Entity = Tables<"ingredients">;

export function CatalogEntityForm({
  client,
  table,
  entity,
  namePlaceholder,
  defaultUnit = "g",
  onSaved,
  onCancel,
}: {
  client: DataClient;
  table: CatalogEntityTable;
  entity?: Entity;
  namePlaceholder?: string;
  defaultUnit?: Unit;
  onSaved?: (entity: Entity) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(entity?.name ?? "");
  const [unit, setUnit] = useState<Unit>(entity?.unit ?? defaultUnit);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Both tables share the same row shape, so it's safe to type this call
    // against one of them regardless of which table name was passed in.
    const query = client.from(table as "ingredients");
    const { data, error: saveError } = entity
      ? await query.update({ name, unit }).eq("id", entity.id).select().single()
      : await query.insert({ name, unit }).select().single();

    if (saveError || !data) {
      setError(saveError?.message ?? "Não foi possível salvar.");
      return;
    }

    onSaved?.(data);
    if (!entity) {
      setName("");
      setUnit(defaultUnit);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row--name-unit">
        <label className="form__field">
          <span className="form__label">Nome</span>
          <input
            className="form__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={namePlaceholder}
            required
          />
        </label>
        <label className="form__field">
          <select
            aria-label="Unidade"
            className="form__select"
            value={unit}
            onChange={(event) => setUnit(event.target.value as Unit)}
          >
            {ALL_UNITS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      {entity ? (
        <div className="form__actions">
          <button type="submit" className="btn btn--primary">
            Atualizar
          </button>
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="submit" className="btn btn--primary">
          Salvar
        </button>
      )}
    </form>
  );
}
