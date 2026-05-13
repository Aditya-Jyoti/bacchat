import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../src/config/database';
import { generateToken } from '../src/utils/jwt';

// Low work factor for fast test hashing
const TEST_SALT = bcrypt.genSaltSync(4);
export const TEST_PASSWORD = 'test-password';
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, TEST_SALT);

let _counter = 0;
function next() {
  return ++_counter;
}

// ── Database ─────────────────────────────────────────────────────────────────

export async function cleanDb() {
  await prisma.transaction.deleteMany();
  await prisma.splitShare.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.split.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.budgetSetting.deleteMany();
  await prisma.revokedToken.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.splitGroup.deleteMany();
  await prisma.user.deleteMany();
}

// ── Factories ─────────────────────────────────────────────────────────────────

export async function makeUser(overrides: {
  name?: string;
  email?: string;
  password?: string;
  isGuest?: boolean;
} = {}) {
  const n = next();
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `User ${n}`,
      email: overrides.email !== undefined ? overrides.email : `user${n}@test.com`,
      password: overrides.password ?? TEST_PASSWORD_HASH,
      isGuest: overrides.isGuest ?? false,
    },
  });
  const token = generateToken(user.id, user.isGuest);
  return { user, token };
}

export async function makeGuest(name = 'Guest') {
  const user = await prisma.user.create({
    data: { name, isGuest: true },
  });
  const token = generateToken(user.id, true);
  return { user, token };
}

export async function makeGroup(
  creatorId: string,
  overrides: { name?: string; emoji?: string } = {}
) {
  const n = next();
  const group = await prisma.splitGroup.create({
    data: {
      name: overrides.name ?? `Group ${n}`,
      emoji: overrides.emoji ?? '💸',
      createdBy: creatorId,
      inviteCode: randomUUID(),
      members: { create: { userId: creatorId, isAdmin: true } },
    },
  });
  return group;
}

export async function addMember(groupId: string, userId: string, isAdmin = false) {
  return prisma.groupMember.create({ data: { groupId, userId, isAdmin } });
}

export async function makeSplit(opts: {
  groupId: string;
  paidById: string;
  memberIds: string[];
  totalAmount?: number;
  title?: string;
  category?: string;
  splitType?: string;
}) {
  const total = opts.totalAmount ?? 100;
  const perPerson = total / opts.memberIds.length;
  const split = await prisma.split.create({
    data: {
      groupId: opts.groupId,
      title: opts.title ?? 'Test Split',
      category: opts.category ?? 'food',
      totalAmount: total,
      paidBy: opts.paidById,
      splitType: opts.splitType ?? 'equal',
      shares: {
        create: opts.memberIds.map((uid) => ({ userId: uid, amount: perPerson })),
      },
    },
  });
  return split;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
