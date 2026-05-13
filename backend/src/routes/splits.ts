import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router: ExpressRouter = Router();

const VALID_CATEGORIES = ['food', 'transport', 'entertainment', 'rent', 'utilities', 'other'] as const;

type SplitFull = {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  category: string;
  totalAmount: { toNumber(): number };
  paidBy: string;
  payer: { name: string };
  splitType: string;
  createdAt: Date;
  shares: Array<{
    id: string;
    userId: string;
    user: { name: string };
    amount: { toNumber(): number };
    isSettled: boolean;
  }>;
};

export const formatSplit = (split: SplitFull) => ({
  id: split.id,
  group_id: split.groupId,
  title: split.title,
  description: split.description,
  category: split.category,
  total_amount: split.totalAmount.toNumber(),
  paid_by_id: split.paidBy,
  paid_by_name: split.payer.name,
  split_type: split.splitType,
  created_at: split.createdAt,
  shares: split.shares.map((s) => ({
    id: s.id,
    user_id: s.userId,
    user_name: s.user.name,
    amount: s.amount.toNumber(),
    is_settled: s.isSettled,
  })),
});

const SPLIT_INCLUDE = {
  payer: { select: { name: true } },
  shares: { include: { user: { select: { name: true } } } },
} as const;

/**
 * @openapi
 * /groups/{groupId}/splits:
 *   get:
 *     tags:
 *       - Splits
 *     summary: List all splits in a group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of splits
 *       403:
 *         description: Not a member
 *       404:
 *         description: Group not found
 */
router.get('/groups/:groupId/splits', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId } = req.params;

    const group = await prisma.splitGroup.findUnique({
      where: { id: groupId },
      include: { members: { select: { userId: true } } },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (!group.members.some((m) => m.userId === userId)) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const splits = await prisma.split.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        payer: { select: { name: true } },
        _count: { select: { shares: true } },
      },
    });

    res.json(
      splits.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        total_amount: s.totalAmount.toNumber(),
        paid_by_id: s.paidBy,
        paid_by_name: s.payer.name,
        share_count: s._count.shares,
        created_at: s.createdAt,
      }))
    );
  } catch (error) {
    console.error('List splits error:', error);
    res.status(500).json({ error: 'Failed to fetch splits' });
  }
});

/**
 * @openapi
 * /groups/{groupId}/splits:
 *   post:
 *     tags:
 *       - Splits
 *     summary: Create a new split in a group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Split created
 *       400:
 *         description: Business rule violation
 *       403:
 *         description: Not a member
 *       404:
 *         description: Group not found
 *       422:
 *         description: Validation failed
 */
router.post(
  '/groups/:groupId/splits',
  authenticate,
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('total_amount').isFloat({ min: 0.01 }).withMessage('total_amount must be greater than 0'),
    body('paid_by').isUUID().withMessage('paid_by must be a valid UUID'),
    body('split_type').isIn(['equal', 'custom']).withMessage('split_type must be equal or custom'),
    body('shares').optional().isArray(),
    body('shares.*.user_id').optional().isUUID(),
    body('shares.*.amount').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { title, description, category, total_amount, paid_by, split_type, shares } = req.body;
      const totalAmount: number = Number(total_amount);

      const group = await prisma.splitGroup.findUnique({
        where: { id: groupId },
        include: { members: { include: { user: { select: { id: true, name: true } } } } },
      });

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const memberMap = new Map(group.members.map((m) => [m.userId, m.user]));

      if (!memberMap.has(userId)) {
        res.status(403).json({ error: 'You are not a member of this group' });
        return;
      }

      if (!memberMap.has(paid_by)) {
        res.status(400).json({ error: 'paid_by must be a member of the group' });
        return;
      }

      let sharesData: Array<{ userId: string; amount: number }>;

      if (split_type === 'equal') {
        const memberIds = Array.from(memberMap.keys());
        const count = memberIds.length;
        const perPerson = Math.floor((totalAmount / count) * 100) / 100;
        const remainder = Math.round((totalAmount - perPerson * count) * 100) / 100;

        sharesData = memberIds.map((uid, i) => ({
          userId: uid,
          amount: i === count - 1 ? perPerson + remainder : perPerson,
        }));
      } else {
        if (!Array.isArray(shares) || shares.length === 0) {
          res.status(400).json({ error: 'shares array is required for custom split' });
          return;
        }

        for (const s of shares) {
          if (!memberMap.has(s.user_id)) {
            res.status(400).json({ error: `User ${s.user_id} is not a member of this group` });
            return;
          }
        }

        const sharesSum = (shares as Array<{ amount: number }>).reduce((acc, s) => acc + Number(s.amount), 0);
        if (Math.abs(sharesSum - totalAmount) > 0.01) {
          res.status(400).json({ error: 'Shares must sum to total_amount (within ₹0.01 tolerance)' });
          return;
        }

        sharesData = (shares as Array<{ user_id: string; amount: number }>).map((s) => ({
          userId: s.user_id,
          amount: Number(s.amount),
        }));
      }

      const split = await prisma.$transaction(async (tx) => {
        const created = await tx.split.create({
          data: {
            groupId,
            title,
            description: description ?? null,
            category,
            totalAmount,
            paidBy: paid_by,
            splitType: split_type,
          },
        });

        await tx.splitShare.createMany({
          data: sharesData.map((s) => ({ splitId: created.id, userId: s.userId, amount: s.amount })),
        });

        return tx.split.findUnique({ where: { id: created.id }, include: SPLIT_INCLUDE });
      });

      res.status(201).json(formatSplit(split!));
    } catch (error) {
      console.error('Create split error:', error);
      res.status(500).json({ error: 'Failed to create split' });
    }
  }
);

/**
 * @openapi
 * /splits/{splitId}:
 *   get:
 *     tags:
 *       - Splits
 *     summary: Get full detail for a split
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: splitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Split detail
 *       403:
 *         description: Not a member of the group
 *       404:
 *         description: Split not found
 */
router.get('/splits/:splitId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { splitId } = req.params;

    const split = await prisma.split.findUnique({
      where: { id: splitId },
      include: SPLIT_INCLUDE,
    });

    if (!split) {
      res.status(404).json({ error: 'Split not found' });
      return;
    }

    const member = await prisma.groupMember.findFirst({
      where: { groupId: split.groupId, userId },
    });

    if (!member) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    res.json(formatSplit(split));
  } catch (error) {
    console.error('Get split error:', error);
    res.status(500).json({ error: 'Failed to fetch split' });
  }
});

/**
 * @openapi
 * /splits/{splitId}:
 *   delete:
 *     tags:
 *       - Splits
 *     summary: Delete a split (payer or group admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: splitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Split deleted
 *       403:
 *         description: Only payer or group admin can delete
 *       404:
 *         description: Split not found
 */
router.delete('/splits/:splitId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { splitId } = req.params;

    const split = await prisma.split.findUnique({ where: { id: splitId } });
    if (!split) {
      res.status(404).json({ error: 'Split not found' });
      return;
    }

    const member = await prisma.groupMember.findFirst({
      where: { groupId: split.groupId, userId },
    });
    if (!member) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    if (!member.isAdmin && split.paidBy !== userId) {
      res.status(403).json({ error: 'Only the payer or a group admin can delete this split' });
      return;
    }

    await prisma.split.delete({ where: { id: splitId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete split error:', error);
    res.status(500).json({ error: 'Failed to delete split' });
  }
});

export default router;
