import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGroup, addMember, makeSplit, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── GET /v1/groups/:groupId/splits ─────────────────────────────────────────

describe('GET /v1/groups/:groupId/splits', () => {
  it('returns empty array when no splits', async () => {
    const { user, token } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app).get(`/v1/groups/${group.id}/splits`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns splits sorted newest first with correct shape', async () => {
    const { user, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(user.id);
    await addMember(group.id, m2.id);

    await makeSplit({ groupId: group.id, paidById: user.id, memberIds: [user.id, m2.id], totalAmount: 200, title: 'First' });
    await makeSplit({ groupId: group.id, paidById: user.id, memberIds: [user.id, m2.id], totalAmount: 100, title: 'Second' });

    const res = await request(app).get(`/v1/groups/${group.id}/splits`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Second'); // newest first
    expect(res.body[0]).toMatchObject({
      total_amount: 100,
      share_count: 2,
    });
    expect(res.body[0].paid_by_name).toBeDefined();
    // List shape must NOT include shares array
    expect(res.body[0].shares).toBeUndefined();
  });

  it('returns 403 when caller is not a member', async () => {
    const { user: owner } = await makeUser();
    const { token: outsider } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app).get(`/v1/groups/${group.id}/splits`).set(authHeader(outsider));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent group', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/v1/groups/00000000-0000-0000-0000-000000000000/splits')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});

// ── POST /v1/groups/:groupId/splits ────────────────────────────────────────

describe('POST /v1/groups/:groupId/splits — equal split', () => {
  it('divides amount equally across all members', async () => {
    const { user: u1, token } = await makeUser();
    const { user: u2 } = await makeUser();
    const { user: u3 } = await makeUser();
    const group = await makeGroup(u1.id);
    await addMember(group.id, u2.id);
    await addMember(group.id, u3.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({ title: 'Dinner', category: 'food', total_amount: 100, paid_by: u1.id, split_type: 'equal' });

    expect(res.status).toBe(201);
    expect(res.body.shares).toHaveLength(3);
    const amounts = res.body.shares.map((s: { amount: number }) => s.amount).sort((a: number, b: number) => a - b);
    // First 2 get 33.33, last gets 33.34
    expect(amounts[0]).toBeCloseTo(33.33, 1);
    expect(amounts[1]).toBeCloseTo(33.33, 1);
    expect(amounts[2]).toBeCloseTo(33.34, 1);
    expect(res.body.shares.reduce((s: number, x: { amount: number }) => s + x.amount, 0)).toBeCloseTo(100, 1);
  });

  it('returns full split detail shape on creation', async () => {
    const { user, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(user.id);
    await addMember(group.id, m2.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({ title: 'Lunch', category: 'food', total_amount: 60, paid_by: user.id, split_type: 'equal' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      group_id: group.id,
      title: 'Lunch',
      category: 'food',
      total_amount: 60,
      paid_by_id: user.id,
      split_type: 'equal',
    });
    expect(Array.isArray(res.body.shares)).toBe(true);
    expect(res.body.shares[0].is_settled).toBe(false);
  });
});

describe('POST /v1/groups/:groupId/splits — custom split', () => {
  it('creates split with given share amounts', async () => {
    const { user: u1, token } = await makeUser();
    const { user: u2 } = await makeUser();
    const group = await makeGroup(u1.id);
    await addMember(group.id, u2.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({
        title: 'Custom',
        category: 'transport',
        total_amount: 100,
        paid_by: u1.id,
        split_type: 'custom',
        shares: [
          { user_id: u1.id, amount: 30 },
          { user_id: u2.id, amount: 70 },
        ],
      });

    expect(res.status).toBe(201);
    const shareAmounts = res.body.shares.map((s: { amount: number }) => s.amount).sort((a: number, b: number) => a - b);
    expect(shareAmounts).toEqual([30, 70]);
  });

  it('returns 400 when shares do not sum to total_amount', async () => {
    const { user, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(user.id);
    await addMember(group.id, m2.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({
        title: 'Bad',
        category: 'food',
        total_amount: 100,
        paid_by: user.id,
        split_type: 'custom',
        shares: [{ user_id: user.id, amount: 40 }, { user_id: m2.id, amount: 40 }],
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when a share user_id is not a group member', async () => {
    const { user, token } = await makeUser();
    const { user: outsider } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({
        title: 'Bad',
        category: 'food',
        total_amount: 100,
        paid_by: user.id,
        split_type: 'custom',
        shares: [{ user_id: outsider.id, amount: 100 }],
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when paid_by is not a member', async () => {
    const { user, token } = await makeUser();
    const { user: outsider } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({
        title: 'Bad',
        category: 'food',
        total_amount: 100,
        paid_by: outsider.id,
        split_type: 'equal',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when custom split has no shares array', async () => {
    const { user, token } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({ title: 'X', category: 'food', total_amount: 100, paid_by: user.id, split_type: 'custom' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/groups/:groupId/splits — validation', () => {
  it('returns 422 for invalid category', async () => {
    const { user, token } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({ title: 'X', category: 'invalid', total_amount: 100, paid_by: user.id, split_type: 'equal' });

    expect(res.status).toBe(400);
  });

  it('returns 422 when total_amount <= 0', async () => {
    const { user, token } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(token))
      .send({ title: 'X', category: 'food', total_amount: 0, paid_by: user.id, split_type: 'equal' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when caller is not a group member', async () => {
    const { user: owner } = await makeUser();
    const { token: outsider } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app)
      .post(`/v1/groups/${group.id}/splits`)
      .set(authHeader(outsider))
      .send({ title: 'X', category: 'food', total_amount: 100, paid_by: owner.id, split_type: 'equal' });

    expect(res.status).toBe(403);
  });
});

// ── GET /v1/splits/:splitId ────────────────────────────────────────────────

describe('GET /v1/splits/:splitId', () => {
  it('returns full split detail with shares', async () => {
    const { user, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(user.id);
    await addMember(group.id, m2.id);
    const split = await makeSplit({ groupId: group.id, paidById: user.id, memberIds: [user.id, m2.id] });

    const res = await request(app).get(`/v1/splits/${split.id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(split.id);
    expect(Array.isArray(res.body.shares)).toBe(true);
    expect(res.body.shares).toHaveLength(2);
  });

  it('returns 403 when caller is not a member of the split group', async () => {
    const { user: owner } = await makeUser();
    const { token: outsider } = await makeUser();
    const group = await makeGroup(owner.id);
    const split = await makeSplit({ groupId: group.id, paidById: owner.id, memberIds: [owner.id] });

    const res = await request(app).get(`/v1/splits/${split.id}`).set(authHeader(outsider));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent split', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/v1/splits/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
