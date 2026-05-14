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
 *     summary: Mark a share as settled (only the debtor or the payer)
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
 *         description: Only the debtor or the payer can settle this share
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

    // Either side of the debt can confirm settlement:
    //   - the debtor (share.userId)  — "I paid them back"
    //   - the payer (split.paidBy)   — "I received their payment"
    // Crucially: a group admin who is *not* either side cannot settle.
    const isDebtor = share.userId === userId;
    const isPayer = share.split.paidBy === userId;

    if (!isDebtor && !isPayer) {
      res.status(403).json({ error: 'Only the debtor or the payer can settle this share' });
      return;
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
 *     summary: Settle all unsettled shares in a split (payer only)
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
 *         description: Only the payer can settle the whole split
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

    if (split.paidBy !== userId) {
      res.status(403).json({ error: 'Only the payer can mark every share as settled' });
      return;
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

/**
 * @openapi
 * /groups/{groupId}/settle-between:
 *   post:
 *     tags:
 *       - Settlements
 *     summary: Settle every unsettled debt between two specific members
 *     description: |
 *       Marks every unsettled share where one person owes another as settled
 *       in one call. The caller must be one of the two participants.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from_user_id, to_user_id]
 *             properties:
 *               from_user_id:
 *                 type: string
 *                 description: The debtor (person who owes)
 *               to_user_id:
 *                 type: string
 *                 description: The creditor (person who paid)
 *     responses:
 *       200:
 *         description: "{ settled_count, total_amount }"
 *       400:
 *         description: Bad request
 *       403:
 *         description: Caller must be either the debtor or creditor
 */
router.post(
  '/groups/:groupId/settle-between',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { from_user_id, to_user_id } = req.body ?? {};

      if (typeof from_user_id !== 'string' || typeof to_user_id !== 'string') {
        res.status(400).json({ error: 'from_user_id and to_user_id are required' });
        return;
      }
      if (from_user_id === to_user_id) {
        res.status(400).json({ error: 'from and to must be different users' });
        return;
      }
      if (userId !== from_user_id && userId !== to_user_id) {
        res.status(403).json({ error: 'You must be one of the two participants' });
        return;
      }

      // Find every unsettled share where from_user_id owes to_user_id in this
      // group: the share belongs to from_user_id and the parent split was paid
      // by to_user_id.
      const candidates = await prisma.splitShare.findMany({
        where: {
          userId: from_user_id,
          isSettled: false,
          split: { groupId, paidBy: to_user_id },
        },
        select: { id: true, amount: true },
      });

      if (candidates.length === 0) {
        res.json({ settled_count: 0, total_amount: 0 });
        return;
      }

      const ids = candidates.map((c) => c.id);
      const totalAmount = candidates.reduce((s, c) => s + Number(c.amount), 0);

      await prisma.splitShare.updateMany({
        where: { id: { in: ids } },
        data: { isSettled: true },
      });

      res.json({ settled_count: ids.length, total_amount: totalAmount });
    } catch (error) {
      console.error('Settle between error:', error);
      res.status(500).json({ error: 'Failed to settle debts' });
    }
  },
);

export default router;
