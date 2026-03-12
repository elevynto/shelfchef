export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  household: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
