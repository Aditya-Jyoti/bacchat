import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGroup, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── GET /v1/invite/:inviteCode ─────────────────────────────────────────────

describe('GET /v1/invite/:inviteCode', () => {
  it('returns group preview without auth', async () => {
    const { user } = await makeUser();
    const group = await makeGroup(user.id, { name: 'PartyTime', emoji: '🎉' });

    const res = await request(app).get(`/v1/invite/${group.inviteCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      group_id: group.id,
      name: 'PartyTime',
      emoji: '🎉',
      member_count: 1,
    });
  });

  it('returns 404 for unknown invite code', async () => {
    const res = await request(app).get('/v1/invite/no-such-code');
    expect(res.status).toBe(404);
  });
});

// ── POST /v1/invite/:inviteCode/join ───────────────────────────────────────

describe('POST /v1/invite/:inviteCode/join (unauthenticated / guest)', () => {
  it('creates a guest user and adds them to the group', async () => {
    const { user: owner } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app)
      .post(`/v1/invite/${group.inviteCode}/join`)
      .send({ name: 'Priya' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.is_guest).toBe(true);
    expect(res.body.user.name).toBe('Priya');
    expect(res.body.group.id).toBe(group.id);
    expect(res.body.group.members).toHaveLength(2);
  });

  it('returns 400 when unauthenticated and name is missing', async () => {
    const { user: owner } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app).post(`/v1/invite/${group.inviteCode}/join`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when unauthenticated and name is empty string', async () => {
    const { user: owner } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app).post(`/v1/invite/${group.inviteCode}/join`).send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for bad invite code', async () => {
    const res = await request(app).post('/v1/invite/bad-code/join').send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('POST /v1/invite/:inviteCode/join (authenticated)', () => {
  it('adds authenticated user to group and returns null token', async () => {
    const { user: owner } = await makeUser();
    const { user: joiner, token: joinerToken } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app)
      .post(`/v1/invite/${group.inviteCode}/join`)
      .set(authHeader(joinerToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.token).toBeNull();
    expect(res.body.user.id).toBe(joiner.id);
    expect(res.body.group.members).toHaveLength(2);
  });

  it('returns 409 when user is already a member', async () => {
    const { user: owner, token } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app)
      .post(`/v1/invite/${group.inviteCode}/join`)
      .set(authHeader(token))
      .send({});

    expect(res.status).toBe(409);
  });
});
