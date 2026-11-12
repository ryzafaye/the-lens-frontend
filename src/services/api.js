import axios from 'axios';

const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

export const apiClient = axios.create({
    baseURL: apiOrigin,
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

let csrfInitialized = false;

function apiPath(path) {
    const value = String(path ?? '/');
    if (/^https?:\/\//i.test(value) || value.startsWith('/api/')) return value;
    return `/api${value.startsWith('/') ? value : `/${value}`}`;
}

async function ensureCsrfCookie() {
    if (csrfInitialized) return;
    await apiClient.get('/sanctum/csrf-cookie');
    csrfInitialized = true;
}

export async function apiRequest(path, options = {}) {
    const method = String(options.method ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        await ensureCsrfCookie();
    }

    return apiClient.request({
        ...options,
        method,
        url: apiPath(path),
    });
}

export async function apiFetch(path, options = {}) {
    try {
        const response = await apiRequest(path, {
            method: options.method ?? 'GET',
            params: options.params,
            data: options.body,
            headers: options.headers,
        });

        return {
            ok: true,
            status: response.status,
            json: async () => response.data,
        };
    } catch (error) {
        return {
            ok: false,
            status: error.response?.status ?? 0,
            json: async () => error.response?.data ?? { message: error.message },
        };
    }
}
