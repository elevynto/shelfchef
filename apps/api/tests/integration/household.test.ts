import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';
import { User } from '../../src/models/user.js';
import { Household } from '../../src/models/household.js';
import { HouseholdInvite } from '../../src/models/householdInvite.js';

const app = createApp();

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Household.deleteMany({}),
    HouseholdInvite.deleteMany({}),
  ]);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function registerUser(email = 'user@example.com', password = 'password123') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password });
  return res.body.accessToken as string;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── POST /api/v1/households ────────────────────────────────────────────────────

describe('POST /api/v1/households', () => {
  it('201 + household on valid input', async () => {
    const token = await registerUser();
    const res = await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'Smith Family' });

    expect(res.status).toBe(201);
    expect(res.body.household).toMatchObject({
      name: 'Smith Family',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      members: expect.arrayContaining([
        expect.objectContaining({ email: 'user@example.com' }),
      ]),
    });
    expect(res.body.household.id).toBeDefined();
  });

  it('updates user.household after creation', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'My House' });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token));
    expect(me.body.household).not.toBeNull();
  });

  it('400 on missing name', async () => {
    const token = await registerUser();
    const res = await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 on name longer than 80 chars', async () => {
    const token = await registerUser();
    const res = await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'x'.repeat(81) });
    expect(res.status).toBe(400);
  });

  it('409 when user already belongs to a household', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'First House' });

    const res = await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'Second House' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_HOUSEHOLD');
  });

  it('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/households')
      .send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/households/current ────────────────────────────────────────────

describe('GET /api/v1/households/current', () => {
  it('200 with household and members', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'The Loft' });

    const res = await request(app)
      .get('/api/v1/households/current')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.household).toMatchObject({
      name: 'The Loft',
      members: [expect.objectContaining({ email: 'user@example.com' })],
    });
  });

  it('404 when user has no household', async () => {
    const token = await registerUser();
    const res = await request(app)
      .get('/api/v1/households/current')
      .set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_HOUSEHOLD');
  });

  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/households/current');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/households/current/invites ───────────────────────────────────

describe('POST /api/v1/households/current/invites', () => {
  it('201 + code + expiresAt for household member', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'Casa' });

    const res = await request(app)
      .post('/api/v1/households/current/invites')
      .set(authHeader(token));

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(typeof res.body.expiresAt).toBe('string');
    const expiresAt = new Date(res.body.expiresAt as string);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000);
  });

  it('multiple invites can be generated for the same household', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(token))
      .send({ name: 'Casa' });

    const r1 = await request(app)
      .post('/api/v1/households/current/invites')
      .set(authHeader(token));
    const r2 = await request(app)
      .post('/api/v1/households/current/invites')
      .set(authHeader(token));

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.code).not.toBe(r2.body.code);
  });

  it('403 when user has no household', async () => {
    const token = await registerUser();
    const res = await request(app)
      .post('/api/v1/households/current/invites')
      .set(authHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NO_HOUSEHOLD');
  });

  it('401 without token', async () => {
    const res = await request(app).post('/api/v1/households/current/invites');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/households/join ──────────────────────────────────────────────

describe('POST /api/v1/households/join', () => {
  async function setupInvite() {
    const ownerToken = await registerUser('owner@example.com');
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(ownerToken))
      .send({ name: 'Shared Flat' });
    const inviteRes = await request(app)
      .post('/api/v1/households/current/invites')
      .set(authHeader(ownerToken));
    return { ownerToken, code: inviteRes.body.code as string };
  }

  it('200 + household with both members after join', async () => {
    const { code } = await setupInvite();
    const joinerToken = await registerUser('joiner@example.com');

    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body.household.members).toHaveLength(2);
    expect(res.body.household.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'owner@example.com' }),
        expect.objectContaining({ email: 'joiner@example.com' }),
      ]),
    );
  });

  it('updates joiner user.household', async () => {
    const { code } = await setupInvite();
    const joinerToken = await registerUser('joiner@example.com');

    await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(joinerToken));
    expect(me.body.household).not.toBeNull();
  });

  it('409 when invite is already used', async () => {
    const { code } = await setupInvite();
    const joiner1Token = await registerUser('j1@example.com');
    const joiner2Token = await registerUser('j2@example.com');

    await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joiner1Token))
      .send({ code });

    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joiner2Token))
      .send({ code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITE_ALREADY_USED');
  });

  it('410 when invite is expired', async () => {
    const { code } = await setupInvite();
    // Back-date the invite's expiresAt
    await HouseholdInvite.updateOne({ code }, { expiresAt: new Date(Date.now() - 1000) });

    const joinerToken = await registerUser('joiner@example.com');
    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('INVITE_EXPIRED');
  });

  it('404 on unknown code', async () => {
    const joinerToken = await registerUser('joiner@example.com');
    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code: 'XXXXXXXX' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVITE_NOT_FOUND');
  });

  it('409 when joiner already belongs to a household', async () => {
    const { code } = await setupInvite();
    const joinerToken = await registerUser('joiner@example.com');
    await request(app)
      .post('/api/v1/households')
      .set(authHeader(joinerToken))
      .send({ name: 'My Own House' });

    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_HOUSEHOLD');
  });

  it('400 on invalid code format', async () => {
    const joinerToken = await registerUser('joiner@example.com');
    const res = await request(app)
      .post('/api/v1/households/join')
      .set(authHeader(joinerToken))
      .send({ code: 'bad' });
    expect(res.status).toBe(400);
  });

  it('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/households/join')
      .send({ code: 'ABCD1234' });
    expect(res.status).toBe(401);
  });
});
