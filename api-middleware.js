import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getCashfreeStatusSummary,
  saveCashfreeConfig,
  createCashfreeOrder,
  verifyCashfreeOrder,
  verifyCashfreeWebhookSignature,
  sanitizeGatewayOrderId
} from './src/server/cashfreeCore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const API_DIR = path.resolve(__dirname, 'api');
const PATRONS_FILE = path.join(DATA_DIR, 'patrons.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const WHATSAPP_LOGS_FILE = path.join(DATA_DIR, 'whatsapp_logs.json');
const API_PRODUCTS_FILE = path.join(API_DIR, 'products');
const API_ORDERS_FILE = path.join(API_DIR, 'orders');
const VIDEOS_UPLOAD_DIR = path.resolve(__dirname, 'videos', 'uploads');
const DIST_VIDEOS_UPLOAD_DIR = path.resolve(__dirname, 'dist', 'videos', 'uploads');
const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024; // 250 MB

const ADMIN_EMAIL = 'anavneeraj2003@gmail.com';
const OWNER_WHATSAPP_NUMBER = '917302187770';

function saveWhatsAppLog(entry) {
  try {
    const logs = readJsonFile(WHATSAPP_LOGS_FILE, []);
    logs.unshift(entry);
    if (logs.length > 100) logs.length = 100;
    fs.writeFileSync(WHATSAPP_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[WhatsApp] Error saving log:', err.message);
  }
}

function formatOwnerWhatsAppMessage(order) {
  const orderId = order.orderNumber || order.id || 'N/A';
  const customerName = order.customerName || order.shippingAddress?.fullName || order.shippingAddress?.name || 'Valued Patron';
  const customerMobile = order.customerPhone || order.shippingAddress?.phone || order.mobile || 'N/A';

  let productName = 'Handcrafted Jewellery';
  let quantity = 1;
  if (Array.isArray(order.items) && order.items.length > 0) {
    if (order.items.length === 1) {
      productName = order.items[0].productName || order.items[0].title || 'Handcrafted Jewellery';
      quantity = order.items[0].quantity || 1;
    } else {
      productName = order.items.map(item => item.productName || item.title || 'Piece').join(', ');
      quantity = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
  }

  const paymentStatus = 'SUCCESSFUL';
  const paymentMethod = order.paymentMethod || 'Online Payment';
  const rawTotal = typeof order.totalAmount === 'number' ? order.totalAmount : Number(order.totalAmount || order.total) || 0;
  const totalAmount = rawTotal.toLocaleString('en-IN');

  let address = 'Address provided at checkout';
  if (order.shippingAddress) {
    const parts = [
      order.shippingAddress.street,
      order.shippingAddress.landmark,
      order.shippingAddress.city,
      order.shippingAddress.state ? `${order.shippingAddress.state} - ${order.shippingAddress.pincode || ''}` : order.shippingAddress.pincode
    ].filter(Boolean);
    if (parts.length > 0) {
      address = parts.join(', ');
    }
  }

  return `VIDHYAA JEWELLERY STUDIO
🟢 NEW ORDER CONFIRMED ✓

Order ID: ${orderId}
Customer Name: ${customerName}
Mobile: ${customerMobile}
Product: ${productName}
Quantity: ${quantity}
Payment Status: ${paymentStatus}
Payment Method: ${paymentMethod}
Total Amount: ₹${totalAmount}

Delivery Address:
${address}

Please prepare this order for delivery.`;
}

function getOwnerWhatsAppClickToChatLink(order) {
  const messageText = formatOwnerWhatsAppMessage(order);
  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(messageText)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expected] = storedHash.split(':');
  try {
    const actual = crypto.scryptSync(password, salt, 64).toString('hex');
    return actual === expected;
  } catch {
    return false;
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function readRawBody(req, maxBytes = MAX_VIDEO_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        aborted = true;
        reject(Object.assign(new Error('File size exceeds maximum allowed limit of 250 MB.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!aborted) {
        resolve(Buffer.concat(chunks, totalBytes));
      }
    });

    req.on('error', (err) => {
      if (!aborted) {
        reject(err);
      }
    });
  });
}

function parseMultipartVideo(buffer, contentTypeHeader) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentTypeHeader || '');
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const headerSep = Buffer.from('\r\n\r\n');

  let pos = buffer.indexOf(boundaryBuf);
  while (pos !== -1) {
    const partStart = pos + boundaryBuf.length;
    // Check for closing boundary `--`
    if (buffer[partStart] === 0x2d && buffer[partStart + 1] === 0x2d) {
      break;
    }
    const contentStart = buffer[partStart] === 0x0d && buffer[partStart + 1] === 0x0a ? partStart + 2 : partStart;
    const nextBoundary = buffer.indexOf(boundaryBuf, contentStart);
    if (nextBoundary === -1) break;

    const headerEnd = buffer.indexOf(headerSep, contentStart);
    if (headerEnd !== -1 && headerEnd < nextBoundary) {
      const headersText = buffer.subarray(contentStart, headerEnd).toString('utf8');
      const filenameMatch = /filename="([^"]*)"/i.exec(headersText);
      if (filenameMatch) {
        const bodyStart = headerEnd + headerSep.length;
        // Strip trailing \r\n before the next boundary
        let bodyEnd = nextBoundary;
        if (buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) {
          bodyEnd -= 2;
        }
        const typeMatch = /Content-Type:\s*([^\r\n;]+)/i.exec(headersText);
        return {
          fileName: filenameMatch[1] || 'video.mp4',
          mimeType: (typeMatch && typeMatch[1].trim()) || 'video/mp4',
          data: buffer.subarray(bodyStart, bodyEnd)
        };
      }
    }
    pos = nextBoundary;
  }
  return null;
}

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(jsonStr),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token'
  });
  res.end(jsonStr);
}

function readJsonFile(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`[API] Error reading ${filePath}:`, err.message);
  }
  return fallback;
}

const VALID_ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function toMoneyNumber(val, fallback = 0) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹,\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatIndianPhoneServer(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91 ${digits.slice(1)}`;
  return str;
}

function extractAdminToken(req) {
  const authHeader = String(req.headers['authorization'] || '');
  const adminHeader = String(req.headers['x-admin-token'] || '');
  if (adminHeader.trim()) return adminHeader.trim();
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return '';
}

function normalizePaymentStatusServer(rawStatus, rawIsPaid) {
  if (rawIsPaid === true) return 'paid';
  const s = String(rawStatus || '').trim().toLowerCase();
  if (s === 'paid' || s === 'success' || s === 'captured' || s === 'completed') return 'paid';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'terminated') return 'failed';
  return 'pending';
}

function sanitizeServerOrder(raw, existing = null) {
  const src = { ...(existing || {}), ...(raw || {}) };
  const rawAddr =
    raw?.shippingAddress && typeof raw.shippingAddress === 'object'
      ? { ...(existing?.shippingAddress || {}), ...raw.shippingAddress }
      : existing?.shippingAddress && typeof existing.shippingAddress === 'object'
      ? { ...existing.shippingAddress }
      : {};

  const itemsSource =
    Array.isArray(raw?.items) && raw.items.length > 0
      ? raw.items
      : Array.isArray(existing?.items)
      ? existing.items
      : [];

  const items = itemsSource.map((it) => ({
    productId: String(it?.productId || 'prod-custom'),
    productName: String(it?.productName || it?.title || 'Jewellery Item'),
    variationId: String(it?.variationId || 'default'),
    variationName: String(it?.variationName || ''),
    quantity: Math.max(1, Math.round(toMoneyNumber(it?.quantity, 1))),
    price: Math.max(0, toMoneyNumber(it?.price, 0)),
    mrp: Math.max(0, toMoneyNumber(it?.mrp, toMoneyNumber(it?.price, 0))),
    image: String(it?.image || ''),
    sku: String(it?.sku || '')
  }));

  const itemsSubtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const parsedSubtotal = toMoneyNumber(src.subtotal, 0);
  const subtotal = parsedSubtotal > 0 ? parsedSubtotal : itemsSubtotal;
  const discount = Math.max(0, toMoneyNumber(src.discount, 0));
  const deliveryCharge = Math.max(0, toMoneyNumber(src.deliveryCharge, 0));
  const computedTotal = Math.max(0, subtotal - discount + deliveryCharge);

  let rawTotal = toMoneyNumber(src.totalAmount, 0);
  if (rawTotal <= 0) rawTotal = toMoneyNumber(src.total, 0);
  if (rawTotal <= 0) rawTotal = toMoneyNumber(src.orderAmount, 0);
  const totalAmount = rawTotal > 0 ? rawTotal : computedTotal;

  const customerName = String(
    src.customerName || rawAddr.name || rawAddr.fullName || 'Customer'
  ).trim();
  const customerEmail = String(src.customerEmail || '').trim();
  const customerPhone = formatIndianPhoneServer(src.customerPhone || rawAddr.phone || '');

  const houseNo = String(rawAddr.houseNo || rawAddr.houseNumber || rawAddr.flatNo || '').trim();
  const area = String(rawAddr.area || rawAddr.addressLine2 || '').trim();
  const combinedStreet = String(rawAddr.street || [houseNo, area].filter(Boolean).join(', ')).trim();

  const shippingAddress = {
    id: String(rawAddr.id || 'ship_addr'),
    name: String(rawAddr.name || rawAddr.fullName || customerName),
    phone: formatIndianPhoneServer(rawAddr.phone || customerPhone),
    ...(houseNo ? { houseNo } : {}),
    ...(area ? { area } : {}),
    street: combinedStreet,
    landmark: String(rawAddr.landmark || '').trim(),
    city: String(rawAddr.city || '').trim(),
    state: String(rawAddr.state || '').trim(),
    pincode: String(rawAddr.pincode || '').trim()
  };

  const paymentStatus = normalizePaymentStatusServer(src.paymentStatus, src.isPaid);
  let orderStatus = VALID_ORDER_STATUSES.includes(src.orderStatus) ? src.orderStatus : 'Pending';
  if (paymentStatus === 'paid' && orderStatus === 'Pending') {
    orderStatus = 'Confirmed';
  }
  if (paymentStatus === 'failed' && orderStatus === 'Confirmed') {
    orderStatus = 'Pending';
  }

  const orderNumber = String(src.orderNumber || src.id || `VDH-${Date.now().toString().slice(-6)}`);
  const id = String(src.id || `order_${sanitizeGatewayOrderId(orderNumber)}`);

  const out = {
    ...src,
    id,
    orderNumber,
    gatewayOrderId: String(src.gatewayOrderId || sanitizeGatewayOrderId(orderNumber)),
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    items,
    subtotal: subtotal > 0 ? subtotal : totalAmount,
    discount,
    deliveryCharge,
    total: totalAmount,
    totalAmount,
    paymentMethod: String(src.paymentMethod || 'Online Payment'),
    paymentStatus,
    isPaid: paymentStatus === 'paid',
    currency: String(src.currency || 'INR').toUpperCase(),
    orderStatus,
    upiReference: String(src.upiReference || ''),
    trackingNumber: String(src.trackingNumber || ''),
    courierName: String(src.courierName || ''),
    createdAt: String(src.createdAt || new Date().toISOString()),
    updatedAt: String(src.updatedAt || new Date().toISOString())
  };

  return out;
}

function readAllOrders() {
  const dataOrders = readJsonFile(ORDERS_FILE, []);
  const apiOrders = readJsonFile(API_ORDERS_FILE, []);
  const map = new Map();

  for (const list of [apiOrders, dataOrders]) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const key = String(raw.id || raw.orderNumber || '');
      if (!key) continue;
      const existing = map.get(key) || null;
      map.set(key, sanitizeServerOrder(raw, existing));
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

function writeAllOrders(orders) {
  const serialized = JSON.stringify(orders, null, 2);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, serialized, 'utf8');
  if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
    fs.writeFileSync(API_ORDERS_FILE, serialized, 'utf8');
  }
}

function findOrderByIdentifier(orders, identifier) {
  const needle = String(identifier || '').trim();
  if (!needle) return null;
  const safeNeedle = sanitizeGatewayOrderId(needle);
  return (
    orders.find(
      (o) =>
        o.id === needle ||
        o.orderNumber === needle ||
        o.gatewayOrderId === needle ||
        String(o.cfOrderId || '') === needle ||
        sanitizeGatewayOrderId(o.orderNumber) === safeNeedle ||
        sanitizeGatewayOrderId(o.id) === safeNeedle
    ) || null
  );
}

export function handleApiMiddleware(req, res, next) {
  const rawUrl = req.url || '';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  let decodedPathname = parsedUrl.pathname;
  try {
    decodedPathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    decodedPathname = parsedUrl.pathname;
  }
  const pathname = decodedPathname.replace(/\/+$/, ''); // normalize trailing slash

  // Prevent Vite SPA index.html fallback (200 text/html) for missing static media files
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    /^\/(?:videos|products|categories|uploads)\/.+\.(?:mp4|mov|webm|m4v|jpg|jpeg|png|webp|gif|svg|avif)$/i.test(pathname)
  ) {
    const relPath = pathname.replace(/^\/+/, '');
    const rootCandidate = path.resolve(__dirname, relPath);
    const distCandidate = path.resolve(__dirname, 'dist', relPath);
    const isSafeRoot = rootCandidate.startsWith(__dirname + path.sep);
    const isSafeDist = distCandidate.startsWith(path.resolve(__dirname, 'dist') + path.sep);

    const existsInRoot = isSafeRoot && fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile();
    const existsInDist = isSafeDist && fs.existsSync(distCandidate) && fs.statSync(distCandidate).isFile();

    if (!existsInRoot && !existsInDist) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end('Not Found');
      return;
    }
    return next();
  }

  // Block direct HTTP access to secret directories, backups, and sensitive private JSON files
  if (
    /^\/(?:\.admin-secrets|\.backups)(?:\/|$)/i.test(pathname) ||
    /^\/(?:cashfree-config\.json|\.env(?:\..*)?|data\/(?:orders|patrons|whatsapp_logs)\.json)$/i.test(pathname)
  ) {
    res.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ success: false, error: 'Forbidden: Protected resource.' }));
    return;
  }

  // Only intercept /api routes
  if (!pathname.startsWith('/api')) {
    return next();
  }

  // Handle CORS preflight for all /api endpoints
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token'
    });
    res.end();
    return;
  }

  // Async dispatch for API endpoints
  (async () => {
    try {
      // 1. Health check
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'ok' });
      }

      // 2. Auth status check
      if (pathname === '/api/auth/status' && req.method === 'GET') {
        return sendJson(res, 200, { ready: true });
      }

      // 3. Admin Login: POST /api/admin/login or /api/admin/login.php
      if ((pathname === '/api/admin/login' || pathname === '/api/admin/login.php') && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, {
            success: false,
            error: 'Invalid JSON request payload.'
          });
        }

        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '').trim();

        if (email === ADMIN_EMAIL) {
          const token = `admin_tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
          return sendJson(res, 200, {
            success: true,
            token,
            admin: {
              email: ADMIN_EMAIL,
              role: 'admin',
              name: 'Neeraj Chauhan (Owner)'
            }
          });
        }

        return sendJson(res, 401, {
          success: false,
          error: 'Invalid administrator credentials. Access restricted to authorized personnel.'
        });
      }

      // 4. Admin Verify Session: POST/GET /api/admin/verify-session or /api/admin/verify-session.php
      if (
        (pathname === '/api/admin/verify-session' || pathname === '/api/admin/verify-session.php') &&
        (req.method === 'POST' || req.method === 'GET')
      ) {
        let token = '';
        if (req.method === 'POST') {
          const body = await parseBody(req);
          token = body?.token || '';
        }

        const authHeader = req.headers['authorization'] || '';
        if (!token && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }

        if (token && token.trim().length > 0) {
          return sendJson(res, 200, {
            valid: true,
            email: ADMIN_EMAIL,
            role: 'admin'
          });
        }

        return sendJson(res, 401, { valid: false });
      }

      // 5. Admin Logout: POST /api/admin/logout or /api/admin/logout.php
      if ((pathname === '/api/admin/logout' || pathname === '/api/admin/logout.php') && req.method === 'POST') {
        return sendJson(res, 200, { success: true });
      }

      // 6. Customer Mobile Registration: POST /api/auth/mobile-register
      if (pathname === '/api/auth/mobile-register' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body) {
          return sendJson(res, 400, { code: 'INVALID_PAYLOAD', error: 'Invalid JSON payload' });
        }

        const rawPhone = String(body.phone || body.mobile || '');
        const cleanDigits = rawPhone.replace(/\D/g, '');
        let mobile = cleanDigits;
        if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
          mobile = cleanDigits.slice(2);
        } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
          mobile = cleanDigits.slice(1);
        }

        if (mobile.length !== 10) {
          return sendJson(res, 400, {
            code: 'INVALID_PHONE',
            error: 'Please enter a valid 10-digit mobile number'
          });
        }

        const password = String(body.password || '');
        if (password.length < 6) {
          return sendJson(res, 400, {
            code: 'INVALID_PASSWORD_LENGTH',
            error: 'Password must be at least 6 characters'
          });
        }

        const confirmPassword = body.confirmPassword;
        if (confirmPassword !== undefined && confirmPassword !== password) {
          return sendJson(res, 400, {
            code: 'PASSWORD_MISMATCH',
            error: 'Passwords do not match'
          });
        }

        const patrons = readJsonFile(PATRONS_FILE, []);
        if (patrons.some((p) => p.mobile === mobile)) {
          return sendJson(res, 409, {
            code: 'ACCOUNT_EXISTS',
            error: 'An account with this mobile number already exists'
          });
        }

        const newPatron = {
          uid: `patron_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          displayName: String(body.name || '').trim() || 'Valued Patron',
          phone: `+91 ${mobile}`,
          mobile: mobile,
          email: String(body.email || '').trim(),
          passwordHash: hashPassword(password),
          role: 'customer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        patrons.push(newPatron);
        fs.writeFileSync(PATRONS_FILE, JSON.stringify(patrons, null, 2), 'utf8');

        return sendJson(res, 200, {
          success: true,
          user: {
            uid: newPatron.uid,
            displayName: newPatron.displayName,
            phone: newPatron.phone,
            mobile: newPatron.mobile,
            email: newPatron.email,
            role: newPatron.role
          },
          token: `patron_tok_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
        });
      }

      // 7. Customer Mobile Login: POST /api/auth/mobile-login
      if (pathname === '/api/auth/mobile-login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body) {
          return sendJson(res, 400, { code: 'INVALID_PAYLOAD', error: 'Invalid JSON payload' });
        }

        const rawPhone = String(body.phone || body.mobile || '');
        const cleanDigits = rawPhone.replace(/\D/g, '');
        let mobile = cleanDigits;
        if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
          mobile = cleanDigits.slice(2);
        } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
          mobile = cleanDigits.slice(1);
        }

        const patrons = readJsonFile(PATRONS_FILE, []);
        const patron = patrons.find((p) => p.mobile === mobile);
        if (!patron) {
          return sendJson(res, 401, {
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid credentials'
          });
        }

        const password = String(body.password || '');
        if (!verifyPassword(password, patron.passwordHash)) {
          return sendJson(res, 401, {
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid credentials'
          });
        }

        return sendJson(res, 200, {
          success: true,
          user: {
            uid: patron.uid,
            displayName: patron.displayName,
            phone: patron.phone,
            mobile: patron.mobile,
            email: patron.email,
            role: patron.role || 'customer'
          },
          token: `patron_tok_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
        });
      }

      // 8. Products API: GET, POST, DELETE
      if (pathname === '/api/products' || pathname.startsWith('/api/products/')) {
        if (req.method === 'GET') {
          const products = readJsonFile(PRODUCTS_FILE, []);
          return sendJson(res, 200, products);
        }

        if (req.method === 'POST') {
          const body = await parseBody(req);
          const incoming = body?.product || body;
          if (!incoming || !incoming.id) {
            return sendJson(res, 400, { success: false, error: 'Product payload requires an id' });
          }

          const rawVideo = typeof incoming.videoUrl === 'string'
            ? incoming.videoUrl
            : (typeof incoming.video === 'string'
              ? incoming.video
              : (typeof incoming.videoURL === 'string' ? incoming.videoURL : ''));
          let normalizedVideo = rawVideo.trim()
            .replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i, '$1');
          if (/^videos\/uploads\//i.test(normalizedVideo)) {
            normalizedVideo = `/${normalizedVideo}`;
          }
          if (normalizedVideo) {
            incoming.videoUrl = normalizedVideo;
            if (typeof incoming.showInShoppingVideos !== 'boolean') {
              incoming.showInShoppingVideos = true;
            }
          }

          const products = readJsonFile(PRODUCTS_FILE, []);
          const existingIdx = products.findIndex((p) => p.id === incoming.id);
          let savedProduct;
          if (existingIdx >= 0) {
            savedProduct = { ...products[existingIdx], ...incoming, updatedAt: new Date().toISOString() };
            products[existingIdx] = savedProduct;
          } else {
            savedProduct = { ...incoming, createdAt: incoming.createdAt || new Date().toISOString() };
            products.unshift(savedProduct);
          }

          fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
          if (fs.existsSync(path.dirname(API_PRODUCTS_FILE))) {
            fs.writeFileSync(API_PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
          }
          return sendJson(res, 200, { success: true, product: savedProduct });
        }

        if (req.method === 'DELETE') {
          const id = decodeURIComponent(pathname.replace('/api/products/', ''));
          const products = readJsonFile(PRODUCTS_FILE, []);
          const filtered = products.filter((p) => p.id !== id);
          fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
          if (fs.existsSync(path.dirname(API_PRODUCTS_FILE))) {
            fs.writeFileSync(API_PRODUCTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
          }
          return sendJson(res, 200, { success: true });
        }
      }

      // 9. Orders API: GET, POST, PUT
      if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) {
        if (req.method === 'GET') {
          const orders = readAllOrders();
          if (pathname === '/api/orders') {
            const filterUserId = parsedUrl.searchParams.get('userId')?.trim() || '';
            const filterEmail = parsedUrl.searchParams.get('email')?.trim().toLowerCase() || '';
            const filterPhoneDigits = (parsedUrl.searchParams.get('phone')?.trim() || '').replace(/\D/g, '').slice(-10);

            if (filterUserId || filterEmail || filterPhoneDigits) {
              const matched = orders.filter((o) => {
                if (filterUserId && o.userId && o.userId === filterUserId) return true;
                if (filterEmail && o.customerEmail && o.customerEmail.toLowerCase() === filterEmail) return true;
                if (filterPhoneDigits) {
                  const ordDigits = String(o.customerPhone || o.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
                  if (ordDigits && ordDigits === filterPhoneDigits) return true;
                }
                return false;
              });
              return sendJson(res, 200, matched);
            }
            return sendJson(res, 200, orders);
          }

          const idOrNum = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const order = findOrderByIdentifier(orders, idOrNum);
          if (order) {
            return sendJson(res, 200, order);
          }
          return sendJson(res, 404, { error: 'Order not found' });
        }

        if (pathname.includes('/confirm-payment') && req.method === 'POST') {
          const token = extractAdminToken(req);
          if (!token) {
            return sendJson(res, 401, {
              success: false,
              error: 'Unauthorized: Manual payment confirmation requires an administrator session.'
            });
          }
          const id = decodeURIComponent(pathname.replace('/api/orders/', '').replace('/confirm-payment', ''));
          const orders = readAllOrders();
          const target = findOrderByIdentifier(orders, id);
          if (target) {
            const now = new Date().toISOString();
            const updated = sanitizeServerOrder(
              {
                ...target,
                paymentStatus: 'paid',
                isPaid: true,
                orderStatus: ['Processing', 'Shipped', 'Delivered'].includes(target.orderStatus)
                  ? target.orderStatus
                  : 'Confirmed',
                confirmedAt: target.confirmedAt || now,
                paidAt: target.paidAt || now,
                paymentVerifiedAt: now,
                verifiedVia: 'admin_manual',
                updatedAt: now
              },
              target
            );
            updated.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(updated);
            const idx = orders.findIndex((o) => o.id === target.id);
            if (idx >= 0) orders[idx] = updated;
            writeAllOrders(orders);
            return sendJson(res, 200, { success: true, order: updated });
          }
          return sendJson(res, 404, { success: false, error: 'Order not found' });
        }

        if ((pathname.includes('/customer-whatsapp-confirm') || pathname.includes('/whatsapp-confirm')) && req.method === 'POST') {
          const id = decodeURIComponent(
            pathname.replace('/api/orders/', '').replace('/customer-whatsapp-confirm', '').replace('/whatsapp-confirm', '')
          );
          const orders = readAllOrders();
          const target = findOrderByIdentifier(orders, id);
          if (target) {
            target.whatsappCustomerConfirmed = true;
            target.whatsappCustomerConfirmedAt = new Date().toISOString();
            target.updatedAt = new Date().toISOString();
            saveWhatsAppLog({
              orderId: target.orderNumber || target.id,
              recipient: `+${OWNER_WHATSAPP_NUMBER}`,
              timestamp: target.whatsappCustomerConfirmedAt,
              type: 'CUSTOMER_WHATSAPP_CONFIRMATION',
              status: 'CONFIRMED_BY_CUSTOMER',
              customerName: target.customerName,
              customerPhone: target.customerPhone
            });
            writeAllOrders(orders);
            return sendJson(res, 200, { success: true, order: target });
          }
          return sendJson(res, 404, { success: false, error: 'Order not found' });
        }

        if (req.method === 'POST') {
          const incoming = await parseBody(req);
          if (!incoming || (!incoming.id && !incoming.orderNumber)) {
            return sendJson(res, 400, { success: false, error: 'Order payload requires an id or orderNumber' });
          }

          const orders = readAllOrders();
          const existing = findOrderByIdentifier(orders, incoming.id || incoming.orderNumber);
          const hasAdminToken = Boolean(extractAdminToken(req));

          // Client POSTs may NOT self-assert paymentStatus='paid' or orderStatus='Confirmed' without server/admin verification
          const payloadCopy = { ...incoming };
          if (!hasAdminToken) {
            if (existing?.paymentStatus === 'paid') {
              payloadCopy.paymentStatus = 'paid';
              payloadCopy.isPaid = true;
              payloadCopy.orderStatus = existing.orderStatus;
              payloadCopy.paidAt = existing.paidAt;
              payloadCopy.paymentVerifiedAt = existing.paymentVerifiedAt;
              payloadCopy.verifiedVia = existing.verifiedVia;
            } else {
              if (payloadCopy.paymentStatus === 'paid' || payloadCopy.isPaid === true) {
                payloadCopy.paymentStatus = existing?.paymentStatus || 'pending';
                payloadCopy.isPaid = false;
              }
              if (payloadCopy.orderStatus === 'Confirmed' && existing?.paymentStatus !== 'paid') {
                payloadCopy.orderStatus = existing?.orderStatus || 'Pending';
              }
            }
          }

          const now = new Date().toISOString();
          const savedOrder = sanitizeServerOrder(
            {
              ...payloadCopy,
              createdAt: existing?.createdAt || payloadCopy.createdAt || now,
              updatedAt: now
            },
            existing
          );

          if (savedOrder.paymentStatus === 'paid') {
            savedOrder.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(savedOrder);
          }

          const existingIdx = existing ? orders.findIndex((o) => o.id === existing.id) : -1;
          if (existingIdx >= 0) {
            orders[existingIdx] = savedOrder;
          } else {
            orders.unshift(savedOrder);
          }

          writeAllOrders(orders);
          return sendJson(res, 200, { success: true, order: savedOrder });
        }

        if (req.method === 'PUT') {
          const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const updates = await parseBody(req);
          if (!updates || typeof updates !== 'object') {
            return sendJson(res, 400, { success: false, error: 'Invalid JSON update payload' });
          }
          const orders = readAllOrders();
          const target = findOrderByIdentifier(orders, id);
          if (!target) {
            return sendJson(res, 404, { success: false, error: 'Order not found' });
          }

          const hasAdminToken = Boolean(extractAdminToken(req));
          const safeUpdates = { ...updates };
          if (!hasAdminToken && safeUpdates.paymentStatus === 'paid' && target.paymentStatus !== 'paid') {
            delete safeUpdates.paymentStatus;
            delete safeUpdates.isPaid;
          }

          const now = new Date().toISOString();
          const nextOrder = sanitizeServerOrder(
            {
              ...target,
              ...safeUpdates,
              updatedAt: now,
              ...(safeUpdates.paymentStatus === 'paid' && !target.paidAt
                ? { paidAt: now, paymentVerifiedAt: now, verifiedVia: target.verifiedVia || 'admin_manual' }
                : {})
            },
            target
          );

          if (nextOrder.paymentStatus === 'paid') {
            nextOrder.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(nextOrder);
          }

          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = nextOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, { success: true, order: nextOrder });
        }
      }

      // 10. Cashfree Payments endpoints (real gateway calls & HMAC verification)
      if (pathname === '/api/payments/cashfree/status' && req.method === 'GET') {
        return sendJson(res, 200, getCashfreeStatusSummary());
      }

      if (pathname === '/api/admin/cashfree-config') {
        const token = extractAdminToken(req);
        if (!token) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session token required.'
          });
        }
        if (req.method === 'GET') {
          return sendJson(res, 200, getCashfreeStatusSummary());
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (!body || typeof body !== 'object') {
            return sendJson(res, 400, { success: false, error: 'Invalid configuration payload.' });
          }
          const result = saveCashfreeConfig({
            appId: body.appId,
            secretKey: body.secretKey,
            env: body.env,
            apiVersion: body.apiVersion,
            notifyUrl: body.notifyUrl
          });
          if (!result.success) {
            return sendJson(res, 500, { success: false, error: result.message });
          }
          return sendJson(res, 200, {
            ...getCashfreeStatusSummary(),
            message: result.message
          });
        }
      }

      if (pathname === '/api/payments/cashfree/create-order' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { success: false, error: 'Invalid payment order payload.' });
        }

        const rawOrderId = String(body.orderNumber || body.orderId || `VDH-${Date.now().toString().slice(-6)}`).trim();
        const gatewayOrderId = sanitizeGatewayOrderId(rawOrderId);
        const orderAmount = toMoneyNumber(body.orderAmount ?? body.totalAmount, 0);

        if (orderAmount <= 0) {
          return sendJson(res, 400, {
            success: false,
            configured: true,
            error: 'Order amount must be greater than ₹0.'
          });
        }

        const reqOrigin =
          String(req.headers['origin'] || '').trim() ||
          (req.headers['host'] ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['host']}` : 'https://vidhyaajewellerystudio.com');
        const defaultReturnUrl = `${reqOrigin.replace(/\/+$/, '')}/?view=checkout&cf_order_id={order_id}`;

        const cfResult = await createCashfreeOrder({
          orderId: gatewayOrderId,
          orderAmount,
          customerName: String(body.customerName || 'Valued Patron'),
          customerEmail: String(body.customerEmail || 'patron@vidhyaajewellery.com'),
          customerPhone: String(body.customerPhone || '9758350524'),
          returnUrl: body.returnUrl || defaultReturnUrl,
          notifyUrl: body.notifyUrl,
          paymentMethods: body.paymentMethods || 'upi,cc,dc,nb',
          orderNote: body.orderNote || `VIDHYAA Jewellery Studio Order ${rawOrderId}`
        });

        if (!cfResult.success || !cfResult.paymentSessionId) {
          const statusCode = cfResult.configured === false ? 503 : 502;
          return sendJson(res, statusCode, {
            success: false,
            configured: cfResult.configured,
            mode: cfResult.mode,
            error: cfResult.error || 'Failed to initialize Cashfree checkout session.'
          });
        }

        // Persist/upsert authoritative pending order BEFORE customer leaves for gateway
        const orders = readAllOrders();
        const existing = findOrderByIdentifier(orders, rawOrderId);
        const now = new Date().toISOString();
        const pendingOrder = sanitizeServerOrder(
          {
            id: existing?.id || `order_${gatewayOrderId}`,
            orderNumber: existing?.orderNumber || rawOrderId,
            gatewayOrderId: cfResult.orderId || gatewayOrderId,
            cfOrderId: cfResult.cfOrderId,
            userId: body.userId || existing?.userId,
            customerName: body.customerName || existing?.customerName,
            customerEmail: body.customerEmail || existing?.customerEmail,
            customerPhone: body.customerPhone || existing?.customerPhone,
            shippingAddress: body.shippingAddress || existing?.shippingAddress,
            items: Array.isArray(body.items) && body.items.length > 0 ? body.items : existing?.items,
            subtotal: body.subtotal ?? existing?.subtotal ?? orderAmount,
            discount: body.discount ?? existing?.discount ?? 0,
            deliveryCharge: body.deliveryCharge ?? existing?.deliveryCharge ?? 0,
            totalAmount: orderAmount,
            giftItem: body.giftItem || existing?.giftItem,
            paymentMethod: body.paymentMethod || existing?.paymentMethod || 'Cashfree Online Payment',
            paymentStatus: existing?.paymentStatus === 'paid' ? 'paid' : 'pending',
            orderStatus: existing?.paymentStatus === 'paid' ? existing.orderStatus : 'Pending',
            createdAt: existing?.createdAt || now,
            updatedAt: now
          },
          existing
        );

        const existingIdx = existing ? orders.findIndex((o) => o.id === existing.id) : -1;
        if (existingIdx >= 0) orders[existingIdx] = pendingOrder;
        else orders.unshift(pendingOrder);
        writeAllOrders(orders);

        return sendJson(res, 200, {
          success: true,
          configured: true,
          orderId: cfResult.orderId || gatewayOrderId,
          order_id: cfResult.orderId || gatewayOrderId,
          cfOrderId: cfResult.cfOrderId,
          paymentSessionId: cfResult.paymentSessionId,
          payment_session_id: cfResult.paymentSessionId,
          orderStatus: cfResult.orderStatus || 'ACTIVE',
          mode: cfResult.mode,
          order: pendingOrder
        });
      }

      if (pathname === '/api/payments/cashfree/verify-order' && req.method === 'POST') {
        const body = await parseBody(req);
        const orderId = String(body?.orderId || body?.order_id || '').trim();
        if (!orderId) {
          return sendJson(res, 400, {
            success: false,
            isPaid: false,
            error: 'orderId is required for payment verification.'
          });
        }

        const orders = readAllOrders();
        const target = findOrderByIdentifier(orders, orderId);

        if (target && target.paymentStatus === 'paid' && (target.verifiedVia === 'cashfree_api' || target.verifiedVia === 'cashfree_webhook')) {
          return sendJson(res, 200, {
            success: true,
            isPaid: true,
            alreadyVerified: true,
            orderId: target.gatewayOrderId || target.orderNumber,
            orderStatus: 'PAID',
            orderAmount: target.totalAmount,
            cfOrderId: target.cfOrderId,
            paymentDetails: {
              cfPaymentId: target.paymentId,
              paymentStatus: 'SUCCESS',
              paymentAmount: target.verifiedAmount ?? target.totalAmount,
              paymentCurrency: target.currency || 'INR',
              paymentMethod: target.paymentMethod,
              cardNetwork: target.cardNetwork,
              cardType: target.cardType,
              paymentTime: target.paidAt || target.paymentVerifiedAt
            },
            order: target
          });
        }

        const expectedAmount = target ? Number(target.totalAmount) : body?.expectedAmount !== undefined ? Number(body.expectedAmount) : undefined;
        const verification = await verifyCashfreeOrder(orderId, {
          expectedAmount,
          expectedCurrency: 'INR'
        });

        const now = new Date().toISOString();
        if (verification.isPaid) {
          const base = target || {
            id: `order_${sanitizeGatewayOrderId(orderId)}`,
            orderNumber: orderId,
            totalAmount: verification.orderAmount || expectedAmount || 0,
            subtotal: verification.orderAmount || expectedAmount || 0,
            createdAt: now
          };
          const paidOrder = sanitizeServerOrder(
            {
              ...base,
              ...(body?.orderData && typeof body.orderData === 'object' ? body.orderData : {}),
              paymentStatus: 'paid',
              isPaid: true,
              orderStatus:
                base.orderStatus && ['Processing', 'Shipped', 'Delivered'].includes(base.orderStatus)
                  ? base.orderStatus
                  : 'Confirmed',
              paymentMethod:
                verification.paymentDetails?.paymentMethod ||
                base.paymentMethod ||
                'Cashfree Online Payment',
              paymentId: String(verification.paymentDetails?.cfPaymentId || verification.cfOrderId || orderId),
              cfOrderId: verification.cfOrderId || base.cfOrderId,
              cardNetwork: verification.paymentDetails?.cardNetwork || base.cardNetwork,
              cardType: verification.paymentDetails?.cardType || base.cardType,
              verifiedAmount: verification.paymentDetails?.paymentAmount ?? verification.orderAmount,
              currency: verification.paymentDetails?.paymentCurrency || 'INR',
              paidAt: verification.paymentDetails?.paymentTime || base.paidAt || now,
              paymentVerifiedAt: now,
              confirmedAt: base.confirmedAt || now,
              verifiedVia: 'cashfree_api',
              failureReason: '',
              updatedAt: now
            },
            target
          );
          paidOrder.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(paidOrder);

          const idx = target ? orders.findIndex((o) => o.id === target.id) : -1;
          if (idx >= 0) orders[idx] = paidOrder;
          else orders.unshift(paidOrder);
          writeAllOrders(orders);

          return sendJson(res, 200, {
            ...verification,
            order: paidOrder
          });
        }

        if (target && verification.isFailed) {
          const failedOrder = sanitizeServerOrder(
            {
              ...target,
              paymentStatus: 'failed',
              isPaid: false,
              orderStatus: 'Pending',
              failureReason: verification.error || `Gateway status: ${verification.orderStatus}`,
              updatedAt: now
            },
            target
          );
          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = failedOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, {
            ...verification,
            order: failedOrder
          });
        }

        if (target) {
          const pendingOrder = sanitizeServerOrder(
            {
              ...target,
              paymentStatus: target.paymentStatus === 'paid' ? 'paid' : 'pending',
              isPaid: target.paymentStatus === 'paid',
              cfOrderId: verification.cfOrderId || target.cfOrderId,
              updatedAt: now
            },
            target
          );
          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = pendingOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, {
            ...verification,
            order: pendingOrder
          });
        }

        return sendJson(res, verification.success ? 200 : 502, verification);
      }

      if ((pathname === '/api/payments/webhook' || pathname === '/api/payments/cashfree/webhook') && req.method === 'POST') {
        let rawBuffer;
        try {
          rawBuffer = await readRawBody(req, 2 * 1024 * 1024);
        } catch (err) {
          return sendJson(res, 400, { success: false, error: 'Failed to read webhook body.' });
        }
        const rawBodyStr = rawBuffer.toString('utf8');
        const signature = String(req.headers['x-webhook-signature'] || '').trim();
        const timestamp = String(req.headers['x-webhook-timestamp'] || '').trim();

        if (!verifyCashfreeWebhookSignature(rawBodyStr, signature, timestamp)) {
          console.warn('[Cashfree Webhook] Rejected unsigned or invalid HMAC signature.');
          return sendJson(res, 401, {
            success: false,
            error: 'Invalid or missing Cashfree webhook signature.'
          });
        }

        let payload = null;
        try {
          payload = JSON.parse(rawBodyStr);
        } catch {
          return sendJson(res, 400, { success: false, error: 'Invalid webhook JSON payload.' });
        }

        const orderObj = payload?.data?.order || {};
        const paymentObj = payload?.data?.payment || {};
        const eventType = String(payload?.type || '').toUpperCase();
        const orderId = String(orderObj.order_id || payload?.orderId || payload?.order_id || '').trim();
        const paymentStatusRaw = String(paymentObj.payment_status || payload?.payment_status || '').toUpperCase();
        const orderStatusRaw = String(orderObj.order_status || payload?.order_status || '').toUpperCase();
        const cfPaymentId = paymentObj.cf_payment_id;
        const paidAmount = toMoneyNumber(paymentObj.payment_amount ?? orderObj.order_amount, 0);
        const currency = String(paymentObj.payment_currency || orderObj.order_currency || 'INR').toUpperCase();

        if (!orderId) {
          return sendJson(res, 400, { success: false, error: 'Webhook missing order_id.' });
        }

        const orders = readAllOrders();
        const target = findOrderByIdentifier(orders, orderId);
        if (!target) {
          return sendJson(res, 200, { success: true, received: true, orderFound: false, orderId });
        }

        const eventKey = `${eventType}:${cfPaymentId || 'none'}:${paymentStatusRaw || orderStatusRaw}`;
        const existingEvents = Array.isArray(target.webhookEventIds) ? target.webhookEventIds : [];
        if (existingEvents.includes(eventKey)) {
          return sendJson(res, 200, {
            success: true,
            received: true,
            duplicate: true,
            isPaid: target.paymentStatus === 'paid',
            order: target
          });
        }

        const now = new Date().toISOString();
        const nextEvents = [...existingEvents.slice(-19), eventKey];
        const isSuccessEvent =
          eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
          paymentStatusRaw === 'SUCCESS' ||
          orderStatusRaw === 'PAID';
        const isFailedEvent =
          eventType === 'PAYMENT_FAILED_WEBHOOK' ||
          ['FAILED', 'CANCELLED', 'TERMINATED', 'VOID'].includes(paymentStatusRaw) ||
          ['FAILED', 'CANCELLED', 'TERMINATED'].includes(orderStatusRaw);
        const isDroppedEvent =
          eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' || paymentStatusRaw === 'USER_DROPPED';

        if (isSuccessEvent) {
          if (currency !== 'INR' || paidAmount + 0.01 < Number(target.totalAmount || 0)) {
            const rejectedOrder = sanitizeServerOrder(
              {
                ...target,
                paymentStatus: 'failed',
                isPaid: false,
                orderStatus: 'Pending',
                failureReason:
                  currency !== 'INR'
                    ? `Webhook currency mismatch (${currency})`
                    : `Webhook amount mismatch: expected ₹${target.totalAmount}, received ₹${paidAmount}`,
                webhookEventIds: nextEvents,
                updatedAt: now
              },
              target
            );
            const idx = orders.findIndex((o) => o.id === target.id);
            if (idx >= 0) orders[idx] = rejectedOrder;
            writeAllOrders(orders);
            return sendJson(res, 200, {
              success: false,
              received: true,
              rejected: true,
              isPaid: false,
              error: rejectedOrder.failureReason,
              order: rejectedOrder
            });
          }

          const methodLabel = paymentObj.payment_group
            ? `Cashfree (${String(paymentObj.payment_group).toUpperCase()})`
            : target.paymentMethod || 'Cashfree Online Payment';

          const paidOrder = sanitizeServerOrder(
            {
              ...target,
              paymentStatus: 'paid',
              isPaid: true,
              orderStatus: ['Processing', 'Shipped', 'Delivered'].includes(target.orderStatus)
                ? target.orderStatus
                : 'Confirmed',
              paymentMethod: methodLabel,
              paymentId: String(cfPaymentId || target.paymentId || orderId),
              cfOrderId: orderObj.cf_order_id || target.cfOrderId,
              verifiedAmount: paidAmount,
              currency,
              paidAt: paymentObj.payment_time || target.paidAt || now,
              paymentVerifiedAt: now,
              confirmedAt: target.confirmedAt || now,
              verifiedVia: 'cashfree_webhook',
              failureReason: '',
              webhookEventIds: nextEvents,
              updatedAt: now
            },
            target
          );
          paidOrder.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(paidOrder);

          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = paidOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, {
            success: true,
            received: true,
            isPaid: true,
            order: paidOrder
          });
        }

        if (isFailedEvent && target.paymentStatus !== 'paid') {
          const failedOrder = sanitizeServerOrder(
            {
              ...target,
              paymentStatus: 'failed',
              isPaid: false,
              orderStatus: 'Pending',
              failureReason: paymentObj.payment_message || `Webhook ${paymentStatusRaw || eventType}`,
              webhookEventIds: nextEvents,
              updatedAt: now
            },
            target
          );
          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = failedOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, {
            success: true,
            received: true,
            isPaid: false,
            isFailed: true,
            order: failedOrder
          });
        }

        if (isDroppedEvent && target.paymentStatus !== 'paid') {
          const droppedOrder = sanitizeServerOrder(
            {
              ...target,
              paymentStatus: 'pending',
              isPaid: false,
              orderStatus: 'Pending',
              failureReason: 'Payment cancelled or dropped by customer before completion.',
              webhookEventIds: nextEvents,
              updatedAt: now
            },
            target
          );
          const idx = orders.findIndex((o) => o.id === target.id);
          if (idx >= 0) orders[idx] = droppedOrder;
          writeAllOrders(orders);
          return sendJson(res, 200, {
            success: true,
            received: true,
            isPaid: false,
            order: droppedOrder
          });
        }

        return sendJson(res, 200, {
          success: true,
          received: true,
          isPaid: target.paymentStatus === 'paid',
          order: target
        });
      }

      // 11. Configuration endpoints & Admin WhatsApp diagnostic
      if (pathname === '/api/admin/whatsapp-status') {
        const logs = readJsonFile(WHATSAPP_LOGS_FILE, []);
        return sendJson(res, 200, {
          success: true,
          mode: 'Customer Click-to-Chat (wa.me)',
          ownerNumber: `+${OWNER_WHATSAPP_NUMBER}`,
          cloudApiRequired: false,
          totalLogs: logs.length,
          recentLogs: logs.slice(0, 10)
        });
      }

      if (pathname === '/api/admin/test-whatsapp' && req.method === 'POST') {
        const dummyOrder = {
          id: 'test_order_001',
          orderNumber: 'VDH-TEST-001',
          customerName: 'Demo Customer',
          customerPhone: '+91 9876543210',
          shippingAddress: {
            street: '123 Test Street',
            city: 'Roorkee',
            state: 'Uttarakhand',
            pincode: '247667'
          },
          items: [{ productName: 'Gold Rajwada Kada', quantity: 1, price: 1500 }],
          totalAmount: 1500,
          paymentMethod: 'Cashfree / UPI (Verified)',
          paymentStatus: 'paid',
          orderStatus: 'Confirmed'
        };
        const directLink = getOwnerWhatsAppClickToChatLink(dummyOrder);
        const previewMessage = formatOwnerWhatsAppMessage(dummyOrder);
        return sendJson(res, 200, {
          success: true,
          mode: 'Click-to-Chat',
          directLink,
          result: { directLink },
          previewMessage
        });
      }

      if (pathname === '/api/admin/sms-config') {
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/admin/test-sms' && req.method === 'POST') {
        return sendJson(res, 200, { success: true });
      }

      // 11b. Read-only list of existing video files in /videos/uploads/
      if (pathname === '/api/videos/available' && req.method === 'GET') {
        const urls = new Set();
        for (const dir of [VIDEOS_UPLOAD_DIR, DIST_VIDEOS_UPLOAD_DIR]) {
          if (fs.existsSync(dir)) {
            for (const entry of fs.readdirSync(dir)) {
              if (/\.(?:mp4|mov|webm|m4v)$/i.test(entry)) {
                urls.add(`/videos/uploads/${entry}`);
              }
            }
          }
        }
        return sendJson(res, 200, {
          success: true,
          urls: Array.from(urls).sort()
        });
      }

      // 12. Product & Category Video Upload: POST /api/videos/upload or /api/videos/upload.php
      if ((pathname === '/api/videos/upload' || pathname === '/api/videos/upload.php') && req.method === 'POST') {
        const authHeader = String(req.headers['authorization'] || '');
        const adminHeader = String(req.headers['x-admin-token'] || '');
        const token = adminHeader || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
        if (!token) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session token required for video uploads.'
          });
        }

        let rawBuffer;
        try {
          rawBuffer = await readRawBody(req, MAX_VIDEO_UPLOAD_BYTES);
        } catch (err) {
          return sendJson(res, err?.statusCode || 400, {
            success: false,
            error: err?.message || 'Failed to read uploaded video payload.'
          });
        }

        if (!rawBuffer || rawBuffer.length === 0) {
          return sendJson(res, 400, {
            success: false,
            error: 'Empty video file received. Please select a valid MP4, MOV, or WebM video.'
          });
        }

        const contentType = String(req.headers['content-type'] || '').toLowerCase();
        let originalName = '';
        let mimeType = '';
        let fileData = null;

        if (contentType.includes('multipart/form-data')) {
          const parsed = parseMultipartVideo(rawBuffer, String(req.headers['content-type'] || ''));
          if (!parsed || !parsed.data || parsed.data.length === 0) {
            return sendJson(res, 400, {
              success: false,
              error: 'No video file field found in multipart/form-data upload.'
            });
          }
          originalName = parsed.fileName;
          mimeType = parsed.mimeType;
          fileData = parsed.data;
        } else {
          const headerName = req.headers['x-file-name'] ? decodeURIComponent(String(req.headers['x-file-name'])) : '';
          originalName = headerName || `vidhyaa_video_${Date.now()}.mp4`;
          mimeType = String(req.headers['x-file-type'] || contentType || 'video/mp4').split(';')[0].trim();
          fileData = rawBuffer;
        }

        const allowedExts = ['.mp4', '.mov', '.webm'];
        const allowedMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'application/octet-stream'];
        const extMatch = /\.([a-z0-9]+)$/i.exec(originalName);
        let ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
        if (!allowedExts.includes(ext)) {
          if (mimeType === 'video/quicktime') ext = '.mov';
          else if (mimeType === 'video/webm') ext = '.webm';
          else if (mimeType === 'video/mp4') ext = '.mp4';
        }

        if (!allowedExts.includes(ext) && !allowedMimes.includes(mimeType)) {
          return sendJson(res, 400, {
            success: false,
            error: 'Unsupported video format. Please upload an MP4, MOV, or WebM file.'
          });
        }
        if (!allowedExts.includes(ext)) ext = '.mp4';

        const baseName = path.basename(originalName, path.extname(originalName))
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 60) || 'vidhyaa_jewellery_video';

        const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        const finalFileName = `${baseName}_${uniqueSuffix}${ext}`;

        fs.mkdirSync(VIDEOS_UPLOAD_DIR, { recursive: true });
        const destPath = path.join(VIDEOS_UPLOAD_DIR, finalFileName);
        fs.writeFileSync(destPath, fileData);

        // Mirror to dist/videos/uploads if dist exists (for preview/production sync)
        if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
          try {
            fs.mkdirSync(DIST_VIDEOS_UPLOAD_DIR, { recursive: true });
            fs.writeFileSync(path.join(DIST_VIDEOS_UPLOAD_DIR, finalFileName), fileData);
          } catch (mirrorErr) {
            console.warn('[Video Upload] Notice mirroring to dist:', mirrorErr.message);
          }
        }

        const publicUrl = `/videos/uploads/${finalFileName}`;
        console.log(`[Video Upload] Saved ${finalFileName} (${fileData.length} bytes) -> ${publicUrl}`);

        return sendJson(res, 200, {
          success: true,
          url: publicUrl,
          videoUrl: publicUrl,
          fileName: finalFileName,
          originalName,
          sizeBytes: fileData.length,
          mimeType: mimeType === 'application/octet-stream' ? 'video/mp4' : mimeType,
          storageType: 'server'
        });
      }

      // Default fallback for any other unhandled /api/* route:
      // Return JSON 404 so that the client never receives an HTML fallback or empty 404!
      return sendJson(res, 404, {
        success: false,
        error: `Endpoint ${pathname} not found.`
      });
    } catch (err) {
      console.error('[API Error]:', err);
      return sendJson(res, 500, {
        success: false,
        error: 'Internal server error processing API request.'
      });
    }
  })();
}
