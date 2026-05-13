import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGroup, addMember, makeSplit, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── GET /v1/groups ─────────────────────────────────────────────────────────

describe('GET /v1/groups', () => {
  it('returns empty array when user has no groups', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/v1/groups').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns groups with correct shape and net_balance = 0 when no splits', async () => {
    const { user, token } = await makeUser();
    await makeGroup(user.id, { name: 'Goa', emoji: '🏖️' });

    const res = await request(app).get('/v1/groups').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'Goa',
      emoji: '🏖️',
      member_count: 1,
      net_balance: 0,
    });
    expect(res.body[0].invite_code).toBeDefined();
    expect(res.body[0].created_at).toBeDefined();
  });

  it('computes positive net_balance when others owe the user', async () => {
    const { user: owner, token } = await makeUser();
    const { user: member } = await makeUser();
    const group = await makeGroup(owner.id);
    await addMember(group.id, member.id);
    // owner pays 100, member owes 50, owner's own share 50
    await makeSplit({ groupId: group.id, paidById: owner.id, memberIds: [owner.id, member.id], totalAmount: 100 });

    const res = await request(app).get('/v1/groups').set(authHeader(token));
    expect(res.status).toBe(200);
    const g = res.body.find((x: { id: string }) => x.id === group.id);
    expect(g.net_balance).toBe(50);
  });

  it('computes negative net_balance when user owes others', async () => {
    const { user: owner } = await makeUser();
    const { user: member, token } = await makeUser();
    const group = await makeGroup(owner.id);
    await addMember(group.id, member.id);
    await makeSplit({ groupId: group.id, paidById: owner.id, memberIds: [owner.id, member.id], totalAmount: 100 });

    const res = await request(app).get('/v1/groups').set(authHeader(token));
    const g = res.body.find((x: { id: string }) => x.id === group.id);
    expect(g.net_balance).toBe(-50);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/v1/groups');
    expect(res.status).toBe(401);
  });
});

// ── POST /v1/groups ────────────────────────────────────────────────────────

describe('POST /v1/groups', () => {
  it('creates a group and adds creator as admin', async () => {
    const { token } = await makeUser();
    const res = await request(app).post('/v1/groups').set(authHeader(token)).send({ name: 'Flat', emoji: '🏠' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Flat',
      emoji: '🏠',
      member_count: 1,
      net_balance: 0,
    });
    expect(res.body.invite_code).toBeDefined();
  });

  it('defaults emoji to 💸 when not provided', async () => {
    const { token } = await makeUser();
    const res = await request(app).post('/v1/groups').set(authHeader(token)).send({ name: 'Plain' });
    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe('💸');
  });

  it('returns 400 when name is missing', async () => {
    const { token } = await makeUser();
    const res = await request(app).post('/v1/groups').set(authHeader(token)).send({ emoji: '😀' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/v1/groups').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── GET /v1/groups/:groupId ────────────────────────────────────────────────

describe('GET /v1/groups/:groupId', () => {
  it('returns group with members array', async () => {
    const { user, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(user.id, { name: 'Trip' });
    await addMember(group.id, m2.id);

    const res = await request(app).get(`/v1/groups/${group.id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Trip');
    expect(res.body.members).toHaveLength(2);
    const admin = res.body.members.find((m: { id: string }) => m.id === user.id);
    expect(admin.is_admin).toBe(true);
    const regular = res.body.members.find((m: { id: string }) => m.id === m2.id);
    expect(regular.is_admin).toBe(false);
  });

  it('returns 403 when caller is not a member', async () => {
    const { user: owner } = await makeUser();
    const { token: outsiderToken } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app).get(`/v1/groups/${group.id}`).set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent group', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/v1/groups/00000000-0000-0000-0000-000000000000').set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
