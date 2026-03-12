export const CanonicalUnit = {
  // Volume
  Ml: 'ml',
  L: 'l',
  Tsp: 'tsp',
  Tbsp: 'tbsp',
  Cup: 'cup',
  FlOz: 'fl_oz',
  // Weight
  G: 'g',
  Kg: 'kg',
  Oz: 'oz',
  Lb: 'lb',
  // Count
  Piece: 'piece',
  Pinch: 'pinch',
  Slice: 'slice',
  // Freeform
  Unit: 'unit',
} as const;

export type CanonicalUnit = (typeof CanonicalUnit)[keyof typeof CanonicalUnit];

/** Conversion factors to the canonical metric base unit (ml for volume, g for weight). */
export const VOLUME_TO_ML: Record<string, number> = {
  [CanonicalUnit.Ml]: 1,
  [CanonicalUnit.L]: 1000,
  [CanonicalUnit.Tsp]: 4.92892,
  [CanonicalUnit.Tbsp]: 14.7868,
  [CanonicalUnit.Cup]: 236.588,
  [CanonicalUnit.FlOz]: 29.5735,
};

export const WEIGHT_TO_G: Record<string, number> = {
  [CanonicalUnit.G]: 1,
  [CanonicalUnit.Kg]: 1000,
  [CanonicalUnit.Oz]: 28.3495,
  [CanonicalUnit.Lb]: 453.592,
};

export const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_ML));
export const WEIGHT_UNITS = new Set(Object.keys(WEIGHT_TO_G));
export const COUNT_UNITS = new Set<string>([
  CanonicalUnit.Piece,
  CanonicalUnit.Pinch,
  CanonicalUnit.Slice,
  CanonicalUnit.Unit,
]);

export type UnitFamily = 'volume' | 'weight' | 'count';

export function getUnitFamily(unit: CanonicalUnit): UnitFamily | null {
  if (VOLUME_UNITS.has(unit)) return 'volume';
  if (WEIGHT_UNITS.has(unit)) return 'weight';
  if (COUNT_UNITS.has(unit)) return 'count';
  return null;
}

/**
 * Convert a quantity from one unit to another within the same family.
 * Returns null if units are from different families.
 */
export function convertUnit(
  quantity: number,
  from: CanonicalUnit,
  to: CanonicalUnit,
): number | null {
  if (from === to) return quantity;

  const fromFamily = getUnitFamily(from);
  const toFamily = getUnitFamily(to);

  if (fromFamily !== toFamily || fromFamily === null) return null;

  if (fromFamily === 'volume') {
    const inMl = quantity * (VOLUME_TO_ML[from] ?? 1);
    return inMl / (VOLUME_TO_ML[to] ?? 1);
  }

  if (fromFamily === 'weight') {
    const inG = quantity * (WEIGHT_TO_G[from] ?? 1);
    return inG / (WEIGHT_TO_G[to] ?? 1);
  }

  // count units — only same unit allowed (already handled above)
  return null;
}
