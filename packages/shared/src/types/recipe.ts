export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  spoonacularIngredientId: number | null;
}

export interface RecipeResponse {
  id: string;
  source: 'spoonacular' | 'custom';
  spoonacularId: number | null;
  household: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  servings: number;
  readyInMinutes: number | null;
  ingredients: RecipeIngredient[];
  instructions: string[];
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpoonacularSearchResponse {
  results: RecipeResponse[];
  stale: boolean;
}
