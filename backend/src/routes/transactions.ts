import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router: ExpressRouter = Router();

function parseMonthRange(monthParam?: string): { gte: Date; lt: Date } {
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    const [year, month] = monthParam.split('-').map(Number);
    return {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

const formatTransaction = (tx: {
  id: string;
  title: string;
  amount: { toNumber(): number } | number;
  type: string;
  categoryId: string | null;
  category: { name: string } | null;
  splitId: string | null;
  date: Date;
}) => ({
  id: tx.id,
  title: tx.title,
  amount: Number(tx.amount),
  type: tx.type,
  category_id: tx.categoryId,
  category_name: tx.category?.name ?? null,
  split_id: tx.splitId,
  date: tx.date,
});

const TX_INCLUDE = {
  category: { select: { name: true } },
} as const;

/**
 * @openapi
 * /transactions:
 *   get:
 *     tags:
 *       - Transactions
 *     summary: List transactions for the current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: "2024-11"
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [expense, income]
 *     responses:
 *       200:
 *         description: Array of transactions
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { month, category_id, type } = req.query as Record<string, string | undefined>;

    const dateRange = parseMonthRange(month);

    const where = {
      userId,
      date: dateRange,
      ...(category_id ? { categoryId: category_id } : {}),
      ...(type === 'expense' || type === 'income' ? { type } : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: TX_INCLUDE,
    });

    res.json(transactions.map(formatTransaction));
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * @openapi
 * /transactions:
 *   post:
 *     tags:
 *       - Transactions
 *     summary: Log a new transaction
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Transaction created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/',
  authenticate,
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('type').isIn(['expense', 'income']).withMessage('type must be expense or income'),
    body('category_id').optional({ nullable: true }).isUUID(),
    body('split_id').optional({ nullable: true }).isUUID(),
    body('date').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { title, amount, type, category_id, split_id, date } = req.body;

      if (category_id) {
        const cat = await prisma.budgetCategory.findUnique({ where: { id: category_id } });
        if (!cat || cat.userId !== userId) {
          res.status(400).json({ error: 'category_id does not belong to the current user' });
          return;
        }
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          title,
          amount,
          type,
          categoryId: category_id ?? null,
          splitId: split_id ?? null,
          date: date ? new Date(date) : undefined,
        },
        include: TX_INCLUDE,
      });

      res.status(201).json(formatTransaction(transaction));
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
);

/**
 * @openapi
 * /transactions/{transactionId}:
 *   delete:
 *     tags:
 *       - Transactions
 *     summary: Delete a transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       403:
 *         description: Not your transaction
 *       404:
 *         description: Transaction not found
 */
router.delete('/:transactionId', authenticate, async (req: AuthRequest & Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { transactionId } = req.params;

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    if (tx.userId !== userId) {
      res.status(403).json({ error: 'This transaction belongs to a different user' });
      return;
    }

    await prisma.transaction.delete({ where: { id: transactionId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
