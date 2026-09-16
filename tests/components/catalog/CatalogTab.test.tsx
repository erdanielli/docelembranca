import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createSupabaseStub } from "../../helpers/supabaseStub";
import { CatalogTab } from "../../../src/features/catalog/CatalogTab";
import type { DataClient } from "../../../src/lib/dataClient";

describe("CatalogTab", () => {
  it("renders the Ingredient, Material, and Recipe sections and navigates between them", () => {
    const stub = createSupabaseStub();

    render(<CatalogTab client={stub.client as unknown as DataClient} />);

    expect(screen.getByRole("button", { name: "Ingredientes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Materiais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receitas" })).toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Ingredientes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Materiais" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Materiais" }));
    expect(screen.getByRole("region", { name: "Materiais" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Ingredientes" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Receitas" }));
    expect(screen.getByRole("region", { name: "Receitas" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Materiais" })).not.toBeInTheDocument();
  });
});
