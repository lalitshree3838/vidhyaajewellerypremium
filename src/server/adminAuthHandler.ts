import crypto from 'crypto';

const DEFAULT_ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'VidhyaaAdmin@2026!';
const DEFAULT_SESSION_SECRET = 'vidhyaa-studio-super-secure-admin-session-salt-2026';

interface RateLimitRecord {
  failedAttempts: number;
  lockoutUntil: number;
  lastAttempt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 mins

const revokedTokens = new Set<string>();

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) {
    s += '=';
  }
  return Buffer.from(s, 'base64').toString('utf8');
}

export function generateAdminSessionToken(email: string): { token: string; expiresIn: number } {
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600; // 12 hours
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: email,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp
    })
  );
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return {
    token: `${header}.${payload}.${signature}`,
    expiresIn: 12 * 3600
  };
}

export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing.' };
  }
  if (revokedTokens.has(token)) {
    return { valid: false, error: 'Session has been revoked.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure.' };
  }

  const [header, payload, signature] = parts;
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expSigBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expSigBuffer)) {
    return { valid: false, error: 'Invalid token signature.' };
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) {
      return { valid: false, error: 'Session expired. Please log in again.' };
    }
    return { valid: true, email: data.sub };
  } catch {
    return { valid: false, error: 'Invalid token payload.' };
  }
}

export function validateAdminCredentials(
  emailInput: string,
  passwordInput: string
): {
  valid: boolean;
  error?: string;
  admin?: { email: string; role: string; name: string };
} {
  const cleanEmail = (emailInput || '').trim().toLowerCase();
  const cleanPassword = (passwordInput || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return { valid: false, error: 'Both administrator email and password are required.' };
  }

  const configuredAdminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  const allowedAdminEmails = new Set([
    configuredAdminEmail,
    'anavneeraj2003@gmail.com',
    'admin@vidhyaajewellery.com'
  ]);

  if (!allowedAdminEmails.has(cleanEmail)) {
    return { valid: false, error: 'Unrecognized administrator email address.' };
  }

  const configuredPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const inputBuffer = Buffer.from(cleanPassword, 'utf8');
  const expectedBuffer = Buffer.from(configuredPassword, 'utf8');

  let match = false;
  if (inputBuffer.length === expectedBuffer.length) {
    match = crypto.timingSafeEqual(inputBuffer, expectedBuffer);
  }

  if (!match) {
    return { valid: false, error: 'Incorrect administrator password. Please check your credentials and try again.' };
  }

  return {
    valid: true,
    admin: {
      email: cleanEmail,
      role: 'admin',
      name: 'Super Administrator'
    }
  };
}

export function checkServerRateLimit(
  identifier: string
): { allowed: boolean; remainingSeconds: number; attemptsLeft: number } {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record) {
    return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILURES };
  }

  if (record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    return { allowed: false, remainingSeconds, attemptsLeft: 0 };
  }

  if (record.lockoutUntil > 0 && record.lockoutUntil <= now) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILURES };
  }

  const attemptsLeft = Math.max(0, MAX_FAILURES - record.failedAttempts);
  return { allowed: attemptsLeft > 0, remainingSeconds: 0, attemptsLeft };
}

export function recordServerFailedAttempt(identifier: string): { locked: boolean; remainingSeconds: number } {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = rateLimitStore.get(key) || { failedAttempts: 0, lockoutUntil: 0, lastAttempt: now };

  record.failedAttempts += 1;
  record.lastAttempt = now;

  if (record.failedAttempts >= MAX_FAILURES) {
    record.lockoutUntil = now + LOCKOUT_MS;
    rateLimitStore.set(key, record);
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  rateLimitStore.set(key, record);
  return { locked: false, remainingSeconds: 0 };
}

export function resetServerFailedAttempts(identifier: string): void {
  rateLimitStore.delete(identifier.toLowerCase().trim());
}

export function revokeAdminToken(token: string): void {
  if (token) revokedTokens.add(token);
}
