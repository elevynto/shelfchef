import { getUnitFamily, convertUnit } from '@shelfchef/shared';
import type { CanonicalUnit } from '@shelfchef/shared';
import type { MatchedIngredient, PantryMatchResponse } from '@shelfchef/shared';

export interface IngredientToMatch {
  name: string;
  quantity: number;
  unit: string;
  spoonacularIngredientId: number | null;
}

export interface PantryItemToMatch {
  name: string;
  quantity: number;
  unit: string;
  aliases: string[];
  spoonacularIngredientId: number | null;
}

function findPantryMatch(
  ing: IngredientToMatch,
  pantryItems: PantryItemToMatch[],
): PantryItemToMatch | null {
  const ingName = ing.name.toLowerCase().trim();

  // Priority 1: spoonacularIngredientId exact match
  if (ing.spoonacularIngredientId !== null) {
    const match = pantryItems.find(
      (p) => p.spoonacularIngredientId !== null && p.spoonacularIngredientId === ing.spoonacularIngredientId,
    );
    if (match) return match;
  }

  // Priority 2: exact name or alias match (normalised lowercase)
  const exactMatch = pantryItems.find(
    (p) => p.name === ingName || p.aliases.includes(ingName),
  );
  if (exactMatch) return exactMatch;

  // Priority 3: substring fallback
  const substringMatch = pantryItems.find(
    (p) => p.name.includes(ingName) || ingName.includes(p.name),
  );
  return substringMatch ?? null;
}

export function computeMatch(
  ingredients: IngredientToMatch[],
  pantryItems: PantryItemToMatch[],
): PantryMatchResponse {
  const available: MatchedIngredient[] = [];
  const missing: MatchedIngredient[] = [];

  for (const ing of ingredients) {
    const base = {
      name: ing.name,
      requiredQuantity: ing.quantity,
      requiredUnit: ing.unit,
    };

    const matched = findPantryMatch(ing, pantryItems);

    if (!matched) {
      missing.push({ ...base, pantryQuantity: null, pantryUnit: null, unitMismatch: false });
      continue;
    }

    const ingFamily = getUnitFamily(ing.unit as CanonicalUnit);
    const pantryFamily = getUnitFamily(matched.unit as CanonicalUnit);

    if (ingFamily !== pantryFamily || ingFamily === null) {
      missing.push({ ...base, pantryQuantity: matched.quantity, pantryUnit: matched.unit, unitMismatch: true });
      continue;
    }

    const converted = convertUnit(
      matched.quantity,
      matched.unit as CanonicalUnit,
      ing.unit as CanonicalUnit,
    );

    if (converted === null) {
      // Same family but different count units (e.g. piece vs pinch)
      missing.push({ ...base, pantryQuantity: matched.quantity, pantryUnit: matched.unit, unitMismatch: true });
      continue;
    }

    if (converted >= ing.quantity) {
      available.push({ ...base, pantryQuantity: matched.quantity, pantryUnit: matched.unit, unitMismatch: false });
    } else {
      missing.push({ ...base, pantryQuantity: matched.quantity, pantryUnit: matched.unit, unitMismatch: false });
    }
  }

  const total = ingredients.length;
  const score = total === 0 ? 1 : available.length / total;

  return { score, totalIngredients: total, available, missing };
}
