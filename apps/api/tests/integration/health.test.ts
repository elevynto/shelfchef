import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('includes a version field', async () => {
    const res = await request(app).get('/api/v1/health');
    const body = res.body as { version: unknown };
    expect(typeof body.version).toBe('string');
  });
});
