import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGuest, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── PUT /v1/profile ────────────────────────────────────────────────────────

describe('PUT /v1/profile', () => {
  it('updates name only', async () => {
    const { token } = await makeUser({ name: 'Old Name' });
    const res = await request(app)
      .put('/v1/profile')
      .set(authHeader(token))
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
  });

  it('updates email only', async () => {
    const { token } = await makeUser({ email: 'before@test.com' });
    const res = await request(app)
      .put('/v1/profile')
      .set(authHeader(token))
      .send({ email: 'after@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('after@test.com');
  });

  it('returns 409 when new email is already taken', async () => {
    await makeUser({ email: 'taken@test.com' });
    const { token } = await makeUser({ email: 'free@test.com' });
    const res = await request(app)
      .put('/v1/profile')
      .set(authHeader(token))
      .send({ email: 'taken@test.com' });
    expect(res.status).toBe(409);
  });

  it('allows updating to the same email (no conflict with self)', async () => {
    const { token } = await makeUser({ email: 'same@test.com' });
    const res = await request(app)
      .put('/v1/profile')
      .set(authHeader(token))
      .send({ email: 'same@test.com' });
    expect(res.status).toBe(200);
  });

  it('upgrades a guest by setting email — returns new token and is_guest: false', async () => {
    const { token: guestToken } = await makeGuest('Priya');
    const res = await request(app)
      .put('/v1/profile')
      .set(authHeader(guestToken))
      .send({ email: 'priya@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.is_guest).toBe(false);
    expect(res.body.user.email).toBe('priya@test.com');
    expect(typeof res.body.token).toBe('string');

    // New token works
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.is_guest).toBe(false);
  });

  it('does not return a token when a non-guest updates', async () => {
    const { token } = await makeUser({ email: 'nonguest@test.com' });
    const res = await request(app).put('/v1/profile').set(authHeader(token)).send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
  });

  it('returns 400 for empty name string', async () => {
    const { token } = await makeUser();
    const res = await request(app).put('/v1/profile').set(authHeader(token)).send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const { token } = await makeUser();
    const res = await request(app).put('/v1/profile').set(authHeader(token)).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/v1/profile').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});
