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

/** Normalise a merchant string for case-insensitive matching: lowercase, trim,
 * collapse whitespace, drop trailing references / refnos. */
function normaliseMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(ref(no|erence)?\s+no\.?\s*\w+|ref\.?\s*\w+)\b/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

const formatTransaction = (tx: {
  id: string;
  title: string;
  amount: { toNumber(): number } | number;
  type: string;
  categoryId: string | null;
  category: { name: string; icon: string } | null;
  splitId: string | null;
  merchantKey: string | null;
  date: Date;
}) => ({
  id: tx.id,
  title: tx.title,
  amount: Number(tx.amount),
  type: tx.type,
  category_id: tx.categoryId,
  category_name: tx.category?.name ?? null,
  category_icon: tx.category?.icon ?? null,
  split_id: tx.splitId,
  merchant_key: tx.merchantKey,
  date: tx.date,
});

const TX_INCLUDE = {
  category: { select: { name: true, icon: true } },
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
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max rows (default unlimited within month, or 500 globally)
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: If true, ignores month filter and returns full history (up to limit)
 *     responses:
 *       200:
 *         description: Array of transactions
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { month, category_id, type, all, limit } = req.query as Record<string, string | undefined>;

    const includeAll = all === 'true' || all === '1';
    const where: Record<string, unknown> = {
      userId,
      ...(includeAll ? {} : { date: parseMonthRange(month) }),
      ...(category_id ? { categoryId: category_id } : {}),
      ...(type === 'expense' || type === 'income' ? { type } : {}),
    };

    const take = limit ? Math.min(Number(limit) || 500, 2000) : (includeAll ? 500 : undefined);

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: TX_INCLUDE,
      ...(take ? { take } : {}),
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
 *     summary: Log a new transaction (auto-resolves category from merchant_key)
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
    body('merchant_key').optional({ nullable: true }).isString(),
    body('date').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { title, amount, type, category_id, split_id, merchant_key, date } = req.body;

      if (category_id) {
        const cat = await prisma.budgetCategory.findUnique({ where: { id: category_id } });
        if (!cat || cat.userId !== userId) {
          res.status(400).json({ error: 'category_id does not belong to the current user' });
          return;
        }
      }

      const merchantKey = normaliseMerchant(merchant_key);

      // If caller didn't pick a category but the merchant is recognised from
      // a previous user-set mapping, auto-assign it. This is what makes
      // "always categorise X as Food" work on future SMS imports.
      let resolvedCategoryId: string | null = category_id ?? null;
      if (!resolvedCategoryId && merchantKey) {
        const mapping = await prisma.merchantCategory.findUnique({
          where: { userId_merchantKey: { userId, merchantKey } },
        });
        if (mapping) resolvedCategoryId = mapping.categoryId;
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          title,
          amount,
          type,
          categoryId: resolvedCategoryId,
          splitId: split_id ?? null,
          merchantKey,
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
 *   patch:
 *     tags:
 *       - Transactions
 *     summary: Edit a transaction; optionally save a category-for-merchant mapping
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [expense, income]
 *               category_id:
 *                 type: string
 *                 nullable: true
 *               date:
 *                 type: string
 *               remember_category:
 *                 type: boolean
 *                 description: |
 *                   If true and the transaction has a merchant_key, upsert a
 *                   merchant→category mapping so future auto-imports apply
 *                   this category to the same payee.
 *     responses:
 *       200:
 *         description: Updated transaction
 */
router.patch(
  '/:transactionId',
  authenticate,
  [
    body('title').optional().isString().trim().notEmpty(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('type').optional().isIn(['expense', 'income']),
    body('category_id').optional({ nullable: true }),
    body('date').optional().isISO8601(),
    body('remember_category').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { transactionId } = req.params;
      const { title, amount, type, category_id, date, remember_category } = req.body;

      const existing = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (!existing) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      if (existing.userId !== userId) {
        res.status(403).json({ error: 'This transaction belongs to a different user' });
        return;
      }

      // Validate category ownership if changing it.
      let resolvedCategoryId: string | null | undefined;
      if (category_id !== undefined) {
        if (category_id === null) {
          resolvedCategoryId = null;
        } else {
          const cat = await prisma.budgetCategory.findUnique({ where: { id: category_id } });
          if (!cat || cat.userId !== userId) {
            res.status(400).json({ error: 'category_id does not belong to the current user' });
            return;
          }
          resolvedCategoryId = category_id;
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(amount !== undefined ? { amount } : {}),
            ...(type !== undefined ? { type } : {}),
            ...(resolvedCategoryId !== undefined ? { categoryId: resolvedCategoryId } : {}),
            ...(date !== undefined ? { date: new Date(date) } : {}),
          },
          include: TX_INCLUDE,
        });

        // Persist "remember this category for this merchant" if requested.
        if (
          remember_category === true &&
          result.merchantKey &&
          result.categoryId
        ) {
          await tx.merchantCategory.upsert({
            where: {
              userId_merchantKey: { userId, merchantKey: result.merchantKey },
            },
            create: {
              userId,
              merchantKey: result.merchantKey,
              categoryId: result.categoryId,
            },
            update: {
              categoryId: result.categoryId,
            },
          });
        }

        return result;
      });

      res.json(formatTransaction(updated));
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  },
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
