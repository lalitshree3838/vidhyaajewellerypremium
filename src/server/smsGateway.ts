import fs from 'fs';
import path from 'path';

export interface SendSmsResult {
  success: boolean;
  provider: 'fast2sms' | 'twofactor' | 'msg91' | 'twilio' | 'none';
  errorCode?: string;
  message: string;
}

export interface SmsGatewayConfig {
  provider?: 'fast2sms' | 'twofactor' | 'twilio' | 'msg91' | 'auto';
  fast2smsApiKey?: string;
  twofactorApiKey?: string;
  msg91AuthKey?: string;
  msg91TemplateId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

const SMS_CONFIG_FILE = path.resolve('sms-config.json');

/**
 * Load SMS gateway configuration from persistent file or process.env
 */
export function getStoredSmsConfig(): SmsGatewayConfig {
  let fileConfig: SmsGatewayConfig = {};
  try {
    if (fs.existsSync(SMS_CONFIG_FILE)) {
      const raw = fs.readFileSync(SMS_CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SMS Config Diagnostic] Could not read sms-config.json:', err);
  }

  return {
    provider: fileConfig.provider || (process.env.SMS_PROVIDER as any) || 'auto',
    fast2smsApiKey: fileConfig.fast2smsApiKey || process.env.FAST2SMS_API_KEY || '',
    twofactorApiKey: fileConfig.twofactorApiKey || process.env.TWOFACTOR_API_KEY || '',
    msg91AuthKey: fileConfig.msg91AuthKey || process.env.MSG91_AUTH_KEY || '',
    msg91TemplateId: fileConfig.msg91TemplateId || process.env.MSG91_TEMPLATE_ID || '',
    twilioAccountSid: fileConfig.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: fileConfig.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: fileConfig.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '',
  };
}

/**
 * Save SMS gateway configuration to persistent file
 */
export function saveStoredSmsConfig(newConfig: Partial<SmsGatewayConfig>): SmsGatewayConfig {
  const current = getStoredSmsConfig();
  const updated: SmsGatewayConfig = {
    ...current,
    ...newConfig,
  };

  try {
    fs.writeFileSync(SMS_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    console.log('[SMS Config Diagnostic] Successfully updated SMS gateway configuration on server.');
  } catch (err) {
    console.error('[SMS Config Diagnostic] Failed to write configuration file:', err);
  }

  return updated;
}

/**
 * Get active SMS Gateway status summary for UI / Admin without exposing raw secrets
 */
export function getSmsStatusSummary() {
  const config = getStoredSmsConfig();

  const isFast2SmsActive = Boolean(config.fast2smsApiKey && config.fast2smsApiKey.trim().length > 5);
  const isTwoFactorActive = Boolean(config.twofactorApiKey && config.twofactorApiKey.trim().length > 5);
  const isTwilioActive = Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber);
  const isMsg91Active = Boolean(config.msg91AuthKey && config.msg91TemplateId);

  let activeProvider = 'None Configured (Setup Required)';
  if (isTwilioActive) activeProvider = 'Twilio Worldwide SMS';
  else if (isFast2SmsActive) activeProvider = 'Fast2SMS India';
  else if (isTwoFactorActive) activeProvider = '2Factor.in India';
  else if (isMsg91Active) activeProvider = 'MSG91 Enterprise';

  return {
    configured: isFast2SmsActive || isTwoFactorActive || isTwilioActive || isMsg91Active,
    activeProvider,
    internationalSupported: isTwilioActive,
    providers: {
      twilio: {
        configured: isTwilioActive,
        description: 'Worldwide international SMS delivery (180+ countries)',
        senderNumber: config.twilioPhoneNumber ? `${config.twilioPhoneNumber.slice(0, 3)}••••${config.twilioPhoneNumber.slice(-2)}` : '',
      },
      fast2sms: {
        configured: isFast2SmsActive,
        description: 'Domestic India (+91) OTP route',
        maskedKey: isFast2SmsActive ? `${config.fast2smsApiKey!.slice(0, 4)}••••${config.fast2smsApiKey!.slice(-3)}` : '',
      },
      twofactor: {
        configured: isTwoFactorActive,
        description: 'Domestic India (+91) OTP route',
        maskedKey: isTwoFactorActive ? `${config.twofactorApiKey!.slice(0, 4)}••••${config.twofactorApiKey!.slice(-3)}` : '',
      },
      msg91: {
        configured: isMsg91Active,
        description: 'Domestic India (+91) DLT transactional route',
      },
    },
  };
}

/**
 * Dispatch real SMS to Indian or international mobile numbers using configured telecom gateway
 * Supports full E.164 international numbers (+1..., +44..., +971..., +91..., etc.)
 */
export async function dispatchRealSms(phoneInput: string, otp: string): Promise<SendSmsResult> {
  const cleanInput = (phoneInput || '').trim();
  const config = getStoredSmsConfig();

  // Normalize phone to E.164
  let e164Number = cleanInput;
  if (!e164Number.startsWith('+')) {
    const digitsOnly = e164Number.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      e164Number = `+91${digitsOnly}`;
    } else {
      e164Number = `+${digitsOnly}`;
    }
  }

  const isIndia = e164Number.startsWith('+91');
  const indian10Digit = isIndia ? e164Number.slice(3).replace(/\D/g, '').slice(-10) : '';

  // 1. Worldwide International SMS Route: Twilio SMS (Supports 180+ countries)
  const twilioSid = (config.twilioAccountSid || '').trim();
  const twilioToken = (config.twilioAuthToken || '').trim();
  const twilioFrom = (config.twilioPhoneNumber || '').trim();
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const bodyParams = new URLSearchParams({
        To: e164Number,
        From: twilioFrom,
        Body: `Your VIDHYAA Jewellery Studio verification code is: ${otp}. Valid for 5 minutes. Do not share this OTP.`,
      });
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });
      const data: any = await res.json().catch(() => null);

      if (res.ok && !data?.error_code) {
        console.log('[SMS Gateway Diagnostic]', { provider: 'twilio', status: 'DISPATCHED_TO_CARRIER', destination: e164Number.slice(0, 4) + '••••' });
        return {
          success: true,
          provider: 'twilio',
          message: `OTP dispatched successfully to ${e164Number} via Twilio international carrier.`,
        };
      }

      console.warn('[SMS Provider Diagnostic]', { provider: 'twilio', statusCode: res.status, errorCode: data?.error_code || 'DISPATCH_FAILED' });
      // If twilio fails and it's India, let it fall through to domestic Indian providers below
      if (!isIndia) {
        return {
          success: false,
          provider: 'twilio',
          errorCode: 'TWILIO_DELIVERY_FAILED',
          message: data?.message || 'Twilio SMS dispatch failed.',
        };
      }
    } catch (err: any) {
      console.error('[SMS Provider Diagnostic]', { provider: 'twilio', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
      if (!isIndia) {
        return {
          success: false,
          provider: 'twilio',
          errorCode: 'NETWORK_ERROR',
          message: 'Failed to connect to Twilio SMS gateway.',
        };
      }
    }
  }

  // Domestic Indian Routes (Fast2SMS, 2Factor, MSG91)
  if (isIndia && indian10Digit.length === 10) {
    // 2. Fast2SMS (India Quick & OTP Route)
    const fast2smsKey = (config.fast2smsApiKey || '').trim();
    if (fast2smsKey) {
      try {
        const getUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=otp&variables_values=${encodeURIComponent(otp)}&numbers=${encodeURIComponent(indian10Digit)}`;
        const getRes = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'authorization': fast2smsKey,
            'cache-control': 'no-cache',
          },
        });

        const getData: any = await getRes.json().catch(() => null);
        if (getData && (getData.return === true || getData.status_code === 200)) {
          console.log('[SMS Gateway Diagnostic]', { provider: 'fast2sms', method: 'GET', status: 'DISPATCHED_TO_CARRIER' });
          return {
            success: true,
            provider: 'fast2sms',
            message: 'OTP dispatched successfully via Fast2SMS telecom gateway.',
          };
        }

        const postRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json',
            'cache-control': 'no-cache',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: indian10Digit,
          }),
        });

        const postData: any = await postRes.json().catch(() => null);
        if (postData && (postData.return === true || postData.status_code === 200)) {
          console.log('[SMS Gateway Diagnostic]', { provider: 'fast2sms', method: 'POST', status: 'DISPATCHED_TO_CARRIER' });
          return {
            success: true,
            provider: 'fast2sms',
            message: 'OTP dispatched successfully via Fast2SMS telecom gateway.',
          };
        }

        const errMsg = Array.isArray(postData?.message)
          ? postData.message[0]
          : (postData?.message || (Array.isArray(getData?.message) ? getData.message[0] : getData?.message) || 'Fast2SMS delivery rejected by carrier.');

        console.warn('[SMS Provider Diagnostic]', { provider: 'fast2sms', statusCode: postRes.status, errorCode: 'CARRIER_REJECTED' });
      } catch (err: any) {
        console.error('[SMS Provider Diagnostic]', { provider: 'fast2sms', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
      }
    }

    // 3. 2Factor.in (Indian transactional OTP route)
    const twofactorKey = (config.twofactorApiKey || '').trim();
    if (twofactorKey) {
      try {
        const url = `https://2factor.in/API/V1/${encodeURIComponent(twofactorKey)}/SMS/+91${encodeURIComponent(indian10Digit)}/${encodeURIComponent(otp)}/OTP1`;
        const res = await fetch(url, { method: 'GET' });
        const data: any = await res.json().catch(() => null);

        if (data && (data.Status === 'Success' || res.ok)) {
          console.log('[SMS Gateway Diagnostic]', { provider: 'twofactor', status: 'DISPATCHED_TO_CARRIER' });
          return {
            success: true,
            provider: 'twofactor',
            message: 'OTP dispatched successfully via 2Factor Indian telecom route.',
          };
        }
        console.warn('[SMS Provider Diagnostic]', { provider: 'twofactor', statusCode: res.status, errorCode: data?.Details || data?.Status || 'DISPATCH_FAILED' });
      } catch (err: any) {
        console.error('[SMS Provider Diagnostic]', { provider: 'twofactor', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
      }
    }

    // 4. MSG91 (Indian DLT Enterprise Gateway)
    const msg91Key = (config.msg91AuthKey || '').trim();
    const msg91TemplateId = (config.msg91TemplateId || '').trim();
    if (msg91Key && msg91TemplateId) {
      try {
        const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(msg91TemplateId)}&mobile=91${indian10Digit}&authkey=${encodeURIComponent(msg91Key)}&otp=${encodeURIComponent(otp)}`;
        const res = await fetch(url, { method: 'POST' });
        const data: any = await res.json().catch(() => null);

        if (data && (data.type === 'success' || res.ok)) {
          console.log('[SMS Gateway Diagnostic]', { provider: 'msg91', status: 'DISPATCHED_TO_CARRIER' });
          return {
            success: true,
            provider: 'msg91',
            message: 'OTP dispatched successfully via MSG91 gateway.',
          };
        }
        console.warn('[SMS Provider Diagnostic]', { provider: 'msg91', statusCode: res.status, errorCode: data?.type || 'DISPATCH_FAILED' });
      } catch (err: any) {
        console.error('[SMS Provider Diagnostic]', { provider: 'msg91', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
      }
    }
  }

  // If phone is not India and Twilio was not configured:
  if (!isIndia) {
    return {
      success: false,
      provider: 'none',
      errorCode: 'NO_INTERNATIONAL_SMS_PROVIDER',
      message: `International SMS delivery to ${e164Number} requires Phone Authentication in the Firebase Console (which routes via Google Telecom globally) or Twilio configured on the server.`,
    };
  }

  // No SMS provider configured for domestic India either
  console.warn('[SMS Gateway Diagnostic]', {
    provider: 'none',
    errorCode: 'NO_SMS_PROVIDER_CONFIGURED',
    message: 'No SMS gateway credentials configured on server, and Firebase Phone is not enabled.'
  });

  return {
    success: false,
    provider: 'none',
    errorCode: 'NO_SMS_PROVIDER_CONFIGURED',
    message: 'No active SMS provider is configured on the server. Please enable Phone Auth in the Firebase Console or configure SMS Gateway credentials (Twilio / Fast2SMS) in Admin Settings to receive real SMS messages on mobile devices.',
  };
}
