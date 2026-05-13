import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router: ExpressRouter = Router();

function currentMonthRange(): { gte: Date; lt: Date } {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/**
 * @openapi
 * /budget:
 *   get:
 *     tags:
 *       - Budget
 *     summary: Get full budget overview for the current month
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget overview
 *       204:
 *         description: No budget set up yet
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const settings = await prisma.budgetSetting.findUnique({ where: { userId } });
    if (!settings) {
      res.status(204).send();
      return;
    }

    const [categories, monthExpenses] = await Promise.all([
      prisma.budgetCategory.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, type: 'expense', date: currentMonthRange() },
        select: { categoryId: true, amount: true },
      }),
    ]);

    const spentByCategory = new Map<string, number>();
    let totalSpent = 0;
    for (const tx of monthExpenses) {
      const amt = Number(tx.amount);
      totalSpent += amt;
      if (tx.categoryId) {
        spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + amt);
      }
    }

    res.json({
      settings: {
        monthly_income: Number(settings.monthlyIncome),
        monthly_savings_goal: Number(settings.monthlySavingsGoal),
        updated_at: settings.updatedAt,
      },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        monthly_limit: Number(c.monthlyLimit),
        is_fixed: c.isFixed,
        spent_this_month: spentByCategory.get(c.id) ?? 0,
      })),
      total_spent_this_month: totalSpent,
    });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

/**
 * @openapi
 * /budget/settings:
 *   put:
 *     tags:
 *       - Budget
 *     summary: Create or update monthly budget settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings saved
 *       422:
 *         description: Validation failed
 */
router.put(
  '/settings',
  authenticate,
  [
    body('monthly_income').isFloat({ min: 0 }).withMessage('monthly_income must be >= 0'),
    body('monthly_savings_goal').isFloat({ min: 0 }).withMessage('monthly_savings_goal must be >= 0'),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { monthly_income, monthly_savings_goal } = req.body;

      const settings = await prisma.budgetSetting.upsert({
        where: { userId },
        create: { userId, monthlyIncome: monthly_income, monthlySavingsGoal: monthly_savings_goal },
        update: { monthlyIncome: monthly_income, monthlySavingsGoal: monthly_savings_goal },
      });

      res.json({
        monthly_income: Number(settings.monthlyIncome),
        monthly_savings_goal: Number(settings.monthlySavingsGoal),
        updated_at: settings.updatedAt,
      });
    } catch (error) {
      console.error('Update budget settings error:', error);
      res.status(500).json({ error: 'Failed to update budget settings' });
    }
  }
);

const categoryValidation = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('icon').notEmpty().trim().withMessage('Icon is required'),
  body('monthly_limit').isFloat({ min: 0 }).withMessage('monthly_limit must be >= 0'),
  body('is_fixed').optional().isBoolean(),
];

/**
 * @openapi
 * /budget/categories:
 *   post:
 *     tags:
 *       - Budget
 *     summary: Add a new budget category
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Category created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/categories',
  authenticate,
  categoryValidation,
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { name, icon, monthly_limit, is_fixed } = req.body;

      const category = await prisma.budgetCategory.create({
        data: {
          userId,
          name,
          icon,
          monthlyLimit: monthly_limit,
          isFixed: is_fixed ?? true,
        },
      });

      res.status(201).json({
        id: category.id,
        name: category.name,
        icon: category.icon,
        monthly_limit: Number(category.monthlyLimit),
        is_fixed: category.isFixed,
        spent_this_month: 0,
      });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

/**
 * @openapi
 * /budget/categories/{categoryId}:
 *   put:
 *     tags:
 *       - Budget
 *     summary: Update a budget category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category updated
 *       403:
 *         description: Not your category
 *       404:
 *         description: Category not found
 */
router.put(
  '/categories/:categoryId',
  authenticate,
  categoryValidation,
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { categoryId } = req.params;
      const { name, icon, monthly_limit, is_fixed } = req.body;

      const existing = await prisma.budgetCategory.findUnique({ where: { id: categoryId } });
      if (!existing) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      if (existing.userId !== userId) {
        res.status(403).json({ error: 'This category belongs to a different user' });
        return;
      }

      const updated = await prisma.budgetCategory.update({
        where: { id: categoryId },
        data: { name, icon, monthlyLimit: monthly_limit, isFixed: is_fixed ?? existing.isFixed },
      });

      const range = currentMonthRange();
      const spent = await prisma.transaction.aggregate({
        where: { userId, categoryId, type: 'expense', date: range },
        _sum: { amount: true },
      });

      res.json({
        id: updated.id,
        name: updated.name,
        icon: updated.icon,
        monthly_limit: Number(updated.monthlyLimit),
        is_fixed: updated.isFixed,
        spent_this_month: Number(spent._sum.amount ?? 0),
      });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
);

/**
 * @openapi
 * /budget/categories/{categoryId}:
 *   delete:
 *     tags:
 *       - Budget
 *     summary: Delete a budget category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       403:
 *         description: Not your category
 *       404:
 *         description: Category not found
 */
router.delete('/categories/:categoryId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { categoryId } = req.params;

    const existing = await prisma.budgetCategory.findUnique({ where: { id: categoryId } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'This category belongs to a different user' });
      return;
    }

    await prisma.budgetCategory.delete({ where: { id: categoryId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
