import { describe, expect, it } from "vitest";
import { convert } from "../../../src/lib/units";

describe("convert", () => {
  it("converts within the mass dimension", () => {
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(500, "mg", "g")).toBe(0.5);
    expect(convert(2500, "g", "kg")).toBe(2.5);
  });

  it("converts within the volume dimension", () => {
    expect(convert(2, "l", "ml")).toBe(2000);
    expect(convert(750, "ml", "l")).toBe(0.75);
  });

  it("treats counts as their own dimension", () => {
    expect(convert(3, "un", "un")).toBe(3);
  });

  it("returns the value unchanged when the units match", () => {
    expect(convert(395, "g", "g")).toBe(395);
  });

  it("throws when the units belong to different dimensions", () => {
    expect(() => convert(1, "g", "ml")).toThrow(/dimension/i);
    expect(() => convert(1, "un", "g")).toThrow(/dimension/i);
  });
});
