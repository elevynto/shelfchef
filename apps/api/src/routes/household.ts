import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { CreateHouseholdSchema, JoinHouseholdSchema } from '@shelfchef/shared';
import * as householdService from '../services/household.service.js';
import { requireAuth } from '../middleware/authenticate.js';

const router = Router();

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

router.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const { name } = CreateHouseholdSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const household = await householdService.createHousehold(req.user!.id, name);
    res.status(201).json({ household });
  }),
);

router.get(
  '/current',
  requireAuth,
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const household = await householdService.getHousehold(req.user!.id);
    res.json({ household });
  }),
);

router.post(
  '/current/invites',
  requireAuth,
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const invite = await householdService.generateInvite(req.user!.id);
    res.status(201).json(invite);
  }),
);

router.post(
  '/join',
  requireAuth,
  wrap(async (req, res) => {
    const { code } = JoinHouseholdSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const household = await householdService.joinHousehold(req.user!.id, code);
    res.json({ household });
  }),
);

export default router;
