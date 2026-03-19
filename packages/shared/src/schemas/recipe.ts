import { z } from 'zod';
import { CanonicalUnit } from '../constants/unitConversions.js';

const canonicalUnitValues = Object.values(CanonicalUnit) as [string, ...string[]];

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1).max(200).transform((v) => v.toLowerCase().trim()),
  quantity: z.number().min(0),
  unit: z.enum(canonicalUnitValues),
  spoonacularIngredientId: z.number().int().positive().nullable().optional(),
});

export const CreateRecipeSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).default(''),
  imageUrl: z.string().url().nullable().optional(),
  servings: z.number().int().min(1),
  readyInMinutes: z.number().int().min(1).nullable().optional(),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export const UpdateRecipeSchema = CreateRecipeSchema.partial();

export type RecipeIngredientInput = z.infer<typeof RecipeIngredientSchema>;
export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof UpdateRecipeSchema>;
