import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server.js';
import { User } from '../../src/models/user.js';
import { Household } from '../../src/models/household.js';
import { HouseholdInvite } from '../../src/models/householdInvite.js';
import { Recipe } from '../../src/models/recipe.js';
import { PantryItem } from '../../src/models/pantryItem.js';

const app = createApp();

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Household.deleteMany({}),
    HouseholdInvite.deleteMany({}),
    Recipe.deleteMany({}),
    PantryItem.deleteMany({}),
  ]);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function registerAndSetupHousehold(email = 'user@example.com') {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  const token = reg.body.accessToken as string;

  await request(app)
    .post('/api/v1/households')
    .set(auth(token))
    .send({ name: 'Test House' });

  return token;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const validRecipe = {
  title: 'Pancakes',
  description: 'Fluffy pancakes',
  servings: 4,
  readyInMinutes: 20,
  ingredients: [
    { name: 'Flour', quantity: 200, unit: 'g' },
    { name: 'Milk', quantity: 300, unit: 'ml' },
    { name: 'Eggs', quantity: 2, unit: 'piece' },
  ],
  instructions: ['Mix dry ingredients', 'Add wet ingredients', 'Cook on pan'],
};

// ── GET /api/v1/recipes ────────────────────────────────────────────────────────

describe('GET /api/v1/recipes', () => {
  it('200 + empty array when no custom recipes', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).get('/api/v1/recipes').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.recipes).toEqual([]);
  });

  it('200 + returns custom recipes for the household', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);

    const res = await request(app).get('/api/v1/recipes').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0]).toMatchObject({ title: 'Pancakes', source: 'custom' });
  });

  it('does not return recipes from a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    await request(app).post('/api/v1/recipes').set(auth(tokenA)).send(validRecipe);

    const res = await request(app).get('/api/v1/recipes').set(auth(tokenB));
    expect(res.body.recipes).toHaveLength(0);
  });

  it('filters by q param (case-insensitive title match)', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);
    await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({ ...validRecipe, title: 'Waffles' });

    const res = await request(app).get('/api/v1/recipes?q=pancake').set(auth(token));
    expect(res.body.recipes).toHaveLength(1);
    expect((res.body.recipes as Array<{ title: string }>)[0]!.title).toBe('Pancakes');
  });

  it('does not return Spoonacular-cached recipes', async () => {
    const token = await registerAndSetupHousehold();
    // Seed a spoonacular recipe directly
    await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 99999,
      household: null,
      title: 'Pancakes',
      description: '',
      imageUrl: null,
      servings: 2,
      readyInMinutes: 10,
      ingredients: [],
      instructions: [],
      cachedAt: new Date(),
    });

    const res = await request(app).get('/api/v1/recipes').set(auth(token));
    expect(res.body.recipes).toHaveLength(0);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .get('/api/v1/recipes')
      .set(auth(reg.body.accessToken as string));
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect((await request(app).get('/api/v1/recipes')).status).toBe(401);
  });
});

// ── POST /api/v1/recipes ───────────────────────────────────────────────────────

describe('POST /api/v1/recipes', () => {
  it('201 + recipe on valid input', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);

    expect(res.status).toBe(201);
    expect(res.body.recipe).toMatchObject({
      title: 'Pancakes',
      source: 'custom',
      servings: 4,
    });
    expect(res.body.recipe.id).toBeDefined();
    expect(res.body.recipe.household).toBeDefined();
    expect(res.body.recipe.spoonacularId).toBeNull();
  });

  it('normalises ingredient names to lowercase', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);
    const ingredients = res.body.recipe.ingredients as Array<{ name: string }>;
    expect(ingredients.map((i) => i.name)).toEqual(['flour', 'milk', 'eggs']);
  });

  it('description defaults to empty string when omitted', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({
        title: validRecipe.title,
        servings: validRecipe.servings,
        readyInMinutes: validRecipe.readyInMinutes,
        ingredients: validRecipe.ingredients,
        instructions: validRecipe.instructions,
      });
    expect(res.status).toBe(201);
    expect(res.body.recipe.description).toBe('');
  });

  it('400 on missing title', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({
        description: validRecipe.description,
        servings: validRecipe.servings,
        ingredients: validRecipe.ingredients,
        instructions: validRecipe.instructions,
      });
    expect(res.status).toBe(400);
  });

  it('400 on empty ingredients array', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({ ...validRecipe, ingredients: [] });
    expect(res.status).toBe(400);
  });

  it('400 on empty instructions array', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({ ...validRecipe, instructions: [] });
    expect(res.status).toBe(400);
  });

  it('400 on invalid ingredient unit', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({
        ...validRecipe,
        ingredients: [{ name: 'Flour', quantity: 200, unit: 'banana' }],
      });
    expect(res.status).toBe(400);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/v1/recipes')
      .set(auth(reg.body.accessToken as string))
      .send(validRecipe);
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect((await request(app).post('/api/v1/recipes').send(validRecipe)).status).toBe(401);
  });
});

// ── GET /api/v1/recipes/:id ────────────────────────────────────────────────────

describe('GET /api/v1/recipes/:id', () => {
  it('200 + recipe for own custom recipe', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app).get(`/api/v1/recipes/${recipeId}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.recipe.id).toBe(recipeId);
  });

  it('200 + returns Spoonacular cached recipe (globally accessible)', async () => {
    const token = await registerAndSetupHousehold();
    const spoon = await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 12345,
      household: null,
      title: 'Spaghetti Bolognese',
      description: '',
      imageUrl: null,
      servings: 4,
      readyInMinutes: 45,
      ingredients: [],
      instructions: ['Boil pasta', 'Make sauce'],
      cachedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/v1/recipes/${spoon._id.toString()}`)
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.recipe.source).toBe('spoonacular');
  });

  it('404 when recipe belongs to different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(tokenA))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app).get(`/api/v1/recipes/${recipeId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).get('/api/v1/recipes/not-an-id').set(auth(token));
    expect(res.status).toBe(404);
  });

  it('401 without token', async () => {
    expect((await request(app).get('/api/v1/recipes/000000000000000000000001')).status).toBe(401);
  });
});

// ── PATCH /api/v1/recipes/:id ──────────────────────────────────────────────────

describe('PATCH /api/v1/recipes/:id', () => {
  it('200 + updates a single field', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app)
      .patch(`/api/v1/recipes/${recipeId}`)
      .set(auth(token))
      .send({ servings: 8 });

    expect(res.status).toBe(200);
    expect(res.body.recipe.servings).toBe(8);
    expect(res.body.recipe.title).toBe('Pancakes');
  });

  it('400 on empty body', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app)
      .patch(`/api/v1/recipes/${recipeId}`)
      .set(auth(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 when recipe belongs to a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(tokenA))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app)
      .patch(`/api/v1/recipes/${recipeId}`)
      .set(auth(tokenB))
      .send({ servings: 2 });
    expect(res.status).toBe(404);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .patch('/api/v1/recipes/not-an-id')
      .set(auth(token))
      .send({ servings: 2 });
    expect(res.status).toBe(404);
  });

  it('404 when attempting to update a Spoonacular recipe', async () => {
    const token = await registerAndSetupHousehold();
    const spoon = await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 77777,
      household: null,
      title: 'Cached Recipe',
      description: '',
      imageUrl: null,
      servings: 2,
      readyInMinutes: 30,
      ingredients: [],
      instructions: ['Step 1'],
      cachedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/v1/recipes/${spoon._id.toString()}`)
      .set(auth(token))
      .send({ servings: 4 });
    expect(res.status).toBe(404);
  });

  it('401 without token', async () => {
    expect(
      (
        await request(app)
          .patch('/api/v1/recipes/000000000000000000000001')
          .send({ servings: 2 })
      ).status,
    ).toBe(401);
  });
});

// ── DELETE /api/v1/recipes/:id ─────────────────────────────────────────────────

describe('DELETE /api/v1/recipes/:id', () => {
  it('204 on successful delete', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app).delete(`/api/v1/recipes/${recipeId}`).set(auth(token));
    expect(res.status).toBe(204);

    const list = await request(app).get('/api/v1/recipes').set(auth(token));
    expect(list.body.recipes).toHaveLength(0);
  });

  it('404 when recipe belongs to a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(tokenA))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app).delete(`/api/v1/recipes/${recipeId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('404 when attempting to delete a Spoonacular recipe', async () => {
    const token = await registerAndSetupHousehold();
    const spoon = await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 55555,
      household: null,
      title: 'Cached Delete Test',
      description: '',
      imageUrl: null,
      servings: 2,
      readyInMinutes: 15,
      ingredients: [],
      instructions: ['Step 1'],
      cachedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/v1/recipes/${spoon._id.toString()}`)
      .set(auth(token));
    expect(res.status).toBe(404);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    expect(
      (await request(app).delete('/api/v1/recipes/not-an-id').set(auth(token))).status,
    ).toBe(404);
  });

  it('401 without token', async () => {
    expect(
      (await request(app).delete('/api/v1/recipes/000000000000000000000001')).status,
    ).toBe(401);
  });
});

// ── GET /api/v1/recipes/search ─────────────────────────────────────────────────

describe('GET /api/v1/recipes/search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('400 when q param is missing', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).get('/api/v1/recipes/search').set(auth(token));
    expect(res.status).toBe(400);
  });

  it('200 + results from Spoonacular API and caches them', async () => {
    const token = await registerAndSetupHousehold();

    const mockSpoonacularResponse = {
      results: [
        {
          id: 11111,
          title: 'Chicken Soup',
          summary: '<p>A hearty soup.</p>',
          image: 'https://example.com/soup.jpg',
          servings: 4,
          readyInMinutes: 60,
          extendedIngredients: [
            { id: 1001, name: 'Chicken', amount: 500, unit: 'g' },
            { id: 1002, name: 'Carrots', amount: 2, unit: 'piece' },
          ],
          analyzedInstructions: [
            { steps: [{ step: 'Boil chicken' }, { step: 'Add vegetables' }] },
          ],
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSpoonacularResponse),
    } as Response);

    const res = await request(app)
      .get('/api/v1/recipes/search?q=chicken+soup')
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(false);
    expect(res.body.results).toHaveLength(1);
    expect((res.body.results as Array<{ title: string }>)[0]!.title).toBe('Chicken Soup');
    expect((res.body.results as Array<{ description: string }>)[0]!.description).toBe(
      'A hearty soup.',
    );

    // Verify cached in DB
    const cached = await Recipe.findOne({ spoonacularId: 11111 });
    expect(cached).not.toBeNull();
    expect(cached?.cachedAt).not.toBeNull();
  });

  it('returns fresh cache without hitting Spoonacular API', async () => {
    const token = await registerAndSetupHousehold();

    // Seed fresh cache
    await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 22222,
      household: null,
      title: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      imageUrl: null,
      servings: 2,
      readyInMinutes: 20,
      ingredients: [],
      instructions: ['Cook pasta'],
      cachedAt: new Date(), // fresh
    });

    const res = await request(app)
      .get('/api/v1/recipes/search?q=pasta+carbonara')
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(res.body.stale).toBe(false);
  });

  it('returns stale: true when Spoonacular errors but stale cache exists', async () => {
    const token = await registerAndSetupHousehold();

    // Seed stale cache (older than 24h)
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 33333,
      household: null,
      title: 'Old Stew',
      description: '',
      imageUrl: null,
      servings: 6,
      readyInMinutes: 90,
      ingredients: [],
      instructions: ['Stew it'],
      cachedAt: oldDate,
    });

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app)
      .get('/api/v1/recipes/search?q=old+stew')
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.results).toHaveLength(1);
  });

  it('503 when Spoonacular errors and no cache exists', async () => {
    const token = await registerAndSetupHousehold();

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app)
      .get('/api/v1/recipes/search?q=nonexistent+dish+xyz')
      .set(auth(token));

    expect(res.status).toBe(503);
  });

  it('401 without token', async () => {
    expect((await request(app).get('/api/v1/recipes/search?q=test')).status).toBe(401);
  });
});

// ── GET /api/v1/recipes/:id/pantry-match ──────────────────────────────────────

describe('GET /api/v1/recipes/:id/pantry-match', () => {
  it('score 0 when pantry is empty', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    expect(res.body.totalIngredients).toBe(3);
    expect(res.body.available).toHaveLength(0);
    expect(res.body.missing).toHaveLength(3);
  });

  it('score 1 when all ingredients present in sufficient quantity', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 500, unit: 'g' });
    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Milk', quantity: 500, unit: 'ml' });
    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Eggs', quantity: 6, unit: 'piece' });

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.available).toHaveLength(3);
    expect(res.body.missing).toHaveLength(0);
  });

  it('partial match returns correct score', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 500, unit: 'g' });

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    expect(res.body.available).toHaveLength(1);
    expect(res.body.missing).toHaveLength(2);
  });

  it('insufficient quantity → ingredient in missing', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 100, unit: 'g' });

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    const flourMissing = (res.body.missing as Array<{ name: string }>).find((i) => i.name === 'flour');
    expect(flourMissing).toBeDefined();
  });

  it('unit conversion within same family counts as available', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 1, unit: 'kg' });

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    const flourAvail = (res.body.available as Array<{ name: string }>).find((i) => i.name === 'flour');
    expect(flourAvail).toBeDefined();
  });

  it('cross-unit-family → unitMismatch: true in missing', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 5, unit: 'piece' });

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(token));

    const flourMissing = (res.body.missing as Array<{ name: string; unitMismatch: boolean }>).find(
      (i) => i.name === 'flour',
    );
    expect(flourMissing?.unitMismatch).toBe(true);
  });

  it('works for a Spoonacular cached recipe', async () => {
    const token = await registerAndSetupHousehold();
    const spoon = await Recipe.create({
      source: 'spoonacular',
      spoonacularId: 88888,
      household: null,
      title: 'Simple Toast',
      description: '',
      imageUrl: null,
      servings: 1,
      readyInMinutes: 5,
      ingredients: [{ name: 'bread', quantity: 2, unit: 'slice', spoonacularIngredientId: null }],
      instructions: ['Toast it'],
      cachedAt: new Date(),
    });

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'bread', quantity: 4, unit: 'slice' });

    const res = await request(app)
      .get(`/api/v1/recipes/${spoon._id.toString()}/pantry-match`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    expect(
      (await request(app).get('/api/v1/recipes/not-an-id/pantry-match').set(auth(token))).status,
    ).toBe(404);
  });

  it('404 when recipe belongs to different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app)
      .post('/api/v1/recipes')
      .set(auth(tokenA))
      .send(validRecipe);
    const { id: recipeId } = createRes.body.recipe as { id: string };

    const res = await request(app)
      .get(`/api/v1/recipes/${recipeId}/pantry-match`)
      .set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('401 without token', async () => {
    expect(
      (await request(app).get('/api/v1/recipes/000000000000000000000001/pantry-match')).status,
    ).toBe(401);
  });
});

// ── GET /api/v1/recipes?available=true ────────────────────────────────────────

describe('GET /api/v1/recipes?available=true', () => {
  it('returns only recipes where all ingredients are available', async () => {
    const token = await registerAndSetupHousehold();

    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);
    await request(app)
      .post('/api/v1/recipes')
      .set(auth(token))
      .send({
        ...validRecipe,
        title: 'Unobtainium Cake',
        ingredients: [{ name: 'unobtainium', quantity: 1, unit: 'g' }],
        instructions: ['Mix'],
      });

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 500, unit: 'g' });
    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Milk', quantity: 500, unit: 'ml' });
    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Eggs', quantity: 6, unit: 'piece' });

    const res = await request(app).get('/api/v1/recipes?available=true').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(1);
    expect((res.body.recipes as Array<{ title: string }>)[0]!.title).toBe('Pancakes');
  });

  it('returns empty when no recipe is fully covered', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);

    const res = await request(app).get('/api/v1/recipes?available=true').set(auth(token));
    expect(res.body.recipes).toHaveLength(0);
  });

  it('does not include partially available recipes', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);

    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Flour', quantity: 500, unit: 'g' });
    await request(app).post('/api/v1/pantry').set(auth(token)).send({ name: 'Milk', quantity: 500, unit: 'ml' });

    const res = await request(app).get('/api/v1/recipes?available=true').set(auth(token));
    expect(res.body.recipes).toHaveLength(0);
  });

  it('without available=true returns all recipes regardless of pantry', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/recipes').set(auth(token)).send(validRecipe);

    const res = await request(app).get('/api/v1/recipes').set(auth(token));
    expect(res.body.recipes).toHaveLength(1);
  });
});
