import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export interface TokenPayload {
  userId: string;
  isGuest: boolean;
  jti: string;
  exp?: number;
}

export const generateToken = (userId: string, isGuest: boolean): string => {
  return jwt.sign(
    { userId, isGuest, jti: randomUUID() },
    process.env.JWT_SECRET!,
    { expiresIn: isGuest ? '7d' : '30d' }
  );
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch (error) {
    return null;
  }
};
