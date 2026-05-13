import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body, query } from 'express-validator';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, verifyToken } from '../utils/jwt';
import { generateRandomToken } from '../utils/token';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { validate } from '../middleware/validator';
import { authenticate, AuthRequest } from '../middleware/auth';

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
 * /auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User created successfully
 *       409:
 *         description: Email already registered
 *       422:
 *         description: Validation failed
 */
router.post(
  '/signup',
  [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const hashedPassword = await hashPassword(password);

      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword },
      });

      const verificationToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.verificationToken.create({
        data: { token: verificationToken, userId: user.id, expiresAt },
      });

      try {
        await sendVerificationEmail(user.email!, verificationToken, user.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      const token = generateToken(user.id, false);

      res.status(201).json({ token, user: formatUser(user) });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

const loginHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      res.status(401).json({ error: 'No account found with that email, or wrong password' });
      return;
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'No account found with that email, or wrong password' });
      return;
    }

    const token = generateToken(user.id, user.isGuest);
    res.json({ token, user: formatUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
};

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Authenticate with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginValidation, validate, loginHandler);

/**
 * @openapi
 * /auth/signin:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Authenticate with email and password (alias for /login)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/signin', loginValidation, validate, loginHandler);

/**
 * @openapi
 * /auth/guest:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Create an anonymous guest session
 *     responses:
 *       201:
 *         description: Guest session created
 */
router.post('/guest', async (_req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.create({
      data: { name: 'Guest', isGuest: true },
    });

    const token = generateToken(user.id, true);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (error) {
    console.error('Guest error:', error);
    res.status(500).json({ error: 'Failed to create guest session' });
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Invalidate the current token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization!;
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const expiresAt = decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.revokedToken.create({
      data: { jti: decoded.jti, expiresAt },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isGuest: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(formatUser(user));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Verify email address with token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get(
  '/verify-email',
  [query('token').notEmpty().withMessage('Token is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.query as { token: string };

      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!verificationToken) {
        res.status(400).json({ error: 'Invalid verification token' });
        return;
      }

      if (new Date() > verificationToken.expiresAt) {
        res.status(400).json({ error: 'Verification token has expired' });
        return;
      }

      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });

      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  }
);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Resend email verification link
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified or no email on account
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/resend-verification',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!user.email) {
        res.status(400).json({ error: 'No email address on this account' });
        return;
      }

      if (user.isEmailVerified) {
        res.status(400).json({ error: 'Email already verified' });
        return;
      }

      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

      const verificationToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.verificationToken.create({
        data: { token: verificationToken, userId: user.id, expiresAt },
      });

      await sendVerificationEmail(user.email, verificationToken, user.name);

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to send verification email' });
    }
  }
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request a password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.email) {
        res.json({ message: 'If the email exists, a password reset link has been sent' });
        return;
      }

      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      const resetToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await prisma.passwordResetToken.create({
        data: { token: resetToken, userId: user.id, expiresAt },
      });

      try {
        await sendPasswordResetEmail(user.email, resetToken, user.name);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
      }

      res.json({ message: 'If the email exists, a password reset link has been sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password using a reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid, expired, or already-used token
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, password } = req.body;

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken) {
        res.status(400).json({ error: 'Invalid reset token' });
        return;
      }

      if (new Date() > resetToken.expiresAt) {
        res.status(400).json({ error: 'Reset token has expired' });
        return;
      }

      if (resetToken.used) {
        res.status(400).json({ error: 'Reset token has already been used' });
        return;
      }

      const hashedPassword = await hashPassword(password);

      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

export default router;
