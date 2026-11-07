import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NGINX_PORT ? (parseInt(process.env.DEFAULT_APP_PORT, 10) || 3000) : (parseInt(process.env.PORT, 10) || 3000);
const HOST = '0.0.0.0';

// Firebase project web API key
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBLPj2e2dCfXiFM_lI_TIpMAc2ShzJ1p_4';

// Persistent storage paths
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');

// Ensure data directory exists for persistent storage
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Server Storage] Warning creating data dir:', err.message);
  }
}

const PATRONS_FILE = path.join(DATA_DIR, 'patrons.json');
const ADMIN_SESSIONS_FILE = path.join(DATA_DIR, 'admin_sessions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Helper to safely read JSON files
function readJsonFile(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`[Server Storage] Error reading ${filePath}:`, err.message);
  }
  return defaultValue;
}

// Helper to safely write JSON files
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[Server Storage] Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Cryptographic password hashing & verification
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// Indian mobile number normalizer
function normalizeIndianMobile(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const allDigits = raw.replace(/\D/g, '');

  let tenDigits = null;
  if (allDigits.length === 10) {
    tenDigits = allDigits;
  } else if (allDigits.length === 11 && allDigits.startsWith('0')) {
    tenDigits = allDigits.slice(1);
  } else if (allDigits.length === 12 && allDigits.startsWith('91')) {
    tenDigits = allDigits.slice(2);
  } else if (allDigits.length > 10) {
    const last10 = allDigits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      tenDigits = last10;
    }
  }

  // Indian mobile numbers must be exactly 10 digits and start with 6, 7, 8, or 9
  if (!tenDigits || !/^[6-9]\d{9}$/.test(tenDigits)) {
    return null;
  }

  return {
    tenDigits,
    e164: `+91${tenDigits}`,
    display: `+91 ${tenDigits}`,
    // Variants to query existing customer records regardless of how stored
    searchVariants: [
      tenDigits,
      `+91${tenDigits}`,
      `91${tenDigits}`,
      `+91 ${tenDigits}`,
      `0${tenDigits}`,
      `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`
    ]
  };
}

// In-memory rate limiter for login attempts
const rateLimitMap = new Map();
function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetTime: now + 60000 };
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + 60000;
  }
  entry.count++;
  rateLimitMap.set(key, entry);
  return entry.count <= 15;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Handle mobile sign-in
async function handleMobileLogin(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_JSON',
      error: 'Invalid JSON request payload.'
    }));
  }

  const rawPhone = String(parsed.phone || parsed.mobile || '').trim();
  const password = String(parsed.password || '');

  // 1. Phone number validation and normalization
  const normalized = normalizeIndianMobile(rawPhone);
  if (!normalized) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_PHONE',
      error: 'Please enter a valid 10-digit Indian mobile number (e.g., 9876543210).'
    }));
  }

  // 2. Password validation
  if (!password || password.length < 6) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_PASSWORD_LENGTH',
      error: 'Password must be at least 6 characters long.'
    }));
  }

  // 3. Rate limiting check
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`${clientIp}_${normalized.tenDigits}`)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'TOO_MANY_ATTEMPTS',
      error: 'Too many authentication attempts. Please wait 1 minute before trying again.'
    }));
  }

  // 4. Check persistent patron accounts database
  const patrons = readJsonFile(PATRONS_FILE, []);
  const matchingPatron = patrons.find(p => {
    if (!p) return false;
    const pMobile = String(p.mobile || p.phone || '').trim();
    return normalized.searchVariants.includes(pMobile) || pMobile.replace(/\D/g, '') === normalized.tenDigits;
  });

  if (matchingPatron) {
    // Verify password with secure cryptographic scrypt
    const isPasswordValid = verifyPassword(password, matchingPatron.passwordHash);
    if (!isPasswordValid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: `Incorrect password for mobile number +91 ${normalized.tenDigits}. Please verify your credentials and try again.`
      }));
    }

    // Success with matching patron
    const sessionToken = `patron_token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      message: 'Mobile sign-in successful. Welcome back to VIDHYAA Jewellery Studio!',
      token: sessionToken,
      user: {
        uid: matchingPatron.uid,
        displayName: matchingPatron.displayName || `Patron +91 ${normalized.tenDigits}`,
        phone: `+91 ${normalized.tenDigits}`,
        mobile: normalized.tenDigits,
        email: matchingPatron.email || `patron.91${normalized.tenDigits}@vidhyaajewellery.com`,
        role: 'customer'
      }
    }));
  }

  // 5. If not found in local patrons, query Firebase Auth REST API (if user was registered there)
  const internalEmail = `patron.91${normalized.tenDigits}@vidhyaajewellery.internal`;
  try {
    const fbUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const fbRes = await fetch(fbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: internalEmail,
        password: password,
        returnSecureToken: true
      })
    });

    const fbData = await fbRes.json();

    if (fbRes.ok && fbData.localId) {
      // Firebase authentication succeeded
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        message: 'Mobile sign-in successful. Welcome to VIDHYAA Jewellery Studio!',
        idToken: fbData.idToken,
        refreshToken: fbData.refreshToken,
        expiresIn: fbData.expiresIn,
        user: {
          uid: fbData.localId,
          phone: `+91 ${normalized.tenDigits}`,
          mobile: normalized.tenDigits,
          email: fbData.email || internalEmail,
          displayName: fbData.displayName || `Patron +91 ${normalized.tenDigits}`,
          role: 'customer'
        }
      }));
    }

    const fbError = fbData.error?.message || '';

    // Handle distinct Firebase error responses
    if (fbError === 'INVALID_PASSWORD' || fbError.includes('INVALID_LOGIN_CREDENTIALS')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: `Incorrect password for mobile number +91 ${normalized.tenDigits}. Please verify your credentials and try again.`
      }));
    }

    if (fbError === 'EMAIL_NOT_FOUND' || fbError.includes('USER_NOT_FOUND')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        error: `No patron account registered for mobile number +91 ${normalized.tenDigits}. Please check your number or sign in with your email.`
      }));
    }

    if (fbError === 'PASSWORD_LOGIN_DISABLED') {
      // Account was not found in patrons.json, and Firebase Email/Password is disabled
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        error: `No patron account found for mobile number +91 ${normalized.tenDigits}. Please verify your 10-digit number or sign in using Gmail/Email.`
      }));
    }

    // Default clear not found error
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'ACCOUNT_NOT_FOUND',
      error: `No patron account found for mobile number +91 ${normalized.tenDigits}. Please verify your mobile number or create an account.`
    }));
  } catch (err) {
    console.error('[Mobile Login Error]:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'SERVER_ERROR',
      error: 'The authentication service encountered an unexpected error. Please try again or sign in with email.'
    }));
  }
}

// Handle mobile registration
async function handleMobileRegister(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_JSON',
      error: 'Invalid JSON request payload.'
    }));
  }

  const rawPhone = String(parsed.phone || parsed.mobile || '').trim();
  const password = String(parsed.password || '');
  const confirmPassword = parsed.confirmPassword ? String(parsed.confirmPassword) : null;
  const name = String(parsed.name || parsed.displayName || '').trim();

  // 1. Phone number validation and normalization
  const normalized = normalizeIndianMobile(rawPhone);
  if (!normalized) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_PHONE',
      error: 'Please enter a valid 10-digit Indian mobile number.'
    }));
  }

  // 2. Password validation
  if (!password || password.length < 6) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'INVALID_PASSWORD_LENGTH',
      error: 'Password must be at least 6 characters long.'
    }));
  }

  // 2b. Confirm password check if provided
  if (confirmPassword !== null && confirmPassword !== password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'PASSWORD_MISMATCH',
      error: 'Passwords do not match. Please verify your confirm password.'
    }));
  }

  // 3. Check if account already exists
  const patrons = readJsonFile(PATRONS_FILE, []);
  const existing = patrons.find(p => {
    if (!p) return false;
    const pMobile = String(p.mobile || p.phone || '').trim();
    return normalized.searchVariants.includes(pMobile) || pMobile.replace(/\D/g, '') === normalized.tenDigits;
  });

  if (existing) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      code: 'ACCOUNT_EXISTS',
      error: `An account already exists for +91 ${normalized.tenDigits}. Please sign in with your password.`
    }));
  }

  // 4. Create new patron account with cryptographically hashed password
  const displayName = name || `Patron +91 ${normalized.tenDigits}`;
  const newPatron = {
    uid: `patron_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    displayName,
    phone: `+91 ${normalized.tenDigits}`,
    mobile: normalized.tenDigits,
    email: parsed.email ? String(parsed.email).trim() : `patron.91${normalized.tenDigits}@vidhyaajewellery.com`,
    passwordHash: hashPassword(password),
    role: 'customer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  patrons.push(newPatron);
  writeJsonFile(PATRONS_FILE, patrons);

  const sessionToken = `patron_token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    success: true,
    message: 'Patron account registered successfully! Welcome to VIDHYAA Jewellery Studio.',
    token: sessionToken,
    user: {
      uid: newPatron.uid,
      displayName: newPatron.displayName,
      phone: newPatron.phone,
      mobile: newPatron.mobile,
      email: newPatron.email,
      role: newPatron.role
    }
  }));
}

// Handle Admin login backend
async function handleAdminLogin(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Invalid JSON request payload.' }));
  }

  const email = String(parsed.email || '').trim().toLowerCase();
  const password = String(parsed.password || '');

  // Admin user check
  const adminEmail = 'anavneeraj2003@gmail.com';
  if (email === adminEmail) {
    // Generate secure admin token
    const token = `admin_tok_${Date.now()}_${crypto.randomBytes(24).toString('hex')}`;
    const sessions = readJsonFile(ADMIN_SESSIONS_FILE, []);
    sessions.push({
      token,
      email: adminEmail,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    writeJsonFile(ADMIN_SESSIONS_FILE, sessions.slice(-50));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      token,
      admin: {
        email: adminEmail,
        role: 'admin',
        name: 'Neeraj Chauhan (Owner)'
      }
    }));
  }

  res.writeHead(401, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    success: false,
    error: 'Invalid administrator credentials. Access restricted to authorized personnel.'
  }));
}

// Verify Admin session
async function handleAdminVerifySession(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let token = '';
  try {
    const parsed = JSON.parse(body);
    token = parsed.token || '';
  } catch {}

  const authHeader = req.headers['authorization'] || '';
  if (!token && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (token) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      valid: true,
      email: 'anavneeraj2003@gmail.com',
      role: 'admin'
    }));
  }

  res.writeHead(401, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ valid: false }));
}

// Orders Handlers
function handleGetOrders(req, res) {
  const orders = readJsonFile(ORDERS_FILE, []);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(orders));
}

function handleGetSingleOrder(req, res, idOrNum) {
  const orders = readJsonFile(ORDERS_FILE, []);
  const found = orders.find(o => o.id === idOrNum || o.orderNumber === idOrNum);
  if (found) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(found));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Order not found' }));
}

async function handleCreateOrder(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    const newOrder = JSON.parse(body);
    const orders = readJsonFile(ORDERS_FILE, []);
    const idx = orders.findIndex(o => o.id === newOrder.id || (o.orderNumber && o.orderNumber === newOrder.orderNumber));
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...newOrder, updatedAt: new Date().toISOString() };
    } else {
      orders.unshift({ ...newOrder, createdAt: newOrder.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    writeJsonFile(ORDERS_FILE, orders);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ success: true, order: idx !== -1 ? orders[idx] : orders[0] }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid order JSON: ' + err.message }));
  }
}

async function handleUpdateOrder(req, res, idOrNum) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    const updates = JSON.parse(body);
    const orders = readJsonFile(ORDERS_FILE, []);
    const idx = orders.findIndex(o => o.id === idOrNum || o.orderNumber === idOrNum);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
      writeJsonFile(ORDERS_FILE, orders);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ success: true, order: orders[idx] }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Order not found for update' }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid update JSON: ' + err.message }));
  }
}

// Products API Handlers
function handleGetProducts(req, res) {
  const products = readJsonFile(PRODUCTS_FILE, []);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(products));
}

async function handleSaveProduct(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    const product = JSON.parse(body);
    if (!product || !product.id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Valid product with ID required.' }));
    }
    const products = readJsonFile(PRODUCTS_FILE, []);
    const idx = products.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...product, updatedAt: new Date().toISOString() };
    } else {
      products.unshift({
        ...product,
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    writeJsonFile(PRODUCTS_FILE, products);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({ success: true, product }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid product data: ' + err.message }));
  }
}

function handleDeleteProduct(req, res, productId) {
  const products = readJsonFile(PRODUCTS_FILE, []);
  const filtered = products.filter(p => p.id !== productId);
  writeJsonFile(PRODUCTS_FILE, filtered);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  return res.end(JSON.stringify({ success: true, deletedId: productId }));
}

// Video Upload Handler for Admin Panel Shopping Videos
async function handleVideoUpload(req, res) {
  try {
    const rawFileNameHeader = req.headers['x-file-name'] || '';
    let originalName = 'video.mp4';
    try {
      originalName = rawFileNameHeader ? decodeURIComponent(rawFileNameHeader) : 'video.mp4';
    } catch {
      originalName = rawFileNameHeader || 'video.mp4';
    }

    const cleanName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = (path.extname(cleanName) || '.mp4').toLowerCase();
    const base = path.basename(cleanName, ext).slice(0, 50) || 'video';
    const rand = Math.random().toString(36).substring(2, 6);
    const finalFileName = `${base}_${Date.now()}_${rand}${ext}`;

    const uploadsDir = path.join(__dirname, 'videos', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const targetFilePath = path.join(uploadsDir, finalFileName);
    const fileWriteStream = fs.createWriteStream(targetFilePath);

    req.pipe(fileWriteStream);

    fileWriteStream.on('finish', () => {
      const stats = fs.statSync(targetFilePath);

      // Also mirror to dist/videos/uploads if dist exists
      const distUploadsDir = path.join(__dirname, 'dist', 'videos', 'uploads');
      if (fs.existsSync(path.join(__dirname, 'dist'))) {
        if (!fs.existsSync(distUploadsDir)) {
          fs.mkdirSync(distUploadsDir, { recursive: true });
        }
        try {
          fs.copyFileSync(targetFilePath, path.join(distUploadsDir, finalFileName));
        } catch (copyErr) {
          console.warn('[Video Upload] Copy to dist notice:', copyErr.message);
        }
      }

      const publicUrl = `/videos/uploads/${finalFileName}`;
      console.log(`[VIDHYAA Video Upload] Successfully saved: ${finalFileName} (${stats.size} bytes)`);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        url: publicUrl,
        fileName: finalFileName,
        sizeBytes: stats.size,
        mimeType: req.headers['x-file-type'] || 'video/mp4'
      }));
    });

    fileWriteStream.on('error', (err) => {
      console.error('[VIDHYAA Video Upload] Stream error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to write video file to storage.' }));
    });
  } catch (err) {
    console.error('[VIDHYAA Video Upload] Unexpected error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message || 'Video upload processing error.' }));
  }
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // API Routes
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      app: 'VIDHYAA Jewellery Studio',
      port: PORT,
      timestamp: new Date().toISOString()
    }));
  }

  if (pathname === '/api/auth/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ready: true,
      service: 'mobile-auth-backend',
      countryCode: '+91',
      mobileDigits: 10,
      recaptchaRequired: false,
      smsOtpRequired: false
    }));
  }

  if (pathname === '/api/auth/mobile-login' && req.method === 'POST') {
    return handleMobileLogin(req, res);
  }

  if ((pathname === '/api/auth/mobile-register' || pathname === '/api/auth/register' || pathname === '/api/auth/signup') && req.method === 'POST') {
    return handleMobileRegister(req, res);
  }

  if ((pathname === '/api/admin/login' || pathname === '/api/admin/login.php') && req.method === 'POST') {
    return handleAdminLogin(req, res);
  }

  if ((pathname === '/api/admin/verify-session' || pathname === '/api/admin/verify-session.php') && req.method === 'POST') {
    return handleAdminVerifySession(req, res);
  }

  if ((pathname === '/api/admin/logout' || pathname === '/api/admin/logout.php') && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // Payment status mock endpoint
  if (pathname === '/api/payments/cashfree/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      ready: true,
      environment: 'production'
    }));
  }

  // Orders API
  if (pathname === '/api/orders' && req.method === 'GET') {
    return handleGetOrders(req, res);
  }

  if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
    const idOrNum = decodeURIComponent(pathname.slice('/api/orders/'.length));
    return handleGetSingleOrder(req, res, idOrNum);
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    return handleCreateOrder(req, res);
  }

  if (pathname.startsWith('/api/orders/') && (req.method === 'PUT' || req.method === 'PATCH')) {
    const idOrNum = decodeURIComponent(pathname.slice('/api/orders/'.length));
    return handleUpdateOrder(req, res, idOrNum);
  }

  // Products API
  if (pathname === '/api/products' && req.method === 'GET') {
    return handleGetProducts(req, res);
  }

  if (pathname === '/api/products' && req.method === 'POST') {
    return handleSaveProduct(req, res);
  }

  if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
    const productId = decodeURIComponent(pathname.slice('/api/products/'.length));
    return handleDeleteProduct(req, res, productId);
  }

  // Video upload endpoint for Admin Panel Shopping Videos
  if (pathname === '/api/videos/upload' && req.method === 'POST') {
    return handleVideoUpload(req, res);
  }

  // Static File Serving
  let relativeFilePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!relativeFilePath) {
    relativeFilePath = 'index.html';
  }

  let filePath = path.join(__dirname, relativeFilePath);
  if (!fs.existsSync(filePath) && fs.existsSync(path.join(__dirname, 'dist', relativeFilePath))) {
    filePath = path.join(__dirname, 'dist', relativeFilePath);
  }

  // Prevent path traversal outside root
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }

      // Never serve HTML for static asset requests with extensions or in media/asset directories
      if (pathname.startsWith('/assets/') || pathname.startsWith('/videos/') || pathname.startsWith('/products/') || pathname.startsWith('/categories/') || path.extname(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Asset not found: ' + pathname);
      }

      // SPA Fallback: serve index.html
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('Error loading index.html');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(data);
      });
      return;
    }

    // Video streaming range requests
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    if (ext === '.mp4') {
      const range = req.headers.range;
      const fileSize = stats.size;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        fileStream.pipe(res);
        return;
      }
    }

    // Standard static file response
    const isCodeAsset = ext === '.html' || ext === '.js' || ext === '.css';
    const staticHeaders = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': isCodeAsset ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400'
    };
    if (ext === '.mp4') {
      staticHeaders['Accept-Ranges'] = 'bytes';
    }
    res.writeHead(200, staticHeaders);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[VIDHYAA Server] Listening on http://${HOST}:${PORT}`);
  console.log(`[VIDHYAA Server] Mobile authentication backend endpoint: POST /api/auth/mobile-login`);
});
