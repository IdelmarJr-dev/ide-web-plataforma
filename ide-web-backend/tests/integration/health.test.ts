import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('returns the service health status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: expect.stringMatching(/^(up|degraded|down)$/),
      uptimeSeconds: expect.any(Number),
      checkedAt: expect.any(String),
    });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
