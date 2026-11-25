// In-memory administrator session token holder.
// Strictly kept in JS memory (never written to localStorage or sessionStorage)
// so cookie-restricted preview iframes still authenticate admin API requests reliably.
import { auth } from './firebase';

let inMemoryAdminToken: string | null = null;

export function setAdminMemoryToken(token: string | null | undefined): void {
  const clean = typeof token === 'string' ? token.trim() : '';
  inMemoryAdminToken = clean || null;
}

export function getAdminMemoryToken(): string | null {
  return inMemoryAdminToken;
}

export function clearAdminMemoryToken(): void {
  inMemoryAdminToken = null;
}

export function getAdminAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!inMemoryAdminToken) {
    return { ...extra };
  }
  return {
    ...extra,
    Authorization: `Bearer ${inMemoryAdminToken}`
  };
}

export interface ResolvedAdminAuthHeaders {
  headers: Record<string, string>;
  authenticated: boolean;
  authMethod: 'memory_token' | 'cookie' | 'firebase_exchange' | 'firebase_bearer' | 'none';
}

function isHtmlAuthPayload(text: string, contentType: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true;
  const trimmed = (text || '').trim();
  return (
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    trimmed.startsWith('<')
  );
}

async function probeCookieAdminSession(): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch('/api/admin/auth-status', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const text = await res.text();
    if (!res.ok || isHtmlAuthPayload(text, res.headers.get('content-type'))) {
      return false;
    }
    const data = text.trim() ? JSON.parse(text) : null;
    return Boolean(data?.isAuthenticatedAdmin || data?.authenticated);
  } catch {
    return false;
  }
}

/**
 * Resolves administrator authentication headers without weakening existing
 * verified-admin, email verification, allowlist, session, or CSRF protections.
 *
 * - Keeps tokens strictly in JS module memory (never localStorage or sessionStorage).
 * - When an authenticated HttpOnly cookie session is active with no in-memory Bearer token,
 *   omits Authorization / x-admin-token so verifyCsrfOriginForCookieRequest() executes in full.
 * - When forceRefresh is requested and Firebase auth.currentUser is null, safely re-checks
 *   the cookie session and returns authenticated: false if no valid auth method exists.
 */
export async function resolveAdminAuthHeaders(
  extra: Record<string, string> = {},
  options?: { forceRefresh?: boolean }
): Promise<ResolvedAdminAuthHeaders> {
  const forceRefresh = Boolean(options?.forceRefresh);

  if (!forceRefresh) {
    if (inMemoryAdminToken) {
      return {
        headers: {
          ...extra,
          Authorization: `Bearer ${inMemoryAdminToken}`
        },
        authenticated: true,
        authMethod: 'memory_token'
      };
    }

    const cookieActive = await probeCookieAdminSession();
    if (cookieActive) {
      // Pure cookie session: deliberately omit Authorization/x-admin-token so server CSRF checks run in full.
      return {
        headers: { ...extra },
        authenticated: true,
        authMethod: 'cookie'
      };
    }
  }

  const currentUser = auth?.currentUser || null;
  if (currentUser) {
    try {
      const freshIdToken = await currentUser.getIdToken(true);
      if (freshIdToken && typeof fetch !== 'undefined') {
        try {
          const loginRes = await fetch('/api/admin/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({ idToken: freshIdToken })
          });
          const loginText = await loginRes.text();
          if (!isHtmlAuthPayload(loginText, loginRes.headers.get('content-type'))) {
            const loginData = loginText.trim() ? JSON.parse(loginText) : null;
            if (loginRes.ok && loginData?.success && typeof loginData.token === 'string' && loginData.token.trim()) {
              const sessionToken = loginData.token.trim();
              setAdminMemoryToken(sessionToken);
              return {
                headers: {
                  ...extra,
                  Authorization: `Bearer ${sessionToken}`
                },
                authenticated: true,
                authMethod: 'firebase_exchange'
              };
            }
          }
        } catch {
          // Fall through to Firebase ID token Bearer header verified server-side by authenticateAdminRequest()
        }

        return {
          headers: {
            ...extra,
            Authorization: `Bearer ${freshIdToken}`
          },
          authenticated: true,
          authMethod: 'firebase_bearer'
        };
      }
    } catch {
      // Fall through to safe cookie re-check below
    }
  }

  // If forceRefresh was requested while auth.currentUser is null (or refresh failed),
  // safely re-check the existing cookie session without bypassing auth or CSRF.
  if (forceRefresh) {
    const cookieActive = await probeCookieAdminSession();
    if (cookieActive) {
      return {
        headers: { ...extra },
        authenticated: true,
        authMethod: 'cookie'
      };
    }
  }

  return {
    headers: { ...extra },
    authenticated: false,
    authMethod: 'none'
  };
}

