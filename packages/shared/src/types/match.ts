export interface MatchedIngredient {
  name: string;
  requiredQuantity: number;
  requiredUnit: string;
  pantryQuantity: number | null;
  pantryUnit: string | null;
  unitMismatch: boolean;
}

export interface PantryMatchResponse {
  score: number;
  totalIngredients: number;
  available: MatchedIngredient[];
  missing: MatchedIngredient[];
}
