import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { RecipeForm } from "../../../src/features/catalog/RecipeForm";
import type { DataClient } from "../../../src/lib/dataClient";

describe("RecipeForm", () => {
  it("creates a new Recipe with a name", async () => {
    const stub = createSupabaseStub();
    const onSaved = vi.fn();

    render(<RecipeForm client={stub.client as unknown as DataClient} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Brigadeiro Gourmet" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const insertCall = stub.calls.find((call) => call.method === "recipes.insert");
      expect(insertCall?.args[0]).toEqual({ name: "Brigadeiro Gourmet" });
    });
  });

  it("edits an existing Recipe, prefilling its current name", async () => {
    const stub = createSupabaseStub();
    const recipe = {
      id: "rec-1",
      name: "Brigadeiro Gourmet",
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(<RecipeForm client={stub.client as unknown as DataClient} recipe={recipe} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Brigadeiro Gourmet");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Brigadeiro Gourmet Extra" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const updateCall = stub.calls.find((call) => call.method === "recipes.update");
      expect(updateCall?.args[0]).toEqual({ name: "Brigadeiro Gourmet Extra" });
      const eqCall = stub.calls.find((call) => call.method === "recipes.eq");
      expect(eqCall?.args).toEqual(["id", "rec-1"]);
    });
  });

  it("lists an existing Recipe's Size Variants", () => {
    const stub = createSupabaseStub();
    const recipe = {
      id: "rec-1",
      name: "Brigadeiro Gourmet",
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const variants = [
      {
        id: "var-1",
        recipe_id: "rec-1",
        name: "Tamanho Festa Tradicional",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "var-2",
        recipe_id: "rec-1",
        name: "Comercial/Gourmet Médio",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <RecipeForm client={stub.client as unknown as DataClient} recipe={recipe} variants={variants} />,
    );

    expect(screen.getByText("Tamanho Festa Tradicional")).toBeInTheDocument();
    expect(screen.getByText("Comercial/Gourmet Médio")).toBeInTheDocument();
  });
});
