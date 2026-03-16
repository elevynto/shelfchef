import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';
import { User } from '../../src/models/user.js';
import { Household } from '../../src/models/household.js';
import { HouseholdInvite } from '../../src/models/householdInvite.js';
import { PantryItem } from '../../src/models/pantryItem.js';

const app = createApp();

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Household.deleteMany({}),
    HouseholdInvite.deleteMany({}),
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

const validItem = {
  name: 'Flour',
  quantity: 500,
  unit: 'g',
};

// ── GET /api/v1/pantry ─────────────────────────────────────────────────────────

describe('GET /api/v1/pantry', () => {
  it('200 + empty array when pantry is empty', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).get('/api/v1/pantry').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('200 + returns items belonging to the household', async () => {
    const token = await registerAndSetupHousehold();
    await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);

    const res = await request(app).get('/api/v1/pantry').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ name: 'flour', quantity: 500, unit: 'g' });
  });

  it('does not return items from a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    await request(app).post('/api/v1/pantry').set(auth(tokenA)).send(validItem);

    const res = await request(app).get('/api/v1/pantry').set(auth(tokenB));
    expect(res.body.items).toHaveLength(0);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .get('/api/v1/pantry')
      .set(auth(reg.body.accessToken as string));
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect((await request(app).get('/api/v1/pantry')).status).toBe(401);
  });
});

// ── POST /api/v1/pantry ────────────────────────────────────────────────────────

describe('POST /api/v1/pantry', () => {
  it('201 + item on valid input', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: 'flour', quantity: 500, unit: 'g' });
    expect(res.body.item.id).toBeDefined();
    expect(res.body.item.household).toBeDefined();
    expect(res.body.item.addedBy).toBeDefined();
    expect(res.body.item.expiresAt).toBeNull();
  });

  it('normalises name to lowercase', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ ...validItem, name: 'All-Purpose Flour' });
    expect(res.body.item.name).toBe('all-purpose flour');
  });

  it('stores expiresAt when provided', async () => {
    const token = await registerAndSetupHousehold();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ ...validItem, expiresAt });
    expect(res.status).toBe(201);
    expect(typeof res.body.item.expiresAt).toBe('string');
  });

  it('stores aliases normalised to lowercase', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ ...validItem, aliases: ['AP Flour', 'Plain Flour'] });
    expect(res.body.item.aliases).toEqual(['ap flour', 'plain flour']);
  });

  it('400 on missing name', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ quantity: 100, unit: 'g' });
    expect(res.status).toBe(400);
  });

  it('400 on negative quantity', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ ...validItem, quantity: -1 });
    expect(res.status).toBe(400);
  });

  it('400 on invalid unit', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(token))
      .send({ ...validItem, unit: 'banana' });
    expect(res.status).toBe(400);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/v1/pantry')
      .set(auth(reg.body.accessToken as string))
      .send(validItem);
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect((await request(app).post('/api/v1/pantry').send(validItem)).status).toBe(401);
  });
});

// ── PATCH /api/v1/pantry/:id ───────────────────────────────────────────────────

describe('PATCH /api/v1/pantry/:id', () => {
  it('200 + updates a single field', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const res = await request(app)
      .patch(`/api/v1/pantry/${itemId}`)
      .set(auth(token))
      .send({ quantity: 250 });

    expect(res.status).toBe(200);
    expect(res.body.item.quantity).toBe(250);
    expect(res.body.item.name).toBe('flour');
  });

  it('sets expiresAt and clears it with null', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    await request(app)
      .patch(`/api/v1/pantry/${itemId}`)
      .set(auth(token))
      .send({ expiresAt });

    const clearRes = await request(app)
      .patch(`/api/v1/pantry/${itemId}`)
      .set(auth(token))
      .send({ expiresAt: null });

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.item.expiresAt).toBeNull();
  });

  it('400 on empty body', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const res = await request(app)
      .patch(`/api/v1/pantry/${itemId}`)
      .set(auth(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 when item belongs to a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app).post('/api/v1/pantry').set(auth(tokenA)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const res = await request(app)
      .patch(`/api/v1/pantry/${itemId}`)
      .set(auth(tokenB))
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .patch('/api/v1/pantry/not-an-id')
      .set(auth(token))
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .patch('/api/v1/pantry/000000000000000000000001')
      .set(auth(reg.body.accessToken as string))
      .send({ quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect(
      (await request(app).patch('/api/v1/pantry/000000000000000000000001').send({ quantity: 1 }))
        .status,
    ).toBe(401);
  });
});

// ── DELETE /api/v1/pantry/:id ──────────────────────────────────────────────────

describe('DELETE /api/v1/pantry/:id', () => {
  it('204 on successful delete', async () => {
    const token = await registerAndSetupHousehold();
    const createRes = await request(app).post('/api/v1/pantry').set(auth(token)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const res = await request(app)
      .delete(`/api/v1/pantry/${itemId}`)
      .set(auth(token));
    expect(res.status).toBe(204);

    const list = await request(app).get('/api/v1/pantry').set(auth(token));
    expect(list.body.items).toHaveLength(0);
  });

  it('404 when item belongs to a different household', async () => {
    const tokenA = await registerAndSetupHousehold('a@example.com');
    const tokenB = await registerAndSetupHousehold('b@example.com');

    const createRes = await request(app).post('/api/v1/pantry').set(auth(tokenA)).send(validItem);
    const { id: itemId } = createRes.body.item as { id: string };

    const res = await request(app)
      .delete(`/api/v1/pantry/${itemId}`)
      .set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('404 on invalid id format', async () => {
    const token = await registerAndSetupHousehold();
    expect(
      (await request(app).delete('/api/v1/pantry/not-an-id').set(auth(token))).status,
    ).toBe(404);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .delete('/api/v1/pantry/000000000000000000000001')
      .set(auth(reg.body.accessToken as string));
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect(
      (await request(app).delete('/api/v1/pantry/000000000000000000000001')).status,
    ).toBe(401);
  });
});

// ── POST /api/v1/pantry/bulk ───────────────────────────────────────────────────

describe('POST /api/v1/pantry/bulk', () => {
  it('201 + all items created', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry/bulk')
      .set(auth(token))
      .send({
        items: [
          { name: 'Eggs', quantity: 12, unit: 'piece' },
          { name: 'Milk', quantity: 1, unit: 'l' },
          { name: 'Butter', quantity: 250, unit: 'g' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(3);
    expect((res.body.items as Array<{ name: string }>).map((i) => i.name)).toEqual(
      expect.arrayContaining(['eggs', 'milk', 'butter']),
    );
  });

  it('400 on empty items array', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry/bulk')
      .set(auth(token))
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('400 on invalid item in array', async () => {
    const token = await registerAndSetupHousehold();
    const res = await request(app)
      .post('/api/v1/pantry/bulk')
      .set(auth(token))
      .send({ items: [{ name: '', quantity: 1, unit: 'g' }] });
    expect(res.status).toBe(400);
  });

  it('403 when user has no household', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'nohousehold@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/v1/pantry/bulk')
      .set(auth(reg.body.accessToken as string))
      .send({ items: [validItem] });
    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    expect(
      (await request(app).post('/api/v1/pantry/bulk').send({ items: [validItem] })).status,
    ).toBe(401);
  });
});
