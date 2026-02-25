import crypto from 'crypto';

export const generateRandomToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
