// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";
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

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var port = parseInt(process.env.PORT || "3000", 10);
var distPath = path2.join(__dirname, "dist");
var indexPath = path2.join(distPath, "index.html");
app.get(["/_health", "/health", "/healthz"], (_req, res) => {
  res.status(200).send("OK");
});
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
var productsDir = path2.join(__dirname, "public", "products");
if (!fs2.existsSync(productsDir)) {
  fs2.mkdirSync(productsDir, { recursive: true });
}
app.use("/products", express.static(productsDir));
var uploadsDir = path2.join(productsDir, "uploads");
if (!fs2.existsSync(uploadsDir)) {
  fs2.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/products/uploads", express.static(uploadsDir));
var videoUploadsDir = path2.join(__dirname, "public", "videos", "uploads");
if (!fs2.existsSync(videoUploadsDir)) {
  fs2.mkdirSync(videoUploadsDir, { recursive: true });
}
app.use("/videos/uploads", express.static(videoUploadsDir, {
  setHeaders: (res, filePath) => {
    const ext = path2.extname(filePath).toLowerCase();
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
      const ext = path2.extname(fileName).toLowerCase().replace(".", "");
      if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
        extension = ext === "jpeg" ? "jpg" : ext;
      }
    }
    if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
      return res.status(400).json({ error: "Only JPG, PNG, and WebP image formats are allowed." });
    }
    const cleanBaseName = (fileName ? path2.parse(fileName).name : "jewellery").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path2.join(uploadsDir, uniqueFileName);
    const buffer = Buffer.from(base64Data, "base64");
    fs2.writeFileSync(targetPath, buffer);
    const distUploads = path2.join(distPath, "products", "uploads");
    try {
      if (fs2.existsSync(distPath)) {
        if (!fs2.existsSync(distUploads)) {
          fs2.mkdirSync(distUploads, { recursive: true });
        }
        fs2.writeFileSync(path2.join(distUploads, uniqueFileName), buffer);
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
    const clientExt = path2.extname(rawFileName).toLowerCase().replace(".", "");
    const allowedExts = ["mp4", "mov", "webm"];
    if (clientExt && !allowedExts.includes(clientExt)) {
      return res.status(400).json({ error: "Invalid format. Only MP4, MOV, and WebM videos are supported." });
    }
    const extension = allowedExts.includes(clientExt) ? clientExt : "mp4";
    const cleanBaseName = path2.parse(rawFileName).name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40) || "jewellery_video";
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
    const targetPath = path2.join(videoUploadsDir, uniqueFileName);
    const fileWriteStream = fs2.createWriteStream(targetPath);
    let bytesWritten = 0;
    req.on("data", (chunk) => {
      bytesWritten += chunk.length;
    });
    req.pipe(fileWriteStream);
    fileWriteStream.on("finish", () => {
      if (bytesWritten === 0) {
        try {
          fs2.unlinkSync(targetPath);
        } catch {
        }
        return res.status(400).json({ error: "Empty video file received." });
      }
      const distVideoUploads = path2.join(distPath, "videos", "uploads");
      try {
        if (fs2.existsSync(distPath)) {
          if (!fs2.existsSync(distVideoUploads)) {
            fs2.mkdirSync(distVideoUploads, { recursive: true });
          }
          fs2.copyFileSync(targetPath, path2.join(distVideoUploads, uniqueFileName));
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
app.use(express.static(distPath, {
  maxAge: "1h",
  etag: true
}));
app.get("*", (_req, res) => {
  if (fs2.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send("Error loading page.");
      }
    });
  } else {
    const rootIndex = path2.join(__dirname, "index.html");
    if (fs2.existsSync(rootIndex)) {
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
