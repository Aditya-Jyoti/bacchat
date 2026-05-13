import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, makeGroup, addMember, makeSplit, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── GET /v1/groups/:groupId/balance ────────────────────────────────────────

describe('GET /v1/groups/:groupId/balance', () => {
  it('returns empty arrays when group has no splits', async () => {
    const { user, token } = await makeUser();
    const group = await makeGroup(user.id);

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.raw_debts).toEqual([]);
    expect(res.body.simplified).toEqual([]);
  });

  it('returns empty arrays when all shares are settled', async () => {
    const { user: payer, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, m2.id);
    const split = await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, m2.id] });
    await prisma.splitShare.updateMany({ where: { splitId: split.id }, data: { isSettled: true } });

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.raw_debts).toHaveLength(0);
    expect(res.body.simplified).toHaveLength(0);
  });

  it('builds raw_debts excluding payer own-share', async () => {
    const { user: payer, token } = await makeUser();
    const { user: m2 } = await makeUser();
    const group = await makeGroup(payer.id);
    await addMember(group.id, m2.id);
    // payer paid 100 split equally: each owes 50. payer's own share excluded.
    await makeSplit({ groupId: group.id, paidById: payer.id, memberIds: [payer.id, m2.id], totalAmount: 100 });

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(token));
    expect(res.status).toBe(200);
    // Only m2→payer raw debt (payer's own share excluded)
    expect(res.body.raw_debts).toHaveLength(1);
    expect(res.body.raw_debts[0]).toMatchObject({
      debtor_id: m2.id,
      creditor_id: payer.id,
      amount: 50,
    });
    expect(res.body.raw_debts[0].split_title).toBeDefined();
    expect(res.body.raw_debts[0].split_id).toBeDefined();
  });

  it('simplifies A→B 300, B→A 100 into A→B 200', async () => {
    const { user: A, token } = await makeUser();
    const { user: B } = await makeUser();
    const group = await makeGroup(A.id);
    await addMember(group.id, B.id);

    // Split 1: A paid 600, B owes 300 (equal split of 600 between A & B)
    await makeSplit({ groupId: group.id, paidById: A.id, memberIds: [A.id, B.id], totalAmount: 600 });
    // Split 2: B paid 200, A owes 100 (equal split of 200 between A & B)
    await makeSplit({ groupId: group.id, paidById: B.id, memberIds: [A.id, B.id], totalAmount: 200 });

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(token));
    expect(res.status).toBe(200);

    // raw: B→A 300, A→B 100
    expect(res.body.raw_debts).toHaveLength(2);

    // simplified: B→A net 200
    expect(res.body.simplified).toHaveLength(1);
    expect(res.body.simplified[0]).toMatchObject({
      debtor_id: B.id,
      creditor_id: A.id,
      amount: 200,
    });
    expect(Array.isArray(res.body.simplified[0].chain)).toBe(true);
    expect(res.body.simplified[0].chain.length).toBeGreaterThan(0);
  });

  it('handles 3-person scenario: C cancels out via simplification', async () => {
    const { user: A, token } = await makeUser();
    const { user: B } = await makeUser();
    const { user: C } = await makeUser();
    const group = await makeGroup(A.id);
    await addMember(group.id, B.id);
    await addMember(group.id, C.id);

    // A paid 300 for 3 people → B owes 100, C owes 100
    await makeSplit({ groupId: group.id, paidById: A.id, memberIds: [A.id, B.id, C.id], totalAmount: 300 });
    // B paid 200 for 2 people (A & B) → A owes 100
    await makeSplit({ groupId: group.id, paidById: B.id, memberIds: [A.id, B.id], totalAmount: 200 });

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(token));
    // raw: B→A 100, C→A 100, A→B 100
    expect(res.body.raw_debts).toHaveLength(3);

    // net: A=+200-100=+100, B=-100+100=0, C=-100
    // simplified: C→A 100
    expect(res.body.simplified).toHaveLength(1);
    expect(res.body.simplified[0]).toMatchObject({
      debtor_id: C.id,
      creditor_id: A.id,
      amount: 100,
    });
  });

  it('returns 403 when caller is not a group member', async () => {
    const { user: owner } = await makeUser();
    const { token: outsider } = await makeUser();
    const group = await makeGroup(owner.id);

    const res = await request(app).get(`/v1/groups/${group.id}/balance`).set(authHeader(outsider));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent group', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/v1/groups/00000000-0000-0000-0000-000000000000/balance')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
