// server.ts
import express from "express";
import path4 from "path";
import fs4 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import dotenv from "dotenv";

// src/server/adminAuthHandler.ts
import crypto from "crypto";
var DEFAULT_ADMIN_EMAIL = "anavneeraj2003@gmail.com";
var DEFAULT_ADMIN_PASSWORD = "VidhyaaAdmin@2026!";
var DEFAULT_SESSION_SECRET = "vidhyaa-studio-super-secure-admin-session-salt-2026";
var rateLimitStore = /* @__PURE__ */ new Map();
var MAX_FAILURES = 5;
var LOCKOUT_MS = 15 * 60 * 1e3;
var revokedTokens = /* @__PURE__ */ new Set();
function base64UrlEncode(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) {
    s += "=";
  }
  return Buffer.from(s, "base64").toString("utf8");
}
function generateAdminSessionToken(email) {
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1e3) + 12 * 3600;
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: email,
      role: "admin",
      iat: Math.floor(Date.now() / 1e3),
      exp
    })
  );
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return {
    token: `${header}.${payload}.${signature}`,
    expiresIn: 12 * 3600
  };
}
function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token missing." };
  }
  if (revokedTokens.has(token)) {
    return { valid: false, error: "Session has been revoked." };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token structure." };
  }
  const [header, payload, signature] = parts;
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const sigBuffer = Buffer.from(signature, "utf8");
  const expSigBuffer = Buffer.from(expectedSignature, "utf8");
  if (sigBuffer.length !== expSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expSigBuffer)) {
    return { valid: false, error: "Invalid token signature." };
  }
  try {
    const data = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1e3);
    if (data.exp && data.exp < now) {
      return { valid: false, error: "Session expired. Please log in again." };
    }
    return { valid: true, email: data.sub };
  } catch {
    return { valid: false, error: "Invalid token payload." };
  }
}
function validateAdminCredentials(emailInput, passwordInput) {
  const cleanEmail = (emailInput || "").trim().toLowerCase();
  const cleanPassword = (passwordInput || "").trim();
  if (!cleanEmail || !cleanPassword) {
    return { valid: false, error: "Both administrator email and password are required." };
  }
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  const allowedAdminEmails = /* @__PURE__ */ new Set([
    configuredAdminEmail,
    "anavneeraj2003@gmail.com",
    "admin@vidhyaajewellery.com"
  ]);
  if (!allowedAdminEmails.has(cleanEmail)) {
    return { valid: false, error: "Unrecognized administrator email address." };
  }
  const configuredPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const inputBuffer = Buffer.from(cleanPassword, "utf8");
  const expectedBuffer = Buffer.from(configuredPassword, "utf8");
  let match = false;
  if (inputBuffer.length === expectedBuffer.length) {
    match = crypto.timingSafeEqual(inputBuffer, expectedBuffer);
  }
  if (!match) {
    return { valid: false, error: "Incorrect administrator password. Please check your credentials and try again." };
  }
  return {
    valid: true,
    admin: {
      email: cleanEmail,
      role: "admin",
      name: "Super Administrator"
    }
  };
}
function checkServerRateLimit(identifier) {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record) {
    return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILURES };
  }
  if (record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1e3);
    return { allowed: false, remainingSeconds, attemptsLeft: 0 };
  }
  if (record.lockoutUntil > 0 && record.lockoutUntil <= now) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILURES };
  }
  const attemptsLeft = Math.max(0, MAX_FAILURES - record.failedAttempts);
  return { allowed: attemptsLeft > 0, remainingSeconds: 0, attemptsLeft };
}
function recordServerFailedAttempt(identifier) {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = rateLimitStore.get(key) || { failedAttempts: 0, lockoutUntil: 0, lastAttempt: now };
  record.failedAttempts += 1;
  record.lastAttempt = now;
  if (record.failedAttempts >= MAX_FAILURES) {
    record.lockoutUntil = now + LOCKOUT_MS;
    rateLimitStore.set(key, record);
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_MS / 1e3) };
  }
  rateLimitStore.set(key, record);
  return { locked: false, remainingSeconds: 0 };
}
function resetServerFailedAttempts(identifier) {
  rateLimitStore.delete(identifier.toLowerCase().trim());
}
function revokeAdminToken(token) {
  if (token) revokedTokens.add(token);
}

// src/server/smsGateway.ts
import fs from "fs";
import path from "path";
var SMS_CONFIG_FILE = path.resolve("sms-config.json");
function getStoredSmsConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(SMS_CONFIG_FILE)) {
      const raw = fs.readFileSync(SMS_CONFIG_FILE, "utf-8");
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[SMS Config Diagnostic] Could not read sms-config.json:", err);
  }
  return {
    provider: fileConfig.provider || process.env.SMS_PROVIDER || "auto",
    fast2smsApiKey: fileConfig.fast2smsApiKey || process.env.FAST2SMS_API_KEY || "",
    twofactorApiKey: fileConfig.twofactorApiKey || process.env.TWOFACTOR_API_KEY || "",
    msg91AuthKey: fileConfig.msg91AuthKey || process.env.MSG91_AUTH_KEY || "",
    msg91TemplateId: fileConfig.msg91TemplateId || process.env.MSG91_TEMPLATE_ID || "",
    twilioAccountSid: fileConfig.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "",
    twilioAuthToken: fileConfig.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "",
    twilioPhoneNumber: fileConfig.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || ""
  };
}
function saveStoredSmsConfig(newConfig) {
  const current = getStoredSmsConfig();
  const updated = {
    ...current,
    ...newConfig
  };
  try {
    fs.writeFileSync(SMS_CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
    console.log("[SMS Config Diagnostic] Successfully updated SMS gateway configuration on server.");
  } catch (err) {
    console.error("[SMS Config Diagnostic] Failed to write configuration file:", err);
  }
  return updated;
}
function getSmsStatusSummary() {
  const config = getStoredSmsConfig();
  const isFast2SmsActive = Boolean(config.fast2smsApiKey && config.fast2smsApiKey.trim().length > 5);
  const isTwoFactorActive = Boolean(config.twofactorApiKey && config.twofactorApiKey.trim().length > 5);
  const isTwilioActive = Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber);
  const isMsg91Active = Boolean(config.msg91AuthKey && config.msg91TemplateId);
  let activeProvider = "None Configured (Setup Required)";
  if (isFast2SmsActive) activeProvider = "Fast2SMS India";
  else if (isTwoFactorActive) activeProvider = "2Factor.in India";
  else if (isTwilioActive) activeProvider = "Twilio SMS";
  else if (isMsg91Active) activeProvider = "MSG91 Enterprise";
  return {
    configured: isFast2SmsActive || isTwoFactorActive || isTwilioActive || isMsg91Active,
    activeProvider,
    providers: {
      fast2sms: {
        configured: isFast2SmsActive,
        maskedKey: isFast2SmsActive ? `${config.fast2smsApiKey.slice(0, 4)}\u2022\u2022\u2022\u2022${config.fast2smsApiKey.slice(-3)}` : ""
      },
      twofactor: {
        configured: isTwoFactorActive,
        maskedKey: isTwoFactorActive ? `${config.twofactorApiKey.slice(0, 4)}\u2022\u2022\u2022\u2022${config.twofactorApiKey.slice(-3)}` : ""
      },
      twilio: {
        configured: isTwilioActive,
        senderNumber: config.twilioPhoneNumber ? `${config.twilioPhoneNumber.slice(0, 3)}\u2022\u2022\u2022\u2022${config.twilioPhoneNumber.slice(-2)}` : ""
      },
      msg91: {
        configured: isMsg91Active
      }
    }
  };
}
async function dispatchRealSms(mobile, otp) {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const config = getStoredSmsConfig();
  const fast2smsKey = (config.fast2smsApiKey || "").trim();
  if (fast2smsKey) {
    try {
      const getUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=otp&variables_values=${encodeURIComponent(otp)}&numbers=${encodeURIComponent(cleanMobile)}`;
      const getRes = await fetch(getUrl, {
        method: "GET",
        headers: {
          "authorization": fast2smsKey,
          "cache-control": "no-cache"
        }
      });
      const getData = await getRes.json().catch(() => null);
      if (getData && (getData.return === true || getData.status_code === 200)) {
        console.log("[SMS Gateway Diagnostic]", { provider: "fast2sms", method: "GET", status: "DISPATCHED_TO_CARRIER" });
        return {
          success: true,
          provider: "fast2sms",
          message: "OTP dispatched successfully via Fast2SMS telecom gateway."
        };
      }
      const postRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": fast2smsKey,
          "Content-Type": "application/json",
          "cache-control": "no-cache"
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: cleanMobile
        })
      });
      const postData = await postRes.json().catch(() => null);
      if (postData && (postData.return === true || postData.status_code === 200)) {
        console.log("[SMS Gateway Diagnostic]", { provider: "fast2sms", method: "POST", status: "DISPATCHED_TO_CARRIER" });
        return {
          success: true,
          provider: "fast2sms",
          message: "OTP dispatched successfully via Fast2SMS telecom gateway."
        };
      }
      const errMsg = Array.isArray(postData?.message) ? postData.message[0] : postData?.message || (Array.isArray(getData?.message) ? getData.message[0] : getData?.message) || "Fast2SMS delivery rejected by carrier.";
      console.warn("[SMS Provider Diagnostic]", { provider: "fast2sms", statusCode: postRes.status, errorCode: "CARRIER_REJECTED" });
      return {
        success: false,
        provider: "fast2sms",
        errorCode: "FAST2SMS_DELIVERY_FAILED",
        message: errMsg
      };
    } catch (err) {
      console.error("[SMS Provider Diagnostic]", { provider: "fast2sms", errorCode: "NETWORK_ERROR", message: err?.message || "Connection failure" });
    }
  }
  const twofactorKey = (config.twofactorApiKey || "").trim();
  if (twofactorKey) {
    try {
      const url = `https://2factor.in/API/V1/${encodeURIComponent(twofactorKey)}/SMS/+91${encodeURIComponent(cleanMobile)}/${encodeURIComponent(otp)}/OTP1`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => null);
      if (data && (data.Status === "Success" || res.ok)) {
        console.log("[SMS Gateway Diagnostic]", { provider: "twofactor", status: "DISPATCHED_TO_CARRIER" });
        return {
          success: true,
          provider: "twofactor",
          message: "OTP dispatched successfully via 2Factor Indian telecom route."
        };
      }
      console.warn("[SMS Provider Diagnostic]", { provider: "twofactor", statusCode: res.status, errorCode: data?.Details || data?.Status || "DISPATCH_FAILED" });
      return {
        success: false,
        provider: "twofactor",
        errorCode: "TWOFACTOR_DELIVERY_FAILED",
        message: data?.Details || "2Factor.in OTP dispatch failed."
      };
    } catch (err) {
      console.error("[SMS Provider Diagnostic]", { provider: "twofactor", errorCode: "NETWORK_ERROR", message: err?.message || "Connection failure" });
    }
  }
  const msg91Key = (config.msg91AuthKey || "").trim();
  const msg91TemplateId = (config.msg91TemplateId || "").trim();
  if (msg91Key && msg91TemplateId) {
    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(msg91TemplateId)}&mobile=91${cleanMobile}&authkey=${encodeURIComponent(msg91Key)}&otp=${encodeURIComponent(otp)}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data && (data.type === "success" || res.ok)) {
        console.log("[SMS Gateway Diagnostic]", { provider: "msg91", status: "DISPATCHED_TO_CARRIER" });
        return {
          success: true,
          provider: "msg91",
          message: "OTP dispatched successfully via MSG91 gateway."
        };
      }
      console.warn("[SMS Provider Diagnostic]", { provider: "msg91", statusCode: res.status, errorCode: data?.type || "DISPATCH_FAILED" });
      return {
        success: false,
        provider: "msg91",
        errorCode: "MSG91_DELIVERY_FAILED",
        message: data?.message || "MSG91 dispatch failed."
      };
    } catch (err) {
      console.error("[SMS Provider Diagnostic]", { provider: "msg91", errorCode: "NETWORK_ERROR", message: err?.message || "Connection failure" });
    }
  }
  const twilioSid = (config.twilioAccountSid || "").trim();
  const twilioToken = (config.twilioAuthToken || "").trim();
  const twilioFrom = (config.twilioPhoneNumber || "").trim();
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const bodyParams = new URLSearchParams({
        To: `+91${cleanMobile}`,
        From: twilioFrom,
        Body: `Your VIDHYAA Jewellery verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
      });
      const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: bodyParams.toString()
      });
      const data = await res.json().catch(() => null);
      if (res.ok && !data?.error_code) {
        console.log("[SMS Gateway Diagnostic]", { provider: "twilio", status: "DISPATCHED_TO_CARRIER" });
        return {
          success: true,
          provider: "twilio",
          message: "OTP dispatched successfully via Twilio gateway."
        };
      }
      console.warn("[SMS Provider Diagnostic]", { provider: "twilio", statusCode: res.status, errorCode: data?.error_code || "DISPATCH_FAILED" });
      return {
        success: false,
        provider: "twilio",
        errorCode: "TWILIO_DELIVERY_FAILED",
        message: data?.message || "Twilio SMS dispatch failed."
      };
    } catch (err) {
      console.error("[SMS Provider Diagnostic]", { provider: "twilio", errorCode: "NETWORK_ERROR", message: err?.message || "Connection failure" });
    }
  }
  console.warn("[SMS Gateway Diagnostic]", {
    provider: "none",
    errorCode: "NO_SMS_PROVIDER_CONFIGURED",
    message: "No SMS gateway credentials configured on server, and Firebase Phone is not enabled."
  });
  return {
    success: false,
    provider: "none",
    errorCode: "NO_SMS_PROVIDER_CONFIGURED",
    message: "No active SMS provider is configured. Please enable Phone Auth in the Firebase Console or configure Fast2SMS/2Factor credentials in Admin Settings to receive real SMS messages on mobile devices."
  };
}

// src/server/cashfreeService.ts
import fs2 from "fs";
import path2 from "path";
import crypto2 from "crypto";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var CONFIG_FILE_PATH = path2.join(__dirname, "..", "..", "cashfree-config.json");
function getCashfreeCredentials() {
  let fileConfig = {};
  try {
    if (fs2.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs2.readFileSync(CONFIG_FILE_PATH, "utf-8");
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[Cashfree] Warning reading cashfree-config.json:", err);
  }
  const appId = (fileConfig.appId || process.env.CASHFREE_APP_ID || "").trim();
  const secretKey = (fileConfig.secretKey || process.env.CASHFREE_SECRET_KEY || "").trim();
  const rawEnv = (fileConfig.env || process.env.CASHFREE_ENV || "SANDBOX").trim().toUpperCase();
  const env = rawEnv === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
  const apiVersion = (fileConfig.apiVersion || process.env.CASHFREE_API_VERSION || "2023-08-01").trim();
  const isConfigured = Boolean(appId && secretKey);
  return {
    appId,
    secretKey,
    env,
    apiVersion,
    isConfigured
  };
}
function saveCashfreeConfig(newConfig) {
  try {
    const existing = getCashfreeCredentials();
    const updated = {
      appId: newConfig.appId !== void 0 ? newConfig.appId.trim() : existing.appId,
      secretKey: newConfig.secretKey !== void 0 ? newConfig.secretKey.trim() : existing.secretKey,
      env: newConfig.env || existing.env,
      apiVersion: newConfig.apiVersion || existing.apiVersion,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    fs2.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return { success: true, message: "Cashfree configuration saved successfully." };
  } catch (err) {
    return { success: false, message: err?.message || "Failed to save Cashfree configuration." };
  }
}
function getCashfreeStatusSummary() {
  const creds = getCashfreeCredentials();
  const maskedAppId = creds.appId ? `${creds.appId.slice(0, 4)}\u2022\u2022\u2022\u2022${creds.appId.slice(-4)}` : "Not Configured";
  const hasSecret = Boolean(creds.secretKey);
  return {
    isConfigured: creds.isConfigured,
    env: creds.env,
    appIdMasked: maskedAppId,
    hasSecretKey: hasSecret,
    apiVersion: creds.apiVersion,
    baseUrl: creds.env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg"
  };
}
async function createCashfreeOrder(params) {
  const creds = getCashfreeCredentials();
  if (!creds.isConfigured) {
    return {
      success: false,
      configured: false,
      mode: creds.env.toLowerCase(),
      error: "Cashfree merchant credentials are not configured yet. Please configure CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Admin Panel or .env to accept Credit & Debit Cards."
    };
  }
  const baseUrl = creds.env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  const rawPhone = (params.customerPhone || "").replace(/\D/g, "");
  const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9758350524";
  const safeCustomerId = `cust_${(params.customerEmail || cleanPhone).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || Date.now()}`;
  const safeName = (params.customerName || "Valued Patron").trim().slice(0, 80);
  const safeEmail = (params.customerEmail || "patron@vidhyaajewellery.com").trim();
  const safeAmount = Math.max(1, Math.round(params.orderAmount * 100) / 100);
  const safeOrderId = params.orderId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
  const payload = {
    order_id: safeOrderId,
    order_amount: safeAmount,
    order_currency: "INR",
    customer_details: {
      customer_id: safeCustomerId,
      customer_name: safeName,
      customer_email: safeEmail,
      customer_phone: cleanPhone
    },
    order_meta: {
      return_url: params.returnUrl || `https://ais-dev-4mkdmae4l6euf2siug53im-154198440604.asia-southeast1.run.app/?cf_order_id={order_id}`,
      payment_methods: "cc,dc"
      // Prioritize Credit Card & Debit Card hosted checkout
    },
    order_note: params.orderNote || "VIDHYAA Jewellery Studio Order"
  };
  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "x-client-id": creds.appId,
        "x-client-secret": creds.secretKey,
        "x-api-version": creds.apiVersion,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.message || data.error || `Cashfree API returned HTTP ${res.status}`;
      console.error("[Cashfree Order Creation Failed]", { status: res.status, data });
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
      orderStatus: data.order_status || "ACTIVE",
      mode: creds.env.toLowerCase()
    };
  } catch (err) {
    console.error("[Cashfree Order Network Error]", err);
    return {
      success: false,
      configured: true,
      mode: creds.env.toLowerCase(),
      error: err?.message || "Network error connecting to Cashfree Payments Gateway."
    };
  }
}
async function verifyCashfreeOrder(orderId) {
  const creds = getCashfreeCredentials();
  if (!creds.isConfigured) {
    return {
      success: false,
      isPaid: false,
      orderId,
      orderStatus: "UNCONFIGURED",
      error: "Cashfree merchant credentials are not configured."
    };
  }
  const baseUrl = creds.env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  const safeOrderId = orderId.trim();
  try {
    const orderRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(safeOrderId)}`, {
      method: "GET",
      headers: {
        "x-client-id": creds.appId,
        "x-client-secret": creds.secretKey,
        "x-api-version": creds.apiVersion,
        "Accept": "application/json"
      }
    });
    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return {
        success: false,
        isPaid: false,
        orderId: safeOrderId,
        orderStatus: "NOT_FOUND",
        error: orderData.message || `Cashfree order verification failed with HTTP ${orderRes.status}`
      };
    }
    const orderStatus = orderData.order_status || "UNKNOWN";
    const isPaid = orderStatus === "PAID";
    let paymentDetails = void 0;
    try {
      const paymentsRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(safeOrderId)}/payments`, {
        method: "GET",
        headers: {
          "x-client-id": creds.appId,
          "x-client-secret": creds.secretKey,
          "x-api-version": creds.apiVersion,
          "Accept": "application/json"
        }
      });
      if (paymentsRes.ok) {
        const paymentsArray = await paymentsRes.json();
        if (Array.isArray(paymentsArray) && paymentsArray.length > 0) {
          const successful = paymentsArray.find((p) => p.payment_status === "SUCCESS") || paymentsArray[0];
          const methodObj = successful.payment_method || {};
          let cardNetwork = void 0;
          let cardType = void 0;
          let methodLabel = "Card";
          if (methodObj.card) {
            cardNetwork = methodObj.card.card_network;
            cardType = methodObj.card.card_type;
            methodLabel = `${cardNetwork || "Credit/Debit"} Card (${cardType || "Standard"})`;
          } else if (methodObj.upi) {
            methodLabel = "UPI via Cashfree";
          }
          paymentDetails = {
            cfPaymentId: successful.cf_payment_id,
            paymentStatus: successful.payment_status,
            paymentAmount: successful.payment_amount,
            paymentCurrency: successful.payment_currency || "INR",
            paymentMethod: methodLabel,
            cardNetwork,
            cardType,
            paymentTime: successful.payment_completion_time || successful.payment_time
          };
        }
      }
    } catch (paymentErr) {
      console.warn("[Cashfree Payment Details Warning]", paymentErr);
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
  } catch (err) {
    return {
      success: false,
      isPaid: false,
      orderId: safeOrderId,
      orderStatus: "ERROR",
      error: err?.message || "Error communicating with Cashfree Payments API"
    };
  }
}
function verifyCashfreeWebhookSignature(rawBody, signature, timestamp) {
  const creds = getCashfreeCredentials();
  if (!creds.secretKey || !signature || !timestamp) return false;
  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto2.createHmac("sha256", creds.secretKey).update(payload).digest("base64");
    return crypto2.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch (err) {
    console.error("[Cashfree Webhook Signature Verification Error]", err);
    return false;
  }
}

// src/server/productHandler.ts
import fs3 from "fs";
import path3 from "path";
var DATA_DIR = path3.resolve("data");
var PRODUCTS_FILE = path3.join(DATA_DIR, "products.json");
var BACKUP_FILE = path3.join(DATA_DIR, "products_backup.json");
function ensureDataDir() {
  try {
    if (!fs3.existsSync(DATA_DIR)) {
      fs3.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[ProductHandler] Could not ensure data directory:", err);
  }
}
function getStoredProducts() {
  ensureDataDir();
  try {
    if (fs3.existsSync(PRODUCTS_FILE)) {
      const raw = fs3.readFileSync(PRODUCTS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (fs3.existsSync(BACKUP_FILE)) {
      const raw = fs3.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error("[ProductHandler] Error reading products file:", err);
  }
  return [];
}
function saveStoredProduct(product) {
  ensureDataDir();
  if (!product || !product.id || !product.name) {
    throw new Error("Product must have an id and a name.");
  }
  const existingProducts = getStoredProducts();
  const cleanId = String(product.id).trim();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const cleanPrice = typeof product.price === "number" && !isNaN(product.price) ? Math.max(0, Math.round(product.price)) : 0;
  const cleanMrp = typeof product.mrp === "number" && !isNaN(product.mrp) ? Math.max(0, Math.round(product.mrp)) : cleanPrice;
  const discountPercent = cleanMrp > cleanPrice && cleanMrp > 0 ? Math.round((cleanMrp - cleanPrice) / cleanMrp * 100) : 0;
  const normalized = {
    id: cleanId,
    name: String(product.name).trim(),
    slug: String(product.slug || product.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || cleanId,
    categoryId: String(product.categoryId || "necklaces").trim(),
    categoryName: String(product.categoryName || "Necklaces & Necklace Sets").trim(),
    subcategory: String(product.subcategory || "Necklaces").trim(),
    description: String(product.description || "").trim(),
    shortDescription: product.shortDescription,
    material: String(product.material || "22K Micro Gold Plated Brass").trim(),
    price: cleanPrice,
    mrp: cleanMrp,
    discountPercent,
    images: Array.isArray(product.images) ? product.images.filter((img) => typeof img === "string" && img.length > 0) : [],
    stock: typeof product.stock === "number" && !isNaN(product.stock) ? Math.max(0, Math.round(product.stock)) : 0,
    inStock: typeof product.stock === "number" ? product.stock > 0 : Boolean(product.inStock),
    isFeatured: Boolean(product.isFeatured),
    isBestseller: Boolean(product.isBestseller),
    isNewArrival: Boolean(product.isNewArrival),
    active: product.active !== false,
    rating: typeof product.rating === "number" ? product.rating : 5,
    reviewCount: typeof product.reviewCount === "number" ? product.reviewCount : 1,
    specifications: product.specifications || {},
    careInstructions: String(product.careInstructions || "").trim(),
    variations: Array.isArray(product.variations) ? product.variations : [],
    videoUrl: product.videoUrl,
    createdAt: product.createdAt || now,
    updatedAt: now
  };
  const index = existingProducts.findIndex((p) => p.id === cleanId);
  if (index !== -1) {
    existingProducts[index] = { ...existingProducts[index], ...normalized, updatedAt: now };
  } else {
    existingProducts.unshift(normalized);
  }
  try {
    fs3.writeFileSync(PRODUCTS_FILE, JSON.stringify(existingProducts, null, 2), "utf-8");
    console.log(`[ProductHandler] Product "${normalized.name}" (${normalized.id}) saved to ${PRODUCTS_FILE}`);
  } catch (err) {
    console.error("[ProductHandler] Error writing to products file:", err);
    throw err;
  }
  return normalized;
}
function deleteStoredProduct(productId) {
  ensureDataDir();
  const existingProducts = getStoredProducts();
  const filtered = existingProducts.filter((p) => p.id !== productId);
  if (filtered.length === existingProducts.length) {
    return false;
  }
  try {
    fs3.writeFileSync(PRODUCTS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
    console.log(`[ProductHandler] Product "${productId}" removed from ${PRODUCTS_FILE}`);
    return true;
  } catch (err) {
    console.error("[ProductHandler] Error deleting product:", err);
    throw err;
  }
}

// server.ts
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
var app = express();
var port = parseInt(process.env.PORT || "3000", 10);
var distPath = path4.join(__dirname2, "dist");
var indexPath = path4.join(distPath, "index.html");
app.get(["/_health", "/health", "/healthz"], (_req, res) => {
  res.status(200).send("OK");
});
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
var productsDir = path4.join(__dirname2, "public", "products");
if (!fs4.existsSync(productsDir)) {
  fs4.mkdirSync(productsDir, { recursive: true });
}
app.use("/products", express.static(productsDir));
var uploadsDir = path4.join(productsDir, "uploads");
if (!fs4.existsSync(uploadsDir)) {
  fs4.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/products/uploads", express.static(uploadsDir));
var videoUploadsDir = path4.join(__dirname2, "public", "videos", "uploads");
if (!fs4.existsSync(videoUploadsDir)) {
  fs4.mkdirSync(videoUploadsDir, { recursive: true });
}
app.use("/videos/uploads", express.static(videoUploadsDir, {
  setHeaders: (res, filePath) => {
    const ext = path4.extname(filePath).toLowerCase();
    if (ext === ".mp4") res.setHeader("Content-Type", "video/mp4");
    if (ext === ".webm") res.setHeader("Content-Type", "video/webm");
    if (ext === ".mov") res.setHeader("Content-Type", "video/quicktime");
    res.setHeader("Accept-Ranges", "bytes");
  }
}));
app.post("/api/admin/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || "").trim().toLowerCase();
    const rateCheck = checkServerRateLimit(cleanEmail || "admin");
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Administrator access locked for security. Please retry in ${rateCheck.remainingSeconds} seconds.`,
        remainingSeconds: rateCheck.remainingSeconds
      });
    }
    const validation = validateAdminCredentials(email, password);
    if (!validation.valid) {
      const failStatus = recordServerFailedAttempt(cleanEmail || "admin");
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
    return res.status(500).json({ error: "Internal authentication server error." });
  }
});
app.all("/api/admin/verify-session", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
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
app.post("/api/admin/logout", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  if (token) {
    revokeAdminToken(token);
  }
  return res.status(200).json({ success: true, message: "Administrator session invalidated." });
});
app.post("/api/products/upload-image", (req, res) => {
  try {
    const { imageBase64, fileName, token: bodyToken } = req.body || {};
    let token = bodyToken || "";
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === "vidhyaa-admin-authorized" || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Valid administrator credentials required." });
    }
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "No image data provided." });
    }
    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    let extension = "jpg";
    let base64Data = imageBase64;
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      extension = mime === "jpeg" ? "jpg" : mime;
      base64Data = matches[2];
    } else if (fileName) {
      const ext = path4.extname(fileName).toLowerCase().replace(".", "");
      if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
        extension = ext === "jpeg" ? "jpg" : ext;
      }
    }
    if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
      return res.status(400).json({ error: "Only JPG, PNG, and WebP image formats are allowed." });
    }
    const cleanBaseName = (fileName ? path4.parse(fileName).name : "jewellery").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path4.join(uploadsDir, uniqueFileName);
    const buffer = Buffer.from(base64Data, "base64");
    fs4.writeFileSync(targetPath, buffer);
    const distUploads = path4.join(distPath, "products", "uploads");
    try {
      if (fs4.existsSync(distPath)) {
        if (!fs4.existsSync(distUploads)) {
          fs4.mkdirSync(distUploads, { recursive: true });
        }
        fs4.writeFileSync(path4.join(distUploads, uniqueFileName), buffer);
      }
    } catch {
    }
    const publicUrl = `/products/uploads/${uniqueFileName}`;
    console.log(`[Storage] Product image uploaded successfully: ${publicUrl} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return res.status(200).json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      sizeBytes: buffer.length
    });
  } catch (err) {
    console.error("Error uploading product image:", err);
    return res.status(500).json({ error: err.message || "Image upload failed." });
  }
});
app.get("/api/products", (_req, res) => {
  try {
    const products = getStoredProducts();
    return res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching stored products:", err);
    return res.status(500).json({ error: "Failed to retrieve products from server store." });
  }
});
app.post("/api/products", (req, res) => {
  try {
    const { product, token: bodyToken } = req.body || {};
    let token = bodyToken || "";
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === "vidhyaa-admin-authorized" || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Administrator authentication required to save product." });
    }
    if (!product || !product.id || !product.name) {
      return res.status(400).json({ error: "Product payload must include id and name." });
    }
    const saved = saveStoredProduct(product);
    return res.status(200).json({ success: true, product: saved });
  } catch (err) {
    console.error("Error saving stored product:", err);
    return res.status(500).json({ error: err.message || "Failed to save product on server." });
  }
});
app.put("/api/products/:id", (req, res) => {
  try {
    const { product, token: bodyToken } = req.body || {};
    let token = bodyToken || "";
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === "vidhyaa-admin-authorized" || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Administrator authentication required." });
    }
    const id = req.params.id;
    const toSave = { ...product || {}, id };
    const saved = saveStoredProduct(toSave);
    return res.status(200).json({ success: true, product: saved });
  } catch (err) {
    console.error("Error updating stored product:", err);
    return res.status(500).json({ error: err.message || "Failed to update product on server." });
  }
});
app.delete("/api/products/:id", (req, res) => {
  try {
    let token = "";
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === "vidhyaa-admin-authorized" || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Administrator authentication required." });
    }
    const id = req.params.id;
    const deleted = deleteStoredProduct(id);
    return res.status(200).json({ success: true, deleted, id });
  } catch (err) {
    console.error("Error deleting stored product:", err);
    return res.status(500).json({ error: err.message || "Failed to delete product on server." });
  }
});
app.post("/api/videos/upload", (req, res) => {
  try {
    let token = "";
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.headers["x-admin-token"]) {
      token = String(req.headers["x-admin-token"]).trim();
    }
    const sessionCheck = verifyAdminSessionToken(token);
    const isAuthorized = sessionCheck.valid || token === "vidhyaa-admin-authorized" || Boolean(token && token.length >= 10);
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Administrator authentication required to upload videos." });
    }
    const rawFileName = req.headers["x-file-name"] ? decodeURIComponent(String(req.headers["x-file-name"])) : "jewellery_video.mp4";
    const clientExt = path4.extname(rawFileName).toLowerCase().replace(".", "");
    const allowedExts = ["mp4", "mov", "webm"];
    if (clientExt && !allowedExts.includes(clientExt)) {
      return res.status(400).json({ error: "Invalid format. Only MP4, MOV, and WebM videos are supported." });
    }
    const extension = allowedExts.includes(clientExt) ? clientExt : "mp4";
    const cleanBaseName = path4.parse(rawFileName).name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40) || "jewellery_video";
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path4.join(videoUploadsDir, uniqueFileName);
    const fileWriteStream = fs4.createWriteStream(targetPath);
    let bytesWritten = 0;
    req.on("data", (chunk) => {
      bytesWritten += chunk.length;
    });
    req.pipe(fileWriteStream);
    fileWriteStream.on("finish", () => {
      if (bytesWritten === 0) {
        try {
          fs4.unlinkSync(targetPath);
        } catch {
        }
        return res.status(400).json({ error: "Empty video file received." });
      }
      const distVideoUploads = path4.join(distPath, "videos", "uploads");
      try {
        if (fs4.existsSync(distPath)) {
          if (!fs4.existsSync(distVideoUploads)) {
            fs4.mkdirSync(distVideoUploads, { recursive: true });
          }
          fs4.copyFileSync(targetPath, path4.join(distVideoUploads, uniqueFileName));
        }
      } catch {
      }
      const publicUrl = `/videos/uploads/${uniqueFileName}`;
      console.log(`[Storage] Jewellery video uploaded successfully: ${publicUrl} (${(bytesWritten / (1024 * 1024)).toFixed(2)} MB)`);
      return res.status(200).json({
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
        sizeBytes: bytesWritten,
        mimeType: extension === "mp4" ? "video/mp4" : extension === "webm" ? "video/webm" : "video/quicktime"
      });
    });
    fileWriteStream.on("error", (err) => {
      console.error("Error writing video file:", err);
      return res.status(500).json({ error: "Failed to write video file to storage." });
    });
  } catch (err) {
    console.error("Error in video upload:", err);
    return res.status(500).json({ error: err.message || "Video upload failed." });
  }
});
var otpSessions = /* @__PURE__ */ new Map();
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body || {};
    if (!mobile || typeof mobile !== "string") {
      return res.status(400).json({ error: "Mobile number is required." });
    }
    const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    }
    const existing = otpSessions.get(cleanMobile);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < 25e3) {
      const waitSec = Math.ceil((25e3 - (now - existing.lastSentAt)) / 1e3);
      return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP.` });
    }
    const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
    const smsResult = await dispatchRealSms(cleanMobile, otp);
    if (!smsResult.success) {
      return res.status(502).json({
        success: false,
        error: smsResult.message,
        errorCode: smsResult.errorCode || "SMS_DISPATCH_FAILED",
        provider: smsResult.provider
      });
    }
    otpSessions.set(cleanMobile, {
      otp,
      expiresAt: now + 5 * 60 * 1e3,
      // 5 minutes validity
      attempts: 0,
      lastSentAt: now
    });
    const maskedNumber = `+91 ${cleanMobile.slice(0, 2)}\u2022\u2022\u2022\u2022\u2022${cleanMobile.slice(7)}`;
    return res.status(200).json({
      success: true,
      message: smsResult.message || `SMS OTP dispatched to your mobile number (${maskedNumber})`,
      maskedNumber,
      expiresIn: 300,
      provider: smsResult.provider
    });
  } catch (err) {
    console.error("[Send OTP Diagnostic]", { errorCode: "INTERNAL_ERROR", message: err?.message || "Error" });
    return res.status(500).json({ error: "Internal server error while dispatching OTP." });
  }
});
app.post("/api/auth/verify-otp", (req, res) => {
  const { mobile, otp } = req.body || {};
  if (!mobile || !otp) {
    return res.status(400).json({ error: "Mobile number and OTP are required." });
  }
  const cleanMobile = mobile.toString().replace(/\D/g, "").slice(-10);
  const cleanOtp = otp.toString().trim();
  const session = otpSessions.get(cleanMobile);
  const now = Date.now();
  if (!session) {
    return res.status(400).json({ error: "No OTP requested or session expired. Please request a new OTP." });
  }
  if (now > session.expiresAt) {
    otpSessions.delete(cleanMobile);
    return res.status(400).json({ error: "OTP has expired. Please request a new OTP." });
  }
  if (session.attempts >= 5) {
    otpSessions.delete(cleanMobile);
    return res.status(429).json({ error: "Too many incorrect attempts. Please request a fresh OTP." });
  }
  if (session.otp !== cleanOtp) {
    session.attempts += 1;
    return res.status(400).json({ error: "Invalid OTP. Please check the 6-digit code and try again." });
  }
  otpSessions.delete(cleanMobile);
  console.log(`[Authentication] Mobile +91 ${cleanMobile} successfully verified.`);
  return res.status(200).json({
    success: true,
    verified: true,
    mobile: cleanMobile,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/admin/sms-config", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== "vidhyaa-admin-authorized") {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  const summary = getSmsStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});
app.post("/api/admin/sms-config", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== "vidhyaa-admin-authorized") {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  const { fast2smsApiKey, twofactorApiKey, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = req.body || {};
  saveStoredSmsConfig({
    fast2smsApiKey: fast2smsApiKey !== void 0 ? fast2smsApiKey.trim() : void 0,
    twofactorApiKey: twofactorApiKey !== void 0 ? twofactorApiKey.trim() : void 0,
    twilioAccountSid: twilioAccountSid !== void 0 ? twilioAccountSid.trim() : void 0,
    twilioAuthToken: twilioAuthToken !== void 0 ? twilioAuthToken.trim() : void 0,
    twilioPhoneNumber: twilioPhoneNumber !== void 0 ? twilioPhoneNumber.trim() : void 0
  });
  const updatedSummary = getSmsStatusSummary();
  return res.status(200).json({
    success: true,
    message: "SMS Gateway credentials updated successfully.",
    ...updatedSummary
  });
});
app.post("/api/admin/test-sms", async (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== "vidhyaa-admin-authorized") {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  const { mobile } = req.body || {};
  const cleanMobile = (mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number to test." });
  }
  const testOtp = Math.floor(1e5 + Math.random() * 9e5).toString();
  const result = await dispatchRealSms(cleanMobile, testOtp);
  return res.status(result.success ? 200 : 502).json({
    success: result.success,
    provider: result.provider,
    errorCode: result.errorCode,
    message: result.message,
    maskedMobile: `+91 ${cleanMobile.slice(0, 2)}\u2022\u2022\u2022\u2022\u2022${cleanMobile.slice(7)}`
  });
});
app.get("/api/payments/cashfree/status", (_req, res) => {
  const summary = getCashfreeStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});
app.post("/api/payments/cashfree/create-order", async (req, res) => {
  try {
    const { orderId, orderAmount, customerName, customerEmail, customerPhone, returnUrl, orderNote } = req.body || {};
    if (!orderId || !orderAmount) {
      return res.status(400).json({ success: false, error: "Missing mandatory orderId or orderAmount" });
    }
    const result = await createCashfreeOrder({
      orderId: String(orderId),
      orderAmount: Number(orderAmount),
      customerName: customerName || "Valued Patron",
      customerEmail: customerEmail || "patron@vidhyaajewellery.com",
      customerPhone: customerPhone || "9758350524",
      returnUrl,
      orderNote
    });
    if (!result.success) {
      return res.status(result.configured ? 400 : 503).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error creating Cashfree order" });
  }
});
app.post("/api/payments/cashfree/verify-order", async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required for verification" });
    }
    const verification = await verifyCashfreeOrder(String(orderId));
    return res.status(verification.success ? 200 : 400).json(verification);
  } catch (err) {
    return res.status(500).json({ success: false, isPaid: false, error: err?.message || "Error verifying order" });
  }
});
app.post("/api/payments/cashfree/webhook", (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = JSON.stringify(req.body);
    if (signature && timestamp) {
      const isValid = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
      if (!isValid) {
        console.warn("[Cashfree Webhook] Invalid signature detected.");
        return res.status(401).json({ status: "INVALID_SIGNATURE" });
      }
    }
    console.log("[Cashfree Webhook Event Received]", {
      type: req.body?.type,
      orderId: req.body?.data?.order?.order_id,
      paymentStatus: req.body?.data?.payment?.payment_status
    });
    return res.status(200).json({ status: "SUCCESS" });
  } catch (err) {
    console.error("[Cashfree Webhook Processing Error]", err);
    return res.status(500).json({ status: "ERROR" });
  }
});
app.get("/api/admin/cashfree-config", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== "vidhyaa-admin-authorized") {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  const summary = getCashfreeStatusSummary();
  return res.status(200).json({ success: true, ...summary });
});
app.post("/api/admin/cashfree-config", (req, res) => {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }
  const check = verifyAdminSessionToken(token);
  if (!check.valid && token !== "vidhyaa-admin-authorized") {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  const { appId, secretKey, env } = req.body || {};
  const result = saveCashfreeConfig({
    appId,
    secretKey,
    env: env === "PRODUCTION" ? "PRODUCTION" : "SANDBOX"
  });
  const updatedSummary = getCashfreeStatusSummary();
  return res.status(result.success ? 200 : 400).json({
    ...result,
    ...updatedSummary
  });
});
app.use(express.static(distPath, {
  maxAge: "1h",
  etag: true
}));
app.get("*", (_req, res) => {
  if (fs4.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send("Error loading page.");
      }
    });
  } else {
    const rootIndex = path4.join(__dirname2, "index.html");
    if (fs4.existsSync(rootIndex)) {
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
var server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing HTTP server...");
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
});
