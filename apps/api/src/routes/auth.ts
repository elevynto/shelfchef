import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { RegisterSchema, LoginSchema } from '@shelfchef/shared';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/authenticate.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// Base options used for both setting and clearing — must match exactly so browsers honour clearCookie
const REFRESH_COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
};

const REFRESH_COOKIE_OPTIONS = {
  ...REFRESH_COOKIE_BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

router.post(
  '/register',
  wrap(async (req, res) => {
    const input = RegisterSchema.parse(req.body);
    const { user, tokens } = await authService.register(input);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ accessToken: tokens.accessToken, user });
  }),
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const input = LoginSchema.parse(req.body);
    const { user, tokens } = await authService.login(input);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken: tokens.accessToken, user });
  }),
);

router.post(
  '/refresh',
  wrap(async (req, res) => {
    const refreshToken = req.cookies.refresh_token as string | undefined;
    if (!refreshToken) {
      throw new AppError(401, 'No refresh token', 'NO_REFRESH_TOKEN');
    }
    const tokens = await authService.refreshTokens(refreshToken);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken: tokens.accessToken });
  }),
);

router.post(
  '/logout',
  requireAuth,
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await authService.logout(req.user!.id);
    res.clearCookie('refresh_token', REFRESH_COOKIE_BASE);
    res.json({ message: 'Logged out' });
  }),
);

router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const user = await authService.getMe(req.user!.id);
    res.json(user);
  }),
);

export default router;
