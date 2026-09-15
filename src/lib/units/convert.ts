export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "un";
export type Dimension = "mass" | "volume" | "count";

/**
 * Factors are expressed in each dimension's smallest unit, so every conversion
 * this domain needs is integer arithmetic: 500 mg to g is 500 * 1 / 1000, not a
 * multiplication by 0.001. The same table is mirrored by the Postgres
 * convert_unit() function (research.md §3).
 */
const UNITS: Readonly<Record<Unit, { readonly dimension: Dimension; readonly factor: number }>> = {
  mg: { dimension: "mass", factor: 1 },
  g: { dimension: "mass", factor: 1_000 },
  kg: { dimension: "mass", factor: 1_000_000 },
  ml: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1_000 },
  un: { dimension: "count", factor: 1 },
};

export function dimensionOf(unit: Unit): Dimension {
  return UNITS[unit].dimension;
}

export function areCompatible(from: Unit, to: Unit): boolean {
  return dimensionOf(from) === dimensionOf(to);
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) {
    return value;
  }

  const source = UNITS[from];
  const target = UNITS[to];

  if (source.dimension !== target.dimension) {
    throw new Error(
      `Cannot convert ${from} to ${to}: different measurement dimensions (${source.dimension} vs ${target.dimension})`,
    );
  }

  return (value * source.factor) / target.factor;
}
