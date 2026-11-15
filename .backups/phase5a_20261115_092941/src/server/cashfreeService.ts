import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CashfreeStoredConfig {
  appId?: string;
  secretKey?: string;
  env?: 'SANDBOX' | 'PRODUCTION';
  apiVersion?: string;
  notifyUrl?: string;
  updatedAt?: string;
}

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl?: string;
  orderNote?: string;
}

export interface CreateOrderResult {
  success: boolean;
  configured: boolean;
  orderId?: string;
  cfOrderId?: string | number;
  paymentSessionId?: string;
  orderStatus?: string;
  mode?: 'sandbox' | 'production';
  error?: string;
}

export interface VerifyOrderResult {
  success: boolean;
  isPaid: boolean;
  orderId: string;
  orderStatus: string;
  orderAmount?: number;
  cfOrderId?: string | number;
  paymentDetails?: {
    cfPaymentId?: string | number;
    paymentStatus?: string;
    paymentAmount?: number;
    paymentCurrency?: string;
    paymentMethod?: string;
    cardNetwork?: string;
    cardType?: string;
    paymentTime?: string;
  };
  error?: string;
}

const CONFIG_FILE_PATH = path.join(__dirname, '..', '..', 'cashfree-config.json');

// Read config from file with fallback to process.env
export function getCashfreeCredentials(): {
  appId: string;
  secretKey: string;
  env: 'SANDBOX' | 'PRODUCTION';
  apiVersion: string;
  isConfigured: boolean;
} {
  let fileConfig: CashfreeStoredConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Cashfree] Warning reading cashfree-config.json:', err);
  }

  const appId = (fileConfig.appId || process.env.CASHFREE_APP_ID || '').trim();
  const secretKey = (fileConfig.secretKey || process.env.CASHFREE_SECRET_KEY || '').trim();
  const rawEnv = (fileConfig.env || process.env.CASHFREE_ENV || 'SANDBOX').trim().toUpperCase();
  const env: 'SANDBOX' | 'PRODUCTION' = rawEnv === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const apiVersion = (fileConfig.apiVersion || process.env.CASHFREE_API_VERSION || '2023-08-01').trim();

  const isConfigured = Boolean(appId && secretKey);

  return {
    appId,
    secretKey,
    env,
    apiVersion,
    isConfigured
  };
}

// Save config securely to local file (never exposes secrets to client)
export function saveCashfreeConfig(newConfig: Partial<CashfreeStoredConfig>): { success: boolean; message: string } {
  try {
    const existing = getCashfreeCredentials();
    const updated: CashfreeStoredConfig = {
      appId: newConfig.appId !== undefined ? newConfig.appId.trim() : existing.appId,
      secretKey: newConfig.secretKey !== undefined ? newConfig.secretKey.trim() : existing.secretKey,
      env: newConfig.env || existing.env,
      apiVersion: newConfig.apiVersion || existing.apiVersion,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return { success: true, message: 'Cashfree configuration saved successfully.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to save Cashfree configuration.' };
  }
}

// Public summary for admin UI without exposing full secret keys
export function getCashfreeStatusSummary() {
  const creds = getCashfreeCredentials();
  const maskedAppId = creds.appId
    ? `${creds.appId.slice(0, 4)}••••${creds.appId.slice(-4)}`
    : 'Not Configured';
  const hasSecret = Boolean(creds.secretKey);

  return {
    isConfigured: creds.isConfigured,
    env: creds.env,
    appIdMasked: maskedAppId,
    hasSecretKey: hasSecret,
    apiVersion: creds.apiVersion,
    baseUrl: creds.env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'
  };
}

// --------------------------------------------------------------------------
// 1. CREATE CASHFREE PAYMENT ORDER
// --------------------------------------------------------------------------
export async function createCashfreeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const creds = getCashfreeCredentials();

  if (!creds.isConfigured) {
    return {
      success: false,
      configured: false,
      mode: creds.env.toLowerCase() as 'sandbox' | 'production',
      error: 'Cashfree merchant credentials are not configured yet. Please configure CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Admin Panel or .env to accept Credit & Debit Cards.'
    };
  }

  const baseUrl = creds.env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  // Sanitize phone number (last 10 digits for Indian mobiles, default fallback if missing)
  const rawPhone = (params.customerPhone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9758350524';

  // Sanitize customer ID & name
  const safeCustomerId = `cust_${(params.customerEmail || cleanPhone).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || Date.now()}`;
  const safeName = (params.customerName || 'Valued Patron').trim().slice(0, 80);
  const safeEmail = (params.customerEmail || 'patron@vidhyaajewellery.com').trim();

  // Ensure amount is positive with 2 decimals
  const safeAmount = Math.max(1, Math.round(params.orderAmount * 100) / 100);

  // Clean Order ID (Cashfree requires alphanumeric, hyphen or underscore, max 50 chars)
  const safeOrderId = params.orderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);

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
    order_meta: {
      return_url: params.returnUrl || `https://ais-dev-4mkdmae4l6euf2siug53im-154198440604.asia-southeast1.run.app/?cf_order_id={order_id}`,
      payment_methods: 'cc,dc' // Prioritize Credit Card & Debit Card hosted checkout
    },
    order_note: params.orderNote || 'VIDHYAA Jewellery Studio Order'
  };

  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': creds.appId,
        'x-client-secret': creds.secretKey,
        'x-api-version': creds.apiVersion,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.message || data.error || `Cashfree API returned HTTP ${res.status}`;
      console.error('[Cashfree Order Creation Failed]', { status: res.status, data });
      return {
        success: false,
        configured: true,
        mode: creds.env.toLowerCase() as 'sandbox' | 'production',
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
      mode: creds.env.toLowerCase() as 'sandbox' | 'production'
    };
  } catch (err: any) {
    console.error('[Cashfree Order Network Error]', err);
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase() as 'sandbox' | 'production',
      error: err?.message || 'Network error connecting to Cashfree Payments Gateway.'
    };
  }
}

// --------------------------------------------------------------------------
// 2. VERIFY CASHFREE ORDER SERVER-SIDE (Never trust client-side redirects alone!)
// --------------------------------------------------------------------------
export async function verifyCashfreeOrder(orderId: string): Promise<VerifyOrderResult> {
  const creds = getCashfreeCredentials();

  if (!creds.isConfigured) {
    return {
      success: false,
      isPaid: false,
      orderId,
      orderStatus: 'UNCONFIGURED',
      error: 'Cashfree merchant credentials are not configured.'
    };
  }

  const baseUrl = creds.env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  const safeOrderId = orderId.trim();

  try {
    // 1. Fetch Order Details from Cashfree
    const orderRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(safeOrderId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': creds.appId,
        'x-client-secret': creds.secretKey,
        'x-api-version': creds.apiVersion,
        'Accept': 'application/json'
      }
    });

    const orderData = await orderRes.json().catch(() => ({}));

    if (!orderRes.ok) {
      return {
        success: false,
        isPaid: false,
        orderId: safeOrderId,
        orderStatus: 'NOT_FOUND',
        error: orderData.message || `Cashfree order verification failed with HTTP ${orderRes.status}`
      };
    }

    const orderStatus = orderData.order_status || 'UNKNOWN';
    const isPaid = orderStatus === 'PAID';

    // 2. Fetch specific payment attempts to extract card brand / transaction details
    let paymentDetails: VerifyOrderResult['paymentDetails'] = undefined;
    try {
      const paymentsRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(safeOrderId)}/payments`, {
        method: 'GET',
        headers: {
          'x-client-id': creds.appId,
          'x-client-secret': creds.secretKey,
          'x-api-version': creds.apiVersion,
          'Accept': 'application/json'
        }
      });
      if (paymentsRes.ok) {
        const paymentsArray = await paymentsRes.json();
        if (Array.isArray(paymentsArray) && paymentsArray.length > 0) {
          // Find the successful payment or latest attempt
          const successful = paymentsArray.find((p: any) => p.payment_status === 'SUCCESS') || paymentsArray[0];
          const methodObj = successful.payment_method || {};
          let cardNetwork = undefined;
          let cardType = undefined;
          let methodLabel = 'Card';

          if (methodObj.card) {
            cardNetwork = methodObj.card.card_network;
            cardType = methodObj.card.card_type;
            methodLabel = `${cardNetwork || 'Credit/Debit'} Card (${cardType || 'Standard'})`;
          } else if (methodObj.upi) {
            methodLabel = 'UPI via Cashfree';
          }

          paymentDetails = {
            cfPaymentId: successful.cf_payment_id,
            paymentStatus: successful.payment_status,
            paymentAmount: successful.payment_amount,
            paymentCurrency: successful.payment_currency || 'INR',
            paymentMethod: methodLabel,
            cardNetwork,
            cardType,
            paymentTime: successful.payment_completion_time || successful.payment_time
          };
        }
      }
    } catch (paymentErr) {
      console.warn('[Cashfree Payment Details Warning]', paymentErr);
    }

    return {
      success: true,
      isPaid,
      orderId: safeOrderId,
      orderStatus,
      orderAmount: orderData.order_amount,
      cfOrderId: orderData.cf_order_id,
      paymentDetails
    };
  } catch (err: any) {
    return {
      success: false,
      isPaid: false,
      orderId: safeOrderId,
      orderStatus: 'ERROR',
      error: err?.message || 'Error communicating with Cashfree Payments API'
    };
  }
}

// --------------------------------------------------------------------------
// 3. VERIFY WEBHOOK SIGNATURE
// --------------------------------------------------------------------------
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  const creds = getCashfreeCredentials();
  if (!creds.secretKey || !signature || !timestamp) return false;

  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', creds.secretKey)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch (err) {
    console.error('[Cashfree Webhook Signature Verification Error]', err);
    return false;
  }
}
