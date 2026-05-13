import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { generateToken, verifyToken } from '../utils/jwt';
import { validate } from '../middleware/validator';
import { formatGroupDetail } from './groups';

const router: ExpressRouter = Router();

/**
 * @openapi
 * /invite/{inviteCode}:
 *   get:
 *     tags:
 *       - Invites
 *     summary: Look up a group by invite code (no auth required)
 *     parameters:
 *       - in: path
 *         name: inviteCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group preview
 *       404:
 *         description: Invite code not found
 */
router.get('/invite/:inviteCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inviteCode } = req.params;

    const group = await prisma.splitGroup.findUnique({
      where: { inviteCode },
      include: { _count: { select: { members: true } } },
    });

    if (!group) {
      res.status(404).json({ error: 'Invite code not found' });
      return;
    }

    res.json({
      group_id: group.id,
      name: group.name,
      emoji: group.emoji,
      member_count: group._count.members,
    });
  } catch (error) {
    console.error('Get invite error:', error);
    res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

/**
 * @openapi
 * /invite/{inviteCode}/join:
 *   post:
 *     tags:
 *       - Invites
 *     summary: Join a group via invite link (auth optional)
 *     parameters:
 *       - in: path
 *         name: inviteCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined group successfully
 *       400:
 *         description: Name required for guest join
 *       404:
 *         description: Invite code not found
 *       409:
 *         description: Already a member
 */
router.post(
  '/invite/:inviteCode/join',
  [body('name').optional().trim()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.params;

      const group = await prisma.splitGroup.findUnique({
        where: { inviteCode },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, isGuest: true } } },
          },
        },
      });

      if (!group) {
        res.status(404).json({ error: 'Invite code not found' });
        return;
      }

      // Resolve caller identity: try to decode auth header if present
      const authHeader = req.headers.authorization;
      let resolvedUserId: string | null = null;
      let isAuthenticated = false;

      if (authHeader?.startsWith('Bearer ')) {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded) {
          const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
          if (!revoked) {
            const exists = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (exists) {
              resolvedUserId = decoded.userId;
              isAuthenticated = true;
            }
          }
        }
      }

      let responseToken: string | null = null;
      let user: { id: string; name: string; email: string | null; avatarUrl: string | null; isGuest: boolean; createdAt: Date };

      if (isAuthenticated && resolvedUserId) {
        const alreadyMember = group.members.some((m) => m.userId === resolvedUserId);
        if (alreadyMember) {
          res.status(409).json({ error: 'You are already a member of this group' });
          return;
        }

        await prisma.groupMember.create({
          data: { groupId: group.id, userId: resolvedUserId, isAdmin: false },
        });

        const dbUser = await prisma.user.findUnique({ where: { id: resolvedUserId } });
        user = dbUser!;
        responseToken = null;
      } else {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
          res.status(400).json({ error: 'name is required for guest join' });
          return;
        }

        const guestUser = await prisma.user.create({
          data: { name: name.trim(), isGuest: true },
        });

        await prisma.groupMember.create({
          data: { groupId: group.id, userId: guestUser.id, isAdmin: false },
        });

        user = guestUser;
        responseToken = generateToken(guestUser.id, true);
        resolvedUserId = guestUser.id;
      }

      // Reload group with updated members
      const updatedGroup = await prisma.splitGroup.findUnique({
        where: { id: group.id },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, isGuest: true } } },
          },
        },
      });

      res.json({
        token: responseToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatarUrl,
          is_guest: user.isGuest,
          created_at: user.createdAt,
        },
        group: formatGroupDetail(updatedGroup!),
      });
    } catch (error) {
      console.error('Join group error:', error);
      res.status(500).json({ error: 'Failed to join group' });
    }
  }
);

export default router;
