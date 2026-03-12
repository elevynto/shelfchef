import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { HydratedDocument } from 'mongoose';
import { env } from '../config/env.js';
import { User, IUser } from '../models/user.js';
import { AppError } from '../utils/errors.js';
import type { AuthUser } from '@shelfchef/shared';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '15m' });
}


function toAuthUser(user: HydratedDocument<IUser>): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    emailVerified: user.emailVerified,
    household: user.household ? user.household.toString() : null,
  };
}

async function issueTokens(userId: string): Promise<TokenPair> {
  const accessToken = generateAccessToken(userId);
  const jti = randomUUID();
  const refreshToken = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  const refreshTokenHash = await bcrypt.hash(jti, 10);
  await User.findByIdAndUpdate(userId, { $set: { refreshTokenHash } });
  return { accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AppError(409, 'Email already in use', 'EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    emailVerified: false,
    household: null,
    refreshTokenHash: null,
  });

  const userId = user._id.toString();
  const tokens = await issueTokens(userId);
  return { user: toAuthUser(user), tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (!user.passwordHash) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const userId = user._id.toString();
  const tokens = await issueTokens(userId);
  return { user: toAuthUser(user), tokens };
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  let payload: { sub: string; jti: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      jti: string;
    };
  } catch {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.refreshTokenHash) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Compare jti (not the full JWT) — bcrypt truncates inputs at 72 bytes,
  // so hashing the full token would make tokens with the same sub compare equal.
  const valid = await bcrypt.compare(payload.jti, user.refreshTokenHash);
  if (!valid) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  return issueTokens(payload.sub);
}

export async function logout(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return toAuthUser(user);
}
