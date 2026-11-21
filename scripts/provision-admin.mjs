#!/usr/bin/env node
/**
 * VIDHYAA Jewellery Studio — Private Owner Admin Provisioning CLI
 *
 * Security guarantees:
 * - Reads owner password privately from interactive TTY (masked input; never CLI args or logs).
 * - Enforces NIST-aligned strong password policy.
 * - Hashes password with PBKDF2-HMAC-SHA256 (100,000 iterations) using Node built-in crypto (exact format verified by both Hostinger PHP and Node).
 * - Generates a fresh CSPRNG 20-byte (160-bit) RFC 4648 Base32 TOTP secret.
 * - Displays QR code directly in the private terminal for Google Authenticator / Authy.
 * - Requires live verification of a genuine 6-digit TOTP code before activating Admin access.
 * - Writes hashed credentials & secrets ONLY to server-only store `.admin-secrets/admin-auth.json` (chmod 600).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iters = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iters, 64, 'sha256').toString('hex');
  return `pbkdf2_sha256:${iters}:${salt}:${hash}`;
}

function verifyPasswordPbkdf2(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.trim().split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iters = Math.max(10000, Number(parts[1]) || 100000);
  const salt = parts[2];
  const expected = String(parts[3] || '').trim().toLowerCase();
  if (!/^[0-9a-f]{32,256}$/.test(expected) || expected.length % 2 !== 0) return false;
  const actual = crypto.pbkdf2Sync(password, salt, iters, expected.length / 2, 'sha256').toString('hex');
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT_DIR, '.admin-secrets');
const SECRETS_FILE = path.join(SECRETS_DIR, 'admin-auth.json');

const AUTHORIZED_ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const ISSUER_NAME = 'VIDHYAA Jewellery Studio';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const COMMONLY_COMPROMISED_PASSWORDS = new Set([
  'password', 'password123', 'admin123', 'admin1234', 'admin12345', 'admin123456',
  '12345678', '123456789', '1234567890', 'qwerty123456', 'welcome123', 'welcome@123',
  'vidhyaa123', 'vidhyaa@123', 'jewellery123', 'jewellery2026', 'superadmin123',
  'letmein123', 'pass@1234', 'india@123', 'jaipur123', 'royal12345', 'vidhyaaadmin@2026!'
]);

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[\s=]+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character at index ${i}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTOTPForCounter(secretBuffer, counter) {
  const counterBuf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTOTP(secretBase32, codeInput, windowSteps = 1, nowMs = Date.now()) {
  const cleanCode = String(codeInput || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false };
  }

  const secretBuf = base32Decode(secretBase32);
  const currentStep = Math.floor(nowMs / 1000 / 30);
  const inputBuf = Buffer.from(cleanCode, 'utf8');

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const step = currentStep + delta;
    if (step < 0) continue;
    const expected = generateTOTPForCounter(secretBuf, step);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (inputBuf.length === expectedBuf.length && crypto.timingSafeEqual(inputBuf, expectedBuf)) {
      return { valid: true, matchedStep: step };
    }
  }
  return { valid: false };
}

function validatePasswordPolicy(password) {
  const errors = [];
  if (password.length < 12) errors.push('Must be at least 12 characters long.');
  if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter (A-Z).');
  if (!/[a-z]/.test(password)) errors.push('Must contain at least one lowercase letter (a-z).');
  if (!/[0-9]/.test(password)) errors.push('Must contain at least one digit (0-9).');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Must contain at least one special character (e.g. !@#$%^&*).');
  if (COMMONLY_COMPROMISED_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password appears in known breached/default password lists.');
  }
  return errors;
}

function promptLine(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Interactive TTY terminal required for private password entry.'));
      return;
    }

    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (ch) => {
      for (const char of ch) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(Boolean(wasRaw));
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(Boolean(wasRaw));
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\nAborted by user.\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (char >= ' ') {
          value += char;
          process.stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

function generateBackupCodes(count = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars[bytes[j] % chars.length];
      part2 += chars[bytes[j + 4] % chars.length];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

function hashBackupCode(code, pepper) {
  const normalized = String(code || '').trim().toUpperCase();
  return crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
}

async function runSelfTest() {
  // RFC 6238 SHA-1 test vector: ASCII "12345678901234567890" at T = 59s => counter 1 => 94287082 (6-digit: 287082)
  const rfcSecret = Buffer.from('12345678901234567890', 'ascii');
  const rfcB32 = base32Encode(rfcSecret);
  const decoded = base32Decode(rfcB32);
  if (!decoded.equals(rfcSecret)) {
    throw new Error('Base32 round-trip mismatch');
  }
  const totpVal = generateTOTPForCounter(decoded, 1);
  if (totpVal !== '287082') {
    throw new Error(`RFC 6238 vector failed: expected 287082, got ${totpVal}`);
  }
  const verifyOk = verifyTOTP(rfcB32, '287082', 0, 59 * 1000);
  if (!verifyOk.valid) {
    throw new Error('TOTP verify failed for RFC 6238 vector');
  }

  // Ephemeral PBKDF2-SHA256 hash + verify check (not stored anywhere)
  const ephemInput = crypto.randomBytes(16).toString('hex');
  const testHash = hashPasswordPbkdf2(ephemInput);
  const parts = testHash.split(':');
  const ok = verifyPasswordPbkdf2(ephemInput, testHash);
  const bad = verifyPasswordPbkdf2(`${ephemInput}_bad`, testHash);
  if (
    parts.length !== 4 ||
    parts[0] !== 'pbkdf2_sha256' ||
    !/^[0-9a-f]{32}$/.test(parts[2]) ||
    !/^[0-9a-f]{128}$/.test(parts[3]) ||
    !ok ||
    bad
  ) {
    throw new Error('PBKDF2-SHA256 verification self-test failed');
  }

  const qrPreview = await QRCode.toString('otpauth://totp/Test:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test', {
    type: 'terminal',
    small: true
  });
  if (!qrPreview || qrPreview.length < 20) {
    throw new Error('Terminal QR rendering failed');
  }

  console.log('SELF_TEST_PASSED: RFC6238_TOTP=OK PBKDF2_SHA256=OK TERMINAL_QR=OK');
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
    return;
  }

  if (!process.stdin.isTTY) {
    console.error('ERROR: This provisioning script must be run directly in an interactive terminal (TTY) so your password and TOTP QR remain private.');
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('  VIDHYAA JEWELLERY STUDIO — PRIVATE ADMIN SECURITY SETUP');
  console.log('============================================================');
  console.log(`Authorized Owner Email : ${AUTHORIZED_ADMIN_EMAIL}`);
  console.log(`Secret Store Target    : ${SECRETS_FILE}`);
  console.log('Mode                   : Private Local Terminal Provisioning');
  console.log('------------------------------------------------------------\n');

  if (fs.existsSync(SECRETS_FILE)) {
    const existingRaw = fs.readFileSync(SECRETS_FILE, 'utf8');
    try {
      const existing = JSON.parse(existingRaw);
      if (existing?.activated) {
        const answer = await promptLine('An activated Admin configuration already exists. Overwrite/rotate credentials? (yes/no): ');
        if (answer.toLowerCase() !== 'yes') {
          console.log('Cancelled. Existing Admin credentials preserved unchanged.');
          process.exit(0);
        }
      }
    } catch {
      // proceed if corrupted/incomplete
    }
  }

  // Step 1: Private Owner Password Entry & Confirmation
  console.log('STEP 1 — SET STRONG ADMIN PASSWORD');
  console.log('Requirements: min 12 chars, uppercase, lowercase, digit, special character.\n');

  let password = '';
  while (true) {
    const p1 = await promptSecret('Enter new Admin password (hidden): ');
    const policyErrors = validatePasswordPolicy(p1);
    if (policyErrors.length > 0) {
      console.log('\nPassword does not meet security policy:');
      for (const err of policyErrors) {
        console.log(`  - ${err}`);
      }
      console.log('');
      continue;
    }

    const p2 = await promptSecret('Confirm Admin password (hidden): ');
    if (p1 !== p2) {
      console.log('\nPasswords do not match. Please try again.\n');
      continue;
    }
    password = p1;
    break;
  }

  console.log('\nHashing password with PBKDF2-SHA256 (100,000 iterations)...');
  const passwordHash = hashPasswordPbkdf2(password);
  password = ''; // clear reference

  // Step 2: Generate fresh 20-byte cryptographic Base32 TOTP secret
  console.log('\nSTEP 2 — GOOGLE AUTHENTICATOR (TOTP 2FA) ENROLLMENT');
  const secretBytes = crypto.randomBytes(20); // 160-bit CSPRNG secret
  const secretBase32 = base32Encode(secretBytes);
  const label = encodeURIComponent(`${ISSUER_NAME}:${AUTHORIZED_ADMIN_EMAIL}`);
  const issuer = encodeURIComponent(ISSUER_NAME);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  const terminalQr = await QRCode.toString(otpauthUrl, {
    type: 'terminal',
    small: true
  });

  console.log('\nScan this private QR code with Google Authenticator (or Authy / 1Password):\n');
  console.log(terminalQr);
  console.log('NOTE: Do NOT screenshot, commit, or paste this terminal output into any chat or log.\n');

  const showManual = await promptLine('Need manual setup key instead of scanning QR? (y/N): ');
  if (showManual.toLowerCase() === 'y' || showManual.toLowerCase() === 'yes') {
    console.log(`\nManual Setup Key (Time-based, 30s, SHA-1, 6 digits): ${secretBase32}\n`);
  }

  // Step 3: Mandatory Live TOTP Verification before activation
  console.log('STEP 3 — VERIFY LIVE AUTHENTICATOR CODE TO ACTIVATE');
  let verified = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const code = await promptLine(`Enter 6-digit code from Google Authenticator (attempt ${attempt}/5): `);
    const check = verifyTOTP(secretBase32, code, 1);
    if (check.valid) {
      verified = true;
      break;
    }
    console.log('Code did not match. Ensure your device clock is synced and wait for the next 30-second code if needed.\n');
  }

  if (!verified) {
    console.error('\nFAILED: TOTP verification failed. Admin authentication was NOT activated and no credentials were written.');
    process.exit(1);
  }

  // Step 4: Generate 256-bit Session Signing Secret & Single-Use Backup Codes
  const sessionSigningSecret = crypto.randomBytes(32).toString('hex');
  const backupPepper = crypto.randomBytes(32).toString('hex');
  const plainBackupCodes = generateBackupCodes(8);
  const backupCodeHashes = plainBackupCodes.map((c) => hashBackupCode(c, backupPepper));

  fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(SECRETS_DIR, 0o700);
  } catch {}

  const secretPayload = {
    version: 1,
    email: AUTHORIZED_ADMIN_EMAIL,
    role: 'admin',
    name: 'Neeraj Chauhan (Owner)',
    passwordAlgorithm: 'pbkdf2_sha256',
    passwordHash,
    totp: {
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secretBase32,
      verified: true,
      enrolledAt: new Date().toISOString()
    },
    sessionSigningSecret,
    backupPepper,
    backupCodeHashes,
    activated: true,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secretPayload, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(SECRETS_FILE, 0o600);
  } catch {}

  console.log('\n============================================================');
  console.log('  ADMIN SECURITY ENROLLMENT COMPLETE & VERIFIED');
  console.log('============================================================');
  console.log('Status           : ACTIVATED (PBKDF2-SHA256 + Verified TOTP)');
  console.log(`Owner            : ${AUTHORIZED_ADMIN_EMAIL}`);
  console.log(`Stored Safely At : ${SECRETS_FILE} (chmod 600)`);
  console.log('\nSINGLE-USE RECOVERY BACKUP CODES (write these down offline NOW — shown once only):');
  for (const code of plainBackupCodes) {
    console.log(`  - ${code}`);
  }
  console.log('\nClear your terminal scrollback (`clear` / `history -c`) before closing.');
}

main().catch((err) => {
  console.error('Provisioning failed:', err?.message || err);
  process.exit(1);
});
