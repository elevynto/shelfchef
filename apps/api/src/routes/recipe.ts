import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { CreateRecipeSchema, UpdateRecipeSchema } from '@shelfchef/shared';
import * as recipeService from '../services/recipe.service.js';
import * as matchService from '../services/match.service.js';
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
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const available = req.query.available === 'true' ? true : undefined;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const recipes = await recipeService.listRecipes(req.householdId!, q, available);
    res.json({ recipes });
  }),
);

// Register /search before /:id to prevent Express treating 'search' as an id
router.get(
  '/search',
  wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    if (!q) {
      res.status(400).json({ error: 'q parameter is required', code: 'MISSING_QUERY' });
      return;
    }
    const result = await recipeService.searchSpoonacular(q);
    res.json(result);
  }),
);

// Register /:id/pantry-match before /:id so it isn't swallowed by the param route
router.get(
  '/:id/pantry-match',
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await matchService.getRecipeMatch(req.params.id!, req.householdId!);
    res.json(result);
  }),
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const recipe = await recipeService.getRecipe(req.householdId!, req.params.id!);
    res.json({ recipe });
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const input = CreateRecipeSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const recipe = await recipeService.createRecipe(req.householdId!, input);
    res.status(201).json({ recipe });
  }),
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const input = UpdateRecipeSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const recipe = await recipeService.updateRecipe(req.householdId!, req.params.id!, input);
    res.json({ recipe });
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await recipeService.deleteRecipe(req.householdId!, req.params.id!);
    res.status(204).send();
  }),
);

export default router;
