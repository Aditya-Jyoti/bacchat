import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGroup, addMember, makeSplit, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

async function getFirstShare(splitId: string, excludeUserId?: string) {
  return prisma.splitShare.findFirst({
    where: { splitId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
  });
}

// ── PATCH /v1/shares/:shareId/settle ──────────────────────────────────────

describe('PATCH /v1/shares/:shareId/settle', () => {
  it('allows the payer to settle a share', async () => {
    const { user: payer, token: payerToken } = await makeUser();
    const { user: debtor } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, debtor.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, debtor.id] });
    const share = await getFirstShare(split.id, payer.id); // debtor's share

    const res = await request(app)
      .patch(`/v1/shares/${share!.id}/settle`)
      .set(authHeader(payerToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.is_settled).toBe(true);
    expect(res.body.user_id).toBe(debtor.id);
    expect(res.body.amount).toBeGreaterThan(0);
  });

  it('allows a group admin (non-payer) to settle a share', async () => {
    const { user: admin, token: adminToken } = await makeUser();
    const { user: payer } = await makeUser();
    const { user: debtor } = await makeUser();
    const group = await makeGroup(admin.id); // admin is the group admin
    await addMember(group.id, payer.id);
    await addMember(group.id, debtor.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, debtor.id] });
    const share = await getFirstShare(split.id, payer.id);

    const res = await request(app)
      .patch(`/v1/shares/${share!.id}/settle`)
      .set(authHeader(adminToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.is_settled).toBe(true);
  });

  it('returns 403 when caller is neither payer nor admin', async () => {
    const { user: payer } = await makeUser();
    const { user: debtor, token: debtorToken } = await makeUser();
    const { user: outsider, token: outsiderToken } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, debtor.id);
    await addMember(group.id, outsider.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, debtor.id] });
    const share = await getFirstShare(split.id, payer.id);

    // debtor cannot settle their own share (not the payer, not admin)
    const r1 = await request(app).patch(`/v1/shares/${share!.id}/settle`).set(authHeader(debtorToken)).send({});
    expect(r1.status).toBe(403);

    // outsider member (not admin) also cannot settle
    const r2 = await request(app).patch(`/v1/shares/${share!.id}/settle`).set(authHeader(outsiderToken)).send({});
    expect(r2.status).toBe(403);
  });

  it('returns 409 when share is already settled', async () => {
    const { user: payer, token: payerToken } = await makeUser();
    const { user: debtor } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, debtor.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, debtor.id] });
    const share = await getFirstShare(split.id, payer.id);

    await request(app).patch(`/v1/shares/${share!.id}/settle`).set(authHeader(payerToken)).send({});
    const res = await request(app).patch(`/v1/shares/${share!.id}/settle`).set(authHeader(payerToken)).send({});
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent share', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .patch('/v1/shares/00000000-0000-0000-0000-000000000000/settle')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/v1/shares/any-id/settle').send({});
    expect(res.status).toBe(401);
  });
});

// ── POST /v1/splits/:splitId/settle-all ───────────────────────────────────

describe('POST /v1/splits/:splitId/settle-all', () => {
  it('marks all unsettled shares as settled and returns full split detail', async () => {
    const { user: payer, token: payerToken } = await makeUser();
    const { user: d1 } = await makeUser();
    const { user: d2 } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, d1.id);
    await addMember(group.id, d2.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, d1.id, d2.id] });

    const res = await request(app)
      .post(`/v1/splits/${split.id}/settle-all`)
      .set(authHeader(payerToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.shares.every((s: { is_settled: boolean }) => s.is_settled)).toBe(true);
    expect(res.body.shares).toHaveLength(3);
  });

  it('is idempotent — settle-all on already-settled split still returns 200', async () => {
    const { user: payer, token: payerToken } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, m2.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, m2.id] });

    await request(app).post(`/v1/splits/${split.id}/settle-all`).set(authHeader(payerToken)).send({});
    const res = await request(app).post(`/v1/splits/${split.id}/settle-all`).set(authHeader(payerToken)).send({});
    expect(res.status).toBe(200);
  });

  it('returns 403 when caller is not payer or admin', async () => {
    const { user: payer } = await makeUser();
    const { user: m2, token: m2Token } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, m2.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, m2.id] });

    const res = await request(app)
      .post(`/v1/splits/${split.id}/settle-all`)
      .set(authHeader(m2Token))
      .send({});

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent split', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/v1/splits/00000000-0000-0000-0000-000000000000/settle-all')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(404);
  });
});
