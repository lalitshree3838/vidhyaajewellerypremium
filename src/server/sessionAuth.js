import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { argon2Verify } from 'hash-wasm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const FIREBASE_PROJECT_ID = 'gen-lang-client-0706507905';
const ADMIN_TTL_SECONDS = 12 * 3600;
const PATRON_TTL_SECONDS = 30 * 24 * 3600;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_SESSION_COOKIE_NAME = 'vidhyaa_admin_session';

let cachedDotEnv = null;
let cachedSessionSecret = null;
let googleCertCache = { expiresAt: 0, certs: null };
const lockChains = new Map();

function readDotEnv() {
  if (cachedDotEnv) return cachedDotEnv;
  const vars = {};
  const envCandidates = [
    path.join(path.dirname(ROOT_DIR), '.env'),
    path.join(path.dirname(ROOT_DIR), '.env.production'),
    path.join(path.dirname(path.dirname(ROOT_DIR)), '.env'),
    path.join(ROOT_DIR, '.env')
  ];
  for (const envPath of envCandidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const raw = fs.readFileSync(envPath, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        let t = line.trim();
        if (!t || t.startsWith('#')) continue;
        if (t.startsWith('export ')) t = t.slice(7).trim();
        const idx = t.indexOf('=');
        if (idx === -1) continue;
        const k = t.slice(0, idx).trim();
        if (!k) continue;
        let v = t.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!Object.prototype.hasOwnProperty.call(vars, k) || !String(vars[k]).trim()) {
          vars[k] = v;
        }
      }
    } catch {}
  }
  cachedDotEnv = vars;
  return vars;
}

export function getEnvVar(key, fallback = '') {
  const proc = process.env[key];
  if (typeof proc === 'string' && proc.trim()) return proc.trim();
  const dot = readDotEnv();
  if (typeof dot[key] === 'string' && dot[key].trim()) return dot[key].trim();
  return fallback;
}

export function getOutsideSecretsDir() {
  const override = getEnvVar('VIDHYAA_SECRETS_DIR');
  if (override) {
    try {
      fs.mkdirSync(override, { recursive: true, mode: 0o700 });
      return override;
    } catch {}
  }
  const existingDirs = [
    path.join(path.dirname(ROOT_DIR), '.admin-secrets'),
    path.join(path.dirname(ROOT_DIR), '.vidhyaa-secrets'),
    path.join(path.dirname(path.dirname(ROOT_DIR)), '.admin-secrets')
  ];
  for (const dir of existingDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.accessSync(dir, fs.constants.W_OK);
        return dir;
      }
    } catch {}
  }
  const outside = path.join(path.dirname(ROOT_DIR), '.admin-secrets');
  try {
    fs.mkdirSync(outside, { recursive: true, mode: 0o700 });
    fs.accessSync(outside, fs.constants.W_OK);
    return outside;
  } catch {
    return null;
  }
}

export function getTempStateDir() {
  const hash = crypto.createHash('md5').update(ROOT_DIR).digest('hex').slice(0, 12);
  const dir = path.join(os.tmpdir(), `vidhyaa_state_${hash}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function getRuntimeStateDir() {
  return getOutsideSecretsDir() || getTempStateDir();
}

export function getSessionSecret() {
  if (cachedSessionSecret) return cachedSessionSecret;

  for (const key of ['VIDHYAA_SESSION_SECRET', 'ADMIN_SESSION_SECRET', 'SESSION_SECRET']) {
    const val = getEnvVar(key);
    if (val.length >= 16) {
      cachedSessionSecret = val;
      return val;
    }
  }

  const creds = loadAdminCredentialsConfig();
  if (creds.sessionSigningSecret && creds.sessionSigningSecret.length >= 32) {
    cachedSessionSecret = creds.sessionSigningSecret;
    return creds.sessionSigningSecret;
  }

  const keyFile = path.join(getRuntimeStateDir(), 'session-secret.key');
  try {
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing.length >= 32) {
        cachedSessionSecret = existing;
        return existing;
      }
    }
  } catch {}

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(keyFile, generated, { encoding: 'utf8', mode: 0o600 });
  } catch {}
  cachedSessionSecret = generated;
  return generated;
}

function base64UrlEncode(bufOrStr) {
  const buf = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(String(bufOrStr), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let padded = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return Buffer.from(padded, 'base64');
}

export function getAllowedAdminEmails() {
  const set = new Set(['anavneeraj2003@gmail.com']);
  const envEmail = getEnvVar('ADMIN_EMAIL').toLowerCase();
  if (envEmail) set.add(envEmail);
  return set;
}

function getRevokedTokensPath() {
  return path.join(getRuntimeStateDir(), 'revoked-tokens.json');
}

function readRevokedTokensMap() {
  try {
    const p = getRevokedTokensPath();
    if (!fs.existsSync(p)) return {};
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isTokenRevoked(jti) {
  if (!jti) return false;
  const map = readRevokedTokensMap();
  const exp = Number(map[jti] || 0);
  return exp >= Math.floor(Date.now() / 1000);
}

export function revokeSessionToken(token) {
  const payload = verifySignedSessionToken(token);
  if (!payload || !payload.jti) return false;
  const now = Math.floor(Date.now() / 1000);
  const map = readRevokedTokensMap();
  const next = {};
  for (const [k, v] of Object.entries(map)) {
    if (Number(v) > now) next[k] = Number(v);
  }
  next[payload.jti] = Number(payload.exp || now + ADMIN_TTL_SECONDS);
  try {
    fs.writeFileSync(getRevokedTokensPath(), JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  } catch {}
  return true;
}

export function signSessionToken(claims, ttlSeconds = ADMIN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + ttlSeconds
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', getSessionSecret()).update(`v1.${encoded}`).digest()
  );
  return `v1.${encoded}.${sig}`;
}

export function signAdminToken(email, extra = {}) {
  return signSessionToken(
    {
      type: 'admin',
      sub: String(email).toLowerCase(),
      email: String(email).toLowerCase(),
      role: 'admin',
      ...extra
    },
    ADMIN_TTL_SECONDS
  );
}

export function signPatronToken(patron) {
  return signSessionToken(
    {
      type: 'patron',
      sub: patron.uid,
      uid: patron.uid,
      mobile: patron.mobile || '',
      phone: patron.phone || '',
      email: patron.email || '',
      role: 'customer'
    },
    PATRON_TTL_SECONDS
  );
}

/**
 * @param {string} token
 * @param {string | null} [expectedType]
 */
export function verifySignedSessionToken(token, expectedType = null) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getSessionSecret()).update(`v1.${parts[1]}`).digest()
  );
  const sigBuf = Buffer.from(parts[2], 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || Number(payload.exp) < now) return null;
  if (expectedType && payload.type !== expectedType) return null;
  if (payload.jti && isTokenRevoked(payload.jti)) return null;

  return payload;
}

async function fetchGoogleFirebaseCerts() {
  const now = Date.now();
  if (googleCertCache.certs && googleCertCache.expiresAt > now) {
    return googleCertCache.certs;
  }
  const diskCacheFile = path.join(getTempStateDir(), 'firebase_google_certs.json');
  try {
    if (fs.existsSync(diskCacheFile)) {
      const parsed = JSON.parse(fs.readFileSync(diskCacheFile, 'utf8'));
      if (parsed?.certs && Number(parsed.expiresAt || 0) > now) {
        googleCertCache = parsed;
        return parsed.certs;
      }
    }
  } catch {}

  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (res.ok) {
      const certs = await res.json();
      const cc = String(res.headers.get('cache-control') || '');
      const m = /max-age=(\d+)/i.exec(cc);
      const maxAgeSec = m ? Math.max(60, Number(m[1])) : 3600;
      googleCertCache = { expiresAt: now + maxAgeSec * 1000, certs };
      try {
        fs.writeFileSync(diskCacheFile, JSON.stringify(googleCertCache), { encoding: 'utf8', mode: 0o600 });
      } catch {}
      return certs;
    }
  } catch {}

  return googleCertCache.certs || {};
}

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) return null;

  let header;
  let payload;
  let sig;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
    sig = base64UrlDecode(parts[2]);
  } catch {
    return null;
  }

  if (header?.alg !== 'RS256' || !header?.kid) return null;
  const now = Math.floor(Date.now() / 1000);
  if (
    payload?.aud !== FIREBASE_PROJECT_ID ||
    payload?.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
    !payload?.sub ||
    Number(payload?.exp || 0) <= now ||
    Number(payload?.iat || 0) > now + 300
  ) {
    return null;
  }

  const certs = await fetchGoogleFirebaseCerts();
  const certPem = certs?.[header.kid];
  if (!certPem) return null;

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    if (!verifier.verify(certPem, sig)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const raw = String(req?.headers?.cookie || '');
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function isHttpsRequest(req) {
  if (req?.socket?.encrypted) return true;
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  if (String(req?.headers?.['x-forwarded-ssl'] || '').toLowerCase() === 'on') return true;
  return false;
}

export function isAllowedOriginValue(origin) {
  const clean = String(origin || '').trim();
  if (!clean) return false;
  if (/^https:\/\/(?:www\.)?vidhyaajewellerystudio\.com$/i.test(clean)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(clean)) return true;
  if (/^https:\/\/[a-z0-9-]+\.run\.app$/i.test(clean)) return true;
  const extra = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(clean);
}

export function buildAdminSessionCookie(token, req, maxAgeSeconds = ADMIN_TTL_SECONDS) {
  const https = isHttpsRequest(req);
  const host = normalizeHostname(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  const isRunApp = https && /\.run\.app$/i.test(host);
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(String(token || ''))}`,
    'Path=/',
    `Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`,
    'HttpOnly'
  ];
  if (https) {
    parts.push('Secure');
    if (isRunApp) {
      parts.push('SameSite=None');
      parts.push('Partitioned');
    } else {
      parts.push('SameSite=Lax');
    }
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function clearAdminSessionCookie(req) {
  const https = isHttpsRequest(req);
  const host = normalizeHostname(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  const isRunApp = https && /\.run\.app$/i.test(host);
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly'
  ];
  if (https) {
    parts.push('Secure');
    if (isRunApp) {
      parts.push('SameSite=None');
      parts.push('Partitioned');
    } else {
      parts.push('SameSite=Lax');
    }
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function extractTokenFromHeaders(req, customHeader = 'x-admin-token') {
  const hdrVal = String(req.headers?.[customHeader] || '').trim();
  if (hdrVal) return hdrVal;
  const auth = String(req.headers?.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }
  if (customHeader === 'x-admin-token') {
    const cookies = parseCookies(req);
    if (cookies[ADMIN_SESSION_COOKIE_NAME]) {
      return String(cookies[ADMIN_SESSION_COOKIE_NAME]).trim();
    }
  }
  return '';
}

export function hasExplicitAdminAuthHeader(req) {
  const hdrVal = String(req?.headers?.['x-admin-token'] || '').trim();
  if (hdrVal) return true;
  const auth = String(req?.headers?.authorization || '').trim();
  return /^Bearer\s+/i.test(auth);
}

export function verifyCsrfOriginForCookieRequest(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { ok: true };
  }
  const cookies = parseCookies(req);
  const hasSessionCookie = Boolean(cookies[ADMIN_SESSION_COOKIE_NAME]);
  if (!hasSessionCookie || hasExplicitAdminAuthHeader(req)) {
    return { ok: true };
  }

  const originHeader = String(req?.headers?.origin || '').trim();
  const refererHeader = String(req?.headers?.referer || '').trim();
  const secFetchSite = String(req?.headers?.['sec-fetch-site'] || '').trim().toLowerCase();

  let candidateOrigin = originHeader;
  if (!candidateOrigin && refererHeader) {
    try {
      candidateOrigin = new URL(refererHeader).origin;
    } catch {
      return { ok: false, error: 'Forbidden: Malformed Referer header on cookie-authenticated request.' };
    }
  }

  if (candidateOrigin) {
    if (isAllowedOriginValue(candidateOrigin)) {
      return { ok: true };
    }
    try {
      const originHost = normalizeHostname(new URL(candidateOrigin).host);
      const reqHost = normalizeHostname(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
      if (originHost && reqHost && originHost === reqHost) {
        return { ok: true };
      }
    } catch {}
    return { ok: false, error: 'Forbidden: Cross-origin state-changing request rejected.' };
  }

  if (secFetchSite === 'cross-site') {
    return { ok: false, error: 'Forbidden: Cross-site mutation request rejected.' };
  }

  return { ok: true };
}

export async function authenticateAdminRequest(req) {
  const headerToken = String(req?.headers?.['x-admin-token'] || '').trim() ||
    (/^Bearer\s+/i.test(String(req?.headers?.authorization || ''))
      ? String(req.headers.authorization).replace(/^Bearer\s+/i, '').trim()
      : '');
  const cookieToken = parseCookies(req)[ADMIN_SESSION_COOKIE_NAME] || '';
  const token = headerToken || cookieToken;
  if (!token) return null;

  const authSource = headerToken ? 'header' : 'cookie';

  const session = verifySignedSessionToken(token, 'admin');
  if (session && getAllowedAdminEmails().has(String(session.email || '').toLowerCase())) {
    return {
      email: String(session.email).toLowerCase(),
      role: 'admin',
      name: session.name || 'Executive Administrator',
      authMethod: session.authMethod || 'session',
      authSource,
      token
    };
  }

  const fb = await verifyFirebaseIdToken(token);
  if (fb) {
    const fbEmail = String(fb.email || '').toLowerCase().trim();
    if (fb.email_verified === true && getAllowedAdminEmails().has(fbEmail)) {
      return {
        email: fbEmail,
        role: 'admin',
        uid: String(fb.sub),
        name: fb.name || 'Executive Administrator',
        authMethod: 'firebase',
        authSource,
        token
      };
    }
  }

  return null;
}

export function normalizePhone10(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function authenticateCustomerRequest(req) {
  const admin = await authenticateAdminRequest(req);
  if (admin) {
    return { ...admin, isAdmin: true };
  }

  const token =
    extractTokenFromHeaders(req, 'x-customer-token') ||
    extractTokenFromHeaders(req, 'x-admin-token');
  if (!token) return null;

  const patron = verifySignedSessionToken(token, 'patron');
  if (patron) {
    return {
      isAdmin: false,
      uid: String(patron.uid || patron.sub || ''),
      email: String(patron.email || '').toLowerCase().trim(),
      phone10: normalizePhone10(patron.mobile || patron.phone || ''),
      role: 'customer'
    };
  }

  const fb = await verifyFirebaseIdToken(token);
  if (fb) {
    return {
      isAdmin: false,
      uid: String(fb.sub || ''),
      email: String(fb.email || '').toLowerCase().trim(),
      phone10: normalizePhone10(fb.phone_number || ''),
      role: 'customer'
    };
  }

  return null;
}

export function computeOrderReceiptToken(order) {
  const keyData = [order?.id || '', order?.orderNumber || '', order?.createdAt || ''].join('|');
  return base64UrlEncode(
    crypto.createHmac('sha256', getSessionSecret()).update(`receipt:${keyData}`).digest()
  );
}

export function hasValidOrderReceiptToken(order, reqOrToken) {
  const provided =
    typeof reqOrToken === 'string'
      ? reqOrToken.trim()
      : String(reqOrToken?.headers?.['x-order-token'] || '').trim();
  if (!provided) return false;
  const expected = computeOrderReceiptToken(order);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function customerOwnsOrder(customer, order) {
  if (!customer || !order) return false;
  if (customer.isAdmin) return true;

  const cUid = String(customer.uid || '').trim();
  const cEmail = String(customer.email || '').toLowerCase().trim();
  const cPhone = normalizePhone10(customer.phone10 || '');

  const oUid = String(order.userId || '').trim();
  const oEmail = String(order.customerEmail || '').toLowerCase().trim();
  const oPhone = normalizePhone10(order.customerPhone || order.shippingAddress?.phone || '');

  if (cUid && oUid && cUid === oUid) return true;
  if (cEmail && oEmail && !cEmail.endsWith('@phone.vidhyaajewellery.com') && cEmail === oEmail) return true;
  if (cPhone && oPhone && cPhone === oPhone) return true;
  return false;
}

export function sanitizePublicOrderTracking(order) {
  const addr = order?.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
  return {
    id: String(order.id || ''),
    orderNumber: String(order.orderNumber || ''),
    orderStatus: String(order.orderStatus || 'Pending'),
    paymentStatus: String(order.paymentStatus || 'pending'),
    isPaid: Boolean(order.isPaid),
    paymentMethod: String(order.paymentMethod || 'Online Payment'),
    subtotal: Number(order.subtotal ?? order.totalAmount ?? 0),
    discount: Number(order.discount ?? 0),
    deliveryCharge: Number(order.deliveryCharge ?? 0),
    total: Number(order.total ?? order.totalAmount ?? 0),
    totalAmount: Number(order.totalAmount ?? 0),
    currency: String(order.currency || 'INR'),
    courierName: String(order.courierName || ''),
    trackingNumber: String(order.trackingNumber || ''),
    giftItem: order.giftItem || undefined,
    paymentEnv: order.paymentEnv || undefined,
    isTestOrder: Boolean(order.isTestOrder),
    items: (Array.isArray(order.items) ? order.items : []).map((it) => ({
      productId: String(it?.productId || ''),
      productName: String(it?.productName || 'Jewellery Item'),
      variationId: String(it?.variationId || ''),
      variationName: String(it?.variationName || ''),
      quantity: Number(it?.quantity || 1),
      price: Number(it?.price || 0),
      image: String(it?.image || '')
    })),
    shippingAddress: {
      id: 'redacted',
      name: '',
      phone: '',
      street: '',
      landmark: '',
      city: String(addr.city || ''),
      state: String(addr.state || ''),
      pincode: String(addr.pincode || '')
    },
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    upiReference: '',
    createdAt: String(order.createdAt || ''),
    updatedAt: String(order.updatedAt || ''),
    redactedPii: true
  };
}

export function hashPasswordPbkdf2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iters = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iters, 64, 'sha256').toString('hex');
  return `pbkdf2_sha256:${iters}:${salt}:${hash}`;
}

export function verifyPatronOrAdminPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const clean = storedHash.trim();

  if (clean.startsWith('pbkdf2_sha256:')) {
    const parts = clean.split(':');
    if (parts.length !== 4) return false;
    const iters = Math.max(10000, Number(parts[1]) || 100000);
    const salt = parts[2];
    const expected = String(parts[3] || '').trim().toLowerCase();
    if (!/^[0-9a-f]{32,256}$/.test(expected) || expected.length % 2 !== 0) {
      return false;
    }
    try {
      const byteLen = expected.length / 2;
      const actual = crypto.pbkdf2Sync(password, salt, iters, byteLen, 'sha256').toString('hex');
      const a = Buffer.from(actual, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  if (clean.startsWith('sha256:')) {
    const parts = clean.split(':');
    if (parts.length !== 3) return false;
    const actual = crypto.createHash('sha256').update(`${parts[1]}:${password}`).digest('hex');
    const a = Buffer.from(actual, 'utf8');
    const b = Buffer.from(parts[2], 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // Legacy scrypt format from data/patrons.json (`saltHex:hashHex`)
  if (clean.includes(':')) {
    const [salt, expected] = clean.split(':');
    if (!salt || !expected) return false;
    try {
      const actual = crypto.scryptSync(password, salt, 64).toString('hex');
      const a = Buffer.from(actual, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  return false;
}

export async function verifyAdminPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const clean = storedHash.trim();
  if (clean.startsWith('$argon2')) {
    try {
      return await argon2Verify({ password, hash: clean });
    } catch {
      return false;
    }
  }
  return verifyPatronOrAdminPassword(password, clean);
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx !== -1) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function verifyTotpCode(secretBase32, code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const key = base32Decode(secretBase32);
  if (key.length === 0) return false;
  const step = Math.floor(Date.now() / 30000);
  for (let offset = -1; offset <= 1; offset++) {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeUInt32BE(0, 0);
    counterBuf.writeUInt32BE(step + offset, 4);
    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
    const pos = hmac[hmac.length - 1] & 0x0f;
    const bin =
      ((hmac[pos] & 0x7f) << 24) |
      ((hmac[pos + 1] & 0xff) << 16) |
      ((hmac[pos + 2] & 0xff) << 8) |
      (hmac[pos + 3] & 0xff);
    const otp = String(bin % 1000000).padStart(6, '0');
    const a = Buffer.from(otp, 'utf8');
    const b = Buffer.from(clean, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function loadAdminCredentialsConfig() {
  const overrideDir = getEnvVar('VIDHYAA_SECRETS_DIR');
  const parentDir = path.dirname(ROOT_DIR);
  const grandParentDir = path.dirname(parentDir);
  const dirs = [
    ...(overrideDir ? [overrideDir] : []),
    path.join(parentDir, '.admin-secrets'),
    path.join(parentDir, '.vidhyaa-secrets'),
    parentDir,
    path.join(grandParentDir, '.admin-secrets'),
    path.join(ROOT_DIR, '.admin-secrets'),
    getTempStateDir()
  ];
  const candidates = [];
  for (const dir of dirs) {
    candidates.push(path.join(dir, 'admin-credentials.json'));
    candidates.push(path.join(dir, 'admin-auth.json'));
  }

  let cfg = {};
  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand)) {
        const parsed = JSON.parse(fs.readFileSync(cand, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          cfg = parsed;
          break;
        }
      }
    } catch {}
  }

  const envPasswordHash = getEnvVar('ADMIN_PASSWORD_HASH');
  const envPlainPassword = getEnvVar('ADMIN_PASSWORD');
  const envTotpSecret = getEnvVar('ADMIN_TOTP_SECRET');

  const passwordHash = String(envPasswordHash || cfg.passwordHash || cfg.adminPasswordHash || '').trim();
  const plainPassword = String(envPlainPassword || cfg.password || '').trim();
  const totpSecret = String(envTotpSecret || cfg.totpSecret || cfg.totp?.secretBase32 || '').trim();
  const backupCodes = Array.isArray(cfg.backupCodes) ? cfg.backupCodes : [];
  const backupPepper = String(cfg.backupPepper || '').trim();
  const backupCodeHashes = Array.isArray(cfg.backupCodeHashes) ? cfg.backupCodeHashes : [];
  const sessionSigningSecret = String(cfg.sessionSigningSecret || '').trim();

  return {
    passwordHash,
    plainPassword,
    totpSecret,
    backupCodes,
    backupPepper,
    backupCodeHashes,
    sessionSigningSecret,
    hasEnvPasswordOverride: Boolean(envPasswordHash || envPlainPassword),
    hasPasswordAuth: Boolean(passwordHash || plainPassword)
  };
}

const COMPROMISED_ADMIN_PASSWORDS = new Set([
  'password', 'password123', 'admin123', 'admin1234', 'admin12345', 'admin123456',
  '12345678', '123456789', '1234567890', 'qwerty123456', 'welcome123', 'welcome@123',
  'vidhyaa123', 'vidhyaa@123', 'jewellery123', 'jewellery2026', 'superadmin123',
  'letmein123', 'pass@1234', 'india@123', 'jaipur123', 'royal12345'
]);

export function validateNewAdminPassword(password) {
  const clean = String(password || '');
  if (clean.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (COMPROMISED_ADMIN_PASSWORDS.has(clean.trim().toLowerCase())) {
    return { valid: false, error: 'Please choose a unique password not in common breach lists.' };
  }
  if (!/[A-Z]/.test(clean) || !/[a-z]/.test(clean) || !/[0-9]/.test(clean) || !/[^A-Za-z0-9]/.test(clean)) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, a digit, and a special character.'
    };
  }
  return { valid: true };
}

export function saveAdminBootstrapCredentials({ email, password }) {
  const secretDir = getOutsideSecretsDir() || getTempStateDir();
  const targetFile = path.join(secretDir, 'admin-credentials.json');
  let existing = {};
  try {
    if (fs.existsSync(targetFile)) {
      const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      if (parsed && typeof parsed === 'object') existing = parsed;
    }
  } catch {}

  const signingSecret = existing.sessionSigningSecret && String(existing.sessionSigningSecret).length >= 32
    ? String(existing.sessionSigningSecret)
    : getSessionSecret();

  const passwordHash = hashPasswordPbkdf2(password);
  const next = {
    ...existing,
    version: 1,
    algorithm: 'pbkdf2-sha256',
    email: String(email).toLowerCase().trim(),
    passwordHash,
    sessionSigningSecret: signingSecret,
    updatedAt: new Date().toISOString()
  };

  atomicWriteFileSync(targetFile, JSON.stringify(next, null, 2));
  try { fs.chmodSync(targetFile, 0o600); } catch {}
  cachedSessionSecret = signingSecret;
  return { savedTo: targetFile };
}

export function verifyAdminBackupCode(creds, totpCode) {
  const normalized = String(totpCode || '').trim().toUpperCase();
  if (!normalized) return false;

  if (Array.isArray(creds?.backupCodes)) {
    for (const bc of creds.backupCodes) {
      if (typeof bc === 'string') {
        const a = Buffer.from(bc.trim().toUpperCase(), 'utf8');
        const b = Buffer.from(normalized, 'utf8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      }
    }
  }

  const pepper = String(creds?.backupPepper || '');
  const hashes = creds?.backupCodeHashes;
  if (pepper && Array.isArray(hashes) && hashes.length > 0) {
    const digest = crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
    const a = Buffer.from(digest, 'utf8');
    for (const expectedHex of hashes) {
      if (typeof expectedHex === 'string') {
        const b = Buffer.from(expectedHex.trim().toLowerCase(), 'utf8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      }
    }
  }

  return false;
}

function getRateLimitFile(bucketKey) {
  const hash = crypto.createHash('md5').update(String(bucketKey)).digest('hex');
  return path.join(getTempStateDir(), `ratelimit_${hash}.json`);
}

export function checkRateLimit(bucketKey) {
  const file = getRateLimitFile(bucketKey);
  const now = Date.now();
  try {
    if (!fs.existsSync(file)) return { allowed: true, remainingSeconds: 0 };
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Number(data?.lockoutUntil || 0) > now) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil((Number(data.lockoutUntil) - now) / 1000)
      };
    }
    if (Number(data?.lastAttempt || 0) < now - RATE_LIMIT_WINDOW_MS) {
      try { fs.unlinkSync(file); } catch {}
    }
  } catch {}
  return { allowed: true, remainingSeconds: 0 };
}

export function recordRateLimitFailure(bucketKey) {
  const file = getRateLimitFile(bucketKey);
  const now = Date.now();
  let data = { attempts: 0, lockoutUntil: 0, lastAttempt: now };
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && Number(parsed.lastAttempt || 0) >= now - RATE_LIMIT_WINDOW_MS) {
        data = parsed;
      }
    }
  } catch {}
  data.attempts = Number(data.attempts || 0) + 1;
  data.lastAttempt = now;
  if (data.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    data.lockoutUntil = now + RATE_LIMIT_WINDOW_MS;
  }
  try {
    fs.writeFileSync(file, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  } catch {}
  return {
    locked: Number(data.lockoutUntil || 0) > now,
    remainingSeconds: Math.max(0, Math.ceil((Number(data.lockoutUntil || 0) - now) / 1000))
  };
}

export function clearRateLimit(bucketKey) {
  try {
    const file = getRateLimitFile(bucketKey);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

function normalizeHostname(raw) {
  const first = String(raw || '').split(',')[0].trim().toLowerCase();
  if (!first) return '';
  if (first.startsWith('[')) {
    const end = first.indexOf(']');
    return end !== -1 ? first.slice(0, end + 1) : first;
  }
  return first.replace(/:\d+$/, '');
}

function isTrustedProxyAddress(addr) {
  const ip = String(addr || '').trim().toLowerCase();
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(clean);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

const LIVE_PRODUCTION_HOST_RE = /^(?:www\.)?vidhyaajewellerystudio\.com$/i;

export function isLiveProductionRequest(req) {
  const directHost = normalizeHostname(req?.headers?.host || '');
  if (LIVE_PRODUCTION_HOST_RE.test(directHost)) {
    return true;
  }

  const remoteAddr = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
  const canTrustForwarded =
    isTrustedProxyAddress(remoteAddr) ||
    !directHost ||
    directHost === 'localhost' ||
    directHost === '127.0.0.1';

  if (canTrustForwarded) {
    const fwdHost = normalizeHostname(req?.headers?.['x-forwarded-host'] || '');
    if (LIVE_PRODUCTION_HOST_RE.test(fwdHost)) {
      return true;
    }
  }

  return false;
}

export function withResourceLock(name, asyncFn) {
  const prev = lockChains.get(name) || Promise.resolve();
  const next = prev.then(
    () => asyncFn(),
    () => asyncFn()
  );
  lockChains.set(
    name,
    next.catch(() => {})
  );
  return next;
}

export function atomicWriteFileSync(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    fs.writeFileSync(targetPath, content, 'utf8');
  }
}
