export type { CanonicalUnit } from '../constants/unitConversions.js';
export type { PantryItemInput } from '../schemas/pantry.js';
export type { AuthUser, AuthResponse } from './auth.js';

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}
