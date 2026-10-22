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
  if (isFast2SmsActive) activeProvider = 'Fast2SMS India';
  else if (isTwoFactorActive) activeProvider = '2Factor.in India';
  else if (isTwilioActive) activeProvider = 'Twilio SMS';
  else if (isMsg91Active) activeProvider = 'MSG91 Enterprise';

  return {
    configured: isFast2SmsActive || isTwoFactorActive || isTwilioActive || isMsg91Active,
    activeProvider,
    providers: {
      fast2sms: {
        configured: isFast2SmsActive,
        maskedKey: isFast2SmsActive ? `${config.fast2smsApiKey!.slice(0, 4)}••••${config.fast2smsApiKey!.slice(-3)}` : '',
      },
      twofactor: {
        configured: isTwoFactorActive,
        maskedKey: isTwoFactorActive ? `${config.twofactorApiKey!.slice(0, 4)}••••${config.twofactorApiKey!.slice(-3)}` : '',
      },
      twilio: {
        configured: isTwilioActive,
        senderNumber: config.twilioPhoneNumber ? `${config.twilioPhoneNumber.slice(0, 3)}••••${config.twilioPhoneNumber.slice(-2)}` : '',
      },
      msg91: {
        configured: isMsg91Active,
      },
    },
  };
}

/**
 * Dispatch real SMS to Indian mobile numbers (+91) using configured real SMS gateway
 */
export async function dispatchRealSms(mobile: string, otp: string): Promise<SendSmsResult> {
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
  const config = getStoredSmsConfig();

  // 1. Fast2SMS (India's premier Quick & OTP SMS route)
  const fast2smsKey = (config.fast2smsApiKey || '').trim();
  if (fast2smsKey) {
    try {
      const getUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=otp&variables_values=${encodeURIComponent(otp)}&numbers=${encodeURIComponent(cleanMobile)}`;
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

      // If GET route did not return success, try POST route
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
          numbers: cleanMobile,
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
      return {
        success: false,
        provider: 'fast2sms',
        errorCode: 'FAST2SMS_DELIVERY_FAILED',
        message: errMsg,
      };
    } catch (err: any) {
      console.error('[SMS Provider Diagnostic]', { provider: 'fast2sms', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
    }
  }

  // 2. 2Factor.in (Specialized Indian transactional OTP SMS API)
  const twofactorKey = (config.twofactorApiKey || '').trim();
  if (twofactorKey) {
    try {
      const url = `https://2factor.in/API/V1/${encodeURIComponent(twofactorKey)}/SMS/+91${encodeURIComponent(cleanMobile)}/${encodeURIComponent(otp)}/OTP1`;
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
      return {
        success: false,
        provider: 'twofactor',
        errorCode: 'TWOFACTOR_DELIVERY_FAILED',
        message: data?.Details || '2Factor.in OTP dispatch failed.',
      };
    } catch (err: any) {
      console.error('[SMS Provider Diagnostic]', { provider: 'twofactor', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
    }
  }

  // 3. MSG91 (Indian Enterprise DLT Gateway)
  const msg91Key = (config.msg91AuthKey || '').trim();
  const msg91TemplateId = (config.msg91TemplateId || '').trim();
  if (msg91Key && msg91TemplateId) {
    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(msg91TemplateId)}&mobile=91${cleanMobile}&authkey=${encodeURIComponent(msg91Key)}&otp=${encodeURIComponent(otp)}`;
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
      return {
        success: false,
        provider: 'msg91',
        errorCode: 'MSG91_DELIVERY_FAILED',
        message: data?.message || 'MSG91 dispatch failed.',
      };
    } catch (err: any) {
      console.error('[SMS Provider Diagnostic]', { provider: 'msg91', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
    }
  }

  // 4. Twilio SMS
  const twilioSid = (config.twilioAccountSid || '').trim();
  const twilioToken = (config.twilioAuthToken || '').trim();
  const twilioFrom = (config.twilioPhoneNumber || '').trim();
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const bodyParams = new URLSearchParams({
        To: `+91${cleanMobile}`,
        From: twilioFrom,
        Body: `Your VIDHYAA Jewellery verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
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
        console.log('[SMS Gateway Diagnostic]', { provider: 'twilio', status: 'DISPATCHED_TO_CARRIER' });
        return {
          success: true,
          provider: 'twilio',
          message: 'OTP dispatched successfully via Twilio gateway.',
        };
      }

      console.warn('[SMS Provider Diagnostic]', { provider: 'twilio', statusCode: res.status, errorCode: data?.error_code || 'DISPATCH_FAILED' });
      return {
        success: false,
        provider: 'twilio',
        errorCode: 'TWILIO_DELIVERY_FAILED',
        message: data?.message || 'Twilio SMS dispatch failed.',
      };
    } catch (err: any) {
      console.error('[SMS Provider Diagnostic]', { provider: 'twilio', errorCode: 'NETWORK_ERROR', message: err?.message || 'Connection failure' });
    }
  }

  // 5. No SMS Provider Configured
  // Safely inform that no telecom carrier gateway or Firebase phone auth is available
  console.warn('[SMS Gateway Diagnostic]', {
    provider: 'none',
    errorCode: 'NO_SMS_PROVIDER_CONFIGURED',
    message: 'No SMS gateway credentials configured on server, and Firebase Phone is not enabled.'
  });

  return {
    success: false,
    provider: 'none',
    errorCode: 'NO_SMS_PROVIDER_CONFIGURED',
    message: 'No active SMS provider is configured. Please enable Phone Auth in the Firebase Console or configure Fast2SMS/2Factor credentials in Admin Settings to receive real SMS messages on mobile devices.',
  };
}
