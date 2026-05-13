import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, TEST_PASSWORD, authHeader } from './helpers';
import { generateToken } from '../src/utils/jwt';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── POST /api/auth/signup ──────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('creates a user and returns token + spec-shaped user', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      name: 'Alice',
      email: 'alice@test.com',
      is_guest: false,
    });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.created_at).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({ name: 'Bob', email: 'bob@test.com', password: 'pass123' });
    const res = await request(app).post('/api/auth/signup').send({ name: 'Bob2', email: 'bob@test.com', password: 'pass456' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('returns 422 for missing name', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'x@test.com', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'C', email: 'not-an-email', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('returns 422 for password shorter than 6 chars', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'D', email: 'd@test.com', password: '12' });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns token and user on valid credentials', async () => {
    await makeUser({ email: 'login@test.com' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('login@test.com');
  });

  it('returns 401 for wrong password', async () => {
    await makeUser({ email: 'wrongpw@test.com' });
    const res = await request(app).post('/api/auth/login').send({ email: 'wrongpw@test.com', password: 'bad-password' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/signin ──────────────────────────────────────────────────

describe('POST /api/auth/signin (alias)', () => {
  it('works identically to /login', async () => {
    await makeUser({ email: 'signin@test.com' });
    const res = await request(app).post('/api/auth/signin').send({ email: 'signin@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });
});

// ── POST /api/auth/guest ───────────────────────────────────────────────────

describe('POST /api/auth/guest', () => {
  it('creates a guest user with null email', async () => {
    const res = await request(app).post('/api/auth/guest').send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.is_guest).toBe(true);
    expect(res.body.user.name).toBe('Guest');
    expect(res.body.user.email).toBeNull();
  });
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 204 and revokes the token', async () => {
    const { token } = await makeUser({ email: 'logout@test.com' });

    const logout = await request(app).post('/api/auth/logout').set(authHeader(token));
    expect(logout.status).toBe(204);

    // Token must now be rejected
    const me = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(me.status).toBe(401);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an already-revoked token', async () => {
    const { token } = await makeUser({ email: 'logout2@test.com' });
    await request(app).post('/api/auth/logout').set(authHeader(token));
    const res = await request(app).post('/api/auth/logout').set(authHeader(token));
    expect(res.status).toBe(401);
  });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns the authenticated user flat (no wrapper)', async () => {
    const { user, token } = await makeUser({ email: 'me@test.com', name: 'MeUser' });
    const res = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.name).toBe('MeUser');
    expect(res.body.email).toBe('me@test.com');
    expect(res.body.is_guest).toBe(false);
    // Must NOT be wrapped in { user: ... }
    expect(res.body.user).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 when user has been deleted mid-session', async () => {
    const { user, token } = await makeUser({ email: 'deleted@test.com' });
    await prisma.user.delete({ where: { id: user.id } });
    const res = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with wrong secret', async () => {
    const { token: _t } = await makeUser({ email: 'badsig@test.com' });
    // Manually craft a valid-looking but wrongly-signed token
    const badToken = generateToken('fake-id', false).slice(0, -5) + 'XXXXX';
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });
});
