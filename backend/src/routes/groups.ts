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
      let unsettledShareCount = 0;
      for (const split of group.splits) {
        for (const share of split.shares) {
          // shares here are already filtered to isSettled=false
          unsettledShareCount += 1;
          if (split.paidBy === userId && share.userId !== userId) {
            netBalance += Number(share.amount);
          } else if (share.userId === userId && split.paidBy !== userId) {
            netBalance -= Number(share.amount);
          }
        }
      }

      // Snap noise to zero — defends the UI against floating-point drift
      // that previously showed "you pay ₹0.00" on groups with no real debt.
      if (Math.abs(netBalance) < 0.01) netBalance = 0;

      // Log groups that look inconsistent (debt without splits, or shares
      // without debt) so we can see the offender in docker logs.
      if (group.splits.length === 0 && netBalance !== 0) {
        console.warn(`[groups] inconsistent: group=${group.id} has 0 splits but netBalance=${netBalance} for user=${userId}`);
      }

      return {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        member_count: group._count.members,
        splits_count: group.splits.length,
        unsettled_shares: unsettledShareCount,
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

/**
 * @openapi
 * /groups/{groupId}/placeholder-members:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Add a placeholder member (admin only) — for someone not on Bacchat yet
 *     description: |
 *       Creates a guest user with the given name, adds them as a group member,
 *       and returns a one-time claim code. Share the resulting `claim_url`
 *       with the real person — when they open it and sign in/up, every
 *       reference to the placeholder (GroupMember + SplitShare rows) is
 *       atomically rewritten to their real userId and the placeholder is
 *       deleted, so they inherit all the splits/shares that were added in
 *       their absence.
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: "{ claim_code, claim_url, member: {...} }"
 *       403:
 *         description: Only an admin can add placeholder members
 */
router.post(
  '/:groupId/placeholder-members',
  authenticate,
  [body('name').notEmpty().trim().withMessage('Name is required').isLength({ max: 80 })],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { name } = req.body as { name: string };

      const me = await prisma.groupMember.findFirst({
        where: { groupId, userId },
      });
      if (!me) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      if (!me.isAdmin) {
        res.status(403).json({ error: 'Only a group admin can add placeholder members' });
        return;
      }

      const claimCode = randomUUID();
      const { claim, member } = await prisma.$transaction(async (tx) => {
        const placeholder = await tx.user.create({
          data: { name: name.trim(), isGuest: true },
        });
        const newMember = await tx.groupMember.create({
          data: { groupId, userId: placeholder.id, isAdmin: false },
        });
        const created = await tx.placeholderClaim.create({
          data: {
            groupId,
            placeholderUserId: placeholder.id,
            code: claimCode,
          },
        });
        return { claim: created, member: newMember };
      });

      // Public-facing URL hosted at the same root the invite landing pages
      // use, so Android App Links auto-open the app on the recipient's phone.
      const host = process.env.FRONTEND_URL ?? '';
      const claimUrl = `${host}/claim/${claim.code}`;

      console.log(`[groups] placeholder member ${claim.placeholderUserId} added to ${groupId} (claim ${claim.code})`);

      res.status(201).json({
        claim_code: claim.code,
        claim_url: claimUrl,
        placeholder_user_id: claim.placeholderUserId,
        member: {
          id: member.userId,
          group_id: groupId,
          is_admin: false,
          name: name.trim(),
          is_guest: true,
          is_placeholder: true,
        },
      });
    } catch (error) {
      console.error('Create placeholder member error:', error);
      res.status(500).json({ error: 'Failed to add placeholder member' });
    }
  },
);

/**
 * @openapi
 * /groups/solo:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Create-or-fetch a 1-on-1 split group with another Bacchat user
 *     description: |
 *       Idempotent. If a 2-member group already exists between the caller and
 *       `with_user_id` (and nobody else), returns that. Otherwise creates a
 *       new group named "You & <name>".
 *
 *       Designed for the "scan a QR / paste a Bacchat ID and start splitting"
 *       flow — no group naming, no member invites.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [with_user_id]
 *             properties:
 *               with_user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Existing solo group returned
 *       201:
 *         description: New solo group created
 *       400:
 *         description: Bad request
 *       404:
 *         description: with_user_id is not a Bacchat user
 */
router.post(
  '/solo',
  authenticate,
  [body('with_user_id').isUUID().withMessage('with_user_id must be a UUID')],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const otherId = String(req.body.with_user_id);

      if (otherId === userId) {
        res.status(400).json({ error: "Can't create a solo group with yourself" });
        return;
      }

      const other = await prisma.user.findUnique({ where: { id: otherId } });
      if (!other) {
        res.status(404).json({ error: 'That Bacchat ID does not exist' });
        return;
      }

      // Find an existing group containing exactly these two members and
      // nobody else.  A correlated query keeps the round-trip count to 1.
      //
      // Read: groups where I'm a member AND the other person is also a
      // member, then filter to those with exactly 2 members on the JS side.
      const candidate = await prisma.splitGroup.findFirst({
        where: {
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherId } } },
          ],
        },
        include: { _count: { select: { members: true } } },
      });
      if (candidate && candidate._count.members === 2) {
        res.status(200).json({
          id: candidate.id,
          name: candidate.name,
          emoji: candidate.emoji,
          member_count: 2,
          splits_count: 0,
          unsettled_shares: 0,
          net_balance: 0,
          invite_code: candidate.inviteCode,
          created_at: candidate.createdAt,
        });
        return;
      }

      const me = await prisma.user.findUnique({ where: { id: userId } });
      const groupName = `You & ${other.name.split(' ')[0]}`;
      const group = await prisma.splitGroup.create({
        data: {
          name: groupName,
          emoji: '🤝',
          createdBy: userId,
          inviteCode: randomUUID(),
          members: {
            create: [
              { userId, isAdmin: true },
              { userId: otherId, isAdmin: false },
            ],
          },
        },
        include: { _count: { select: { members: true } } },
      });

      console.log(`[groups] solo-group created ${group.id} for ${me?.name} ↔ ${other.name}`);

      res.status(201).json({
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        member_count: group._count.members,
        splits_count: 0,
        unsettled_shares: 0,
        net_balance: 0,
        invite_code: group.inviteCode,
        created_at: group.createdAt,
      });
    } catch (error) {
      console.error('Create solo group error:', error);
      res.status(500).json({ error: 'Failed to create solo group' });
    }
  },
);

/**
 * @openapi
 * /groups/{groupId}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Delete a group (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Group deleted
 *       403:
 *         description: Only group admin can delete
 *       404:
 *         description: Group not found
 */
router.delete('/:groupId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId } = req.params;

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!membership) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (!membership.isAdmin) {
      res.status(403).json({ error: 'Only a group admin can delete this group' });
      return;
    }

    // Cascading delete: Prisma schema must cascade for members/splits/shares
    await prisma.splitGroup.delete({ where: { id: groupId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

/**
 * @openapi
 * /groups/{groupId}/members/{memberUserId}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Remove a member from a group (admin removes others, or self-leave)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Member removed
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Member has unsettled shares
 */
router.delete('/:groupId/members/:memberUserId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { groupId, memberUserId } = req.params;

    const requester = await prisma.groupMember.findFirst({ where: { groupId, userId } });
    if (!requester) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (memberUserId !== userId && !requester.isAdmin) {
      res.status(403).json({ error: 'Only an admin can remove other members' });
      return;
    }

    const target = await prisma.groupMember.findFirst({
      where: { groupId, userId: memberUserId },
    });
    if (!target) {
      res.status(404).json({ error: 'Member not found in this group' });
      return;
    }

    // Block removal if they still have unsettled shares — preserves audit trail
    const unsettled = await prisma.splitShare.count({
      where: { userId: memberUserId, isSettled: false, split: { groupId } },
    });
    if (unsettled > 0) {
      res.status(409).json({ error: 'Member has unsettled shares — settle them first' });
      return;
    }

    await prisma.groupMember.delete({ where: { id: target.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export { formatGroupDetail };
export default router;
