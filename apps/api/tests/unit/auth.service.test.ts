import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/models/user.js', () => ({
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_value'),
    compare: vi.fn(),
  },
}));

// Import after mocks are set up
const { User } = await import('../../src/models/user.js');
const authService = await import('../../src/services/auth.service.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateAccessToken()', () => {
  it('produces a verifiable JWT with correct sub', () => {
    const token = authService.generateAccessToken('user123');
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    expect(payload.sub).toBe('user123');
  });
});


describe('register()', () => {
  it('throws 409 AppError when email is already taken', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ email: 'taken@example.com' } as never);

    await expect(
      authService.register({ email: 'taken@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_IN_USE' });

    expect(vi.mocked(User.findOne)).toHaveBeenCalledWith({ email: 'taken@example.com' });
  });

  it('throws an AppError instance', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ email: 'taken@example.com' } as never);

    const err = await authService
      .register({ email: 'taken@example.com', password: 'password123' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
  });
});

describe('login()', () => {
  it('throws 401 when no user found', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 when user has no passwordHash (OAuth-only account)', async () => {
    vi.mocked(User.findOne).mockResolvedValue({
      email: 'oauth@example.com',
      passwordHash: null,
    } as never);

    await expect(
      authService.login({ email: 'oauth@example.com', password: 'anything' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 on wrong password', async () => {
    vi.mocked(User.findOne).mockResolvedValue({
      email: 'user@example.com',
      passwordHash: 'hashed_value',
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrongpassword' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });
});
