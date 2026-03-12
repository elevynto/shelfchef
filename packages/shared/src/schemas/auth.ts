import { z } from 'zod';

export const RegisterSchema = z.object({
  // Normalise at the boundary so callers never receive un-lowercased email
  email: z.string().email().transform((v) => v.toLowerCase()),
  // 72 is bcrypt's silent truncation limit; cap here prevents hash-collision and amplification
  password: z.string().min(8).max(72),
});

export const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
