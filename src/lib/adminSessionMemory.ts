// In-memory administrator session token holder.
// Strictly kept in JS memory (never written to localStorage or sessionStorage)
// so cookie-restricted preview iframes still authenticate admin API requests reliably.

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
