import { Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { Recipe, IRecipe } from '../models/recipe.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeResponse,
  SpoonacularSearchResponse,
} from '@shelfchef/shared';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ── Internal Spoonacular API types ────────────────────────────────────────────

interface SpoonacularIngredient {
  id: number;
  name: string;
  amount: number;
  unit: string;
}

interface SpoonacularStep {
  step: string;
}

interface SpoonacularInstruction {
  steps: SpoonacularStep[];
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  summary: string;
  image: string | null;
  servings: number;
  readyInMinutes: number;
  extendedIngredients: SpoonacularIngredient[];
  analyzedInstructions: SpoonacularInstruction[];
}

interface SpoonacularApiResponse {
  results: SpoonacularRecipe[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toResponse(recipe: HydratedDocument<IRecipe>): RecipeResponse {
  return {
    id: recipe._id.toString(),
    source: recipe.source,
    spoonacularId: recipe.spoonacularId,
    household: recipe.household ? recipe.household.toString() : null,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      spoonacularIngredientId: ing.spoonacularIngredientId,
    })),
    instructions: recipe.instructions,
    cachedAt: recipe.cachedAt ? recipe.cachedAt.toISOString() : null,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function mapUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    ml: 'ml',
    milliliter: 'ml',
    milliliters: 'ml',
    l: 'l',
    liter: 'l',
    liters: 'l',
    tsp: 'tsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    tbsp: 'tbsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    cup: 'cup',
    cups: 'cup',
    'fl oz': 'fl_oz',
    'fluid ounce': 'fl_oz',
    'fluid ounces': 'fl_oz',
    g: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    oz: 'oz',
    ounce: 'oz',
    ounces: 'oz',
    lb: 'lb',
    pound: 'lb',
    pounds: 'lb',
    piece: 'piece',
    pieces: 'piece',
    pinch: 'pinch',
    pinches: 'pinch',
    slice: 'slice',
    slices: 'slice',
  };
  return unitMap[unit.toLowerCase().trim()] ?? 'unit';
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listRecipes(householdId: string, q?: string): Promise<RecipeResponse[]> {
  const filter: Record<string, unknown> = { source: 'custom', household: householdId };
  if (q) {
    filter['title'] = { $regex: q, $options: 'i' };
  }
  const recipes = await Recipe.find(filter);
  return recipes.map(toResponse);
}

export async function createRecipe(
  householdId: string,
  input: CreateRecipeInput,
): Promise<RecipeResponse> {
  const recipe = await Recipe.create({
    source: 'custom' as const,
    spoonacularId: null,
    household: householdId,
    ...input,
  });
  return toResponse(recipe);
}

export async function getRecipe(householdId: string, recipeId: string): Promise<RecipeResponse> {
  if (!Types.ObjectId.isValid(recipeId)) {
    throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  }

  const recipe = await Recipe.findOne({
    _id: recipeId,
    $or: [{ household: householdId }, { source: 'spoonacular' }],
  });

  if (!recipe) throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  return toResponse(recipe);
}

export async function updateRecipe(
  householdId: string,
  recipeId: string,
  input: UpdateRecipeInput,
): Promise<RecipeResponse> {
  if (!Types.ObjectId.isValid(recipeId)) {
    throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  }

  if (Object.keys(input).length === 0) {
    throw new AppError(400, 'No fields to update', 'NO_UPDATE_FIELDS');
  }

  const recipe = await Recipe.findOneAndUpdate(
    { _id: recipeId, source: 'custom', household: householdId },
    { $set: input },
    { new: true, runValidators: true },
  );

  if (!recipe) throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  return toResponse(recipe);
}

export async function deleteRecipe(householdId: string, recipeId: string): Promise<void> {
  if (!Types.ObjectId.isValid(recipeId)) {
    throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
  }

  const recipe = await Recipe.findOneAndDelete({
    _id: recipeId,
    source: 'custom',
    household: householdId,
  });

  if (!recipe) throw new AppError(404, 'Recipe not found', 'RECIPE_NOT_FOUND');
}

export async function searchSpoonacular(query: string): Promise<SpoonacularSearchResponse> {
  if (!env.SPOONACULAR_API_KEY) {
    throw new AppError(503, 'Spoonacular integration not configured', 'SPOONACULAR_NOT_CONFIGURED');
  }

  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const fresh = await Recipe.find({
    source: 'spoonacular',
    title: { $regex: query, $options: 'i' },
    cachedAt: { $gte: cutoff },
  });

  if (fresh.length > 0) {
    return { results: fresh.map(toResponse), stale: false };
  }

  let apiResults: SpoonacularRecipe[];
  try {
    const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${env.SPOONACULAR_API_KEY}&query=${encodeURIComponent(query)}&number=20&addRecipeInformation=true&fillIngredients=true`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Spoonacular returned ${String(response.status)}`);
    }
    const data = (await response.json()) as SpoonacularApiResponse;
    apiResults = data.results;
  } catch {
    // Spoonacular error — return stale cached results if available
    const stale = await Recipe.find({
      source: 'spoonacular',
      title: { $regex: query, $options: 'i' },
    });
    if (stale.length > 0) {
      return { results: stale.map(toResponse), stale: true };
    }
    throw new AppError(503, 'Spoonacular unavailable and no cached results', 'SPOONACULAR_UNAVAILABLE');
  }

  const now = new Date();
  const ops = apiResults.map((r) => ({
    updateOne: {
      filter: { spoonacularId: r.id },
      update: {
        $set: {
          source: 'spoonacular' as const,
          spoonacularId: r.id,
          household: null,
          title: r.title,
          description: stripHtml(r.summary),
          imageUrl: r.image,
          servings: r.servings,
          readyInMinutes: r.readyInMinutes,
          ingredients: r.extendedIngredients.map((ing) => ({
            name: ing.name.toLowerCase().trim(),
            quantity: ing.amount,
            unit: mapUnit(ing.unit),
            spoonacularIngredientId: ing.id,
          })),
          instructions: (r.analyzedInstructions[0]?.steps ?? []).map((s) => s.step),
          cachedAt: now,
        },
      },
      upsert: true,
    },
  }));

  await Recipe.bulkWrite(ops);

  const upserted = await Recipe.find({
    source: 'spoonacular',
    spoonacularId: { $in: apiResults.map((r) => r.id) },
  });

  return { results: upserted.map(toResponse), stale: false };
}
