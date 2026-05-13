import { Router, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateToken } from '../utils/jwt';
import { validate } from '../middleware/validator';

const router: ExpressRouter = Router();

const formatUser = (user: {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar_url: user.avatarUrl,
  is_guest: user.isGuest,
  created_at: user.createdAt,
});

/**
 * @openapi
 * /profile:
 *   put:
 *     tags:
 *       - Profile
 *     summary: Update the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Updated user profile
 *       409:
 *         description: Email already taken
 *       422:
 *         description: Validation failed
 */
router.put(
  '/',
  authenticate,
  [
    body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { name, email } = req.body;

      const current = await prisma.user.findUnique({ where: { id: userId } });
      if (!current) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (email && email !== current.email) {
        const conflict = await prisma.user.findUnique({ where: { email } });
        if (conflict) {
          res.status(409).json({ error: 'Email already taken' });
          return;
        }
      }

      const isGuestUpgrade = current.isGuest && !!email;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(isGuestUpgrade && { isGuest: false }),
        },
        select: { id: true, name: true, email: true, avatarUrl: true, isGuest: true, createdAt: true },
      });

      const response: Record<string, unknown> = { user: formatUser(updated) };
      if (isGuestUpgrade) {
        response.token = generateToken(updated.id, false);
      }

      res.json(response);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

export default router;
