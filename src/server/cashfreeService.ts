import {
  getCashfreeCredentials as coreGetCreds,
  saveCashfreeConfig as coreSaveConfig,
  getCashfreeStatusSummary as coreGetStatus,
  createCashfreeOrder as coreCreateOrder,
  verifyCashfreeOrder as coreVerifyOrder,
  verifyCashfreeWebhookSignature as coreVerifyWebhook
} from './cashfreeCore.js';

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
  notifyUrl?: string;
  paymentMethods?: string;
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
  isFailed?: boolean;
  mismatch?: boolean;
  configured?: boolean;
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
    paymentMessage?: string;
  };
  error?: string;
}

export function getCashfreeCredentials() {
  return coreGetCreds();
}

export function saveCashfreeConfig(newConfig: Partial<CashfreeStoredConfig>) {
  return coreSaveConfig(newConfig);
}

export function getCashfreeStatusSummary() {
  return coreGetStatus();
}

export async function createCashfreeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  return coreCreateOrder(params) as Promise<CreateOrderResult>;
}

export async function verifyCashfreeOrder(
  orderId: string,
  options?: { expectedAmount?: number; expectedCurrency?: string }
): Promise<VerifyOrderResult> {
  return coreVerifyOrder(orderId, options) as Promise<VerifyOrderResult>;
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  return coreVerifyWebhook(rawBody, signature, timestamp);
}
