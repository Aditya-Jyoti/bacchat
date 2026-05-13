import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { simplifyDebts, RawDebt } from '../services/debtSimplifier';

const router: ExpressRouter = Router();

const formatRawDebt = (d: RawDebt) => ({
  debtor_id: d.debtorId,
  debtor_name: d.debtorName,
  creditor_id: d.creditorId,
  creditor_name: d.creditorName,
  amount: d.amount,
  split_title: d.splitTitle,
  split_id: d.splitId,
});

/**
 * @openapi
 * /groups/{groupId}/balance:
 *   get:
 *     tags:
 *       - Balance
 *     summary: Get raw and simplified debts for a group
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
 *         description: Raw debts and simplified payments
 *       403:
 *         description: Not a member
 *       404:
 *         description: Group not found
 */
router.get('/groups/:groupId/balance', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const shares = await prisma.splitShare.findMany({
      where: { split: { groupId }, isSettled: false },
      include: {
        user: { select: { id: true, name: true } },
        split: {
          select: {
            id: true,
            title: true,
            paidBy: true,
            payer: { select: { id: true, name: true } },
          },
        },
      },
    });

    const rawDebts: RawDebt[] = shares
      .filter((s) => s.userId !== s.split.paidBy)
      .map((s) => ({
        debtorId: s.userId,
        debtorName: s.user.name,
        creditorId: s.split.paidBy,
        creditorName: s.split.payer.name,
        amount: s.amount.toNumber(),
        splitTitle: s.split.title,
        splitId: s.split.id,
      }));

    const simplified = simplifyDebts(rawDebts);

    res.json({
      raw_debts: rawDebts.map(formatRawDebt),
      simplified: simplified.map((s) => ({
        debtor_id: s.debtorId,
        debtor_name: s.debtorName,
        creditor_id: s.creditorId,
        creditor_name: s.creditorName,
        amount: s.amount,
        chain: s.chain.map(formatRawDebt),
      })),
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Failed to compute balance' });
  }
});

export default router;
