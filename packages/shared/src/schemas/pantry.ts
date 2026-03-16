import { z } from 'zod';
import { CanonicalUnit } from '../constants/unitConversions.js';

const canonicalUnitValues = Object.values(CanonicalUnit) as [string, ...string[]];

export const PantryItemSchema = z.object({
  name: z.string().min(1).max(200).transform((v) => v.toLowerCase().trim()),
  quantity: z.number().min(0),
  unit: z.enum(canonicalUnitValues),
  aliases: z
    .array(z.string().min(1).max(100).transform((v) => v.toLowerCase().trim()))
    .default([]),
  spoonacularIngredientId: z.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const UpdatePantryItemSchema = PantryItemSchema.partial();

export const BulkAddPantryItemsSchema = z.object({
  items: z.array(PantryItemSchema).min(1).max(100),
});

export type PantryItemInput = z.infer<typeof PantryItemSchema>;
export type UpdatePantryItemInput = z.infer<typeof UpdatePantryItemSchema>;
export type BulkAddPantryItemsInput = z.infer<typeof BulkAddPantryItemsSchema>;
