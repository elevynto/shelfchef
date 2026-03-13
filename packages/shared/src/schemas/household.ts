import { z } from 'zod';

export const CreateHouseholdSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export const JoinHouseholdSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{8}$/, 'Invalid invite code format'),
});

export type CreateHouseholdInput = z.infer<typeof CreateHouseholdSchema>;
export type JoinHouseholdInput = z.infer<typeof JoinHouseholdSchema>;
