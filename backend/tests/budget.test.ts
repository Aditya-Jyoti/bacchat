import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { cleanDb, makeUser, authHeader } from './helpers';

beforeAll(cleanDb);
afterAll(() => prisma.$disconnect());

// ── GET /v1/budget ────────────────────────────────────────────────────────

describe('GET /v1/budget', () => {
  it('returns 204 when no budget settings exist', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/v1/budget').set(authHeader(token));
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns full overview with categories and monthly spend', async () => {
    const { user, token } = await makeUser();

    // Create budget settings
    await prisma.budgetSetting.create({
      data: { userId: user.id, monthlyIncome: 50000, monthlySavingsGoal: 10000 },
    });

    // Create category
    const cat = await prisma.budgetCategory.create({
      data: { userId: user.id, name: 'Food', icon: '🍔', monthlyLimit: 8000, isFixed: false },
    });

    // Add an expense this month
    await prisma.transaction.create({
      data: { userId: user.id, title: 'Groceries', amount: 1500, type: 'expense', categoryId: cat.id },
    });

    // Add income (should NOT count in spent_this_month)
    await prisma.transaction.create({
      data: { userId: user.id, title: 'Salary', amount: 50000, type: 'income' },
    });

    const res = await request(app).get('/v1/budget').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.settings.monthly_income).toBe(50000);
    expect(res.body.settings.monthly_savings_goal).toBe(10000);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0]).toMatchObject({ name: 'Food', spent_this_month: 1500 });
    expect(res.body.total_spent_this_month).toBe(1500);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/v1/budget');
    expect(res.status).toBe(401);
  });
});

// ── PUT /v1/budget/settings ────────────────────────────────────────────────

describe('PUT /v1/budget/settings', () => {
  it('creates settings on first call', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/v1/budget/settings')
      .set(authHeader(token))
      .send({ monthly_income: 80000, monthly_savings_goal: 20000 });
    expect(res.status).toBe(200);
    expect(res.body.monthly_income).toBe(80000);
    expect(res.body.monthly_savings_goal).toBe(20000);
    expect(res.body.updated_at).toBeDefined();
  });

  it('updates existing settings (upsert)', async () => {
    const { token } = await makeUser();
    await request(app).put('/v1/budget/settings').set(authHeader(token)).send({ monthly_income: 50000, monthly_savings_goal: 5000 });
    const res = await request(app).put('/v1/budget/settings').set(authHeader(token)).send({ monthly_income: 60000, monthly_savings_goal: 10000 });
    expect(res.status).toBe(200);
    expect(res.body.monthly_income).toBe(60000);
  });

  it('returns 400 for negative monthly_income', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/v1/budget/settings')
      .set(authHeader(token))
      .send({ monthly_income: -1000, monthly_savings_goal: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    const { token } = await makeUser();
    const res = await request(app).put('/v1/budget/settings').set(authHeader(token)).send({ monthly_income: 1000 });
    expect(res.status).toBe(400);
  });
});

// ── POST /v1/budget/categories ─────────────────────────────────────────────

describe('POST /v1/budget/categories', () => {
  it('creates a category with spent_this_month: 0', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/v1/budget/categories')
      .set(authHeader(token))
      .send({ name: 'Rent', icon: '🏠', monthly_limit: 20000, is_fixed: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Rent', icon: '🏠', monthly_limit: 20000, is_fixed: true, spent_this_month: 0 });
    expect(res.body.id).toBeDefined();
  });

  it('defaults is_fixed to true when not provided', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/v1/budget/categories')
      .set(authHeader(token))
      .send({ name: 'Food', icon: '🍔', monthly_limit: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.is_fixed).toBe(true);
  });

  it('returns 400 for missing name', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/v1/budget/categories')
      .set(authHeader(token))
      .send({ icon: '🏠', monthly_limit: 5000 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative monthly_limit', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/v1/budget/categories')
      .set(authHeader(token))
      .send({ name: 'X', icon: '🏠', monthly_limit: -100 });
    expect(res.status).toBe(400);
  });
});

// ── PUT /v1/budget/categories/:categoryId ─────────────────────────────────

describe('PUT /v1/budget/categories/:categoryId', () => {
  it('updates category and returns spent_this_month', async () => {
    const { user, token } = await makeUser();
    const cat = await prisma.budgetCategory.create({
      data: { userId: user.id, name: 'Old', icon: '❓', monthlyLimit: 1000, isFixed: false },
    });

    const res = await request(app)
      .put(`/v1/budget/categories/${cat.id}`)
      .set(authHeader(token))
      .send({ name: 'New', icon: '✅', monthly_limit: 2000, is_fixed: true });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
    expect(res.body.monthly_limit).toBe(2000);
    expect(res.body.spent_this_month).toBeDefined();
  });

  it('returns 403 when category belongs to different user', async () => {
    const { user: other } = await makeUser();
    const { token } = await makeUser();
    const cat = await prisma.budgetCategory.create({
      data: { userId: other.id, name: 'Other', icon: '❓', monthlyLimit: 1000 },
    });

    const res = await request(app)
      .put(`/v1/budget/categories/${cat.id}`)
      .set(authHeader(token))
      .send({ name: 'X', icon: '❓', monthly_limit: 500 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent category', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/v1/budget/categories/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token))
      .send({ name: 'X', icon: '❓', monthly_limit: 500 });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /v1/budget/categories/:categoryId ──────────────────────────────

describe('DELETE /v1/budget/categories/:categoryId', () => {
  it('deletes category and nulls out transaction categoryId', async () => {
    const { user, token } = await makeUser();
    const cat = await prisma.budgetCategory.create({
      data: { userId: user.id, name: 'Temp', icon: '🗑️', monthlyLimit: 500 },
    });
    const tx = await prisma.transaction.create({
      data: { userId: user.id, title: 'Item', amount: 100, type: 'expense', categoryId: cat.id },
    });

    const res = await request(app).delete(`/v1/budget/categories/${cat.id}`).set(authHeader(token));
    expect(res.status).toBe(204);

    const updatedTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(updatedTx?.categoryId).toBeNull();
  });

  it('returns 403 when category belongs to different user', async () => {
    const { user: other } = await makeUser();
    const { token } = await makeUser();
    const cat = await prisma.budgetCategory.create({
      data: { userId: other.id, name: 'Other', icon: '❓', monthlyLimit: 100 },
    });

    const res = await request(app).delete(`/v1/budget/categories/${cat.id}`).set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent category', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .delete('/v1/budget/categories/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
