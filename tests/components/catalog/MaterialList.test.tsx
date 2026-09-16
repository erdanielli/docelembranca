import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { MaterialList } from "../../../src/features/catalog/MaterialList";

const material = (overrides: Partial<Parameters<typeof MaterialList>[0]["materials"][number]>) => ({
  id: "mat-1",
  name: "Forminha branca",
  unit: "un" as const,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("MaterialList", () => {
  it("lists Materials and invokes onEdit when Editar is pressed", () => {
    const stub = createSupabaseStub();
    const onEdit = vi.fn();
    const item = material({});

    render(
      <MaterialList client={stub.client} materials={[item]} onEdit={onEdit} />,
    );

    expect(screen.getByText("Forminha branca")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("deactivates a Material via Desativar and notifies the caller", async () => {
    const stub = createSupabaseStub();
    const onChanged = vi.fn();
    const item = material({});

    render(
      <MaterialList
        client={stub.client}
        materials={[item]}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "materials.update");
      expect(updateCall?.args[0]).toEqual({ active: false });
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("hides a deactivated Material by default", () => {
    const stub = createSupabaseStub();
    const item = material({ active: false });

    render(<MaterialList client={stub.client} materials={[item]} />);

    expect(screen.queryByText("Forminha branca")).not.toBeInTheDocument();
  });

  it("shows a deactivated Material once 'Mostrar excluídos' is checked, without an Editar action", () => {
    const stub = createSupabaseStub();
    const item = material({ active: false });

    render(<MaterialList client={stub.client} materials={[item]} />);

    fireEvent.click(screen.getByLabelText("Mostrar excluídos"));

    expect(screen.getByText("Forminha branca")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
  });
});
