import crypto from 'crypto';

export interface CashfreeCustomerDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customer: CashfreeCustomerDetails;
  returnUrl?: string;
  notifyUrl?: string;
  note?: string;
}

export interface CreateOrderResult {
  success: boolean;
  paymentSessionId?: string;
  orderId?: string;
  cfOrderId?: string | number;
  orderStatus?: string;
  error?: string;
  isMockFallback?: boolean;
}

export interface VerifyOrderResult {
  success: boolean;
  orderStatus: 'PAID' | 'ACTIVE' | 'FAILED' | 'CANCELLED' | 'USER_DROPPED' | 'EXPIRED' | 'UNKNOWN';
  orderAmount?: number;
  paymentId?: string;
  paymentMethod?: string;
  bankReference?: string;
  paymentTime?: string;
  error?: string;
  raw?: any;
}

export interface CashfreeConfigSummary {
  enabled: boolean;
  mode: 'sandbox' | 'production';
  apiVersion: string;
  appIdConfigured: boolean;
  secretKeyConfigured: boolean;
  isReady: boolean;
}

/**
 * Returns Cashfree credentials safely from environment
 */
export function getCashfreeCredentials() {
  const mode = (process.env.CASHFREE_MODE || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const appId = (process.env.CASHFREE_APP_ID || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';

  const baseUrl = mode === 'production' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';

  return {
    mode: mode as 'sandbox' | 'production',
    appId,
    secretKey,
    apiVersion,
    baseUrl,
    isConfigured: Boolean(appId && secretKey)
  };
}

/**
 * Summary for client or admin without exposing secrets
 */
export function getCashfreeConfigSummary(): CashfreeConfigSummary {
  const creds = getCashfreeCredentials();
  return {
    enabled: true,
    mode: creds.mode,
    apiVersion: creds.apiVersion,
    appIdConfigured: Boolean(creds.appId),
    secretKeyConfigured: Boolean(creds.secretKey),
    isReady: creds.isConfigured
  };
}

/**
 * Creates a payment order with Cashfree Hosted Checkout API
 */
export async function createCashfreeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const creds = getCashfreeCredentials();

  if (!creds.isConfigured) {
    return {
      success: false,
      error: 'Cashfree Gateway credentials not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in server environment.'
    };
  }

  // Format phone number to clean 10-digit Indian number or international number
  const cleanPhone = (params.customer.phone || '').replace(/\D/g, '').slice(-10) || '9758350524';
  const cleanEmail = (params.customer.email || '').trim() || 'care@vidhyaajewellery.com';
  const cleanName = (params.customer.name || '').trim() || 'Valued Patron';

  const payload = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: params.orderCurrency || 'INR',
    customer_details: {
      customer_id: params.customer.id || `cust_${Date.now()}`,
      customer_name: cleanName,
      customer_email: cleanEmail,
      customer_phone: cleanPhone
    },
    order_meta: {
      return_url: params.returnUrl || undefined,
      notify_url: params.notifyUrl || undefined,
      payment_methods: 'cc,dc' // Enable Credit Cards & Debit Cards specifically
    },
    order_note: params.note || `VIDHYAA Jewellery Studio Order #${params.orderId}`
  };

  try {
    const response = await fetch(`${creds.baseUrl}/orders`, {
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

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data.message || data.error || `Cashfree API responded with HTTP ${response.status}`;
      console.error('[Cashfree] Order Creation Error:', {
        status: response.status,
        code: data.code,
        type: data.type,
        message: errMsg
      });
      return {
        success: false,
        error: errMsg
      };
    }

    if (!data.payment_session_id) {
      return {
        success: false,
        error: 'Cashfree did not return a valid payment_session_id.'
      };
    }

    return {
      success: true,
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id,
      orderStatus: data.order_status
    };
  } catch (err: any) {
    console.error('[Cashfree] Network exception creating order:', err);
    return {
      success: false,
      error: err?.message || 'Unable to connect to Cashfree payment server.'
    };
  }
}

/**
 * Server-side verification of payment status directly with Cashfree
 */
export async function verifyCashfreeOrder(orderId: string): Promise<VerifyOrderResult> {
  const creds = getCashfreeCredentials();

  if (!creds.isConfigured) {
    return {
      success: false,
      orderStatus: 'UNKNOWN',
      error: 'Cashfree Gateway credentials not configured.'
    };
  }

  try {
    // 1. Fetch Order Status
    const orderRes = await fetch(`${creds.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': creds.appId,
        'x-client-secret': creds.secretKey,
        'x-api-version': creds.apiVersion,
        'Accept': 'application/json'
      }
    });

    const orderData: any = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return {
        success: false,
        orderStatus: 'UNKNOWN',
        error: orderData.message || `Cashfree returned HTTP ${orderRes.status}`
      };
    }

    // 2. Fetch specific payment attempts to obtain payment ID, card network, and bank reference
    let paymentId: string | undefined;
    let paymentMethod: string | undefined;
    let bankReference: string | undefined;
    let paymentTime: string | undefined;

    try {
      const paymentsRes = await fetch(`${creds.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'GET',
        headers: {
          'x-client-id': creds.appId,
          'x-client-secret': creds.secretKey,
          'x-api-version': creds.apiVersion,
          'Accept': 'application/json'
        }
      });
      if (paymentsRes.ok) {
        const paymentsList: any = await paymentsRes.json();
        if (Array.isArray(paymentsList) && paymentsList.length > 0) {
          // Find the successful payment attempt
          const successfulAttempt = paymentsList.find((p: any) => p.payment_status === 'SUCCESS') || paymentsList[0];
          paymentId = String(successfulAttempt.cf_payment_id || successfulAttempt.payment_id || '');
          paymentMethod = successfulAttempt.payment_group || 'card';
          bankReference = successfulAttempt.bank_reference || '';
          paymentTime = successfulAttempt.payment_completion_time || new Date().toISOString();
        }
      }
    } catch (payErr) {
      console.warn('[Cashfree] Non-critical: could not fetch payment attempts detail:', payErr);
    }

    const orderStatus = (orderData.order_status || 'UNKNOWN').toUpperCase();

    return {
      success: orderStatus === 'PAID',
      orderStatus: orderStatus as any,
      orderAmount: orderData.order_amount,
      paymentId: paymentId || String(orderData.cf_order_id || ''),
      paymentMethod: paymentMethod || 'Credit / Debit Card',
      bankReference,
      paymentTime: paymentTime || new Date().toISOString(),
      raw: orderData
    };
  } catch (err: any) {
    console.error('[Cashfree] Order Verification Exception:', err);
    return {
      success: false,
      orderStatus: 'UNKNOWN',
      error: err?.message || 'Error communicating with Cashfree verification gateway.'
    };
  }
}

/**
 * Webhook signature verification for Cashfree
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secretKey?: string
): boolean {
  const secret = secretKey || getCashfreeCredentials().secretKey;
  if (!secret || !signature || !timestamp) return false;

  try {
    const dataToSign = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (err) {
    console.error('[Cashfree] Signature verification failed:', err);
    return false;
  }
}
