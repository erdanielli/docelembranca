import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { MaterialForm } from "../../../src/features/catalog/MaterialForm";

describe("MaterialForm", () => {
  it("creates a new Material with a name and a unit of measure", async () => {
    const stub = createSupabaseStub();
    const onSaved = vi.fn();

    render(<MaterialForm client={stub.client} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Forminha branca" } });
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "un" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const insertCall = stub.calls.find((call) => call.method === "materials.insert");
      expect(insertCall?.args[0]).toEqual({ name: "Forminha branca", unit: "un" });
    });
  });

  it("edits an existing Material, prefilling its current name and unit", async () => {
    const stub = createSupabaseStub();
    const material = {
      id: "mat-1",
      name: "Forminha branca",
      unit: "un" as const,
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(<MaterialForm client={stub.client} material={material} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Forminha branca");
    expect(screen.getByLabelText("Unidade")).toHaveValue("un");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Forminha dourada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "materials.update");
      expect(updateCall?.args[0]).toEqual({ name: "Forminha dourada", unit: "un" });
      const eqCall = stub.calls.find((call) => call.method === "materials.eq");
      expect(eqCall?.args).toEqual(["id", "mat-1"]);
    });
  });
});
