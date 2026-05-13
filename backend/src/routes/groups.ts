import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router: ExpressRouter = Router();

const formatGroupDetail = (
  group: {
    id: string;
    name: string;
    emoji: string;
    inviteCode: string;
    createdAt: Date;
    members: Array<{
      isAdmin: boolean;
      user: { id: string; name: string; isGuest: boolean };
    }>;
  }
) => ({
  id: group.id,
  name: group.name,
  emoji: group.emoji,
  invite_code: group.inviteCode,
  created_at: group.createdAt,
  members: group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    is_guest: m.user.isGuest,
    is_admin: m.isAdmin,
  })),
});

/**
 * @openapi
 * /groups:
 *   get:
 *     tags:
 *       - Groups
 *     summary: List all groups the current user belongs to
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of groups with net balance
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
            splits: {
              include: {
                shares: { where: { isSettled: false } },
              },
            },
          },
        },
      },
    });

    const groups = memberships.map(({ group }) => {
      let netBalance = 0;
      for (const split of group.splits) {
        for (const share of split.shares) {
          if (split.paidBy === userId && share.userId !== userId) {
            netBalance += Number(share.amount);
          } else if (share.userId === userId && split.paidBy !== userId) {
            netBalance -= Number(share.amount);
          }
        }
      }
      return {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        member_count: group._count.members,
        net_balance: netBalance,
        invite_code: group.inviteCode,
        created_at: group.createdAt,
      };
    });

    res.json(groups);
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * @openapi
 * /groups:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Create a new group
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               emoji:
 *                 type: string
 *     responses:
 *       201:
 *         description: Group created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/',
  authenticate,
  [body('name').notEmpty().trim().withMessage('Name is required'), body('emoji').optional().trim()],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { name, emoji = '💸' } = req.body;

      const group = await prisma.splitGroup.create({
        data: {
          name,
          emoji,
          createdBy: userId,
          inviteCode: randomUUID(),
          members: {
            create: { userId, isAdmin: true },
          },
        },
        include: {
          _count: { select: { members: true } },
        },
      });

      res.status(201).json({
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        member_count: group._count.members,
        net_balance: 0,
        invite_code: group.inviteCode,
        created_at: group.createdAt,
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

/**
 * @openapi
 * /groups/{groupId}:
 *   get:
 *     tags:
 *       - Groups
 *     summary: Get full detail for a group
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
 *         description: Group detail with members
 *       403:
 *         description: Not a member
 *       404:
 *         description: Group not found
 */
router.get('/:groupId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId } = req.params;

    const group = await prisma.splitGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, isGuest: true } } },
        },
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    res.json(formatGroupDetail(group));
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

/**
 * @openapi
 * /groups/{groupId}/categories:
 *   get:
 *     tags:
 *       - Groups
 *     summary: List custom categories for a group
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
 *         description: Array of custom categories
 *       403:
 *         description: Not a member
 */
router.get('/:groupId/categories', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId } = req.params;

    const membership = await prisma.groupMember.findFirst({ where: { groupId, userId } });
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const categories = await prisma.groupCategory.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      created_at: c.createdAt,
    })));
  } catch (error) {
    console.error('List group categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * @openapi
 * /groups/{groupId}/categories:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Create a custom category for a group
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
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 *       403:
 *         description: Not a member
 *       409:
 *         description: Category name already exists in this group
 */
router.post(
  '/:groupId/categories',
  authenticate,
  [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('icon').optional().trim(),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { name, icon = '📦' } = req.body;

      const membership = await prisma.groupMember.findFirst({ where: { groupId, userId } });
      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this group' });
        return;
      }

      const category = await prisma.groupCategory.create({
        data: { groupId, name: name.trim(), icon, createdBy: userId },
      });

      res.status(201).json({
        id: category.id,
        name: category.name,
        icon: category.icon,
        created_at: category.createdAt,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ error: 'A category with that name already exists in this group' });
        return;
      }
      console.error('Create group category error:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

/**
 * @openapi
 * /groups/{groupId}/categories/{categoryId}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Delete a custom group category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       403:
 *         description: Not a member or not the creator
 *       404:
 *         description: Category not found
 */
router.delete('/:groupId/categories/:categoryId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId, categoryId } = req.params;

    const category = await prisma.groupCategory.findFirst({ where: { id: categoryId, groupId } });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const membership = await prisma.groupMember.findFirst({ where: { groupId, userId } });
    if (!membership || (category.createdBy !== userId && !membership.isAdmin)) {
      res.status(403).json({ error: 'Not authorized to delete this category' });
      return;
    }

    await prisma.groupCategory.delete({ where: { id: categoryId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete group category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export { formatGroupDetail };
export default router;
