import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

export function handleApiMiddleware(req, res, next) {
  const rawUrl = req.url || '';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname.replace(/\/+$/, ''); // normalize trailing slash

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
          const orders = readJsonFile(ORDERS_FILE, []);
          if (pathname === '/api/orders') {
            return sendJson(res, 200, orders);
          }
          const idOrNum = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const order = orders.find((o) => o.id === idOrNum || o.orderNumber === idOrNum);
          if (order) {
            return sendJson(res, 200, order);
          }
          return sendJson(res, 404, { error: 'Order not found' });
        }

        if (pathname.includes('/confirm-payment') && req.method === 'POST') {
          const id = decodeURIComponent(pathname.replace('/api/orders/', '').replace('/confirm-payment', ''));
          const orders = readJsonFile(ORDERS_FILE, []);
          const target = orders.find((o) => o.id === id || o.orderNumber === id);
          if (target) {
            target.paymentStatus = 'paid';
            target.orderStatus = 'Confirmed';
            target.confirmedAt = new Date().toISOString();
            target.updatedAt = new Date().toISOString();
            target.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(target);
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
              fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            }
            return sendJson(res, 200, { success: true, order: target });
          }
          return sendJson(res, 404, { success: false, error: 'Order not found' });
        }

        if ((pathname.includes('/customer-whatsapp-confirm') || pathname.includes('/whatsapp-confirm')) && req.method === 'POST') {
          const id = decodeURIComponent(pathname.replace('/api/orders/', '').replace('/customer-whatsapp-confirm', '').replace('/whatsapp-confirm', ''));
          const orders = readJsonFile(ORDERS_FILE, []);
          const target = orders.find((o) => o.id === id || o.orderNumber === id);
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
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
              fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            }
            return sendJson(res, 200, { success: true, order: target });
          }
          return sendJson(res, 404, { success: false, error: 'Order not found' });
        }

        if (req.method === 'POST') {
          const incoming = await parseBody(req);
          if (!incoming || !incoming.id) {
            return sendJson(res, 400, { success: false, error: 'Order payload requires an id' });
          }

          // If payment is paid, automatically mark order as Confirmed
          const isPaid = incoming.paymentStatus === 'paid' || incoming.isPaid === true || incoming.orderStatus === 'Confirmed';
          if (isPaid) {
            incoming.paymentStatus = 'paid';
            incoming.orderStatus = 'Confirmed';
            if (!incoming.confirmedAt) incoming.confirmedAt = new Date().toISOString();
          } else {
            if (!incoming.paymentStatus) incoming.paymentStatus = 'pending';
            if (!incoming.orderStatus) incoming.orderStatus = 'Pending';
          }

          const orders = readJsonFile(ORDERS_FILE, []);
          const existingIdx = orders.findIndex((o) => o.id === incoming.id || o.orderNumber === incoming.orderNumber);
          let savedOrder = incoming;
          if (existingIdx >= 0) {
            savedOrder = { ...orders[existingIdx], ...incoming, updatedAt: new Date().toISOString() };
            orders[existingIdx] = savedOrder;
          } else {
            savedOrder = { ...incoming, createdAt: incoming.createdAt || new Date().toISOString() };
            orders.unshift(savedOrder);
          }

          // If paid, attach click-to-chat WhatsApp URL for customer or owner reference
          if (savedOrder.paymentStatus === 'paid') {
            savedOrder.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(savedOrder);
          }

          fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
          if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
            fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
          }
          return sendJson(res, 200, { success: true, order: savedOrder });
        }

        if (req.method === 'PUT') {
          const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
          const updates = await parseBody(req);
          const orders = readJsonFile(ORDERS_FILE, []);
          const target = orders.find((o) => o.id === id || o.orderNumber === id);
          if (target) {
            Object.assign(target, updates, { updatedAt: new Date().toISOString() });
            if (target.paymentStatus === 'paid') {
              target.orderStatus = 'Confirmed';
              target.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(target);
            }
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
              fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            }
            return sendJson(res, 200, { success: true, order: target });
          }
          return sendJson(res, 404, { success: false, error: 'Order not found' });
        }
      }

      // 10. Cashfree Payments endpoints
      if (pathname === '/api/payments/cashfree/status') {
        return sendJson(res, 200, { success: true, configured: false });
      }

      if (pathname === '/api/payments/cashfree/create-order' && req.method === 'POST') {
        const body = await parseBody(req);
        const orderId = body?.orderId || `VDH_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
        return sendJson(res, 200, {
          success: true,
          order_id: orderId,
          payment_session_id: `mock_session_${Date.now()}`
        });
      }

      if (pathname === '/api/payments/cashfree/verify-order' && req.method === 'POST') {
        const body = await parseBody(req);
        const orderId = body?.orderId || body?.order_id;
        const orders = readJsonFile(ORDERS_FILE, []);
        const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (target) {
          target.paymentStatus = 'paid';
          target.orderStatus = 'Confirmed';
          target.paymentVerifiedAt = new Date().toISOString();
          target.updatedAt = new Date().toISOString();
          target.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(target);
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
          if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
            fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
          }
          return sendJson(res, 200, {
            success: true,
            isPaid: true,
            orderId: orderId,
            order: target
          });
        }
        return sendJson(res, 200, {
          success: true,
          isPaid: true,
          orderId: orderId
        });
      }

      if ((pathname === '/api/payments/webhook' || pathname === '/api/payments/cashfree/webhook') && req.method === 'POST') {
        const payload = await parseBody(req);
        const orderId = payload?.data?.order?.order_id || payload?.orderId || payload?.order_id;
        if (orderId) {
          const orders = readJsonFile(ORDERS_FILE, []);
          const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
          if (target) {
            target.paymentStatus = 'paid';
            target.orderStatus = 'Confirmed';
            target.paymentVerifiedAt = new Date().toISOString();
            target.updatedAt = new Date().toISOString();
            target.whatsappClickToChatUrl = getOwnerWhatsAppClickToChatLink(target);
            fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            if (fs.existsSync(path.dirname(API_ORDERS_FILE))) {
              fs.writeFileSync(API_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
            }
          }
        }
        return sendJson(res, 200, { success: true, received: true });
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

      if (pathname === '/api/admin/cashfree-config' || pathname === '/api/admin/sms-config') {
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/admin/test-sms' && req.method === 'POST') {
        return sendJson(res, 200, { success: true });
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
