import { getToken, getRefreshToken, setTokens, logout } from "./auth";
import { getEnv, getSchoolSlug } from "./env";

export const API_BASE_URL = getEnv('API_URL') || "http://localhost:3000";
export const SCHOOL_SLUG = getEnv('SCHOOL_SLUG') || '';

export const fetcher = async (url: string) => {
    // Resolve at call time, not at module load, so window.__ENV__ is populated
    const apiBase = getEnv('API_URL') || "http://localhost:3000";
    const fullUrl = url.startsWith("http") ? url : `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const slug = getSchoolSlug();
    if (slug) headers['X-School-Slug'] = slug;

    if (typeof window !== 'undefined') {
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    let res = await fetch(fullUrl, { headers });

    if (res.status === 401) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${apiBase}/auth/refresh-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    setTokens(data.access_token, data.refresh_token || refreshToken);
                    headers['Authorization'] = `Bearer ${data.access_token}`;
                    res = await fetch(fullUrl, { headers });
                } else {
                    logout();
                }
            } catch (err) {
                logout();
            }
        } else {
            logout();
        }
    }

    if (!res.ok) {
        const error = new Error("An error occurred while fetching the data.");
        // Attach extra info to the error object.
        (error as any).info = await res.json().catch(() => ({}));
        (error as any).status = res.status;
        throw error;
    }

    return res.json();
};
