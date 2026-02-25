import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body, query } from 'express-validator';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { generateRandomToken } from '../utils/token';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { validate } from '../middleware/validator';
import { authenticate, AuthRequest } from '../middleware/auth';

const router: ExpressRouter = Router();

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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email already registered or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
      });

      // Generate verification token
      const verificationToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await prisma.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt,
        },
      });

      // Send verification email
      try {
        await sendVerificationEmail(user.email, verificationToken, user.firstName || undefined);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail the signup if email fails
      }

      // Generate JWT
      const token = generateToken(user.id);

      res.status(201).json({
        message: 'User created successfully. Please check your email to verify your account.',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * @openapi
 * /auth/signin:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Sign in with email and password
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
 *         description: Signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/signin',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password);

      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Generate JWT
      const token = generateToken(user.id);

      res.json({
        message: 'Signed in successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Signin error:', error);
      res.status(500).json({ error: 'Failed to sign in' });
    }
  }
);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/verify-email',
  [query('token').notEmpty().withMessage('Token is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.query as { token: string };

      // Find verification token
      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!verificationToken) {
        res.status(400).json({ error: 'Invalid verification token' });
        return;
      }

      // Check if token expired
      if (new Date() > verificationToken.expiresAt) {
        res.status(400).json({ error: 'Verification token has expired' });
        return;
      }

      // Update user
      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      // Delete verification token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email already verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/resend-verification',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (user.isEmailVerified) {
        res.status(400).json({ error: 'Email already verified' });
        return;
      }

      // Delete old verification tokens
      await prisma.verificationToken.deleteMany({
        where: { userId: user.id },
      });

      // Generate new verification token
      const verificationToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt,
        },
      });

      // Send verification email
      await sendVerificationEmail(user.email, verificationToken, user.firstName || undefined);

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
 *         description: Password reset email sent (always returns 200 to prevent enumeration)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        res.json({ message: 'If the email exists, a password reset link has been sent' });
        return;
      }

      // Delete old reset tokens
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Generate reset token
      const resetToken = generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          expiresAt,
        },
      });

      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, resetToken, user.firstName || undefined);
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
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid, expired, or already-used token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, password } = req.body;

      // Find reset token
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken) {
        res.status(400).json({ error: 'Invalid reset token' });
        return;
      }

      // Check if token expired
      if (new Date() > resetToken.expiresAt) {
        res.status(400).json({ error: 'Reset token has expired' });
        return;
      }

      // Check if token already used
      if (resetToken.used) {
        res.status(400).json({ error: 'Reset token has already been used' });
        return;
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update user password
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      // Mark token as used
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
