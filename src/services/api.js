import axios from 'axios';

// In development / VS Code port forwarding / dev tunnels, use relative paths ('')
// so requests are proxied by Vite's dev server to http://127.0.0.1:8000.
// In production, use VITE_API_BASE_URL if configured, or fallback to relative paths.
const apiOrigin = import.meta.env.DEV
    ? ''
    : (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const apiClient = axios.create({
    baseURL: apiOrigin,
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

let csrfPromise = null;
let csrfInitialized = false;

// In-memory cache to ensure instantaneous tab switching and data display
const apiCache = new Map();

function getCache(key, maxAgeMs = 30000) {
    const item = apiCache.get(key);
    if (!item) return null;
    if (Date.now() - item.time > maxAgeMs) {
        apiCache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    apiCache.set(key, { data, time: Date.now() });
}

export function clearApiCache(prefix = '') {
    if (!prefix) {
        apiCache.clear();
        return;
    }
    for (const key of apiCache.keys()) {
        if (key.startsWith(prefix)) {
            apiCache.delete(key);
        }
    }
}

/**
 * Initializes CSRF token via /api/ping only when necessary.
 * Deduplicates in-flight calls so multiple mutations in the same tick share one promise.
 */
export async function ensureCsrfToken(force = false) {
    if (csrfInitialized && !force) return;

    if (!csrfPromise || force) {
        csrfPromise = apiClient.get('/api/ping')
            .then((response) => {
                if (response.data?.csrf_token) {
                    apiClient.defaults.headers.common['X-CSRF-TOKEN'] = response.data.csrf_token;
                }
                csrfInitialized = true;
            })
            .catch((err) => {
                console.warn('Could not initialize CSRF token via /api/ping:', err.message);
            })
            .finally(() => {
                csrfPromise = null;
            });
    }

    await csrfPromise;
}

// Request Interceptor: Ensure CSRF token only for mutating methods (POST, PUT, PATCH, DELETE)
apiClient.interceptors.request.use(async (config) => {
    const method = (config.method || 'get').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        await ensureCsrfToken();
    }
    return config;
});

// Intercept 419 (CSRF Token Mismatch) and automatically refresh token and retry
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (
            error.response &&
            error.response.status === 419 &&
            originalRequest &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            csrfInitialized = false;
            try {
                await ensureCsrfToken(true);
                const freshToken = apiClient.defaults.headers.common['X-CSRF-TOKEN'];
                if (freshToken) {
                    originalRequest.headers['X-CSRF-TOKEN'] = freshToken;
                }
                return apiClient(originalRequest);
            } catch (retryErr) {
                return Promise.reject(retryErr);
            }
        }
        return Promise.reject(error);
    }
);

export async function login(studentNumber, password) {
    await ensureCsrfToken();
    clearApiCache();

    const response = await apiClient.post('/api/login', {
        student_number: studentNumber,
        password: password,
    });

    if (response.data?.csrf_token) {
        apiClient.defaults.headers.common['X-CSRF-TOKEN'] = response.data.csrf_token;
        csrfInitialized = true;
    } else {
        // Session regenerated upon login; fetch fresh token
        csrfInitialized = false;
        await ensureCsrfToken(true);
    }

    return response.data;
}

export async function logout() {
    clearApiCache();
    try {
        const response = await apiClient.post('/api/logout');
        return response.data;
    } finally {
        csrfInitialized = false;
        delete apiClient.defaults.headers.common['X-CSRF-TOKEN'];
    }
}

// In-flight promise deduplicator for /api/user requests
let inFlightUserPromise = null;

export async function getUser(forceFresh = false) {
    const cacheKey = 'current_user';
    if (!forceFresh) {
        const cached = getCache(cacheKey, 60000); // 1 minute client cache
        if (cached) return cached;
    }

    if (inFlightUserPromise && !forceFresh) {
        return inFlightUserPromise;
    }

    inFlightUserPromise = apiClient.get('/api/user')
        .then((response) => {
            setCache(cacheKey, response.data);
            return response.data;
        })
        .finally(() => {
            inFlightUserPromise = null;
        });

    return inFlightUserPromise;
}

// Writer Portal API calls
export async function getWriterDashboard(forceFresh = false) {
    const cacheKey = 'writer_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/writer/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getWriterSubmitData(draftId = null, forceFresh = false) {
    const cacheKey = `writer_submit_${draftId || 'new'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const params = draftId ? { draft_id: draftId } : {};
    const response = await apiClient.get('/api/writer/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeWriterArticle(data) {
    clearApiCache();
    const response = await apiClient.post('/api/writer/submit-article', data);
    return response.data;
}

export async function getWriterArticles(forceFresh = false) {
    const cacheKey = 'writer_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/writer/manage-my-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function deleteWriterDraft(draftId) {
    clearApiCache('writer_');
    const response = await apiClient.delete(`/api/writer/drafts/${draftId}`);
    return response.data;
}

export async function updateProfileInfo(formData) {
    clearApiCache();
    const isFormData = formData instanceof FormData;
    const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.post('/api/profile/update-info', formData, { headers });
    return response.data;
}

export async function uploadProfileAvatar(imageFile) {
    clearApiCache();
    const formData = imageFile instanceof FormData ? imageFile : new FormData();
    if (!(imageFile instanceof FormData)) {
        formData.append('image', imageFile);
    }
    const response = await apiClient.post('/api/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function updatePassword(currentPassword, newPassword, confirmPassword) {
    clearApiCache();
    let payload = {};
    if (typeof currentPassword === 'object' && currentPassword !== null) {
        payload = {
            current_password: currentPassword.current_password || currentPassword.currentPassword,
            new_password: currentPassword.new_password || currentPassword.password || currentPassword.newPassword,
            new_password_confirmation: currentPassword.new_password_confirmation || currentPassword.password_confirmation || currentPassword.confirmPassword,
        };
    } else {
        payload = {
            current_password: currentPassword,
            new_password: newPassword,
            new_password_confirmation: confirmPassword,
        };
    }
    const response = await apiClient.post('/api/profile/update-password', payload);
    return response.data;
}

// Section Head Portal API calls
export async function getSectionHeadDashboard(forceFresh = false) {
    const cacheKey = 'section_head_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/section-head/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getSectionHeadReviewArticles(params = {}, forceFresh = false) {
    const cacheKey = `section_head_reviews_${params.category || 'all'}_${params.sort || 'newest'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/section-head/review-articles', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function updateSectionHeadReviewArticle(articleId, data) {
    clearApiCache('section_head_');
    const response = await apiClient.post(`/api/section-head/review-articles/${articleId}`, data);
    return response.data;
}

export async function approveSectionHeadArticle(articleId, data = {}) {
    clearApiCache('section_head_');
    clearApiCache('section_');
    clearApiCache('eic_');
    clearApiCache('exec_');
    const response = await apiClient.post(`/api/section-head/review-articles/${articleId}/approve`, data);
    return response.data;
}

export async function returnSectionHeadArticleForRevision(articleId, remarks) {
    clearApiCache('section_head_');
    clearApiCache('section_');
    clearApiCache('eic_');
    clearApiCache('exec_');
    const response = await apiClient.post(`/api/section-head/review-articles/${articleId}/revision`, { remarks });
    return response.data;
}

export async function getSectionHeadArticles(forceFresh = false) {
    const cacheKey = 'section_head_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/section-head/manage-my-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getSectionHeadSubmitData(draftId = null, forceFresh = false) {
    const cacheKey = `section_head_submit_${draftId || 'new'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const params = draftId ? { draft_id: draftId } : {};
    const response = await apiClient.get('/api/section-head/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeSectionHeadArticle(data) {
    clearApiCache('section_head_');
    const response = await apiClient.post('/api/section-head/submit-article', data);
    return response.data;
}

export async function deleteSectionHeadDraft(draftId) {
    clearApiCache('section_head_');
    const response = await apiClient.delete(`/api/section-head/drafts/${draftId}`);
    return response.data;
}

export async function getSectionHeadActivityLogs(params = {}, forceFresh = false) {
    const cacheKey = `section_head_logs_${params.search || ''}_${params.date_filter || 'all'}_${params.date || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/section-head/activity-logs', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

// Editor-in-Chief (EIC) & Associate Editor-in-Chief (AEIC) Portal API calls
export async function getEicDashboard(forceFresh = false) {
    const cacheKey = 'eic_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getEicManageArticles(forceFresh = false) {
    const cacheKey = 'eic_manage_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/manage-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function archiveEicArticle(id) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/manage-articles/${id}/archive`);
    return response.data;
}

export async function restoreEicArticle(id) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/manage-articles/${id}/restore`);
    return response.data;
}

export async function updateEicArticle(id, data) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/manage-articles/${id}`, data);
    return response.data;
}

export async function destroyEicArticle(id) {
    clearApiCache('eic_');
    const response = await apiClient.delete(`/api/eic/manage-articles/${id}`);
    return response.data;
}

export async function getEicMyArticles(forceFresh = false) {
    const cacheKey = 'eic_my_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/manage-my-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getEicReviewArticles(params = {}, forceFresh = false) {
    const queryParams = typeof params === 'string' ? { sort: params } : (params || {});
    const cacheKey = `eic_reviews_${queryParams.category || 'all'}_${queryParams.sort || 'newest'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/review-articles', { params: queryParams });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function updateEicReviewArticle(articleId, data) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/review-articles/${articleId}`, data);
    return response.data;
}

export async function approveEicArticle(articleId, data = {}) {
    clearApiCache('eic_');
    clearApiCache('section_head_');
    clearApiCache('section_');
    clearApiCache('exec_');
    const response = await apiClient.post(`/api/eic/review-articles/${articleId}/approve`, data);
    return response.data;
}

export async function returnEicArticleForRevision(articleId, remarks) {
    clearApiCache('eic_');
    clearApiCache('section_head_');
    clearApiCache('section_');
    clearApiCache('exec_');
    const response = await apiClient.post(`/api/eic/review-articles/${articleId}/revision`, { remarks });
    return response.data;
}

export async function getEicMediaDesk(forceFresh = false) {
    const cacheKey = 'eic_media_desk';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/media-desk');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function approveEicMedia(id) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/media/${id}/approve`);
    return response.data;
}

export async function returnEicMediaForRevision(id, remarks) {
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/eic/media/${id}/revision`, { remarks });
    return response.data;
}

export async function getEicSubmitData(draftId = null, forceFresh = false) {
    const cacheKey = `eic_submit_${draftId || 'new'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const params = draftId ? { draft_id: draftId } : {};
    const response = await apiClient.get('/api/eic/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeEicArticle(data) {
    clearApiCache('eic_');
    const response = await apiClient.post('/api/eic/submit-article', data);
    return response.data;
}

export async function deleteEicDraft(draftId) {
    clearApiCache('eic_');
    const response = await apiClient.delete(`/api/eic/drafts/${draftId}`);
    return response.data;
}

export async function getEicManageAccounts(forceFresh = false) {
    const cacheKey = 'eic_manage_accounts';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/manage-accounts');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeEicAccount(data) {
    clearApiCache('eic_');
    const response = await apiClient.post('/api/eic/manage-accounts', data);
    return response.data;
}

export async function updateEicAccountRole(id, data) {
    clearApiCache('eic_');
    const response = await apiClient.put(`/api/eic/manage-accounts/${id}/role`, data);
    return response.data;
}

export async function toggleEicAccountStatus(id, status = null) {
    clearApiCache('eic_');
    const payload = status ? { status } : {};
    const response = await apiClient.patch(`/api/eic/manage-accounts/${id}/status`, payload);
    return response.data;
}

export async function getEicActivityLogs(params = {}, forceFresh = false) {
    const cacheKey = `eic_logs_${params.search || ''}_${params.date_filter || 'all'}_${params.date || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/activity-logs', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getEicFeedback(forceFresh = false) {
    const cacheKey = 'eic_feedback';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/eic/feedback-inbox');
    setCache(cacheKey, response.data);
    return response.data;
}

// ==========================================
// EXECUTIVE PORTAL ENDPOINTS
// ==========================================

export async function getExecutiveDashboard(forceFresh = false) {
    const cacheKey = 'executive_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getExecutiveManageArticles(forceFresh = false) {
    const cacheKey = 'executive_manage_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/manage-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function archiveExecutiveArticle(id) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/executive/manage-articles/${id}/archive`);
    return response.data;
}

export async function restoreExecutiveArticle(id) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/executive/manage-articles/${id}/restore`);
    return response.data;
}

export async function updateExecutiveArticle(id, data) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/executive/manage-articles/${id}`, data);
    return response.data;
}

export async function destroyExecutiveArticle(id) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.delete(`/api/executive/manage-articles/${id}`);
    return response.data;
}

export async function getExecutiveMyArticles(forceFresh = false) {
    const cacheKey = 'executive_my_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/manage-my-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getExecutiveReviewArticles(params = {}, forceFresh = false) {
    const queryParams = typeof params === 'string' ? { sort: params } : (params || {});
    const cacheKey = `executive_reviews_${queryParams.category || 'all'}_${queryParams.sort || 'newest'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/review-articles', { params: queryParams });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function updateExecutiveReviewArticle(articleId, data) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/executive/review-articles/${articleId}`, data);
    return response.data;
}

export async function approveExecutiveArticle(articleId, data = {}) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    clearApiCache('section_head_');
    clearApiCache('section_');
    const response = await apiClient.post(`/api/executive/review-articles/${articleId}/approve`, data);
    return response.data;
}

export async function returnExecutiveArticleForRevision(articleId, remarks) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    clearApiCache('section_head_');
    clearApiCache('section_');
    const response = await apiClient.post(`/api/executive/review-articles/${articleId}/revision`, { remarks });
    return response.data;
}

export async function getExecutiveSubmitData(draftId = null, forceFresh = false) {
    const cacheKey = `executive_submit_${draftId || 'new'}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const params = draftId ? { draft_id: draftId } : {};
    const response = await apiClient.get('/api/executive/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeExecutiveArticle(data) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post('/api/executive/submit-article', data);
    return response.data;
}

export async function deleteExecutiveDraft(draftId) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.delete(`/api/executive/drafts/${draftId}`);
    return response.data;
}

export async function getExecutiveManageAccounts(forceFresh = false) {
    const cacheKey = 'executive_manage_accounts';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/manage-accounts');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeExecutiveAccount(data) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.post('/api/executive/manage-accounts', data);
    return response.data;
}

export async function updateExecutiveAccountRole(id, data) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const response = await apiClient.put(`/api/executive/manage-accounts/${id}/role`, data);
    return response.data;
}

export async function toggleExecutiveAccountStatus(id, status = null) {
    clearApiCache('executive_');
    clearApiCache('eic_');
    const payload = status ? { status } : {};
    const response = await apiClient.patch(`/api/executive/manage-accounts/${id}/status`, payload);
    return response.data;
}

export async function getExecutiveActivityLogs(params = {}, forceFresh = false) {
    const cacheKey = `executive_logs_${params.search || ''}_${params.date_filter || 'all'}_${params.date || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/activity-logs', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getExecutiveFeedback(forceFresh = false) {
    const cacheKey = 'executive_feedback';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/executive/feedback-inbox');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getExecutiveTransparency() {
    const response = await apiClient.get('/api/executive/transparency');
    return response.data;
}

export default apiClient;
