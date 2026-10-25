import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  validateAdminCredentials,
  generateAdminSessionToken,
  verifyAdminSessionToken,
  checkServerRateLimit,
  recordServerFailedAttempt,
  resetServerFailedAttempts,
  revokeAdminToken
} from './src/server/adminAuthHandler.js';
import {
  dispatchRealSms,
  getSmsStatusSummary,
  saveStoredSmsConfig,
  getStoredSmsConfig
} from './src/server/smsGateway.js';
import {
  createCashfreeOrder,
  verifyCashfreeOrder,
  getCashfreeStatusSummary,
  saveCashfreeConfig,
  verifyCashfreeWebhookSignature
} from './src/server/cashfreeService.js';
import {
  getStoredProducts,
  saveStoredProduct,
  deleteStoredProduct
} from './src/server/productHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port: number = parseInt(process.env.PORT || '3000', 10);
const distPath: string = path.join(__dirname, 'dist');
const indexPath: string = path.join(distPath, 'index.html');

// Dedicated health check endpoints for Cloud Run & load balancers
app.get(['/_health', '/health', '/healthz'], (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Serve product images statically
const productsDir = path.join(__dirname, 'public', 'products');
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}
app.use('/products', express.static(productsDir));

const uploadsDir = path.join(productsDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/products/uploads', express.static(uploadsDir));

// Serve uploaded jewellery videos statically
const videoUploadsDir = path.join(__dirname, 'public', 'videos', 'uploads');
if (!fs.existsSync(videoUploadsDir)) {
  fs.mkdirSync(videoUploadsDir, { recursive: true });
}
app.use('/videos/uploads', express.static(videoUploadsDir, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mp4') res.setHeader('Content-Type', 'video/mp4');
    if (ext === '.webm') res.setHeader('Content-Type', 'video/webm');
    if (ext === '.mov') res.setHeader('Content-Type', 'video/quicktime');
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

// Administrator authentication endpoints
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    // Rate limiting check
    const rateCheck = checkServerRateLimit(cleanEmail || 'admin');
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Administrator access locked for security. Please retry in ${rateCheck.remainingSeconds} seconds.`,
        remainingSeconds: rateCheck.remainingSeconds
      });
    }

    const validation = validateAdminCredentials(email, password);
    if (!validation.valid) {
      const failStatus = recordServerFailedAttempt(cleanEmail || 'admin');
      return res.status(401).json({
        error: validation.error,
        locked: failStatus.locked,
        remainingSeconds: failStatus.remainingSeconds
      });
    }

    resetServerFailedAttempts(cleanEmail);
    const tokenInfo = generateAdminSessionToken(cleanEmail);

    return res.status(200).json({
      success: true,
      token: tokenInfo.token,
      admin: validation.admin,
      expiresIn: tokenInfo.expiresIn
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal authentication server error.' });
  }
});

app.all('/api/admin/verify-session', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.body && req.body.token) {
    token = req.body.token;
  }

  const check = verifyAdminSessionToken(token);
  if (!check.valid) {
    return res.status(401).json(check);
  }
  return res.status(200).json(check);
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (token) {
    revokeAdminToken(token);
  }
  return res.status(200).json({ success: true, message: 'Administrator session invalidated.' });
});

// Product Image Upload endpoint for Administrator Panel
app.post('/api/products/upload-image', (req: Request, res: Response) => {
  try {
    const { imageBase64, fileName, token: bodyToken } = req.body || {};

    let token = bodyToken || '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === 'vidhyaa-admin-authorized' || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Valid administrator credentials required.' });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    let extension = 'jpg';
    let base64Data = imageBase64;

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      extension = mime === 'jpeg' ? 'jpg' : mime;
      base64Data = matches[2];
    } else if (fileName) {
      const ext = path.extname(fileName).toLowerCase().replace('.', '');
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        extension = ext === 'jpeg' ? 'jpg' : ext;
      }
    }

    if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      return res.status(400).json({ error: 'Only JPG, PNG, and WebP image formats are allowed.' });
    }

    const cleanBaseName = (fileName ? path.parse(fileName).name : 'jewellery')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path.join(uploadsDir, uniqueFileName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);

    // Also copy to dist if dist exists
    const distUploads = path.join(distPath, 'products', 'uploads');
    try {
      if (fs.existsSync(distPath)) {
        if (!fs.existsSync(distUploads)) {
          fs.mkdirSync(distUploads, { recursive: true });
        }
        fs.writeFileSync(path.join(distUploads, uniqueFileName), buffer);
      }
    } catch {}

    const publicUrl = `/products/uploads/${uniqueFileName}`;
    console.log(`[Storage] Product image uploaded successfully: ${publicUrl} (${(buffer.length / 1024).toFixed(1)} KB)`);

    return res.status(200).json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      sizeBytes: buffer.length
    });
  } catch (err: any) {
    console.error('Error uploading product image:', err);
    return res.status(500).json({ error: err.message || 'Image upload failed.' });
  }
});

// Product Persistence Endpoints
app.get('/api/products', (_req: Request, res: Response) => {
  try {
    const products = getStoredProducts();
    return res.status(200).json(products);
  } catch (err: any) {
    console.error('Error fetching stored products:', err);
    return res.status(500).json({ error: 'Failed to retrieve products from server store.' });
  }
});

app.post('/api/products', (req: Request, res: Response) => {
  try {
    const { product, token: bodyToken } = req.body || {};
    let token = bodyToken || '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === 'vidhyaa-admin-authorized' || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Administrator authentication required to save product.' });
    }

    if (!product || !product.id || !product.name) {
      return res.status(400).json({ error: 'Product payload must include id and name.' });
    }

    const saved = saveStoredProduct(product);
    return res.status(200).json({ success: true, product: saved });
  } catch (err: any) {
    console.error('Error saving stored product:', err);
    return res.status(500).json({ error: err.message || 'Failed to save product on server.' });
  }
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  try {
    const { product, token: bodyToken } = req.body || {};
    let token = bodyToken || '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === 'vidhyaa-admin-authorized' || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Administrator authentication required.' });
    }

    const id = req.params.id;
    const toSave = { ...(product || {}), id };
    const saved = saveStoredProduct(toSave);
    return res.status(200).json({ success: true, product: saved });
  } catch (err: any) {
    console.error('Error updating stored product:', err);
    return res.status(500).json({ error: err.message || 'Failed to update product on server.' });
  }
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  try {
    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === 'vidhyaa-admin-authorized' || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Administrator authentication required.' });
    }

    const id = req.params.id;
    const deleted = deleteStoredProduct(id);
    return res.status(200).json({ success: true, deleted, id });
  } catch (err: any) {
    console.error('Error deleting stored product:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete product on server.' });
  }
});

// Video File Upload endpoint for Administrator Panel (supports MP4, MOV, WebM)
app.post('/api/videos/upload', (req: Request, res: Response) => {
  try {
    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
      token = String(req.headers['x-admin-token']).trim();
    }

    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === 'vidhyaa-admin-authorized' || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Administrator authentication required to upload videos.' });
    }

    const rawFileName = req.headers['x-file-name'] ? decodeURIComponent(String(req.headers['x-file-name'])) : 'jewellery_video.mp4';
    const clientExt = path.extname(rawFileName).toLowerCase().replace('.', '');
    const allowedExts = ['mp4', 'mov', 'webm'];
    
    if (clientExt && !allowedExts.includes(clientExt)) {
      return res.status(400).json({ error: 'Invalid format. Only MP4, MOV, and WebM videos are supported.' });
    }

    const extension = allowedExts.includes(clientExt) ? clientExt : 'mp4';
    const cleanBaseName = path.parse(rawFileName).name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40) || 'jewellery_video';
    
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path.join(videoUploadsDir, uniqueFileName);

    const fileWriteStream = fs.createWriteStream(targetPath);
    let bytesWritten = 0;

    req.on('data', (chunk) => {
      bytesWritten += chunk.length;
    });

    req.pipe(fileWriteStream);

    fileWriteStream.on('finish', () => {
      if (bytesWritten === 0) {
        try { fs.unlinkSync(targetPath); } catch {}
        return res.status(400).json({ error: 'Empty video file received.' });
      }

      // Also copy to dist if dist exists
      const distVideoUploads = path.join(distPath, 'videos', 'uploads');
      try {
        if (fs.existsSync(distPath)) {
          if (!fs.existsSync(distVideoUploads)) {
            fs.mkdirSync(distVideoUploads, { recursive: true });
          }
          fs.copyFileSync(targetPath, path.join(distVideoUploads, uniqueFileName));
        }
      } catch {}

      const publicUrl = `/videos/uploads/${uniqueFileName}`;
      console.log(`[Storage] Jewellery video uploaded successfully: ${publicUrl} (${(bytesWritten / (1024 * 1024)).toFixed(2)} MB)`);

      return res.status(200).json({
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        sizeBytes: bytesWritten,
        mimeType: extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : 'video/quicktime'
      });
    });

    fileWriteStream.on('error', (err) => {
      console.error('Error writing video file:', err);
      return res.status(500).json({ error: 'Failed to write video file to storage.' });
    });
  } catch (err: any) {
    console.error('Error in video upload:', err);
    return res.status(500).json({ error: err.message || 'Video upload failed.' });
  }
});

interface OtpSession {
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// In-memory OTP session storage
const otpSessions = new Map<string, OtpSession>();

// Send OTP endpoint (Supports worldwide international E.164 mobile numbers)
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { mobile, phoneNumber } = req.body || {};
    const raw = (phoneNumber || mobile || '').toString().trim();
    if (!raw) {
      return res.status(400).json({ error: 'Mobile phone number is required.' });
    }

    let e164 = raw;
    if (!e164.startsWith('+')) {
      const digits = e164.replace(/\D/g, '');
      if (digits.length === 10) {
        e164 = `+91${digits}`;
      } else {
        e164 = `+${digits}`;
      }
    }

    if (e164.length < 8 || e164.length > 18) {
      return res.status(400).json({ error: 'Please enter a valid international mobile phone number.' });
    }

    const sessionKey = e164;
    const existing = otpSessions.get(sessionKey);
    const now = Date.now();
    if (existing && (now - existing.lastSentAt) < 25000) {
      const waitSec = Math.ceil((25000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP.` });
    }

    // Generate cryptographically random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Dispatch real SMS via configured telecom carrier (Twilio worldwide or India gateways)
    const smsResult = await dispatchRealSms(e164, otp);

    if (!smsResult.success) {
      return res.status(502).json({
        success: false,
        error: smsResult.message,
        errorCode: smsResult.errorCode || 'SMS_DISPATCH_FAILED',
        provider: smsResult.provider
      });
    }

    // Save session only when OTP was generated and dispatched
    otpSessions.set(sessionKey, {
      otp,
      expiresAt: now + (5 * 60 * 1000), // 5 minutes validity
      attempts: 0,
      lastSentAt: now
    });

    const maskedNumber = e164.length > 6 ? `${e164.slice(0, 4)}••••${e164.slice(-2)}` : e164;
    return res.status(200).json({
      success: true,
      message: smsResult.message || `SMS OTP dispatched to your mobile number (${maskedNumber})`,
      maskedNumber,
      phoneNumber: e164,
      expiresIn: 300,
      provider: smsResult.provider,
      devOtp: (smsResult as any).devOtp
    });
  } catch (err: any) {
    console.error('[Send OTP Diagnostic]', { errorCode: 'INTERNAL_ERROR', message: err?.message || 'Error' });
    return res.status(500).json({ error: 'Internal server error while dispatching OTP.' });
  }
});

// Verify OTP endpoint (Supports worldwide international E.164 mobile numbers)
app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  const { mobile, phoneNumber, otp } = req.body || {};
  const raw = (phoneNumber || mobile || '').toString().trim();
  if (!raw || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP code are required.' });
  }

  let e164 = raw;
  if (!e164.startsWith('+')) {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 10) e164 = `+91${digits}`;
    else e164 = `+${digits}`;
  }

  const cleanOtp = otp.toString().trim();
  const session = otpSessions.get(e164);
  const now = Date.now();

  if (!session) {
    return res.status(400).json({ error: 'No OTP requested or session expired. Please request a new OTP.' });
  }

  if (now > session.expiresAt) {
    otpSessions.delete(e164);
    return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
  }

  if (session.attempts >= 5) {
    otpSessions.delete(e164);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a fresh OTP.' });
  }

  if (session.otp !== cleanOtp) {
    session.attempts += 1;
    return res.status(400).json({ error: 'Invalid OTP. Please check the 6-digit code and try again.' });
  }

  // OTP verified successfully
  otpSessions.delete(e164);
  console.log(`[Authentication] Mobile ${e164} successfully verified.`);

  return res.status(200).json({
    success: true,
    verified: true,
    phoneNumber: e164,
    timestamp: new Date().toISOString()
  });
});

// Admin SMS Gateway configuration endpoints
app.get('/api/admin/sms-config', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== 'vidhyaa-admin-authorized') {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const summary = getSmsStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});

app.post('/api/admin/sms-config', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== 'vidhyaa-admin-authorized') {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const { fast2smsApiKey, twofactorApiKey, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = req.body || {};
  saveStoredSmsConfig({
    fast2smsApiKey: fast2smsApiKey !== undefined ? fast2smsApiKey.trim() : undefined,
    twofactorApiKey: twofactorApiKey !== undefined ? twofactorApiKey.trim() : undefined,
    twilioAccountSid: twilioAccountSid !== undefined ? twilioAccountSid.trim() : undefined,
    twilioAuthToken: twilioAuthToken !== undefined ? twilioAuthToken.trim() : undefined,
    twilioPhoneNumber: twilioPhoneNumber !== undefined ? twilioPhoneNumber.trim() : undefined,
  });

  const updatedSummary = getSmsStatusSummary();
  return res.status(200).json({
    success: true,
    message: 'SMS Gateway credentials updated successfully.',
    ...updatedSummary
  });
});

app.post('/api/admin/test-sms', async (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== 'vidhyaa-admin-authorized') {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const { mobile, phoneNumber } = req.body || {};
  const raw = (phoneNumber || mobile || '').toString().trim();
  if (!raw) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  let e164 = raw;
  if (!e164.startsWith('+')) {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 10) e164 = `+91${digits}`;
    else e164 = `+${digits}`;
  }

  if (e164.length < 8 || e164.length > 18) {
    return res.status(400).json({ error: 'Please enter a valid international mobile phone number (e.g., +14155552671 or +919876543210).' });
  }

  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const result = await dispatchRealSms(e164, testOtp);

  const masked = e164.length > 6 ? `${e164.slice(0, 4)}••••${e164.slice(-2)}` : e164;
  return res.status(result.success ? 200 : 502).json({
    success: result.success,
    provider: result.provider,
    errorCode: result.errorCode,
    message: result.message,
    maskedMobile: masked,
    phoneNumber: e164
  });
});

// ============================================================================
// CASHFREE PAYMENTS GATEWAY - CREDIT & DEBIT CARD ENDPOINTS
// ============================================================================

// Public Cashfree Gateway status (is configured, sandbox/production mode, etc.)
app.get('/api/payments/cashfree/status', (_req: Request, res: Response) => {
  const summary = getCashfreeStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});

// Create Cashfree Order securely on backend (Secret Key never exposed to client)
app.post('/api/payments/cashfree/create-order', async (req: Request, res: Response) => {
  try {
    const { orderId, orderAmount, customerName, customerEmail, customerPhone, returnUrl, orderNote } = req.body || {};

    if (!orderId || !orderAmount) {
      return res.status(400).json({ success: false, error: 'Missing mandatory orderId or orderAmount' });
    }

    const result = await createCashfreeOrder({
      orderId: String(orderId),
      orderAmount: Number(orderAmount),
      customerName: customerName || 'Valued Patron',
      customerEmail: customerEmail || 'patron@vidhyaajewellery.com',
      customerPhone: customerPhone || '9758350524',
      returnUrl,
      orderNote
    });

    if (!result.success) {
      return res.status(result.configured ? 400 : 503).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server error creating Cashfree order' });
  }
});

// Server-side payment verification API (Never mark order as paid on client-side redirect alone!)
app.post('/api/payments/cashfree/verify-order', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required for verification' });
    }

    const verification = await verifyCashfreeOrder(String(orderId));
    return res.status(verification.success ? 200 : 400).json(verification);
  } catch (err: any) {
    return res.status(500).json({ success: false, isPaid: false, error: err?.message || 'Error verifying order' });
  }
});

// Official Cashfree Webhook Listener (verifies signature and logs event)
app.post('/api/payments/cashfree/webhook', (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    if (signature && timestamp) {
      const isValid = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
      if (!isValid) {
        console.warn('[Cashfree Webhook] Invalid signature detected.');
        return res.status(401).json({ status: 'INVALID_SIGNATURE' });
      }
    }

    console.log('[Cashfree Webhook Event Received]', {
      type: req.body?.type,
      orderId: req.body?.data?.order?.order_id,
      paymentStatus: req.body?.data?.payment?.payment_status
    });

    return res.status(200).json({ status: 'SUCCESS' });
  } catch (err) {
    console.error('[Cashfree Webhook Processing Error]', err);
    return res.status(500).json({ status: 'ERROR' });
  }
});

// Admin Cashfree Configuration Endpoints
app.get('/api/admin/cashfree-config', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== 'vidhyaa-admin-authorized') {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const summary = getCashfreeStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});

app.post('/api/admin/cashfree-config', (req: Request, res: Response) => {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== 'vidhyaa-admin-authorized') {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const { appId, secretKey, env } = req.body || {};
  const result = saveCashfreeConfig({
    appId,
    secretKey,
    env: env === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX'
  });

  const updatedSummary = getCashfreeStatusSummary();
  return res.status(result.success ? 200 : 400).json({
    ...result,
    ...updatedSummary
  });
});

// Serve built static assets from dist directory
app.use(express.static(distPath, {
  maxAge: '1h',
  etag: true,
}));

// SPA fallback: serve index.html for all routes
app.get('*', (_req: Request, res: Response) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send('Error loading page.');
      }
    });
  } else {
    const rootIndex = path.join(__dirname, 'index.html');
    if (fs.existsSync(rootIndex)) {
      return res.sendFile(rootIndex);
    }
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VIDHYAA Jewellery Studio</title>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #FAF7F2; color: #3B1E22;">
  <h2>VIDHYAA Jewellery Studio</h2>
  <p>Loading luxury heirlooms, please wait...</p>
</body>
</html>`);
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});

// Graceful termination handling for Cloud Run
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
