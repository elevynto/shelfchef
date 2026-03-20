import { describe, expect, it } from 'vitest';
import { computeMatch } from '../../src/utils/matchScore.js';
import type { IngredientToMatch, PantryItemToMatch } from '../../src/utils/matchScore.js';

function ing(
  name: string,
  quantity: number,
  unit: string,
  spoonacularIngredientId: number | null = null,
): IngredientToMatch {
  return { name, quantity, unit, spoonacularIngredientId };
}

function pantry(
  name: string,
  quantity: number,
  unit: string,
  opts: { aliases?: string[]; spoonacularIngredientId?: number | null } = {},
): PantryItemToMatch {
  return {
    name,
    quantity,
    unit,
    aliases: opts.aliases ?? [],
    spoonacularIngredientId: opts.spoonacularIngredientId ?? null,
  };
}

describe('computeMatch', () => {
  it('score is 1.0 when ingredient list is empty', () => {
    const result = computeMatch([], [pantry('flour', 1000, 'g')]);
    expect(result.score).toBe(1);
    expect(result.totalIngredients).toBe(0);
    expect(result.available).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('score is 0 when pantry is empty', () => {
    const result = computeMatch([ing('flour', 200, 'g')], []);
    expect(result.score).toBe(0);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]!.pantryQuantity).toBeNull();
  });

  it('exact name match with sufficient quantity → available', () => {
    const result = computeMatch(
      [ing('flour', 200, 'g')],
      [pantry('flour', 500, 'g')],
    );
    expect(result.score).toBe(1);
    expect(result.available).toHaveLength(1);
    expect(result.available[0]!.name).toBe('flour');
    expect(result.available[0]!.pantryQuantity).toBe(500);
  });

  it('exact name match with insufficient quantity → missing', () => {
    const result = computeMatch(
      [ing('flour', 500, 'g')],
      [pantry('flour', 100, 'g')],
    );
    expect(result.score).toBe(0);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]!.unitMismatch).toBe(false);
  });

  it('alias match: ingredient name found in pantry item aliases', () => {
    const result = computeMatch(
      [ing('all-purpose flour', 200, 'g')],
      [pantry('flour', 500, 'g', { aliases: ['all-purpose flour', 'plain flour'] })],
    );
    expect(result.score).toBe(1);
    expect(result.available).toHaveLength(1);
  });

  it('alias match: pantry item name matches ingredient alias list', () => {
    // Ingredient named 'ap flour', pantry item named 'ap flour' — exact name match
    const result = computeMatch(
      [ing('ap flour', 200, 'g')],
      [pantry('ap flour', 500, 'g')],
    );
    expect(result.score).toBe(1);
  });

  it('spoonacularIngredientId match takes priority over substring', () => {
    // Two pantry items: one matches by ID, one by substring — ID match should win
    const result = computeMatch(
      [ing('flour', 200, 'g', 1001)],
      [
        pantry('bread flour', 50, 'g'),         // substring match, insufficient qty
        pantry('wheat flour', 500, 'g', { spoonacularIngredientId: 1001 }), // ID match, sufficient
      ],
    );
    expect(result.score).toBe(1);
    expect(result.available[0]!.pantryQuantity).toBe(500);
  });

  it('substring fallback: pantry name contains ingredient name', () => {
    const result = computeMatch(
      [ing('flour', 200, 'g')],
      [pantry('all-purpose flour', 500, 'g')],
    );
    expect(result.score).toBe(1);
  });

  it('substring fallback: ingredient name contains pantry name', () => {
    const result = computeMatch(
      [ing('all-purpose flour', 200, 'g')],
      [pantry('flour', 500, 'g')],
    );
    expect(result.score).toBe(1);
  });

  it('unit conversion within same family: 1 kg covers 500 g requirement', () => {
    const result = computeMatch(
      [ing('flour', 500, 'g')],
      [pantry('flour', 1, 'kg')],
    );
    expect(result.score).toBe(1);
    expect(result.available[0]!.unitMismatch).toBe(false);
  });

  it('unit conversion within same family: insufficient after conversion', () => {
    const result = computeMatch(
      [ing('milk', 500, 'ml')],
      [pantry('milk', 0.4, 'l')], // 400 ml < 500 ml required
    );
    expect(result.score).toBe(0);
    expect(result.missing[0]!.unitMismatch).toBe(false);
  });

  it('cross-unit-family mismatch → missing with unitMismatch: true', () => {
    const result = computeMatch(
      [ing('butter', 200, 'g')],
      [pantry('butter', 2, 'piece')],
    );
    expect(result.score).toBe(0);
    expect(result.missing[0]!.unitMismatch).toBe(true);
    expect(result.missing[0]!.pantryQuantity).toBe(2);
  });

  it('same count family, different count units → unitMismatch: true', () => {
    const result = computeMatch(
      [ing('salt', 1, 'pinch')],
      [pantry('salt', 10, 'piece')],
    );
    expect(result.score).toBe(0);
    expect(result.missing[0]!.unitMismatch).toBe(true);
  });

  it('mixed result: partial match gives correct score', () => {
    const result = computeMatch(
      [
        ing('flour', 200, 'g'),
        ing('eggs', 2, 'piece'),
        ing('milk', 300, 'ml'),
        ing('butter', 50, 'g'),
      ],
      [
        pantry('flour', 500, 'g'),
        pantry('eggs', 1, 'piece'), // insufficient
        pantry('milk', 500, 'ml'),
        // no butter
      ],
    );
    expect(result.score).toBeCloseTo(0.5); // 2/4
    expect(result.available).toHaveLength(2);
    expect(result.missing).toHaveLength(2);
    expect(result.totalIngredients).toBe(4);
  });

  it('response includes correct requiredQuantity and requiredUnit', () => {
    const result = computeMatch(
      [ing('flour', 200, 'g')],
      [],
    );
    expect(result.missing[0]!.requiredQuantity).toBe(200);
    expect(result.missing[0]!.requiredUnit).toBe('g');
  });
});
