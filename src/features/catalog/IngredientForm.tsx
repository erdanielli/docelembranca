import { useState, type FormEvent } from "react";
import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

type Ingredient = Tables<"ingredients">;
type Unit = Ingredient["unit"];

const UNITS: readonly Unit[] = ["mg", "g", "kg", "ml", "l", "un"];

export function IngredientForm({
  client,
  ingredient,
  onSaved,
}: {
  client: DataClient;
  ingredient?: Ingredient;
  onSaved?: (ingredient: Ingredient) => void;
}) {
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState<Unit>(ingredient?.unit ?? "g");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const { data } = ingredient
      ? await client
          .from("ingredients")
          .update({ name, unit })
          .eq("id", ingredient.id)
          .select()
          .single()
      : await client.from("ingredients").insert({ name, unit }).select().single();

    if (data) {
      onSaved?.(data);
    }
    if (!ingredient) {
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
