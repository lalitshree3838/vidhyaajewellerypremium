import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getCashfreeCredentials,
  getCashfreeStatusSummary,
  saveCashfreeConfig,
  createCashfreeOrder,
  verifyCashfreeOrder,
  verifyCashfreeWebhookSignature,
  sanitizeGatewayOrderId
} from './src/server/cashfreeCore.js';
import {
  getAllowedAdminEmails,
  signAdminToken,
  signPatronToken,
  verifySignedSessionToken,
  verifyFirebaseIdToken,
  revokeSessionToken,
  extractTokenFromHeaders,
  authenticateAdminRequest,
  authenticateCustomerRequest,
  computeOrderReceiptToken,
  hasValidOrderReceiptToken,
  customerOwnsOrder,
  sanitizePublicOrderTracking,
  normalizePhone10,
  hashPasswordPbkdf2,
  verifyPatronOrAdminPassword,
  verifyAdminPassword,
  verifyAdminBackupCode,
  verifyTotpCode,
  loadAdminCredentialsConfig,
  validateNewAdminPassword,
  saveAdminBootstrapCredentials,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit,
  isLiveProductionRequest,
  withResourceLock,
  atomicWriteFileSync,
  getOutsideSecretsDir
} from './src/server/sessionAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VIDHYAA_DATA_DIR
  ? path.resolve(process.env.VIDHYAA_DATA_DIR)
  : path.resolve(__dirname, 'data');
const API_DIR = process.env.VIDHYAA_API_DIR
  ? path.resolve(process.env.VIDHYAA_API_DIR)
  : path.resolve(__dirname, 'api');
const PATRONS_FILE = path.join(DATA_DIR, 'patrons.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const WHATSAPP_LOGS_FILE = path.join(DATA_DIR, 'whatsapp_logs.json');
const API_PRODUCTS_FILE = path.join(API_DIR, 'products');
const API_ORDERS_FILE = path.join(API_DIR, 'orders');
const VIDEOS_UPLOAD_DIR = process.env.VIDHYAA_VIDEOS_DIR
  ? path.resolve(process.env.VIDHYAA_VIDEOS_DIR)
  : path.resolve(__dirname, 'videos', 'uploads');
const DIST_VIDEOS_UPLOAD_DIR = path.resolve(__dirname, 'dist', 'videos', 'uploads');
const PRODUCTS_MEDIA_DIR = path.resolve(__dirname, 'products');
const PRODUCTS_UPLOAD_MEDIA_DIR = path.resolve(__dirname, 'products', 'uploads');
const DIST_PRODUCTS_MEDIA_DIR = path.resolve(__dirname, 'dist', 'products');
const CATEGORIES_MEDIA_DIR = path.resolve(__dirname, 'categories');
const DIST_CATEGORIES_MEDIA_DIR = path.resolve(__dirname, 'dist', 'categories');
const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024; // 250 MB
const DEFAULT_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB
const PRODUCT_JSON_BODY_LIMIT_BYTES = 8 * 1024 * 1024; // 8 MB (supports inline image uploads)

const OWNER_WHATSAPP_NUMBER = '917302187770';
const inflightCashfreeOrders = new Set();

function getClientIp(req) {
  const fwd = String(req?.headers?.['x-forwarded-for'] || '').trim();
  if (fwd) return fwd.split(',')[0].trim();
  return String(req?.socket?.remoteAddress || 'unknown');
}

function saveWhatsAppLog(entry) {
  try {
    const logs = readJsonFile(WHATSAPP_LOGS_FILE, []);
    logs.unshift(entry);
    if (logs.length > 100) logs.length = 100;
    atomicWriteFileSync(WHATSAPP_LOGS_FILE, JSON.stringify(logs, null, 2));
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

function parseBody(req, maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES) {
  return new Promise((resolve) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        settled = true;
        chunks.length = 0;
        resolve({ __tooLarge: true });
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks, totalBytes).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
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

function getAllowedCorsOrigin(req) {
  const origin = String(req?.headers?.origin || '').trim();
  if (!origin) return '';

  if (/^https:\/\/(?:www\.)?vidhyaajewellerystudio\.com$/i.test(origin)) {
    return origin;
  }
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) {
    return origin;
  }
  if (/^https:\/\/[a-z0-9-]+\.run\.app$/i.test(origin)) {
    return origin;
  }

  const extra = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(origin)) {
    return origin;
  }
  return '';
}

function sendJson(res, statusCode, data, req = res?.__vdhReq || res?.req) {
  const jsonStr = JSON.stringify(data);
  const allowedOrigin = getAllowedCorsOrigin(req);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(jsonStr),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token'
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  res.writeHead(statusCode, headers);
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
    ...(src.appliedPromo ? { appliedPromo: String(src.appliedPromo).trim().toUpperCase() } : {}),
    upiReference: String(src.upiReference || ''),
    trackingNumber: String(src.trackingNumber || ''),
    courierName: String(src.courierName || ''),
    createdAt: String(src.createdAt || new Date().toISOString()),
    updatedAt: String(src.updatedAt || new Date().toISOString())
  };

  return out;
}

function computePromoDiscountServer(subtotal, rawPromo) {
  const code = String(rawPromo || '').trim().toUpperCase();
  if (!code || subtotal <= 0) return 0;
  let discount = 0;
  if (code === 'VIDHYAA10' || code === 'ROYAL10') {
    discount = Math.round(subtotal * 0.1);
  } else if (code === 'LIVESTUDIO15') {
    discount = Math.round(subtotal * 0.15);
  } else if (code === 'FESTIVE500') {
    discount = subtotal >= 2500 ? 500 : 0;
  } else if (code === 'BRIDALVIP') {
    discount = subtotal >= 5000 ? Math.round(subtotal * 0.15) : 0;
  }
  return Math.max(0, Math.min(subtotal, discount));
}

function validateAndComputeOrderPricing(body, allowAdminBypass = false) {
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0) {
    if (allowAdminBypass) {
      const amt = Math.max(0, toMoneyNumber(body?.orderAmount ?? body?.totalAmount ?? body?.total, 0));
      return {
        valid: true,
        subtotal: Math.max(0, toMoneyNumber(body?.subtotal, amt)),
        discount: Math.max(0, toMoneyNumber(body?.discount, 0)),
        deliveryCharge: Math.max(0, toMoneyNumber(body?.deliveryCharge, 0)),
        totalAmount: amt
      };
    }
    return {
      valid: false,
      code: 'EMPTY_ITEMS',
      error: 'Order must contain at least one catalog item for price verification.'
    };
  }

  const products = readJsonFile(PRODUCTS_FILE, []);
  const productMap = new Map();
  for (const p of products) {
    if (p && p.id) productMap.set(String(p.id), p);
  }

  let computedSubtotal = 0;
  for (const it of rawItems) {
    const qty = Math.round(toMoneyNumber(it?.quantity, 0));
    if (qty < 1 || qty > 50) {
      return {
        valid: false,
        code: 'INVALID_QUANTITY',
        error: 'Each item quantity must be between 1 and 50.'
      };
    }
    const prodId = String(it?.productId || '').trim();
    const prod = productMap.get(prodId);
    if (!prod) {
      if (allowAdminBypass) {
        computedSubtotal += Math.max(0, toMoneyNumber(it?.price, 0)) * qty;
        continue;
      }
      return {
        valid: false,
        code: 'UNKNOWN_PRODUCT',
        error: `Catalog item '${prodId || 'unknown'}' could not be verified.`
      };
    }

    const catalogPrice = Math.max(0, toMoneyNumber(prod.price, 0));
    if (catalogPrice <= 0 && !allowAdminBypass) {
      return {
        valid: false,
        code: 'INVALID_CATALOG_PRICE',
        error: `Catalog pricing unavailable for '${prod.name || prodId}'.`
      };
    }

    if (it?.price !== undefined) {
      const clientUnitPrice = toMoneyNumber(it.price, -1);
      if (!allowAdminBypass && Math.abs(clientUnitPrice - catalogPrice) > 1) {
        return {
          valid: false,
          code: 'PRICE_TAMPER_DETECTED',
          error: `Unit price mismatch for '${prod.name || prodId}'. Please refresh your bag and retry.`
        };
      }
    }

    computedSubtotal += catalogPrice * qty;
  }

  const promoCode = String(body?.appliedPromo || body?.promoCode || '').trim().toUpperCase();
  const clientDiscount = Math.max(0, toMoneyNumber(body?.discount, 0));
  const expectedDiscount = promoCode ? computePromoDiscountServer(computedSubtotal, promoCode) : 0;

  if (!allowAdminBypass) {
    if (promoCode && expectedDiscount === 0 && clientDiscount > 0) {
      return {
        valid: false,
        code: 'INVALID_PROMO_DISCOUNT',
        error: `Promo code '${promoCode}' is invalid or minimum cart value is not met.`
      };
    }
    if (!promoCode && clientDiscount > 0) {
      return {
        valid: false,
        code: 'PRICE_OR_DISCOUNT_MISMATCH',
        error: 'Unrecognized discount applied without a valid promotional code.'
      };
    }
    if (Math.abs(clientDiscount - expectedDiscount) > 2) {
      return {
        valid: false,
        code: 'PRICE_OR_DISCOUNT_MISMATCH',
        error: 'Promotional discount amount does not match server calculation.'
      };
    }
  }

  const finalDiscount = allowAdminBypass ? clientDiscount : expectedDiscount;
  const expectedDelivery = computedSubtotal > 0 ? 100 : 0;
  const deliveryCharge = allowAdminBypass && body?.deliveryCharge !== undefined
    ? Math.max(0, toMoneyNumber(body.deliveryCharge, expectedDelivery))
    : expectedDelivery;

  if (!allowAdminBypass && body?.deliveryCharge !== undefined) {
    const clientDelivery = toMoneyNumber(body.deliveryCharge, -1);
    if (Math.abs(clientDelivery - expectedDelivery) > 2) {
      return {
        valid: false,
        code: 'DELIVERY_CHARGE_MISMATCH',
        error: 'Shipping charge does not match standard ₹100 flat delivery.'
      };
    }
  }

  const expectedTotal = Math.max(1, Math.round((computedSubtotal - finalDiscount + deliveryCharge) * 100) / 100);
  const clientTotal = toMoneyNumber(body?.orderAmount ?? body?.totalAmount ?? body?.total, 0);

  if (!allowAdminBypass && clientTotal > 0 && Math.abs(clientTotal - expectedTotal) > 2) {
    return {
      valid: false,
      code: 'TOTAL_AMOUNT_MISMATCH',
      error: `Submitted order total (₹${clientTotal}) does not match verified server total (₹${expectedTotal}).`
    };
  }

  return {
    valid: true,
    subtotal: computedSubtotal,
    discount: finalDiscount,
    deliveryCharge,
    totalAmount: allowAdminBypass && clientTotal > 0 ? clientTotal : expectedTotal,
    ...(promoCode ? { appliedPromo: promoCode } : {})
  };
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
  atomicWriteFileSync(ORDERS_FILE, serialized);
  if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
    atomicWriteFileSync(API_ORDERS_FILE, serialized);
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

function stripUntrustedOrderFields(input, allowAdminOnly = false) {
  if (!input || typeof input !== 'object') return {};
  const copy = { ...input };
  if (allowAdminOnly) return copy;

  const protectedKeys = [
    'paymentStatus',
    'isPaid',
    'paymentId',
    'cfOrderId',
    'paidAt',
    'paymentVerifiedAt',
    'confirmedAt',
    'verifiedVia',
    'verifiedAmount',
    'webhookEventIds',
    'isTestOrder',
    'paymentEnv',
    'whatsappClickToChatUrl'
  ];
  for (const k of protectedKeys) {
    delete copy[k];
  }
  if (copy.orderStatus === 'Confirmed' || copy.orderStatus === 'Processing' || copy.orderStatus === 'Shipped' || copy.orderStatus === 'Delivered') {
    delete copy.orderStatus;
  }
  return copy;
}

function resolveSmsConfigPath() {
  const outside = getOutsideSecretsDir();
  return outside ? path.join(outside, 'sms-config.json') : null;
}

function readSmsConfigSafe() {
  let fileCfg = {};
  const outside = getOutsideSecretsDir();
  const candidates = [
    ...(outside ? [path.join(outside, 'sms-config.json')] : [])
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        fileCfg = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch {}
  }
  const fast2smsApiKey = String(fileCfg.fast2smsApiKey || process.env.FAST2SMS_API_KEY || '').trim();
  const twofactorApiKey = String(fileCfg.twofactorApiKey || process.env.TWOFACTOR_API_KEY || '').trim();
  const msg91AuthKey = String(fileCfg.msg91AuthKey || process.env.MSG91_AUTH_KEY || '').trim();
  const msg91TemplateId = String(fileCfg.msg91TemplateId || process.env.MSG91_TEMPLATE_ID || '').trim();
  const twilioAccountSid = String(fileCfg.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const twilioAuthToken = String(fileCfg.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioPhoneNumber = String(fileCfg.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '').trim();

  const isFast2SmsActive = fast2smsApiKey.length > 5;
  const isTwoFactorActive = twofactorApiKey.length > 5;
  const isTwilioActive = Boolean(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
  const isMsg91Active = Boolean(msg91AuthKey && msg91TemplateId);

  let activeProvider = 'None Configured (Setup Required)';
  if (isTwilioActive) activeProvider = 'Twilio Worldwide SMS';
  else if (isFast2SmsActive) activeProvider = 'Fast2SMS India';
  else if (isTwoFactorActive) activeProvider = '2Factor.in India';
  else if (isMsg91Active) activeProvider = 'MSG91 Enterprise';

  return {
    raw: {
      provider: fileCfg.provider || process.env.SMS_PROVIDER || 'auto',
      fast2smsApiKey,
      twofactorApiKey,
      msg91AuthKey,
      msg91TemplateId,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber
    },
    summary: {
      success: true,
      configured: isFast2SmsActive || isTwoFactorActive || isTwilioActive || isMsg91Active,
      activeProvider,
      internationalSupported: isTwilioActive,
      providers: {
        twilio: {
          configured: isTwilioActive,
          description: 'Worldwide international SMS delivery (180+ countries)',
          senderNumber: twilioPhoneNumber ? `${twilioPhoneNumber.slice(0, 3)}••••${twilioPhoneNumber.slice(-2)}` : ''
        },
        fast2sms: {
          configured: isFast2SmsActive,
          description: 'Domestic India (+91) OTP route',
          maskedKey: isFast2SmsActive ? `${fast2smsApiKey.slice(0, 4)}••••${fast2smsApiKey.slice(-3)}` : ''
        },
        twofactor: {
          configured: isTwoFactorActive,
          description: 'Domestic India (+91) OTP route',
          maskedKey: isTwoFactorActive ? `${twofactorApiKey.slice(0, 4)}••••${twofactorApiKey.slice(-3)}` : ''
        },
        msg91: {
          configured: isMsg91Active,
          description: 'Domestic India (+91) DLT transactional route'
        }
      }
    }
  };
}

export function handleApiMiddleware(req, res, next) {
  res.__vdhReq = req;
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

  // Block direct HTTP access to secret directories, backups, private JSON files, and internal PHP helpers
  if (
    /^\/(?:\.admin-secrets|\.backups)(?:\/|$)/i.test(pathname) ||
    /^\/(?:cashfree-config\.json|sms-config\.json|admin-credentials\.json|\.env(?:\..*)?|data\/(?:orders|patrons|whatsapp_logs|backup_orders[^/]*)\.json)$/i.test(pathname) ||
    /^\/api\/admin\/_/i.test(pathname)
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

  // Handle CORS preflight for all /api endpoints using strict origin allowlist
  if (req.method === 'OPTIONS') {
    const allowedOrigin = getAllowedCorsOrigin(req);
    const optHeaders = {
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-file-name, x-file-type, x-admin-token, x-customer-token, x-order-token'
    };
    if (allowedOrigin) {
      optHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
    }
    res.writeHead(204, optHeaders);
    res.end();
    return;
  }

  // Async dispatch for API endpoints
  (async () => {
    try {
      const clientIp = getClientIp(req);

      // 1. Health check
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'ok' });
      }

      // 2. Auth status check
      if (pathname === '/api/auth/status' && req.method === 'GET') {
        return sendJson(res, 200, { ready: true });
      }

      // 2b. Admin Auth Capabilities & First-Run Setup Status
      if ((pathname === '/api/admin/auth-status' || pathname === '/api/admin/auth-status.php') && req.method === 'GET') {
        const creds = loadAdminCredentialsConfig();
        const admin = await authenticateAdminRequest(req);
        const liveProd = isLiveProductionRequest(req);
        return sendJson(res, 200, {
          passwordConfigured: Boolean(creds.hasPasswordAuth),
          totpRequired: Boolean(creds.totpSecret),
          canFirstRunSetup: !creds.hasPasswordAuth && (!liveProd || Boolean(admin)),
          isAuthenticatedAdmin: Boolean(admin),
          googleSsoEnabled: true
        });
      }

      // 2c. Admin Password Setup (one-time bootstrap in preview, or verified Google Admin in any env)
      if ((pathname === '/api/admin/setup-password' || pathname === '/api/admin/setup-password.php') && req.method === 'POST') {
        const rlKey = `admin_setup:${clientIp}`;
        const rl = checkRateLimit(rlKey);
        if (!rl.allowed) {
          return sendJson(res, 429, {
            success: false,
            error: `Too many setup attempts. Retry in ${rl.remainingSeconds} seconds.`
          });
        }

        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { success: false, error: 'Request payload exceeds maximum allowed size.' });
        }
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { success: false, error: 'Invalid JSON request payload.' });
        }

        return await withResourceLock('admin_creds', async () => {
          const creds = loadAdminCredentialsConfig();
          const admin = await authenticateAdminRequest(req);
          const liveProd = isLiveProductionRequest(req);

          if (liveProd && !admin) {
            return sendJson(res, 403, {
              success: false,
              error: 'Sign in with Google Workspace Admin first before configuring server password login on production.'
            });
          }

          if (creds.hasPasswordAuth && !admin) {
            return sendJson(res, 409, {
              success: false,
              error: 'Administrator password is already configured. Please sign in with your password or Google Workspace Admin.'
            });
          }

          const email = String(body.email || admin?.email || '').trim().toLowerCase();
          const password = String(body.password || '');
          const confirmPassword = String(body.confirmPassword ?? password);

          if (!email || !getAllowedAdminEmails().has(email)) {
            recordRateLimitFailure(rlKey);
            return sendJson(res, 401, {
              success: false,
              error: 'Only the authorized administrator email can be configured.'
            });
          }

          if (admin && email !== admin.email) {
            return sendJson(res, 403, {
              success: false,
              error: 'Email must match your authenticated administrator account.'
            });
          }

          if (password !== confirmPassword) {
            return sendJson(res, 400, {
              success: false,
              error: 'Password and confirmation password do not match.'
            });
          }

          const policy = validateNewAdminPassword(password);
          if (!policy.valid) {
            return sendJson(res, 400, {
              success: false,
              error: policy.error
            });
          }

          if (creds.hasEnvPasswordOverride) {
            return sendJson(res, 409, {
              success: false,
              error: 'ADMIN_PASSWORD_HASH is managed by server environment variables.'
            });
          }

          saveAdminBootstrapCredentials({ email, password });
          clearRateLimit(rlKey);

          const adminInfo = {
            email,
            role: 'admin',
            name: admin?.name || 'Neeraj Chauhan (Owner)'
          };
          const token = signAdminToken(email, { name: adminInfo.name, authMethod: 'password_setup' });
          return sendJson(res, 200, {
            success: true,
            token,
            admin: adminInfo
          });
        });
      }

      // 3. Admin Login: POST /api/admin/login or /api/admin/login.php
      if ((pathname === '/api/admin/login' || pathname === '/api/admin/login.php') && req.method === 'POST') {
        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { success: false, error: 'Request payload exceeds maximum allowed size.' });
        }
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, {
            success: false,
            error: 'Invalid JSON request payload.'
          });
        }

        const idToken = String(body.idToken || '').trim();
        if (idToken) {
          const rlKey = `admin_fb:${clientIp}`;
          const rl = checkRateLimit(rlKey);
          if (!rl.allowed) {
            return sendJson(res, 429, {
              success: false,
              error: `Too many failed login attempts. Retry in ${rl.remainingSeconds} seconds.`
            });
          }

          const fb = await verifyFirebaseIdToken(idToken);
          const fbEmail = String(fb?.email || '').toLowerCase().trim();
          if (!fb || fb.email_verified !== true || !getAllowedAdminEmails().has(fbEmail)) {
            recordRateLimitFailure(rlKey);
            return sendJson(res, 401, {
              success: false,
              error: 'Unauthorized: Firebase account is not verified as an executive administrator.'
            });
          }

          clearRateLimit(rlKey);
          const adminInfo = {
            email: fbEmail,
            role: 'admin',
            name: String(fb.name || 'Neeraj Chauhan (Owner)')
          };
          const token = signAdminToken(fbEmail, { name: adminInfo.name, authMethod: 'firebase' });
          return sendJson(res, 200, {
            success: true,
            token,
            admin: adminInfo
          });
        }

        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const totpCode = String(body.totpCode || body.otpCode || '').trim();

        if (!email || !password.trim()) {
          return sendJson(res, 400, {
            success: false,
            error: 'Both administrator email and password are required.'
          });
        }

        const rlKey = `admin_pw:${clientIp}:${email}`;
        const rl = checkRateLimit(rlKey);
        if (!rl.allowed) {
          return sendJson(res, 429, {
            success: false,
            error: `Security lockout active due to repeated failures. Retry in ${rl.remainingSeconds} seconds.`
          });
        }

        if (!getAllowedAdminEmails().has(email)) {
          recordRateLimitFailure(rlKey);
          return sendJson(res, 401, {
            success: false,
            error: 'Invalid administrator credentials. Access restricted to authorized personnel.'
          });
        }

        const creds = loadAdminCredentialsConfig();
        if (!creds.hasPasswordAuth) {
          return sendJson(res, 401, {
            success: false,
            error: 'Server password login is not configured. Sign in with Google Workspace Admin or configure ADMIN_PASSWORD_HASH outside public_html.'
          });
        }

        let passwordOk = false;
        if (creds.passwordHash) {
          passwordOk = await verifyAdminPassword(password, creds.passwordHash);
        } else if (creds.plainPassword) {
          const a = Buffer.from(creds.plainPassword, 'utf8');
          const b = Buffer.from(password, 'utf8');
          passwordOk = a.length === b.length && crypto.timingSafeEqual(a, b);
        }

        if (!passwordOk) {
          const fail = recordRateLimitFailure(rlKey);
          if (fail.locked) {
            return sendJson(res, 429, {
              success: false,
              error: `Too many failed attempts. Access suspended for ${fail.remainingSeconds} seconds.`
            });
          }
          return sendJson(res, 401, {
            success: false,
            error: 'Invalid administrator credentials. Access restricted to authorized personnel.'
          });
        }

        if (creds.totpSecret) {
          if (!totpCode) {
            return sendJson(res, 200, {
              success: false,
              requires2FA: true,
              message: 'Enter your 6-digit authenticator verification code.'
            });
          }

          let totpOk = verifyTotpCode(creds.totpSecret, totpCode);
          if (!totpOk) {
            totpOk = verifyAdminBackupCode(creds, totpCode);
          }

          if (!totpOk) {
            const fail = recordRateLimitFailure(rlKey);
            return sendJson(res, 401, {
              success: false,
              requires2FA: true,
              error: fail.locked
                ? `Too many invalid verification codes. Retry in ${fail.remainingSeconds} seconds.`
                : 'Invalid two-factor authentication code.'
            });
          }
        }

        clearRateLimit(rlKey);
        const adminInfo = {
          email,
          role: 'admin',
          name: 'Neeraj Chauhan (Owner)'
        };
        const token = signAdminToken(email, { name: adminInfo.name, authMethod: 'password' });
        return sendJson(res, 200, {
          success: true,
          token,
          admin: adminInfo
        });
      }

      // 4. Admin Verify Session: POST/GET /api/admin/verify-session or /api/admin/verify-session.php
      if (
        (pathname === '/api/admin/verify-session' || pathname === '/api/admin/verify-session.php') &&
        (req.method === 'POST' || req.method === 'GET')
      ) {
        let admin = await authenticateAdminRequest(req);
        if (!admin && req.method === 'POST') {
          const body = await parseBody(req);
          const bodyToken = String(body?.token || '').trim();
          if (bodyToken) {
            const session = verifySignedSessionToken(bodyToken, 'admin');
            if (session && getAllowedAdminEmails().has(String(session.email || '').toLowerCase())) {
              admin = {
                email: String(session.email).toLowerCase(),
                role: 'admin',
                name: session.name || 'Executive Administrator'
              };
            } else {
              const fb = await verifyFirebaseIdToken(bodyToken);
              const fbEmail = String(fb?.email || '').toLowerCase().trim();
              if (fb && fb.email_verified === true && getAllowedAdminEmails().has(fbEmail)) {
                admin = {
                  email: fbEmail,
                  role: 'admin',
                  name: fb.name || 'Executive Administrator'
                };
              }
            }
          }
        }

        if (admin) {
          return sendJson(res, 200, {
            valid: true,
            email: admin.email,
            role: 'admin',
            name: admin.name || 'Executive Administrator'
          });
        }

        return sendJson(res, 401, { valid: false });
      }

      // 5. Admin Logout: POST /api/admin/logout or /api/admin/logout.php
      if ((pathname === '/api/admin/logout' || pathname === '/api/admin/logout.php') && req.method === 'POST') {
        const token = extractTokenFromHeaders(req, 'x-admin-token');
        if (token) {
          revokeSessionToken(token);
        }
        return sendJson(res, 200, { success: true });
      }

      // 6. Customer Mobile Registration: POST /api/auth/mobile-register
      if (pathname === '/api/auth/mobile-register' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { code: 'PAYLOAD_TOO_LARGE', error: 'Request payload exceeds maximum allowed size.' });
        }
        if (!body) {
          return sendJson(res, 400, { code: 'INVALID_PAYLOAD', error: 'Invalid JSON payload' });
        }

        const rawPhone = String(body.phone || body.mobile || '');
        const mobile = normalizePhone10(rawPhone);

        if (mobile.length !== 10 || !/^[6-9]\d{9}$/.test(mobile)) {
          return sendJson(res, 400, {
            code: 'INVALID_PHONE',
            error: 'Please enter a valid 10-digit Indian mobile number'
          });
        }

        const rlKey = `patron_reg:${clientIp}`;
        const rl = checkRateLimit(rlKey);
        if (!rl.allowed) {
          return sendJson(res, 429, {
            code: 'RATE_LIMITED',
            error: `Too many registration attempts. Retry in ${rl.remainingSeconds} seconds.`
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

        return await withResourceLock('patrons', async () => {
          const patrons = readJsonFile(PATRONS_FILE, []);
          if (patrons.some((p) => normalizePhone10(p?.mobile || p?.phone || '') === mobile)) {
            return sendJson(res, 409, {
              code: 'ACCOUNT_EXISTS',
              error: 'An account with this mobile number already exists'
            });
          }

          const newPatron = {
            uid: `patron_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            displayName: String(body.name || '').trim() || 'Valued Patron',
            phone: `+91 ${mobile}`,
            mobile,
            email: String(body.email || '').trim(),
            passwordHash: hashPasswordPbkdf2(password),
            role: 'customer',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          patrons.push(newPatron);
          atomicWriteFileSync(PATRONS_FILE, JSON.stringify(patrons, null, 2));
          clearRateLimit(rlKey);

          const token = signPatronToken(newPatron);
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
            token
          });
        });
      }

      // 7. Customer Mobile Login: POST /api/auth/mobile-login
      if (pathname === '/api/auth/mobile-login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { code: 'PAYLOAD_TOO_LARGE', error: 'Request payload exceeds maximum allowed size.' });
        }
        if (!body) {
          return sendJson(res, 400, { code: 'INVALID_PAYLOAD', error: 'Invalid JSON payload' });
        }

        const mobile = normalizePhone10(body.phone || body.mobile || '');
        if (mobile.length !== 10) {
          return sendJson(res, 400, {
            code: 'INVALID_PHONE',
            error: 'Please enter a valid 10-digit mobile number'
          });
        }

        const rlKey = `patron_login:${clientIp}:${mobile}`;
        const rl = checkRateLimit(rlKey);
        if (!rl.allowed) {
          return sendJson(res, 429, {
            code: 'RATE_LIMITED',
            error: `Too many failed sign-in attempts. Retry in ${rl.remainingSeconds} seconds.`
          });
        }

        const patrons = readJsonFile(PATRONS_FILE, []);
        const patron = patrons.find((p) => normalizePhone10(p?.mobile || p?.phone || '') === mobile);
        const password = String(body.password || '');

        if (!patron || !verifyPatronOrAdminPassword(password, patron.passwordHash)) {
          recordRateLimitFailure(rlKey);
          return sendJson(res, 401, {
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid credentials'
          });
        }

        clearRateLimit(rlKey);
        const token = signPatronToken(patron);
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
          token
        });
      }

      // 8. Products API: GET, POST, DELETE
      if (pathname === '/api/products' || pathname.startsWith('/api/products/')) {
        if (req.method === 'GET') {
          const products = readJsonFile(PRODUCTS_FILE, []);
          return sendJson(res, 200, products);
        }

        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
          const admin = await authenticateAdminRequest(req);
          if (!admin) {
            return sendJson(res, 401, {
              success: false,
              error: 'Unauthorized: Administrator authentication required to modify catalog products.'
            });
          }
        }

        if (req.method === 'POST' || req.method === 'PUT') {
          const body = await parseBody(req, PRODUCT_JSON_BODY_LIMIT_BYTES);
          if (body?.__tooLarge) {
            return sendJson(res, 413, { success: false, error: 'Product payload exceeds maximum allowed size.' });
          }
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

          return await withResourceLock('products', async () => {
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

            const serialized = JSON.stringify(products, null, 2);
            atomicWriteFileSync(PRODUCTS_FILE, serialized);
            if (fs.existsSync(path.dirname(API_PRODUCTS_FILE))) {
              atomicWriteFileSync(API_PRODUCTS_FILE, serialized);
            }
            return sendJson(res, 200, { success: true, product: savedProduct });
          });
        }

        if (req.method === 'DELETE') {
          const id = decodeURIComponent(pathname.replace('/api/products/', ''));
          return await withResourceLock('products', async () => {
            const products = readJsonFile(PRODUCTS_FILE, []);
            const filtered = products.filter((p) => p.id !== id);
            const serialized = JSON.stringify(filtered, null, 2);
            atomicWriteFileSync(PRODUCTS_FILE, serialized);
            if (fs.existsSync(path.dirname(API_PRODUCTS_FILE))) {
              atomicWriteFileSync(API_PRODUCTS_FILE, serialized);
            }
            return sendJson(res, 200, { success: true });
          });
        }
      }

      // 9. Orders API: GET, POST, PUT
      if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) {
        if (req.method === 'GET') {
          const orders = readAllOrders();
          if (pathname === '/api/orders') {
            const filterUserId = parsedUrl.searchParams.get('userId')?.trim() || '';
            const filterEmail = parsedUrl.searchParams.get('email')?.trim().toLowerCase() || '';
            const filterPhoneDigits = normalizePhone10(parsedUrl.searchParams.get('phone')?.trim() || '');

            if (!filterUserId && !filterEmail && !filterPhoneDigits) {
              const admin = await authenticateAdminRequest(req);
              if (!admin) {
                return sendJson(res, 401, {
                  success: false,
                  error: 'Unauthorized: Administrator session required to list all orders.'
                });
              }
              return sendJson(res, 200, orders);
            }

            const customer = await authenticateCustomerRequest(req);
            if (!customer) {
              return sendJson(res, 401, {
                success: false,
                error: 'Authentication required to view customer orders.'
              });
            }

            if (!customer.isAdmin) {
              if (filterUserId && customer.uid && filterUserId !== customer.uid) {
                return sendJson(res, 403, { success: false, error: 'Forbidden: Cannot access another customer orders.' });
              }
              if (
                filterEmail &&
                customer.email &&
                !customer.email.endsWith('@phone.vidhyaajewellery.com') &&
                filterEmail !== customer.email
              ) {
                return sendJson(res, 403, { success: false, error: 'Forbidden: Email does not match signed-in account.' });
              }
              if (filterPhoneDigits && customer.phone10 && filterPhoneDigits !== customer.phone10) {
                return sendJson(res, 403, { success: false, error: 'Forbidden: Phone does not match signed-in account.' });
              }
            }

            const matched = orders.filter((o) => {
              if (!customer.isAdmin && !customerOwnsOrder(customer, o)) {
                return false;
              }
              if (filterUserId && o.userId && o.userId === filterUserId) return true;
              if (filterEmail && o.customerEmail && o.customerEmail.toLowerCase() === filterEmail) return true;
              if (filterPhoneDigits) {
                const ordDigits = normalizePhone10(o.customerPhone || o.shippingAddress?.phone || '');
                if (ordDigits && ordDigits === filterPhoneDigits) return true;
              }
              return Boolean(customer.isAdmin);
            });
            return sendJson(res, 200, matched);
          }

          const idOrNum = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const order = findOrderByIdentifier(orders, idOrNum);
          if (!order) {
            return sendJson(res, 404, { error: 'Order not found' });
          }

          const customer = await authenticateCustomerRequest(req);
          const canViewFull =
            Boolean(customer?.isAdmin) ||
            (customer && customerOwnsOrder(customer, order)) ||
            hasValidOrderReceiptToken(order, req);

          if (canViewFull) {
            return sendJson(res, 200, order);
          }
          return sendJson(res, 200, sanitizePublicOrderTracking(order));
        }

        if (pathname.includes('/confirm-payment') && req.method === 'POST') {
          const admin = await authenticateAdminRequest(req);
          if (!admin) {
            return sendJson(res, 401, {
              success: false,
              error: 'Unauthorized: Manual payment confirmation requires an administrator session.'
            });
          }
          const id = decodeURIComponent(pathname.replace('/api/orders/', '').replace('/confirm-payment', ''));
          return await withResourceLock('orders', async () => {
            const orders = readAllOrders();
            const target = findOrderByIdentifier(orders, id);
            if (!target) {
              return sendJson(res, 404, { success: false, error: 'Order not found' });
            }
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
          });
        }

        if ((pathname.includes('/customer-whatsapp-confirm') || pathname.includes('/whatsapp-confirm')) && req.method === 'POST') {
          const id = decodeURIComponent(
            pathname.replace('/api/orders/', '').replace('/customer-whatsapp-confirm', '').replace('/whatsapp-confirm', '')
          );
          const customer = await authenticateCustomerRequest(req);
          return await withResourceLock('orders', async () => {
            const orders = readAllOrders();
            const target = findOrderByIdentifier(orders, id);
            if (!target) {
              return sendJson(res, 404, { success: false, error: 'Order not found' });
            }

            const authorized =
              Boolean(customer?.isAdmin) ||
              (customer && customerOwnsOrder(customer, target)) ||
              hasValidOrderReceiptToken(target, req);

            if (!authorized) {
              return sendJson(res, 403, {
                success: false,
                error: 'Forbidden: Order verification token or patron session required.'
              });
            }

            if (target.whatsappCustomerConfirmed) {
              return sendJson(res, 200, { success: true, alreadyConfirmed: true, order: target });
            }

            const now = new Date().toISOString();
            target.whatsappCustomerConfirmed = true;
            target.whatsappCustomerConfirmedAt = now;
            target.updatedAt = now;
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
          });
        }

        if (req.method === 'POST') {
          const incoming = await parseBody(req);
          if (incoming?.__tooLarge) {
            return sendJson(res, 413, { success: false, error: 'Order payload exceeds maximum allowed size.' });
          }
          if (!incoming || (!incoming.id && !incoming.orderNumber)) {
            return sendJson(res, 400, { success: false, error: 'Order payload requires an id or orderNumber' });
          }

          const admin = await authenticateAdminRequest(req);
          const customer = await authenticateCustomerRequest(req);

          return await withResourceLock('orders', async () => {
            const orders = readAllOrders();
            const existing = findOrderByIdentifier(orders, incoming.id || incoming.orderNumber);

            if (existing) {
              const allowedUpdate =
                Boolean(admin) ||
                (customer && customerOwnsOrder(customer, existing)) ||
                hasValidOrderReceiptToken(existing, req);
              if (!allowedUpdate) {
                return sendJson(res, 403, {
                  success: false,
                  error: 'Forbidden: Order already exists and cannot be overwritten without authorization.'
                });
              }
            }

            if (!existing || (Array.isArray(incoming.items) && incoming.items.length > 0)) {
              const pricing = validateAndComputeOrderPricing(incoming, Boolean(admin));
              if (!pricing.valid) {
                return sendJson(res, 400, {
                  success: false,
                  code: pricing.code || 'INVALID_ORDER_PRICING',
                  error: pricing.error || 'Order pricing verification failed.'
                });
              }
              incoming.subtotal = pricing.subtotal;
              incoming.discount = pricing.discount;
              incoming.deliveryCharge = pricing.deliveryCharge;
              incoming.total = pricing.totalAmount;
              incoming.totalAmount = pricing.totalAmount;
              if (pricing.appliedPromo) {
                incoming.appliedPromo = pricing.appliedPromo;
              }
            }

            const payloadCopy = stripUntrustedOrderFields(incoming, Boolean(admin));
            if (!admin) {
              if (customer?.uid) {
                payloadCopy.userId = customer.uid;
              } else if (existing?.userId) {
                payloadCopy.userId = existing.userId;
              } else {
                delete payloadCopy.userId;
              }
            }
            if (!admin && existing?.paymentStatus === 'paid') {
              payloadCopy.paymentStatus = 'paid';
              payloadCopy.isPaid = true;
              payloadCopy.orderStatus = existing.orderStatus;
              payloadCopy.paidAt = existing.paidAt;
              payloadCopy.paymentVerifiedAt = existing.paymentVerifiedAt;
              payloadCopy.verifiedVia = existing.verifiedVia;
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
            return sendJson(res, 200, {
              success: true,
              order: savedOrder,
              receiptToken: computeOrderReceiptToken(savedOrder)
            });
          });
        }

        if (req.method === 'PUT') {
          const admin = await authenticateAdminRequest(req);
          if (!admin) {
            return sendJson(res, 401, {
              success: false,
              error: 'Unauthorized: Administrator session required to update order status.'
            });
          }

          const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const updates = await parseBody(req);
          if (updates?.__tooLarge) {
            return sendJson(res, 413, { success: false, error: 'Order update payload exceeds maximum allowed size.' });
          }
          if (!updates || typeof updates !== 'object') {
            return sendJson(res, 400, { success: false, error: 'Invalid JSON update payload' });
          }

          return await withResourceLock('orders', async () => {
            const orders = readAllOrders();
            const target = findOrderByIdentifier(orders, id);
            if (!target) {
              return sendJson(res, 404, { success: false, error: 'Order not found' });
            }

            const now = new Date().toISOString();
            const nextOrder = sanitizeServerOrder(
              {
                ...target,
                ...updates,
                updatedAt: now,
                ...(updates.paymentStatus === 'paid' && !target.paidAt
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
          });
        }
      }

      // 10. Cashfree Payments endpoints (real gateway calls & HMAC verification)
      if (pathname === '/api/payments/cashfree/status' && req.method === 'GET') {
        return sendJson(res, 200, getCashfreeStatusSummary(req));
      }

      if (pathname === '/api/admin/cashfree-config') {
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session token required.'
          });
        }
        if (req.method === 'GET') {
          return sendJson(res, 200, getCashfreeStatusSummary(req));
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (body?.__tooLarge) {
            return sendJson(res, 413, { success: false, error: 'Configuration payload exceeds maximum allowed size.' });
          }
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
            ...getCashfreeStatusSummary(req),
            message: result.message
          });
        }
      }

      if (pathname === '/api/payments/cashfree/create-order' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { success: false, error: 'Payment payload exceeds maximum allowed size.' });
        }
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { success: false, error: 'Invalid payment order payload.' });
        }

        const admin = await authenticateAdminRequest(req);
        const customer = await authenticateCustomerRequest(req);
        const isLiveDomain = isLiveProductionRequest(req);
        const rawOrderId = String(body.orderNumber || body.orderId || `VDH-${Date.now().toString().slice(-6)}`).trim();
        const gatewayOrderId = sanitizeGatewayOrderId(rawOrderId);
        if (!gatewayOrderId) {
          return sendJson(res, 400, { success: false, configured: true, error: 'Valid orderNumber is required.' });
        }

        const pricing = validateAndComputeOrderPricing(body, Boolean(admin));
        if (!pricing.valid) {
          return sendJson(res, 400, {
            success: false,
            configured: true,
            code: pricing.code || 'INVALID_ORDER_PRICING',
            error: pricing.error || 'Order pricing verification failed.'
          });
        }
        const orderAmount = pricing.totalAmount;

        if (orderAmount <= 0) {
          return sendJson(res, 400, {
            success: false,
            configured: true,
            error: 'Order amount must be greater than ₹0.'
          });
        }

        const directHostRaw = String(req.headers['host'] || '').split(',')[0].trim();
        const canonicalLiveHost = /^(?:www\.)?vidhyaajewellerystudio\.com(?::\d+)?$/i.test(directHostRaw)
          ? directHostRaw.replace(/:\d+$/, '').toLowerCase()
          : 'vidhyaajewellerystudio.com';
        const defaultOrigin = isLiveDomain
          ? `https://${canonicalLiveHost}`
          : directHostRaw
          ? `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim() === 'https' ? 'https' : 'http'}://${directHostRaw}`
          : 'http://localhost:3000';
        const defaultReturnUrl = `${defaultOrigin}/?view=checkout&cf_order_id={order_id}`;

        let validatedReturnUrl = defaultReturnUrl;
        if (body.returnUrl !== undefined && String(body.returnUrl).trim() !== '') {
          const candidateUrl = String(body.returnUrl).trim();
          let parsedReturn = null;
          try {
            parsedReturn = new URL(candidateUrl);
          } catch {
            parsedReturn = null;
          }
          if (!parsedReturn) {
            return sendJson(res, 400, {
              success: false,
              configured: true,
              error: 'Invalid returnUrl format.'
            });
          }
          if (isLiveDomain) {
            if (
              parsedReturn.protocol !== 'https:' ||
              !/^(?:www\.)?vidhyaajewellerystudio\.com$/i.test(parsedReturn.hostname)
            ) {
              return sendJson(res, 400, {
                success: false,
                configured: true,
                error: 'Invalid returnUrl for live production domain. Only HTTPS URLs on vidhyaajewellerystudio.com are permitted.'
              });
            }
          } else {
            const reqHostname = directHostRaw.replace(/:\d+$/, '').toLowerCase();
            if (
              !['http:', 'https:'].includes(parsedReturn.protocol) ||
              (reqHostname && parsedReturn.hostname.toLowerCase() !== reqHostname)
            ) {
              return sendJson(res, 400, {
                success: false,
                configured: true,
                error: 'Invalid returnUrl: must use http(s) and match the active host origin.'
              });
            }
          }
          validatedReturnUrl = candidateUrl;
        }

        let notifyUrl = String(body.notifyUrl || '').trim();
        if (!notifyUrl && isLiveDomain) {
          notifyUrl = `https://${canonicalLiveHost}/api/payments/cashfree/webhook`;
        } else if (notifyUrl && isLiveDomain) {
          try {
            const u = new URL(notifyUrl);
            if (u.protocol !== 'https:' || !/^(?:www\.)?vidhyaajewellerystudio\.com$/i.test(u.hostname)) {
              notifyUrl = `https://${canonicalLiveHost}/api/payments/cashfree/webhook`;
            }
          } catch {
            notifyUrl = `https://${canonicalLiveHost}/api/payments/cashfree/webhook`;
          }
        }

        const resolvedUserId = admin
          ? (body.userId || customer?.uid || undefined)
          : customer?.uid
          ? customer.uid
          : undefined;

        const conflictReason = await withResourceLock('orders', async () => {
          const orders = readAllOrders();
          const existing =
            findOrderByIdentifier(orders, rawOrderId) ||
            findOrderByIdentifier(orders, gatewayOrderId) ||
            (body.orderId ? findOrderByIdentifier(orders, String(body.orderId)) : null);
          if (existing) return 'existing';
          if (inflightCashfreeOrders.has(gatewayOrderId)) return 'inflight';
          inflightCashfreeOrders.add(gatewayOrderId);
          return null;
        });

        if (conflictReason) {
          return sendJson(res, 409, {
            success: false,
            code: 'ORDER_ALREADY_EXISTS',
            error:
              conflictReason === 'inflight'
                ? 'Payment session creation is already in progress for this order number. Please retry with a fresh order number.'
                : 'Order ID already exists and cannot be overwritten. Please initiate checkout with a fresh order number.'
          });
        }

        try {
          const cfResult = await createCashfreeOrder({
            orderId: gatewayOrderId,
            orderAmount,
            customerName: String(body.customerName || 'Valued Patron'),
            customerEmail: String(body.customerEmail || 'patron@vidhyaajewellery.com'),
            customerPhone: String(body.customerPhone || '9758350524'),
            returnUrl: validatedReturnUrl,
            notifyUrl,
            paymentMethods: body.paymentMethods || 'upi,cc,dc,nb',
            orderNote: body.orderNote || `VIDHYAA Jewellery Studio Order ${rawOrderId}`,
            isLiveDomain
          });

          if (!cfResult.success || !cfResult.paymentSessionId) {
            const statusCode = cfResult.blockedOnLiveDomain ? 403 : cfResult.configured === false ? 503 : 502;
            return sendJson(res, statusCode, {
              success: false,
              configured: cfResult.configured,
              blockedOnLiveDomain: cfResult.blockedOnLiveDomain,
              mode: cfResult.mode,
              env: cfResult.env,
              error: cfResult.error || 'Failed to initialize Cashfree checkout session.'
            });
          }

          return await withResourceLock('orders', async () => {
            const orders = readAllOrders();
            const existing =
              findOrderByIdentifier(orders, rawOrderId) ||
              findOrderByIdentifier(orders, gatewayOrderId);
            if (existing) {
              return sendJson(res, 409, {
                success: false,
                code: 'ORDER_ALREADY_EXISTS',
                error: 'Order ID already exists and cannot be overwritten. Please retry with a fresh order number.'
              });
            }

            const now = new Date().toISOString();
            const paymentEnv = cfResult.env || (cfResult.mode === 'production' ? 'PRODUCTION' : 'SANDBOX');
            const pendingOrder = sanitizeServerOrder({
              id: `order_${gatewayOrderId}`,
              orderNumber: rawOrderId,
              gatewayOrderId: cfResult.orderId || gatewayOrderId,
              cfOrderId: cfResult.cfOrderId,
              userId: resolvedUserId,
              customerName: body.customerName,
              customerEmail: body.customerEmail,
              customerPhone: body.customerPhone,
              shippingAddress: body.shippingAddress,
              items: Array.isArray(body.items) ? body.items : [],
              subtotal: pricing.subtotal,
              discount: pricing.discount,
              deliveryCharge: pricing.deliveryCharge,
              totalAmount: orderAmount,
              ...(pricing.appliedPromo ? { appliedPromo: pricing.appliedPromo } : {}),
              giftItem: body.giftItem,
              paymentMethod: body.paymentMethod || 'Cashfree Online Payment',
              paymentStatus: 'pending',
              orderStatus: 'Pending',
              paymentEnv,
              isTestOrder: paymentEnv === 'SANDBOX',
              createdAt: now,
              updatedAt: now
            });

            orders.unshift(pendingOrder);
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
              env: paymentEnv,
              isTestOrder: paymentEnv === 'SANDBOX',
              receiptToken: computeOrderReceiptToken(pendingOrder),
              order: pendingOrder
            });
          });
        } finally {
          inflightCashfreeOrders.delete(gatewayOrderId);
        }
      }

      if (pathname === '/api/payments/cashfree/verify-order' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body?.__tooLarge) {
          return sendJson(res, 413, { success: false, isPaid: false, error: 'Verification payload exceeds maximum allowed size.' });
        }
        const orderId = String(body?.orderId || body?.order_id || '').trim();
        if (!orderId) {
          return sendJson(res, 400, {
            success: false,
            isPaid: false,
            error: 'orderId is required for payment verification.'
          });
        }

        const isLiveDomain = isLiveProductionRequest(req);
        const customer = await authenticateCustomerRequest(req);

        const initialOrders = readAllOrders();
        const initialTarget = findOrderByIdentifier(initialOrders, orderId);

        if (
          initialTarget &&
          initialTarget.paymentStatus === 'paid' &&
          (initialTarget.verifiedVia === 'cashfree_api' || initialTarget.verifiedVia === 'cashfree_webhook')
        ) {
          const canViewFull =
            Boolean(customer?.isAdmin) ||
            (customer && customerOwnsOrder(customer, initialTarget)) ||
            hasValidOrderReceiptToken(initialTarget, req);
          const envStr = initialTarget.paymentEnv || 'PRODUCTION';

          return sendJson(res, 200, {
            success: true,
            isPaid: true,
            alreadyVerified: true,
            orderId: initialTarget.gatewayOrderId || initialTarget.orderNumber,
            orderStatus: 'PAID',
            orderAmount: initialTarget.verifiedAmount ?? initialTarget.totalAmount,
            cfOrderId: initialTarget.cfOrderId,
            paymentMethod: initialTarget.paymentMethod || 'Cashfree Online Payment',
            cardNetwork: initialTarget.cardNetwork,
            cardType: initialTarget.cardType,
            env: envStr,
            mode: String(envStr).toLowerCase(),
            isTestOrder: Boolean(initialTarget.isTestOrder),
            paymentDetails: {
              cfPaymentId: initialTarget.paymentId,
              paymentStatus: 'SUCCESS',
              paymentAmount: initialTarget.verifiedAmount ?? initialTarget.totalAmount,
              paymentCurrency: initialTarget.currency || 'INR',
              paymentMethod: initialTarget.paymentMethod || 'Cashfree Online Payment',
              cardNetwork: initialTarget.cardNetwork,
              cardType: initialTarget.cardType,
              paymentTime: initialTarget.paidAt || initialTarget.paymentVerifiedAt
            },
            ...(canViewFull ? { receiptToken: computeOrderReceiptToken(initialTarget) } : {}),
            order: canViewFull ? initialTarget : sanitizePublicOrderTracking(initialTarget)
          });
        }

        const expectedAmount = initialTarget
          ? Number(initialTarget.totalAmount)
          : body?.expectedAmount !== undefined
          ? Number(body.expectedAmount)
          : undefined;
        const verification = await verifyCashfreeOrder(orderId, {
          expectedAmount,
          expectedCurrency: 'INR',
          isLiveDomain
        });

        if (verification.blockedOnLiveDomain) {
          return sendJson(res, 403, verification);
        }

        return await withResourceLock('orders', async () => {
          const orders = readAllOrders();
          const target = findOrderByIdentifier(orders, orderId);

          // Concurrent idempotency guard: check again under lock in case webhook completed first
          if (
            target &&
            target.paymentStatus === 'paid' &&
            (target.verifiedVia === 'cashfree_api' || target.verifiedVia === 'cashfree_webhook')
          ) {
            const canViewFull =
              Boolean(customer?.isAdmin) ||
              (customer && customerOwnsOrder(customer, target)) ||
              hasValidOrderReceiptToken(target, req);
            const envStr = target.paymentEnv || 'PRODUCTION';
            return sendJson(res, 200, {
              success: true,
              isPaid: true,
              alreadyVerified: true,
              orderId: target.gatewayOrderId || target.orderNumber,
              orderStatus: 'PAID',
              orderAmount: target.verifiedAmount ?? target.totalAmount,
              cfOrderId: target.cfOrderId,
              paymentMethod: target.paymentMethod || 'Cashfree Online Payment',
              cardNetwork: target.cardNetwork,
              cardType: target.cardType,
              env: envStr,
              mode: String(envStr).toLowerCase(),
              isTestOrder: Boolean(target.isTestOrder),
              paymentDetails: {
                cfPaymentId: target.paymentId,
                paymentStatus: 'SUCCESS',
                paymentAmount: target.verifiedAmount ?? target.totalAmount,
                paymentCurrency: target.currency || 'INR',
                paymentMethod: target.paymentMethod || 'Cashfree Online Payment',
                cardNetwork: target.cardNetwork,
                cardType: target.cardType,
                paymentTime: target.paidAt || target.paymentVerifiedAt
              },
              ...(canViewFull ? { receiptToken: computeOrderReceiptToken(target) } : {}),
              order: canViewFull ? target : sanitizePublicOrderTracking(target)
            });
          }

          const now = new Date().toISOString();
          const paymentEnv = verification.env || target?.paymentEnv || 'PRODUCTION';
          const isTestOrder = paymentEnv === 'SANDBOX';

          if (verification.isPaid) {
            let cleanOrderData = !target
              ? stripUntrustedOrderFields(body?.orderData, Boolean(customer?.isAdmin))
              : {};
            if (!target && body?.orderData && Array.isArray(body.orderData.items) && body.orderData.items.length > 0) {
              const ordPricing = validateAndComputeOrderPricing(body.orderData, Boolean(customer?.isAdmin));
              if (!ordPricing.valid) {
                return sendJson(res, 400, {
                  success: false,
                  isPaid: false,
                  code: ordPricing.code || 'INVALID_ORDER_PRICING',
                  error: ordPricing.error || 'Order pricing verification failed.'
                });
              }
              cleanOrderData.subtotal = ordPricing.subtotal;
              cleanOrderData.discount = ordPricing.discount;
              cleanOrderData.deliveryCharge = ordPricing.deliveryCharge;
              if (ordPricing.appliedPromo) cleanOrderData.appliedPromo = ordPricing.appliedPromo;
            }
            if (!target && !customer?.isAdmin) {
              delete cleanOrderData.userId;
              if (customer?.uid) cleanOrderData.userId = customer.uid;
            }
            const base = target || {
              id: `order_${sanitizeGatewayOrderId(orderId)}`,
              orderNumber: orderId,
              totalAmount: verification.orderAmount || expectedAmount || 0,
              subtotal: verification.orderAmount || expectedAmount || 0,
              createdAt: now
            };
            const paidOrder = sanitizeServerOrder(
              {
                ...cleanOrderData,
                ...base,
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
                paymentEnv,
                isTestOrder,
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

            const canIssueToken =
              Boolean(customer?.isAdmin) ||
              (customer && customerOwnsOrder(customer, paidOrder)) ||
              hasValidOrderReceiptToken(paidOrder, req);

            return sendJson(res, 200, {
              ...verification,
              paymentMethod: paidOrder.paymentMethod,
              cardNetwork: paidOrder.cardNetwork,
              cardType: paidOrder.cardType,
              env: paymentEnv,
              mode: String(paymentEnv).toLowerCase(),
              isTestOrder,
              ...(canIssueToken ? { receiptToken: computeOrderReceiptToken(paidOrder) } : {}),
              order: canIssueToken ? paidOrder : sanitizePublicOrderTracking(paidOrder)
            });
          }

          if (target && verification.isFailed) {
            const failedOrder = sanitizeServerOrder(
              {
                ...target,
                paymentStatus: 'failed',
                isPaid: false,
                orderStatus: 'Pending',
                paymentEnv,
                isTestOrder,
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
              isTestOrder,
              order: sanitizePublicOrderTracking(failedOrder)
            });
          }

          if (target) {
            const pendingOrder = sanitizeServerOrder(
              {
                ...target,
                paymentStatus: target.paymentStatus === 'paid' ? 'paid' : 'pending',
                isPaid: target.paymentStatus === 'paid',
                cfOrderId: verification.cfOrderId || target.cfOrderId,
                paymentEnv,
                isTestOrder,
                updatedAt: now
              },
              target
            );
            const idx = orders.findIndex((o) => o.id === target.id);
            if (idx >= 0) orders[idx] = pendingOrder;
            writeAllOrders(orders);
            return sendJson(res, 200, {
              ...verification,
              isTestOrder,
              order: sanitizePublicOrderTracking(pendingOrder)
            });
          }

          return sendJson(res, verification.success ? 200 : 502, { ...verification, isTestOrder });
        });
      }

      if ((pathname === '/api/payments/webhook' || pathname === '/api/payments/cashfree/webhook') && req.method === 'POST') {
        let rawBuffer;
        try {
          rawBuffer = await readRawBody(req, 2 * 1024 * 1024);
        } catch {
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

        const creds = getCashfreeCredentials();
        const paymentEnv = creds.env || 'PRODUCTION';
        const isTestOrder = paymentEnv === 'SANDBOX';

        return await withResourceLock('orders', async () => {
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
                  paymentEnv,
                  isTestOrder,
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
                paymentEnv,
                isTestOrder,
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
                paymentEnv,
                isTestOrder,
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
                paymentEnv,
                isTestOrder,
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
        });
      }

      // 11. Configuration endpoints & Admin WhatsApp / SMS diagnostic (admin only)
      if (pathname === '/api/admin/whatsapp-status') {
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session required.'
          });
        }
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
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session required.'
          });
        }
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
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session required.'
          });
        }
        if (req.method === 'GET') {
          return sendJson(res, 200, readSmsConfigSafe().summary);
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (!body || typeof body !== 'object') {
            return sendJson(res, 400, { success: false, error: 'Invalid SMS config payload.' });
          }
          const current = readSmsConfigSafe().raw;
          const updated = {
            ...current,
            ...(body.fast2smsApiKey !== undefined ? { fast2smsApiKey: String(body.fast2smsApiKey).trim() } : {}),
            ...(body.twofactorApiKey !== undefined ? { twofactorApiKey: String(body.twofactorApiKey).trim() } : {}),
            ...(body.msg91AuthKey !== undefined ? { msg91AuthKey: String(body.msg91AuthKey).trim() } : {}),
            ...(body.msg91TemplateId !== undefined ? { msg91TemplateId: String(body.msg91TemplateId).trim() } : {}),
            ...(body.twilioAccountSid !== undefined ? { twilioAccountSid: String(body.twilioAccountSid).trim() } : {}),
            ...(body.twilioAuthToken !== undefined ? { twilioAuthToken: String(body.twilioAuthToken).trim() } : {}),
            ...(body.twilioPhoneNumber !== undefined ? { twilioPhoneNumber: String(body.twilioPhoneNumber).trim() } : {}),
            updatedAt: new Date().toISOString()
          };
          const targetPath = resolveSmsConfigPath();
          if (!targetPath) {
            return sendJson(res, 500, {
              success: false,
              error: 'Cannot access outside-webroot .admin-secrets directory. Refusing insecure webroot secrets write.'
            });
          }
          atomicWriteFileSync(targetPath, JSON.stringify(updated, null, 2));
          try { fs.chmodSync(targetPath, 0o600); } catch {}
          return sendJson(res, 200, readSmsConfigSafe().summary);
        }
      }

      if (pathname === '/api/admin/test-sms' && req.method === 'POST') {
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Administrator session required.'
          });
        }
        const cfg = readSmsConfigSafe().raw;
        const body = await parseBody(req);
        const mobile = String(body?.phoneNumber || body?.mobile || '').trim();
        if (!mobile || mobile.length < 8) {
          return sendJson(res, 400, { success: false, error: 'Valid mobile number required.' });
        }
        const hasGateway = Boolean(
          cfg.fast2smsApiKey ||
          cfg.twofactorApiKey ||
          (cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioPhoneNumber)
        );
        if (!hasGateway) {
          return sendJson(res, 400, {
            success: false,
            provider: 'none',
            error: 'No SMS gateway credentials configured on server.'
          });
        }
        return sendJson(res, 200, {
          success: true,
          provider: cfg.twilioAccountSid ? 'twilio' : cfg.fast2smsApiKey ? 'fast2sms' : 'twofactor',
          phoneNumber: mobile,
          message: 'SMS gateway credentials validated.'
        });
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

      // 11c. Read-only inventory of existing image assets on disk in /products and /categories
      if (pathname === '/api/media/available' && req.method === 'GET') {
        const productImages = new Set();
        const categoryImages = new Set();
        const imgExtRe = /\.(?:jpg|jpeg|png|webp|gif|avif|svg)$/i;

        for (const dir of [PRODUCTS_MEDIA_DIR, DIST_PRODUCTS_MEDIA_DIR]) {
          if (fs.existsSync(dir)) {
            for (const entry of fs.readdirSync(dir)) {
              const full = path.join(dir, entry);
              if (imgExtRe.test(entry) && fs.statSync(full).isFile()) {
                productImages.add(`/products/${entry}`);
              }
            }
          }
        }
        if (fs.existsSync(PRODUCTS_UPLOAD_MEDIA_DIR)) {
          for (const entry of fs.readdirSync(PRODUCTS_UPLOAD_MEDIA_DIR)) {
            const full = path.join(PRODUCTS_UPLOAD_MEDIA_DIR, entry);
            if (imgExtRe.test(entry) && fs.statSync(full).isFile()) {
              productImages.add(`/products/uploads/${entry}`);
            }
          }
        }
        for (const dir of [CATEGORIES_MEDIA_DIR, DIST_CATEGORIES_MEDIA_DIR]) {
          if (fs.existsSync(dir)) {
            for (const entry of fs.readdirSync(dir)) {
              const full = path.join(dir, entry);
              if (imgExtRe.test(entry) && fs.statSync(full).isFile()) {
                categoryImages.add(`/categories/${entry}`);
              }
            }
          }
        }
        return sendJson(res, 200, {
          success: true,
          productImages: Array.from(productImages).sort(),
          categoryImages: Array.from(categoryImages).sort()
        });
      }

      // 12. Product & Category Video Upload: POST /api/videos/upload or /api/videos/upload.php
      if ((pathname === '/api/videos/upload' || pathname === '/api/videos/upload.php') && req.method === 'POST') {
        const admin = await authenticateAdminRequest(req);
        if (!admin) {
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
