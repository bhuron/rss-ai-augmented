import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { basicAuth } from '../../../src/middleware/basicAuth.js';

const app = express();
app.use(basicAuth);
app.get('/test', (req, res) => res.json({ ok: true }));

const OLD_ENV = { ...process.env };

describe('Basic Auth Middleware', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('should allow requests when no auth is configured', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('should return 401 when no credentials provided', async () => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASSWORD = 'secret';

    const response = await request(app).get('/test');
    expect(response.status).toBe(401);
    // WWW-Authenticate is deliberately absent — the SPA handles login
    // with a custom form, not the browser's native dialog.
    expect(response.headers['www-authenticate']).toBeUndefined();
  });

  it('should return 401 for wrong username', async () => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASSWORD = 'secret';

    const response = await request(app)
      .get('/test')
      .auth('wrong', 'secret');

    expect(response.status).toBe(401);
  });

  it('should return 401 for wrong password', async () => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASSWORD = 'secret';

    const response = await request(app)
      .get('/test')
      .auth('admin', 'wrong');

    expect(response.status).toBe(401);
  });

  it('should return 200 for correct credentials', async () => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASSWORD = 'secret';

    const response = await request(app)
      .get('/test')
      .auth('admin', 'secret');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('should pass through when only one env var is set', async () => {
    process.env.BASIC_AUTH_USER = 'admin';
    delete process.env.BASIC_AUTH_PASSWORD;

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
  });
});
