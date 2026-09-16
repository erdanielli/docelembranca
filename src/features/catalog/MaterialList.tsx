import type { DataClient } from "../../lib/dataClient";
import type { Tables } from "../../lib/database.types";

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
  const toggleActive = async (material: Material) => {
    await client.from("materials").update({ active: !material.active }).eq("id", material.id);
    onChanged?.();
  };

  return (
    <ul className="list">
      {materials.map((material) => (
        <li key={material.id} className="list__row">
          <span className="list__title">{material.name}</span>
          <span className="list__meta">{material.unit}</span>
          {!material.active && <span className="list__badge">Inativo</span>}
          <button type="button" className="list__action" onClick={() => onEdit?.(material)}>
            Editar
          </button>
          <button type="button" className="list__action" onClick={() => toggleActive(material)}>
            {material.active ? "Desativar" : "Reativar"}
          </button>
        </li>
      ))}
    </ul>
  );
}
