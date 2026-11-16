import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SECRETS_DIR = path.join(ROOT_DIR, '.admin-secrets');
const SECRET_CONFIG_PATH = path.join(SECRETS_DIR, 'cashfree-config.json');
const LEGACY_CONFIG_PATH = path.join(ROOT_DIR, 'cashfree-config.json');
const ENV_FILE_PATH = path.join(ROOT_DIR, '.env');

function readDotEnvVars() {
  const vars = {};
  try {
    if (fs.existsSync(ENV_FILE_PATH)) {
      const content = fs.readFileSync(ENV_FILE_PATH, 'utf8');
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
        vars[key] = val;
      }
    }
  } catch {
    // ignore malformed .env
  }
  return vars;
}

export function getCashfreeCredentials() {
  let fileConfig = {};
  for (const candidate of [SECRET_CONFIG_PATH, LEGACY_CONFIG_PATH]) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          fileConfig = parsed;
          break;
        }
      }
    } catch (err) {
      console.warn(`[Cashfree] Warning reading ${candidate}:`, err?.message || err);
    }
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
    hasLiveCredentials
  };
}

export function saveCashfreeConfig(newConfig = {}) {
  try {
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

    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
    }
    try {
      fs.chmodSync(SECRETS_DIR, 0o700);
    } catch {}

    fs.writeFileSync(SECRET_CONFIG_PATH, JSON.stringify(updated, null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(SECRET_CONFIG_PATH, 0o600);
    } catch {}

    return { success: true, message: 'Cashfree configuration saved securely on server.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Failed to save Cashfree configuration.' };
  }
}

export function getCashfreeStatusSummary() {
  const creds = getCashfreeCredentials();
  const maskedAppId = creds.appId
    ? creds.appId.length > 8
      ? `${creds.appId.slice(0, 4)}••••${creds.appId.slice(-4)}`
      : '••••Configured'
    : 'Not Configured';

  return {
    success: true,
    configured: creds.isConfigured,
    isConfigured: creds.isConfigured,
    hasLiveCredentials: creds.hasLiveCredentials,
    env: creds.env,
    mode: creds.env.toLowerCase(),
    appIdMasked: maskedAppId,
    hasSecretKey: Boolean(creds.secretKey),
    apiVersion: creds.apiVersion
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
      error:
        'Cashfree live/sandbox credentials are not configured yet. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env or Admin Settings > Cashfree Gateway.'
    };
  }

  const rawPhone = String(params.customerPhone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9758350524';
  const safeEmail = String(params.customerEmail || '').trim() || 'patron@vidhyaajewellery.com';
  const safeName = String(params.customerName || 'Valued Patron').trim().slice(0, 80) || 'Valued Patron';
  const safeCustomerId = `cust_${(safeEmail || cleanPhone).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || Date.now()}`;

  const rawAmount = Number(params.orderAmount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase(),
      error: 'Invalid order amount. Payment amount must be greater than ₹0.'
    };
  }
  const safeAmount = Math.round(rawAmount * 100) / 100;
  const safeOrderId = sanitizeGatewayOrderId(params.orderId || `VDH-${Date.now()}`);

  const orderMeta = {
    return_url: params.returnUrl || 'https://vidhyaajewellerystudio.com/?view=checkout&cf_order_id={order_id}',
    payment_methods: params.paymentMethods || 'upi,cc,dc,nb'
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
    const res = await fetch(`${creds.baseUrl}/orders`, {
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
      mode: creds.env.toLowerCase()
    };
  } catch (err) {
    console.error('[Cashfree Order Network Error]', err);
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase(),
      error: err?.message || 'Network error connecting to Cashfree Payments Gateway.'
    };
  }
}

function formatPaymentMethodLabel(methodObj) {
  if (!methodObj || typeof methodObj !== 'object') return 'Cashfree Online Payment';
  if (methodObj.upi) {
    const channel = methodObj.upi.channel ? ` (${String(methodObj.upi.channel).toUpperCase()})` : '';
    return `UPI via Cashfree${channel}`;
  }
  if (methodObj.card) {
    const net = methodObj.card.card_network || 'Credit/Debit';
    const type = methodObj.card.card_type ? ` (${methodObj.card.card_type})` : ' Card';
    return `${net}${type}`;
  }
  if (methodObj.netbanking) {
    return `Netbanking (${methodObj.netbanking.netbanking_bank_name || 'Bank'})`;
  }
  if (methodObj.app) {
    return `Wallet (${methodObj.app.provider || 'App'})`;
  }
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
      configured: false,
      orderId: safeOrderId,
      orderStatus: 'UNCONFIGURED',
      error: 'Cashfree merchant credentials are not configured on the server.'
    };
  }

  try {
    const orderRes = await fetch(`${creds.baseUrl}/orders/${encodeURIComponent(safeOrderId)}`, {
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
      const paymentsRes = await fetch(`${creds.baseUrl}/orders/${encodeURIComponent(safeOrderId)}/payments`, {
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
        paymentStatus: latestPaymentStatus,
        paymentAmount: Number(latestPayment.payment_amount ?? gatewayOrderAmount),
        paymentCurrency: String(latestPayment.payment_currency || orderCurrency).toUpperCase(),
        paymentMethod: formatPaymentMethodLabel(methodObj),
        cardNetwork: methodObj.card?.card_network,
        cardType: methodObj.card?.card_type,
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
        orderId: safeOrderId,
        orderStatus: rawOrderStatus,
        orderAmount: paidAmount,
        cfOrderId: orderData.cf_order_id,
        paymentDetails
      };
    }

    const failedStates = new Set(['FAILED', 'CANCELLED', 'TERMINATED', 'EXPIRED', 'VOID']);
    const isFailed =
      failedStates.has(rawOrderStatus) ||
      (!successfulPayment && ['FAILED', 'CANCELLED', 'VOID'].includes(latestPaymentStatus));

    return {
      success: true,
      isPaid: false,
      isFailed,
      orderId: safeOrderId,
      orderStatus: latestPaymentStatus && !successfulPayment && latestPaymentStatus !== 'NOT_ATTEMPTED'
        ? latestPaymentStatus
        : rawOrderStatus,
      orderAmount: gatewayOrderAmount,
      cfOrderId: orderData.cf_order_id,
      paymentDetails,
      error: paymentDetails?.paymentMessage || (isFailed ? `Payment ${latestPaymentStatus || rawOrderStatus}` : undefined)
    };
  } catch (err) {
    return {
      success: false,
      isPaid: false,
      isFailed: false,
      orderId: safeOrderId,
      orderStatus: 'ERROR',
      error: err?.message || 'Error communicating with Cashfree Payments API'
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
