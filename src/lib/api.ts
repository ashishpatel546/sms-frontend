import { authFetch } from "./auth";
import { getEnv } from "./env";

export const API_BASE_URL = getEnv('API_URL') || "http://localhost:3000";
export const SCHOOL_SLUG = getEnv('SCHOOL_SLUG') || '';

export const fetcher = async (url: string) => {
    // Resolve at call time, not at module load, so window.__ENV__ is populated
    const apiBase = getEnv('API_URL') || "http://localhost:3000";
    const fullUrl = url.startsWith("http") ? url : `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;

    // Use authFetch so that:
    // 1. The shared isRefreshing lock prevents simultaneous refresh races with other authFetch calls
    // 2. Network errors (TypeError, AbortError) do NOT trigger logout — only genuine server rejections do
    const res = await authFetch(fullUrl);

    if (!res.ok) {
        const error = new Error("An error occurred while fetching the data.");
        // Attach extra info to the error object.
        (error as any).info = await res.json().catch(() => ({}));
        (error as any).status = res.status;
        throw error;
    }

    return res.json();
};
