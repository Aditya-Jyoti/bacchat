import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { formatSplit } from './splits';

const router: ExpressRouter = Router();

const SPLIT_INCLUDE = {
  payer: { select: { name: true } },
  shares: { include: { user: { select: { name: true } } } },
} as const;

/**
 * @openapi
 * /shares/{shareId}/settle:
 *   patch:
 *     tags:
 *       - Settlements
 *     summary: Mark a share as settled
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shareId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Share settled
 *       403:
 *         description: Not the payer or an admin
 *       404:
 *         description: Share not found
 *       409:
 *         description: Share is already settled
 */
router.patch('/shares/:shareId/settle', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { shareId } = req.params;

    const share = await prisma.splitShare.findUnique({
      where: { id: shareId },
      include: {
        split: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!share) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    if (share.isSettled) {
      res.status(409).json({ error: 'Share is already settled' });
      return;
    }

    const isPayer = share.split.paidBy === userId;

    if (!isPayer) {
      const member = await prisma.groupMember.findFirst({
        where: { groupId: share.split.groupId, userId },
      });
      if (!member?.isAdmin) {
        res.status(403).json({ error: 'Only the payer or a group admin can settle shares' });
        return;
      }
    }

    const updated = await prisma.splitShare.update({
      where: { id: shareId },
      data: { isSettled: true },
      include: { user: { select: { name: true } } },
    });

    res.json({
      id: updated.id,
      user_id: updated.userId,
      user_name: updated.user.name,
      amount: updated.amount.toNumber(),
      is_settled: updated.isSettled,
    });
  } catch (error) {
    console.error('Settle share error:', error);
    res.status(500).json({ error: 'Failed to settle share' });
  }
});

/**
 * @openapi
 * /splits/{splitId}/settle-all:
 *   post:
 *     tags:
 *       - Settlements
 *     summary: Settle all unsettled shares in a split
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
 *         description: All shares settled, returns full split detail
 *       403:
 *         description: Not the payer or an admin
 *       404:
 *         description: Split not found
 */
router.post('/splits/:splitId/settle-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { splitId } = req.params;

    const split = await prisma.split.findUnique({ where: { id: splitId } });

    if (!split) {
      res.status(404).json({ error: 'Split not found' });
      return;
    }

    const isPayer = split.paidBy === userId;

    if (!isPayer) {
      const member = await prisma.groupMember.findFirst({
        where: { groupId: split.groupId, userId },
      });
      if (!member?.isAdmin) {
        res.status(403).json({ error: 'Only the payer or a group admin can settle all shares' });
        return;
      }
    }

    const fullSplit = await prisma.$transaction(async (tx) => {
      await tx.splitShare.updateMany({
        where: { splitId, isSettled: false },
        data: { isSettled: true },
      });

      return tx.split.findUnique({ where: { id: splitId }, include: SPLIT_INCLUDE });
    });

    res.json(formatSplit(fullSplit!));
  } catch (error) {
    console.error('Settle all error:', error);
    res.status(500).json({ error: 'Failed to settle all shares' });
  }
});

export default router;
