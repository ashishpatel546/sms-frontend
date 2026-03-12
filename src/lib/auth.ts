'use client';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export interface AuthUser {
  sub: number;
  role: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  mobile?: string;
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload as AuthUser;
  } catch {
    removeToken();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}

export function logout(): void {
  removeToken();
  window.location.href = '/';
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ── Refresh token state ────────────────────────────────────────
let isRefreshing = false;
// Subscribers waiting for the in-flight refresh; null token means refresh failed
let refreshSubscribers: ((token: string | null) => void)[] = [];
let refreshAbortController: AbortController | null = null;

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/** Notify all queued subscribers that the refresh failed so they can resolve (not hang). */
function onRefreshFailed() {
  refreshSubscribers.forEach((cb) => cb(null));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Call this when the app returns to the foreground (visibilitychange → visible).
 * If a token refresh was in-flight when the OS backgrounded the PWA (Android will
 * abort the fetch), this resets the stuck flag so the next API call can retry.
 * Register this once in the root layout via useEffect.
 */
export function resetRefreshState(): void {
  if (isRefreshing) {
    refreshAbortController?.abort();
    isRefreshing = false;
    onRefreshFailed();
  }
}

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  let res = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized globally
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      logout();
      return res;
    }

    if (isRefreshing) {
      // Wait for the existing refresh to finish before retrying
      return new Promise((resolve) => {
        addRefreshSubscriber(async (newToken) => {
          if (!newToken) {
            // Refresh failed — return a 401 so callers handle it gracefully
            resolve(new Response(null, { status: 401 }));
            return;
          }
          const newHeaders = {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          };
          resolve(await fetch(url, { ...options, headers: newHeaders }));
        });
      });
    }

    isRefreshing = true;
    refreshAbortController = new AbortController();
    // Safety timeout: if refresh fetch hangs for 15 s, abort it
    const timeoutId = setTimeout(() => refreshAbortController?.abort(), 15_000);

    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: refreshAbortController.signal,
      });

      if (!refreshRes.ok) {
        // Server explicitly rejected the refresh token — session is truly expired
        onRefreshFailed();
        logout();
        return new Response(null, { status: 401 });
      }

      const data = await refreshRes.json();
      setTokens(data.access_token, data.refresh_token || refreshToken);
      onRefreshed(data.access_token);

      // Retry the original request with the new access token
      const newHeaders = {
        ...headers,
        Authorization: `Bearer ${data.access_token}`,
      };
      res = await fetch(url, { ...options, headers: newHeaders });
    } catch (error: any) {
      onRefreshFailed();
      // Only log out if it's a genuine auth rejection, NOT a transient network error or abort.
      // Transient errors (offline, Cloudflare 5xx, Android background abort) must not log the user out.
      const isNetworkError =
        error instanceof TypeError || error?.name === 'AbortError';
      if (!isNetworkError) {
        logout();
      }
      // Re-throw so callers know the request failed
      throw error;
    } finally {
      clearTimeout(timeoutId);
      isRefreshing = false;
      refreshAbortController = null;
    }
  }

  return res;
}

export function getDashboardRoute(role: string): string {
  if (role === 'PARENT') return '/parent-dashboard';
  return '/dashboard';
}
