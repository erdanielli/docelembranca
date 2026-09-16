import { useState, type FormEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

type Material = Tables<"materials">;
type Unit = Material["unit"];

const UNITS: readonly Unit[] = ["mg", "g", "kg", "ml", "l", "un"];

export function MaterialForm({
  client,
  material,
  onSaved,
}: {
  client: DataClient;
  material?: Material;
  onSaved?: (material: Material) => void;
}) {
  const [name, setName] = useState(material?.name ?? "");
  const [unit, setUnit] = useState<Unit>(material?.unit ?? "g");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const { data } = material
      ? await client.from("materials").update({ name, unit }).eq("id", material.id).select().single()
      : await client.from("materials").insert({ name, unit }).select().single();

    if (data) {
      onSaved?.(data);
    }
    if (!material) {
      setName("");
      setUnit("g");
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="form__field">
        <span className="form__label">Nome</span>
        <input
          className="form__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="form__field">
        <span className="form__label">Unidade</span>
        <select
          className="form__select"
          value={unit}
          onChange={(event) => setUnit(event.target.value as Unit)}
        >
          {UNITS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn--primary">
        Salvar
      </button>
    </form>
  );
}
