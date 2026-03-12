import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';
import { User } from '../../src/models/user.js';

const app = createApp();

afterEach(async () => {
  await User.deleteMany({});
});

function extractRefreshCookie(cookies: string[]): string {
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh_token cookie not found');
  return cookie;
}

describe('POST /api/v1/auth/register', () => {
  it('201 + accessToken + refresh cookie on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user).toMatchObject({
      email: 'user@example.com',
      emailVerified: false,
      household: null,
    });
    expect(res.body.user.id).toBeDefined();
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 on password too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 on missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('normalises email to lowercase', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'Case@Example.COM', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'case@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('case@example.com');
  });

  it('409 on duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dupe@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dupe@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_IN_USE');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('200 + accessToken + refresh cookie on valid credentials', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'login@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe('login@example.com');
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('400 on missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('login invalidates the refresh token issued at registration', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'relogin@example.com', password: 'password123' });

    const regCookies = regRes.headers['set-cookie'] as string[];
    const registerCookie = extractRefreshCookie(regCookies);

    // Login overwrites refreshTokenHash
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'relogin@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', registerCookie);

    expect(res.status).toBe(401);
  });

  it('401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('401 on wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'wrongpw@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'wrongpw@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('200 + new accessToken when cookie present', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'refresh@example.com', password: 'password123' });

    const cookies = regRes.headers['set-cookie'] as string[];
    const refreshCookie = extractRefreshCookie(cookies);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    const newCookies = res.headers['set-cookie'] as string[];
    expect(newCookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('401 on missing cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('401 on tampered token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=tampered.token.value');
    expect(res.status).toBe(401);
  });

  it('new access token from refresh is usable on /me', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'refreshme@example.com', password: 'password123' });

    const regCookies = regRes.headers['set-cookie'] as string[];
    const refreshCookie = extractRefreshCookie(regCookies);

    const refRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    const { accessToken } = refRes.body as { accessToken: string };

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('refreshme@example.com');
  });

  it('token rotation: old refresh token rejected after use', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'rotate@example.com', password: 'password123' });

    const cookies = regRes.headers['set-cookie'] as string[];
    const originalCookie = extractRefreshCookie(cookies);

    // Use the original refresh token once (rotates it)
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);

    // The original token should now be rejected
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('200 and cookie cleared', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'logout@example.com', password: 'password123' });

    const { accessToken } = regRes.body as { accessToken: string };
    const cookies = regRes.headers['set-cookie'] as string[];
    const refreshCookie = extractRefreshCookie(cookies);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    // Refresh token should be invalidated
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('401 without Bearer token', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('200 with AuthUser on valid token', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'me@example.com', password: 'password123' });

    const { accessToken } = regRes.body as { accessToken: string };

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'me@example.com',
      emailVerified: false,
      household: null,
    });
    expect(res.body.id).toBeDefined();
  });

  it('401 without Bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 with invalid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(res.status).toBe(401);
  });

  it('404 when user is deleted after token was issued', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'deleted@example.com', password: 'password123' });

    const { accessToken } = regRes.body as { accessToken: string };

    await User.deleteMany({ email: 'deleted@example.com' });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });
});
