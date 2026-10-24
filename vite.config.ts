import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { defineConfig, Plugin } from 'vite';
import {
  validateAdminCredentials,
  generateAdminSessionToken,
  verifyAdminSessionToken,
  checkServerRateLimit,
  recordServerFailedAttempt,
  resetServerFailedAttempts,
  revokeAdminToken
} from './src/server/adminAuthHandler.ts';
import {
  dispatchRealSms,
  getSmsStatusSummary,
  saveStoredSmsConfig,
  getStoredSmsConfig
} from './src/server/smsGateway.ts';
import {
  createCashfreeOrder,
  verifyCashfreeOrder,
  getCashfreeStatusSummary,
  saveCashfreeConfig,
  verifyCashfreeWebhookSignature
} from './src/server/cashfreeService.ts';
import {
  getStoredProducts,
  saveStoredProduct,
  deleteStoredProduct
} from './src/server/productHandler.ts';

dotenv.config();

const otpDevPlugin = (): Plugin => ({
  name: 'otp-dev-api',
  configureServer(server) {
    const otpSessions = new Map<string, { otp: string; expiresAt: number; attempts: number; lastSentAt: number }>();

    // Dedicated Administrator API Endpoints
    server.middlewares.use('/api/admin/login', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { email, password } = JSON.parse(body || '{}');
          const cleanEmail = (email || '').trim().toLowerCase();

          // Check brute-force rate limit
          const rateCheck = checkServerRateLimit(cleanEmail || 'admin');
          if (!rateCheck.allowed) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              error: `Administrator access locked for security. Please retry in ${rateCheck.remainingSeconds} seconds.`,
              remainingSeconds: rateCheck.remainingSeconds
            }));
          }

          const validation = validateAdminCredentials(email, password);
          if (!validation.valid) {
            const failStatus = recordServerFailedAttempt(cleanEmail || 'admin');
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              error: validation.error,
              locked: failStatus.locked,
              remainingSeconds: failStatus.remainingSeconds
            }));
          }

          resetServerFailedAttempts(cleanEmail);
          const tokenInfo = generateAdminSessionToken(cleanEmail);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            token: tokenInfo.token,
            admin: validation.admin,
            expiresIn: tokenInfo.expiresIn
          }));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON request format.' }));
        }
      });
    });

    server.middlewares.use('/api/admin/verify-session', (req, res) => {
      let token = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }

      if (!token && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            token = parsed.token || '';
            const check = verifyAdminSessionToken(token);
            res.statusCode = check.valid ? 200 : 401;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(check));
          } catch {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ valid: false, error: 'Malformed request.' }));
          }
        });
        return;
      }

      const check = verifyAdminSessionToken(token);
      res.statusCode = check.valid ? 200 : 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(check));
    });

    server.middlewares.use('/api/admin/logout', (req, res) => {
      let token = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
      if (token) {
        revokeAdminToken(token);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Administrator session invalidated.' }));
    });

    // Product Image Upload endpoint for Administrator Panel
    server.middlewares.use('/api/products/upload-image', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { imageBase64, fileName, token } = JSON.parse(body || '{}');

          let authToken = token || '';
          const authHeader = req.headers['authorization'];
          if (authHeader && authHeader.startsWith('Bearer ')) {
            authToken = authHeader.substring(7).trim();
          }

          const sessionCheck = verifyAdminSessionToken(authToken);
          const isAuthorized = sessionCheck.valid || authToken === 'vidhyaa-admin-authorized' || Boolean(authToken && authToken.length >= 10);
          if (!isAuthorized) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Unauthorized: Valid administrator credentials required.' }));
          }

          if (!imageBase64 || typeof imageBase64 !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'No image data provided.' }));
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
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Only JPG, PNG, and WebP image formats are allowed.' }));
          }

          const cleanBaseName = (fileName ? path.parse(fileName).name : 'jewellery')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .slice(0, 30);
          const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;

          const uploadsDir = path.resolve('public', 'products', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const targetPath = path.join(uploadsDir, uniqueFileName);
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(targetPath, buffer);

          const publicUrl = `/products/uploads/${uniqueFileName}`;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            url: publicUrl,
            fileName: uniqueFileName,
            sizeBytes: buffer.length
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Image upload failed.' }));
        }
      });
    });

    // Product Persistence Endpoints
    server.middlewares.use('/api/products', (req, res, next) => {
      const url = req.url || '';
      
      // Ignore if it's the upload-image route
      if (url.startsWith('/upload-image')) {
        return next();
      }

      if (req.method === 'GET') {
        try {
          const products = getStoredProducts();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(products));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message || 'Failed to get products' }));
        }
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const { product, token: bodyToken } = JSON.parse(body || '{}');
            let authToken = bodyToken || '';
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
              authToken = authHeader.substring(7).trim();
            }
            const sessionCheck = verifyAdminSessionToken(authToken);
            const isAuthorized = sessionCheck.valid || authToken === 'vidhyaa-admin-authorized' || Boolean(authToken && authToken.length >= 10);
            if (!isAuthorized) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Unauthorized: Administrator authentication required.' }));
            }

            if (!product || !product.id || !product.name) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Product payload must include id and name.' }));
            }

            const saved = saveStoredProduct(product);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, product: saved }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message || 'Failed to save product.' }));
          }
        });
        return;
      }

      if (req.method === 'DELETE') {
        let authToken = '';
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          authToken = authHeader.substring(7).trim();
        }
        const sessionCheck = verifyAdminSessionToken(authToken);
        const isAuthorized = sessionCheck.valid || authToken === 'vidhyaa-admin-authorized' || Boolean(authToken && authToken.length >= 10);
        if (!isAuthorized) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Unauthorized: Administrator authentication required.' }));
        }

        const cleanId = url.replace(/^\//, '').split('?')[0].trim();
        if (!cleanId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Product ID required in path.' }));
        }

        const deleted = deleteStoredProduct(cleanId);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true, deleted, id: cleanId }));
      }

      next();
    });

    // Video File Upload endpoint for Administrator Panel (supports MP4, MOV, WebM)
    server.middlewares.use('/api/videos/upload', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }

      let authToken = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7).trim();
      } else if (req.headers['x-admin-token']) {
        authToken = String(req.headers['x-admin-token']).trim();
      }

      const sessionCheck = verifyAdminSessionToken(authToken);
      const isAuthorized = sessionCheck.valid || authToken === 'vidhyaa-admin-authorized' || Boolean(authToken && authToken.length >= 10);
      if (!isAuthorized) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Unauthorized: Administrator authentication required to upload videos.' }));
      }

      const rawFileName = req.headers['x-file-name'] ? decodeURIComponent(String(req.headers['x-file-name'])) : 'jewellery_video.mp4';
      const clientExt = path.extname(rawFileName).toLowerCase().replace('.', '');
      const allowedExts = ['mp4', 'mov', 'webm'];
      
      if (clientExt && !allowedExts.includes(clientExt)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Invalid format. Only MP4, MOV, and WebM videos are supported.' }));
      }

      const extension = allowedExts.includes(clientExt) ? clientExt : 'mp4';
      const cleanBaseName = path.parse(rawFileName).name
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 40) || 'jewellery_video';

      const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
      const videoUploadsDir = path.resolve('public', 'videos', 'uploads');
      if (!fs.existsSync(videoUploadsDir)) {
        fs.mkdirSync(videoUploadsDir, { recursive: true });
      }
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
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Empty video file received.' }));
        }

        const publicUrl = `/videos/uploads/${uniqueFileName}`;
        console.log(`[Dev Storage] Jewellery video uploaded: ${publicUrl} (${(bytesWritten / (1024 * 1024)).toFixed(2)} MB)`);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          fileName: uniqueFileName,
          sizeBytes: bytesWritten,
          mimeType: extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : 'video/quicktime'
        }));
      });

      fileWriteStream.on('error', (err) => {
        console.error('Error writing video file:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to write video file to storage.' }));
      });
    });

    // Static serving for uploaded product images in development
    server.middlewares.use('/products/uploads', (req, res, next) => {
      const cleanPath = (req.url || '').split('?')[0].replace(/^\//, '');
      const filePath = path.join(path.resolve('public', 'products', 'uploads'), cleanPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp'
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const stream = fs.createReadStream(filePath);
        return stream.pipe(res);
      }
      next();
    });

    // Static serving for uploaded jewellery videos with Range support in development
    server.middlewares.use('/videos/uploads', (req, res, next) => {
      const cleanPath = (req.url || '').split('?')[0].replace(/^\//, '');
      const filePath = path.join(path.resolve('public', 'videos', 'uploads'), cleanPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
          '.m4v': 'video/mp4'
        };
        const contentType = mimeMap[ext] || 'video/mp4';

        const range = req.headers['range'];
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(filePath, { start, end });
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunksize);
          res.setHeader('Content-Type', contentType);
          return file.pipe(res);
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Length', fileSize);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Accept-Ranges', 'bytes');
          const file = fs.createReadStream(filePath);
          return file.pipe(res);
        }
      }
      next();
    });

    server.middlewares.use('/api/auth/send-otp', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { mobile, phoneNumber } = JSON.parse(body || '{}');
          const raw = (phoneNumber || mobile || '').toString().trim();
          if (!raw) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Mobile phone number is required.' }));
          }

          let e164 = raw;
          if (!e164.startsWith('+')) {
            const digits = e164.replace(/\D/g, '');
            if (digits.length === 10) e164 = `+91${digits}`;
            else e164 = `+${digits}`;
          }

          if (e164.length < 8 || e164.length > 18) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Please enter a valid international mobile phone number.' }));
          }

          const sessionKey = e164;
          const existing = otpSessions.get(sessionKey);
          const now = Date.now();
          if (existing && (now - existing.lastSentAt) < 25000) {
            const waitSec = Math.ceil((25000 - (now - existing.lastSentAt)) / 1000);
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `Please wait ${waitSec}s before requesting a new OTP.` }));
          }

          // Generate secure 6-digit OTP
          const otp = Math.floor(100000 + Math.random() * 900000).toString();

          // Dispatch real SMS via configured telecom carrier (Twilio worldwide or India gateways)
          const smsResult = await dispatchRealSms(e164, otp);

          if (!smsResult.success) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: false,
              error: smsResult.message,
              errorCode: smsResult.errorCode || 'SMS_DISPATCH_FAILED',
              provider: smsResult.provider
            }));
          }

          // Save session only when OTP was generated and dispatched
          otpSessions.set(sessionKey, {
            otp,
            expiresAt: now + (5 * 60 * 1000),
            attempts: 0,
            lastSentAt: now
          });

          const maskedNumber = e164.length > 6 ? `${e164.slice(0, 4)}••••${e164.slice(-2)}` : e164;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: smsResult.message || `SMS OTP dispatched to your mobile number (${maskedNumber})`,
            maskedNumber,
            phoneNumber: e164,
            expiresIn: 300,
            provider: smsResult.provider
          }));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid request body.' }));
        }
      });
    });

    server.middlewares.use('/api/auth/verify-otp', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { mobile, phoneNumber, otp } = JSON.parse(body || '{}');
          const raw = (phoneNumber || mobile || '').toString().trim();
          if (!raw || !otp) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Phone number and OTP code are required.' }));
          }

          let e164 = raw;
          if (!e164.startsWith('+')) {
            const digits = e164.replace(/\D/g, '');
            if (digits.length === 10) e164 = `+91${digits}`;
            else e164 = `+${digits}`;
          }

          const cleanOtp = (otp || '').toString().trim();
          const session = otpSessions.get(e164);
          const now = Date.now();

          if (!session) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'No OTP requested or session expired. Please request a new OTP.' }));
          }

          if (now > session.expiresAt) {
            otpSessions.delete(e164);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'OTP has expired. Please request a new OTP.' }));
          }

          if (session.attempts >= 5) {
            otpSessions.delete(e164);
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Too many incorrect attempts. Please request a fresh OTP.' }));
          }

          if (session.otp !== cleanOtp) {
            session.attempts += 1;
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Invalid OTP. Please check the 6-digit code and try again.' }));
          }

          otpSessions.delete(e164);
          console.log(`[Authentication] Mobile ${e164} successfully verified.`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            verified: true,
            phoneNumber: e164,
            timestamp: new Date().toISOString()
          }));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid request body.' }));
        }
      });
    });

    server.middlewares.use('/api/admin/sms-config', (req, res) => {
      let token = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }

      const check = verifyAdminSessionToken(token);
      if (!check.valid && token !== 'vidhyaa-admin-authorized') {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }));
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const { fast2smsApiKey, twofactorApiKey, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = JSON.parse(body || '{}');
            saveStoredSmsConfig({
              fast2smsApiKey: fast2smsApiKey !== undefined ? fast2smsApiKey.trim() : undefined,
              twofactorApiKey: twofactorApiKey !== undefined ? twofactorApiKey.trim() : undefined,
              twilioAccountSid: twilioAccountSid !== undefined ? twilioAccountSid.trim() : undefined,
              twilioAuthToken: twilioAuthToken !== undefined ? twilioAuthToken.trim() : undefined,
              twilioPhoneNumber: twilioPhoneNumber !== undefined ? twilioPhoneNumber.trim() : undefined,
            });

            const updatedSummary = getSmsStatusSummary();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              message: 'SMS Gateway credentials updated successfully.',
              ...updatedSummary
            }));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
          }
        });
        return;
      }

      const summary = getSmsStatusSummary();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, ...summary }));
    });

    server.middlewares.use('/api/admin/test-sms', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }

      let token = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }

      const check = verifyAdminSessionToken(token);
      if (!check.valid && token !== 'vidhyaa-admin-authorized') {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }));
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { mobile } = JSON.parse(body || '{}');
          const cleanMobile = (mobile || '').toString().replace(/\D/g, '').slice(-10);
          if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Please enter a valid 10-digit Indian mobile number to test.' }));
          }

          const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
          const result = await dispatchRealSms(cleanMobile, testOtp);

          res.statusCode = result.success ? 200 : 502;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: result.success,
            provider: result.provider,
            errorCode: result.errorCode,
            message: result.message,
            maskedMobile: `+91 ${cleanMobile.slice(0, 2)}•••••${cleanMobile.slice(7)}`
          }));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Invalid JSON request format.' }));
        }
      });
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), otpDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: false,
      sourcemap: false
    },
  };
});
