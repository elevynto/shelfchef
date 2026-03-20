import { Types } from 'mongoose';
import { Recipe } from '../models/recipe.js';
import { PantryItem } from '../models/pantryItem.js';
import { AppError } from '../utils/errors.js';
import { computeMatch } from '../utils/matchScore.js';
import type { IngredientToMatch, PantryItemToMatch } from '../utils/matchScore.js';
import type { PantryMatchResponse } from '@shelfchef/shared';

export async function getRecipeMatch(
  recipeId: string,
  householdId: string,
): Promise<PantryMatchResponse> {
  if (!Types.ObjectId.isValid(recipeId)) {
    throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  }

  const [recipe, pantryItems] = await Promise.all([
    Recipe.findOne({
      _id: recipeId,
      $or: [{ household: householdId }, { source: 'spoonacular' }],
    }),
    PantryItem.find({ household: householdId }),
  ]);

  if (!recipe) throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');

  const ingredientsToMatch: IngredientToMatch[] = recipe.ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    spoonacularIngredientId: ing.spoonacularIngredientId,
  }));

  const pantryForMatch: PantryItemToMatch[] = pantryItems.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    aliases: p.aliases,
    spoonacularIngredientId: p.spoonacularIngredientId,
  }));

  return computeMatch(ingredientsToMatch, pantryForMatch);
}
