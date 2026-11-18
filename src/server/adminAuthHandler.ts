import crypto from 'node:crypto';
import {
  getSessionSecret,
  getAllowedAdminEmails,
  verifyPatronOrAdminPassword,
  loadAdminCredentialsConfig,
  signAdminToken,
  verifySignedSessionToken,
  revokeSessionToken,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit
} from './sessionAuth.js';

export function generateAdminSessionToken(email: string): { token: string; expiresIn: number } {
  return {
    token: signAdminToken(email),
    expiresIn: 12 * 3600
  };
}

export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string; error?: string } {
  const payload = verifySignedSessionToken(token, 'admin');
  if (!payload || !getAllowedAdminEmails().has(String(payload.email || '').toLowerCase())) {
    return { valid: false, error: 'Invalid, expired, or revoked admin token.' };
  }
  return { valid: true, email: String(payload.email) };
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
  const cleanPassword = passwordInput || '';

  if (!cleanEmail || !cleanPassword.trim()) {
    return { valid: false, error: 'Both administrator email and password are required.' };
  }

  if (!getAllowedAdminEmails().has(cleanEmail)) {
    return { valid: false, error: 'Unrecognized administrator email address.' };
  }

  const creds = loadAdminCredentialsConfig();
  if (!creds.hasPasswordAuth) {
    return {
      valid: false,
      error: 'Server password authentication is not configured. Use Google Workspace Admin Sign In or configure ADMIN_PASSWORD_HASH.'
    };
  }

  let match = false;
  if (creds.passwordHash) {
    match = verifyPatronOrAdminPassword(cleanPassword, creds.passwordHash);
  } else if (creds.plainPassword) {
    const a = Buffer.from(cleanPassword, 'utf8');
    const b = Buffer.from(creds.plainPassword, 'utf8');
    match = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!match) {
    return { valid: false, error: 'Incorrect administrator password.' };
  }

  return {
    valid: true,
    admin: {
      email: cleanEmail,
      role: 'admin',
      name: 'Neeraj Chauhan (Owner)'
    }
  };
}

export function checkServerRateLimit(
  identifier: string
): { allowed: boolean; remainingSeconds: number; attemptsLeft: number } {
  const res = checkRateLimit(`admin_handler:${identifier.toLowerCase().trim()}`);
  return {
    allowed: res.allowed,
    remainingSeconds: res.remainingSeconds,
    attemptsLeft: res.allowed ? 5 : 0
  };
}

export function recordServerFailedAttempt(identifier: string): { locked: boolean; remainingSeconds: number } {
  return recordRateLimitFailure(`admin_handler:${identifier.toLowerCase().trim()}`);
}

export function resetServerFailedAttempts(identifier: string): void {
  clearRateLimit(`admin_handler:${identifier.toLowerCase().trim()}`);
  void getSessionSecret();
}

export function revokeAdminToken(token: string): void {
  if (token) revokeSessionToken(token);
}
