import { z } from 'zod';
import { CanonicalUnit } from '../constants/unitConversions.js';

const canonicalUnitValues = Object.values(CanonicalUnit) as [string, ...string[]];

export const PantryItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().min(0),
  unit: z.enum(canonicalUnitValues),
  aliases: z.array(z.string().min(1).max(100)).default([]),
});

export type PantryItemInput = z.infer<typeof PantryItemSchema>;
