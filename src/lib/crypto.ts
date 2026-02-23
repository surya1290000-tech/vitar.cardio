import crypto from 'crypto';

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyOTPHash(otp: string, hash: string): boolean {
  return hashOTP(otp) === hash;
}
