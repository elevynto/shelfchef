import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { PantryItemSchema, UpdatePantryItemSchema, BulkAddPantryItemsSchema } from '@shelfchef/shared';
import * as pantryService from '../services/pantry.service.js';
import { requireAuth, requireHousehold } from '../middleware/authenticate.js';

const router = Router();

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth, requireHousehold);

router.get(
  '/',
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const items = await pantryService.listItems(req.householdId!);
    res.json({ items });
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const input = PantryItemSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const item = await pantryService.addItem(req.householdId!, req.user!.id, input);
    res.status(201).json({ item });
  }),
);

// Register /bulk before /:id to prevent Express treating 'bulk' as an id
router.post(
  '/bulk',
  wrap(async (req, res) => {
    const { items: inputs } = BulkAddPantryItemsSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const items = await pantryService.bulkAdd(req.householdId!, req.user!.id, inputs);
    res.status(201).json({ items });
  }),
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const input = UpdatePantryItemSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const item = await pantryService.updateItem(req.householdId!, req.params.id!, input);
    res.json({ item });
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await pantryService.deleteItem(req.householdId!, req.params.id!);
    res.status(204).send();
  }),
);

export default router;
