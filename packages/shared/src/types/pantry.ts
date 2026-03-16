export interface PantryItemResponse {
  id: string;
  household: string;
  name: string;
  quantity: number;
  unit: string;
  aliases: string[];
  spoonacularIngredientId: number | null;
  expiresAt: string | null;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}
