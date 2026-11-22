import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getOutsideSecretsDir, isLiveProductionRequest } from './sessionAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENV_CANDIDATE_PATHS = [
  path.join(ROOT_DIR, '.env'),
  path.join(path.dirname(ROOT_DIR), '.env'),
  path.join(path.dirname(ROOT_DIR), '.env.production')
];

const VALID_CASHFREE_PAYMENT_METHODS = new Set(['cc', 'dc', 'upi', 'nb', 'app', 'emi', 'paylater']);
const CASHFREE_FETCH_TIMEOUT_MS = 20000;

function resolveOutsideConfigPath() {
  const override = String(process.env.VIDHYAA_SECRETS_DIR || '').trim();
  if (override) {
    return path.join(override, 'cashfree-config.json');
  }
  return path.join(path.dirname(ROOT_DIR), '.admin-secrets', 'cashfree-config.json');
}

function readDotEnvVars() {
  const vars = {};
  for (const envPath of ENV_CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in vars) || !vars[key]) {
            vars[key] = val;
          }
        }
      }
    } catch {
      // ignore malformed .env
    }
  }
  return vars;
}

export function normalizeIndianMobile10(rawPhone) {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return null;
  }
  return digits;
}

export function sanitizeCashfreePaymentMethods(rawMethods) {
  const tokens = String(rawMethods || '')
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter((t) => VALID_CASHFREE_PAYMENT_METHODS.has(t));
  const unique = Array.from(new Set(tokens));
  return unique.length > 0 ? unique.join(',') : 'upi,cc,dc';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = CASHFREE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getCashfreeCredentials() {
  const outsideConfigPath = resolveOutsideConfigPath();
  let fileConfig = {};
  let storedOutsideWebroot = false;

  try {
    if (fs.existsSync(outsideConfigPath)) {
      const raw = fs.readFileSync(outsideConfigPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        fileConfig = parsed;
        storedOutsideWebroot = true;
      }
    }
  } catch (err) {
    console.warn(`[Cashfree] Warning reading ${outsideConfigPath}:`, err?.message || err);
  }

  const dotEnv = readDotEnvVars();
  const appId = String(fileConfig.appId || process.env.CASHFREE_APP_ID || dotEnv.CASHFREE_APP_ID || '').trim();
  const secretKey = String(fileConfig.secretKey || process.env.CASHFREE_SECRET_KEY || dotEnv.CASHFREE_SECRET_KEY || '').trim();
  const rawEnv = String(fileConfig.env || process.env.CASHFREE_ENV || process.env.CASHFREE_MODE || dotEnv.CASHFREE_ENV || 'SANDBOX')
    .trim()
    .toUpperCase();
  const env = rawEnv === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const apiVersion = String(fileConfig.apiVersion || process.env.CASHFREE_API_VERSION || dotEnv.CASHFREE_API_VERSION || '2023-08-01').trim();
  const notifyUrl = String(fileConfig.notifyUrl || process.env.CASHFREE_NOTIFY_URL || dotEnv.CASHFREE_NOTIFY_URL || '').trim();

  const overrideBase = String(process.env.CASHFREE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const baseUrl = overrideBase || (env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');

  const isConfigured = Boolean(appId && secretKey);
  const hasLiveCredentials = isConfigured && env === 'PRODUCTION';

  return {
    appId,
    secretKey,
    env,
    apiVersion,
    notifyUrl,
    baseUrl,
    isConfigured,
    hasLiveCredentials,
    storedOutsideWebroot
  };
}

export function saveCashfreeConfig(newConfig = {}) {
  try {
    const outsideDir = getOutsideSecretsDir();
    if (!outsideDir) {
      return {
        success: false,
        message:
          'Cannot write Cashfree secrets outside webroot (../.admin-secrets/). Refusing insecure fallback inside public_html. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in environment instead.'
      };
    }

    const existing = getCashfreeCredentials();
    const rawEnv = String(newConfig.env || existing.env || 'SANDBOX').trim().toUpperCase();
    const updated = {
      appId: newConfig.appId !== undefined ? String(newConfig.appId).trim() : existing.appId,
      secretKey: newConfig.secretKey !== undefined ? String(newConfig.secretKey).trim() : existing.secretKey,
      env: rawEnv === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
      apiVersion: newConfig.apiVersion ? String(newConfig.apiVersion).trim() : existing.apiVersion,
      notifyUrl: newConfig.notifyUrl !== undefined ? String(newConfig.notifyUrl).trim() : existing.notifyUrl,
      updatedAt: new Date().toISOString()
    };

    const targetPath = path.join(outsideDir, 'cashfree-config.json');
    fs.writeFileSync(targetPath, JSON.stringify(updated, null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {}

    return { success: true, message: 'Cashfree configuration saved securely outside webroot.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Failed to save Cashfree configuration.' };
  }
}

export function getCashfreeStatusSummary(req = null) {
  const creds = getCashfreeCredentials();
  const maskedAppId = creds.appId
    ? creds.appId.length > 8
      ? `${creds.appId.slice(0, 4)}••••${creds.appId.slice(-4)}`
      : '••••Configured'
    : 'Not Configured';
  const isLiveDomain = req ? isLiveProductionRequest(req) : false;

  return {
    success: true,
    configured: creds.isConfigured,
    isConfigured: creds.isConfigured,
    hasLiveCredentials: creds.hasLiveCredentials,
    isLiveDomain,
    blockedOnLiveDomain: Boolean(isLiveDomain && creds.env === 'SANDBOX'),
    storedOutsideWebroot: creds.storedOutsideWebroot,
    env: creds.env,
    mode: creds.env.toLowerCase(),
    appIdMasked: maskedAppId,
    hasSecretKey: Boolean(creds.secretKey),
    apiVersion: creds.apiVersion,
    supportedMethods: ['upi', 'cc', 'dc']
  };
}

export function sanitizeGatewayOrderId(rawOrderId) {
  return String(rawOrderId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 45);
}

export async function createCashfreeOrder(params) {
  const creds = getCashfreeCredentials();

  if (!creds.isConfigured) {
    return {
      success: false,
      configured: false,
      mode: creds.env.toLowerCase(),
      env: creds.env,
      error:
        'Cashfree credentials are not configured yet. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env or Admin Settings > Cashfree Gateway.'
    };
  }

  if (params?.isLiveDomain && creds.env === 'SANDBOX') {
    return {
      success: false,
      configured: true,
      blockedOnLiveDomain: true,
      mode: 'sandbox',
      env: 'SANDBOX',
      error:
        'Cashfree Gateway is in SANDBOX test mode and is disabled on live production domain vidhyaajewellerystudio.com. Switch to PRODUCTION credentials in Admin Settings.'
    };
  }

  const cleanPhone = normalizeIndianMobile10(params.customerPhone);
  if (!cleanPhone) {
    return {
      success: false,
      configured: true,
      code: 'INVALID_MOBILE_NUMBER',
      mode: creds.env.toLowerCase(),
      env: creds.env,
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    };
  }

  const safeEmail = String(params.customerEmail || '').trim() || 'patron@vidhyaajewellery.com';
  const safeName = String(params.customerName || 'Valued Patron').trim().slice(0, 80) || 'Valued Patron';
  const safeCustomerId = `cust_${(safeEmail || cleanPhone).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || Date.now()}`;

  const rawAmount = Number(params.orderAmount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase(),
      env: creds.env,
      error: 'Invalid order amount. Payment amount must be greater than ₹0.'
    };
  }
  const safeAmount = Math.round(rawAmount * 100) / 100;
  const safeOrderId = sanitizeGatewayOrderId(params.orderId || `VDH-${Date.now()}`);
  const safeMethods = sanitizeCashfreePaymentMethods(params.paymentMethods);

  const orderMeta = {
    return_url: params.returnUrl || 'https://vidhyaajewellerystudio.com/?view=checkout&cf_order_id={order_id}',
    payment_methods: safeMethods
  };
  if (params.notifyUrl || creds.notifyUrl) {
    const candidateNotify = String(params.notifyUrl || creds.notifyUrl).trim();
    if (/^https:\/\//i.test(candidateNotify)) {
      orderMeta.notify_url = candidateNotify;
    }
  }

  const payload = {
    order_id: safeOrderId,
    order_amount: safeAmount,
    order_currency: 'INR',
    customer_details: {
      customer_id: safeCustomerId,
      customer_name: safeName,
      customer_email: safeEmail,
      customer_phone: cleanPhone
    },
    order_meta: orderMeta,
    order_note: String(params.orderNote || `VIDHYAA Jewellery Studio Order ${safeOrderId}`).slice(0, 200)
  };

  try {
    const res = await fetchWithTimeout(`${creds.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': creds.appId,
        'x-client-secret': creds.secretKey,
        'x-api-version': creds.apiVersion,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.payment_session_id) {
      const errMsg = data?.message || data?.error || `Cashfree API returned HTTP ${res.status}`;
      console.error('[Cashfree Order Creation Failed]', { status: res.status, data });
      return {
        success: false,
        configured: true,
        mode: creds.env.toLowerCase(),
        env: creds.env,
        error: errMsg
      };
    }

    return {
      success: true,
      configured: true,
      orderId: data.order_id || safeOrderId,
      cfOrderId: data.cf_order_id,
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status || 'ACTIVE',
      paymentMethods: safeMethods,
      mode: creds.env.toLowerCase(),
      env: creds.env
    };
  } catch (err) {
    console.error('[Cashfree Order Network Error]', err);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase(),
      env: creds.env,
      error: isTimeout
        ? 'Cashfree Payments Gateway timed out. Please try again.'
        : err?.message || 'Network error connecting to Cashfree Payments Gateway.'
    };
  }
}

export function formatPaymentMethodLabel(methodObj, paymentGroup = '') {
  const groupLower = String(paymentGroup || '').trim().toLowerCase();
  if (methodObj && typeof methodObj === 'object') {
    if (methodObj.upi) {
      const rawChannel = String(methodObj.upi.channel || '').trim().toLowerCase();
      const channelMap = {
        intent: 'UPI App Intent',
        link: 'UPI App Intent',
        qrcode: 'UPI QR Code',
        qr: 'UPI QR Code',
        collect: 'UPI ID / Collect'
      };
      const suffix = channelMap[rawChannel] || (rawChannel ? rawChannel.toUpperCase() : 'Cashfree');
      return `UPI (${suffix})`;
    }
    if (methodObj.card) {
      const rawType = String(methodObj.card.card_type || groupLower || '').trim().toLowerCase();
      const typeLabel = rawType.includes('credit')
        ? 'Credit Card'
        : rawType.includes('debit')
        ? 'Debit Card'
        : 'Card';
      const rawNet = String(methodObj.card.card_network || '').trim();
      const netLabel = rawNet ? rawNet.charAt(0).toUpperCase() + rawNet.slice(1) : '';
      return netLabel ? `${typeLabel} (${netLabel})` : typeLabel;
    }
    if (methodObj.netbanking) {
      return `Netbanking (${methodObj.netbanking.netbanking_bank_name || 'Bank'})`;
    }
    if (methodObj.app) {
      return `Wallet (${methodObj.app.provider || 'App'})`;
    }
  }
  if (groupLower === 'credit_card') return 'Credit Card (Cashfree)';
  if (groupLower === 'debit_card') return 'Debit Card (Cashfree)';
  if (groupLower === 'upi') return 'UPI (Cashfree)';
  if (groupLower === 'net_banking' || groupLower === 'netbanking') return 'Netbanking (Cashfree)';
  return 'Cashfree Online Payment';
}

export async function verifyCashfreeOrder(orderId, options = {}) {
  const creds = getCashfreeCredentials();
  const safeOrderId = sanitizeGatewayOrderId(orderId);
  const expectedAmount = options.expectedAmount !== undefined ? Number(options.expectedAmount) : undefined;
  const expectedCurrency = String(options.expectedCurrency || 'INR').toUpperCase();

  if (!safeOrderId) {
    return {
      success: false,
      isPaid: false,
      isFailed: false,
      isCancelled: false,
      isPending: false,
      orderId: '',
      orderStatus: 'INVALID_ORDER_ID',
      error: 'Order ID is required for payment verification.'
    };
  }

  if (!creds.isConfigured) {
    return {
      success: false,
      isPaid: false,
      isFailed: false,
      isCancelled: false,
      isPending: false,
      configured: false,
      orderId: safeOrderId,
      orderStatus: 'UNCONFIGURED',
      error: 'Cashfree merchant credentials are not configured on the server.'
    };
  }

  if (options?.isLiveDomain && creds.env === 'SANDBOX') {
    return {
      success: false,
      isPaid: false,
      isFailed: false,
      isCancelled: false,
      isPending: false,
      blockedOnLiveDomain: true,
      orderId: safeOrderId,
      orderStatus: 'SANDBOX_BLOCKED_ON_PRODUCTION',
      mode: 'sandbox',
      env: 'SANDBOX',
      error: 'Sandbox payment verification is disabled on live production domain vidhyaajewellerystudio.com.'
    };
  }

  try {
    const orderRes = await fetchWithTimeout(`${creds.baseUrl}/orders/${encodeURIComponent(safeOrderId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': creds.appId,
        'x-client-secret': creds.secretKey,
        'x-api-version': creds.apiVersion,
        Accept: 'application/json'
      }
    });

    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return {
        success: false,
        isPaid: false,
        isFailed: false,
        isCancelled: false,
        isPending: false,
        orderId: safeOrderId,
        orderStatus: orderRes.status === 404 ? 'NOT_FOUND' : 'GATEWAY_ERROR',
        error: orderData?.message || `Cashfree order lookup failed with HTTP ${orderRes.status}`
      };
    }

    const gatewayOrderId = String(orderData.order_id || safeOrderId);
    if (gatewayOrderId !== safeOrderId) {
      return {
        success: true,
        isPaid: false,
        isFailed: true,
        isCancelled: false,
        isPending: false,
        orderId: safeOrderId,
        orderStatus: 'ORDER_ID_MISMATCH',
        error: `Gateway order ID mismatch: expected ${safeOrderId}, received ${gatewayOrderId}.`
      };
    }

    const rawOrderStatus = String(orderData.order_status || 'UNKNOWN').toUpperCase();
    const orderCurrency = String(orderData.order_currency || 'INR').toUpperCase();
    const gatewayOrderAmount = Number(orderData.order_amount || 0);

    let paymentsArray = [];
    try {
      const paymentsRes = await fetchWithTimeout(`${creds.baseUrl}/orders/${encodeURIComponent(safeOrderId)}/payments`, {
        method: 'GET',
        headers: {
          'x-client-id': creds.appId,
          'x-client-secret': creds.secretKey,
          'x-api-version': creds.apiVersion,
          Accept: 'application/json'
        }
      });
      if (paymentsRes.ok) {
        const parsedPayments = await paymentsRes.json().catch(() => []);
        if (Array.isArray(parsedPayments)) {
          paymentsArray = parsedPayments;
        }
      }
    } catch (paymentErr) {
      console.warn('[Cashfree Payment Details Warning]', paymentErr?.message || paymentErr);
    }

    const successfulPayment = paymentsArray.find((p) => String(p?.payment_status || '').toUpperCase() === 'SUCCESS');
    const latestPayment = successfulPayment || paymentsArray[0] || null;
    const latestPaymentStatus = latestPayment ? String(latestPayment.payment_status || '').toUpperCase() : '';

    let paymentDetails = undefined;
    if (latestPayment) {
      const methodObj = latestPayment.payment_method || {};
      paymentDetails = {
        cfPaymentId: latestPayment.cf_payment_id,
        bankReference: latestPayment.bank_reference ? String(latestPayment.bank_reference) : undefined,
        paymentGroup: latestPayment.payment_group ? String(latestPayment.payment_group) : undefined,
        paymentStatus: latestPaymentStatus,
        paymentAmount: Number(latestPayment.payment_amount ?? gatewayOrderAmount),
        paymentCurrency: String(latestPayment.payment_currency || orderCurrency).toUpperCase(),
        paymentMethod: formatPaymentMethodLabel(methodObj, latestPayment.payment_group),
        cardNetwork: methodObj.card?.card_network,
        cardType: methodObj.card?.card_type,
        upiChannel: methodObj.upi?.channel,
        paymentTime: latestPayment.payment_completion_time || latestPayment.payment_time,
        paymentMessage: latestPayment.payment_message
      };
    }

    const paidCurrency = String(paymentDetails?.paymentCurrency || orderCurrency || 'INR').toUpperCase();
    const paidAmount = Number(paymentDetails?.paymentAmount ?? gatewayOrderAmount ?? 0);

    const hasSuccessfulPaymentStatus =
      rawOrderStatus === 'PAID' &&
      (paymentsArray.length === 0 || Boolean(successfulPayment));

    if (hasSuccessfulPaymentStatus) {
      if (paidCurrency !== expectedCurrency) {
        return {
          success: true,
          isPaid: false,
          isFailed: true,
          isCancelled: false,
          isPending: false,
          mismatch: true,
          orderId: safeOrderId,
          orderStatus: 'CURRENCY_MISMATCH',
          orderAmount: paidAmount,
          cfOrderId: orderData.cf_order_id,
          paymentDetails,
          error: `Currency mismatch: expected ${expectedCurrency}, got ${paidCurrency}.`
        };
      }

      if (expectedAmount !== undefined && Number.isFinite(expectedAmount) && expectedAmount > 0) {
        if (!Number.isFinite(paidAmount) || paidAmount + 0.01 < expectedAmount) {
          return {
            success: true,
            isPaid: false,
            isFailed: true,
            isCancelled: false,
            isPending: false,
            mismatch: true,
            orderId: safeOrderId,
            orderStatus: 'AMOUNT_MISMATCH',
            orderAmount: paidAmount,
            cfOrderId: orderData.cf_order_id,
            paymentDetails,
            error: `Payment amount mismatch: expected ₹${expectedAmount}, received ₹${paidAmount}.`
          };
        }
      }

      return {
        success: true,
        isPaid: true,
        isFailed: false,
        isCancelled: false,
        isPending: false,
        orderId: safeOrderId,
        orderStatus: rawOrderStatus,
        orderAmount: paidAmount,
        cfOrderId: orderData.cf_order_id,
        env: creds.env,
        mode: creds.env.toLowerCase(),
        paymentDetails
      };
    }

    const cancelledStates = new Set(['CANCELLED', 'USER_DROPPED']);
    const failedStates = new Set(['FAILED', 'TERMINATED', 'EXPIRED', 'VOID']);
    const isCancelled =
      !successfulPayment &&
      (cancelledStates.has(latestPaymentStatus) || cancelledStates.has(rawOrderStatus));
    const isFailed =
      !isCancelled &&
      (failedStates.has(rawOrderStatus) ||
        (!successfulPayment && failedStates.has(latestPaymentStatus)));
    const isPending = !isFailed && !isCancelled;

    const effectiveStatus =
      latestPaymentStatus && !successfulPayment && latestPaymentStatus !== 'NOT_ATTEMPTED'
        ? latestPaymentStatus
        : rawOrderStatus;

    return {
      success: true,
      isPaid: false,
      isFailed,
      isCancelled,
      isPending,
      orderId: safeOrderId,
      orderStatus: effectiveStatus,
      orderAmount: gatewayOrderAmount,
      cfOrderId: orderData.cf_order_id,
      env: creds.env,
      mode: creds.env.toLowerCase(),
      paymentDetails,
      error:
        paymentDetails?.paymentMessage ||
        (isCancelled
          ? 'Payment was cancelled before completion. No amount was confirmed.'
          : isFailed
          ? `Payment ${latestPaymentStatus || rawOrderStatus}`
          : undefined)
    };
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      isPaid: false,
      isFailed: false,
      isCancelled: false,
      isPending: true,
      orderId: safeOrderId,
      orderStatus: isTimeout ? 'TIMEOUT' : 'ERROR',
      error: isTimeout
        ? 'Cashfree verification timed out. Please check payment status again.'
        : err?.message || 'Error communicating with Cashfree Payments API'
    };
  }
}

export function verifyCashfreeWebhookSignature(rawBody, signature, timestamp) {
  const creds = getCashfreeCredentials();
  if (!creds.secretKey || !signature || !timestamp || typeof rawBody !== 'string') {
    return false;
  }

  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', creds.secretKey)
      .update(payload)
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(String(signature).trim(), 'utf8');
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (err) {
    console.error('[Cashfree Webhook Signature Verification Error]', err);
    return false;
  }
}
