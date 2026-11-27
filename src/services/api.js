import axios from 'axios';

// In development / VS Code port forwarding / dev tunnels, use relative paths ('')
// so requests are proxied by Vite's dev server to http://127.0.0.1:8000.
// In production, use VITE_API_BASE_URL if configured, or fallback to relative paths.
const apiOrigin = import.meta.env.DEV
    ? ''
    : (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const apiClient = axios.create({
    baseURL: apiOrigin,
    timeout: 15000,
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

export const invalidateCache = clearApiCache;

/**
 * Initializes CSRF token via /api/ping only when necessary.
 * Deduplicates in-flight calls so multiple mutations in the same tick share one promise.
 */
export async function ensureCsrfToken(force = false) {
    if (csrfInitialized && !force) return;

    if (!csrfPromise || force) {
        csrfPromise = apiClient.get('/api/ping', { timeout: 5000 })
            .then((response) => {
                if (response.data?.csrf_token) {
                    apiClient.defaults.headers.common['X-CSRF-TOKEN'] = response.data.csrf_token;
                }
                csrfInitialized = true;
            })
            .catch((err) => {
                console.warn('Could not initialize CSRF token via /api/ping:', err.message);
                csrfInitialized = true; // Avoid blocking mutations if ping endpoint fails
            })
            .finally(() => {
                csrfPromise = null;
            });
    }

    await csrfPromise;
}

// Request Interceptor: Ensure CSRF token only for mutating methods (POST, PUT, PATCH, DELETE)
apiClient.interceptors.request.use(async (config) => {
    const url = config.url || '';
    if (url.includes('/login') || url.includes('/ping') || url.includes('/csrf-cookie')) {
        return config;
    }
    const method = (config.method || 'get').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        await ensureCsrfToken();
    }
    return config;
});

// Intercept 419 (CSRF Token Mismatch) and automatically refresh token and retry
apiClient.interceptors.response.use(
    (response) => {
        const method = (response.config?.method || 'get').toUpperCase();
        const url = response.config?.url || '';
        if (
            typeof window !== 'undefined' &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
            !url.includes('/login') &&
            !url.includes('/logout') &&
            !url.includes('/forgot-password') &&
            !url.includes('/reset-password') &&
            !url.includes('/ping')
        ) {
            clearApiCache();
            window.dispatchEvent(new CustomEvent('sidebar-counts-refresh'));
        }
        return response;
    },
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
    clearApiCache();

    const response = await apiClient.post('/api/login', {
        student_number: studentNumber,
        password: password,
    });

    if (response.data?.csrf_token) {
        apiClient.defaults.headers.common['X-CSRF-TOKEN'] = response.data.csrf_token;
        csrfInitialized = true;
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

export async function requestPasswordReset({ student_number = null, email = null }) {
    const payload = {};
    if (student_number) payload.student_number = student_number;
    if (email) payload.email = email;
    const response = await apiClient.post('/api/forgot-password', payload);
    return response.data;
}

export async function resetPassword({ token, email, password, password_confirmation }) {
    const response = await apiClient.post('/api/reset-password', {
        token,
        email,
        password,
        password_confirmation,
    });
    return response.data;
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

export async function resubmitArticle(articleId, data = {}) {
    clearApiCache('section_head_');
    clearApiCache('section_');
    clearApiCache('eic_');
    clearApiCache('exec_');
    clearApiCache('writer_');
    clearApiCache('media_');
    clearApiCache('cartoonist_');
    clearApiCache('mpc_');
    const response = await apiClient.post(`/api/articles/${articleId}/resubmit`, data);
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
    clearApiCache('mpc_');
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

export async function markEicFeedbackRead(id) {
    const response = await apiClient.patch(`/api/eic/feedback-inbox/${id}/read`);
    clearApiCache('eic_feedback');
    clearApiCache('executive_feedback');
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

export async function markExecutiveFeedbackRead(id) {
    const response = await apiClient.patch(`/api/executive/feedback-inbox/${id}/read`);
    clearApiCache('executive_feedback');
    clearApiCache('eic_feedback');
    return response.data;
}

export async function getExecutiveTransparency() {
    const response = await apiClient.get('/api/executive/transparency');
    return response.data;
}

// =========================================================================
// Media & Public Communications (M&PC) Portal APIs
// =========================================================================

export async function getMpcDashboard(forceFresh = false) {
    const cacheKey = 'mpc_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMpcPublishArticle(forceFresh = false) {
    const cacheKey = 'mpc_publish_article';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/publish-article');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function publishMpcArticleRelease(id, coverId = null) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    clearApiCache('exec_');
    const payload = coverId ? { cover_id: coverId } : {};
    const response = await apiClient.post(`/api/mpc/articles/${id}/publish`, payload);
    return response.data;
}

export async function unpublishMpcArticleRelease(id) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    clearApiCache('exec_');
    const response = await apiClient.post(`/api/mpc/articles/${id}/unpublish`);
    return response.data;
}

export async function assignMpcArticleCover(id, coverId) {
    clearApiCache('mpc_');
    const response = await apiClient.post(`/api/mpc/articles/${id}/assign-cover`, { cover_id: coverId });
    return response.data;
}

export async function returnMpcArticleForRevision(id, remarks) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/mpc/articles/${id}/revision`, { remarks });
    return response.data;
}

export async function getMpcMediaDesk(forceFresh = false) {
    const cacheKey = 'mpc_media_desk';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/media-desk');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function endorseMpcMedia(id) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/mpc/media/${id}/endorse`);
    return response.data;
}

export async function returnMpcMediaForRevision(id, remarks) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/mpc/media/${id}/revision`, { remarks });
    return response.data;
}

export async function resubmitMpcMedia(id, formData) {
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/mpc/media/${id}/resubmit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function submitMpcMedia(formData) {
    clearApiCache('mpc_');
    const response = await apiClient.post('/api/mpc/submit-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function getMpcManageMedia(forceFresh = false) {
    const cacheKey = 'mpc_manage_media';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/manage-media');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMpcMyArticles(forceFresh = false) {
    const cacheKey = 'mpc_my_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/manage-my-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMpcSubmitData(params = {}, forceFresh = false) {
    const cacheKey = `mpc_submit_data_${params.draft_id || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeMpcArticle(payload) {
    clearApiCache('mpc_');
    clearApiCache('writer_');
    const response = await apiClient.post('/api/mpc/submit-article', payload);
    return response.data;
}

export async function deleteMpcDraft(id) {
    clearApiCache('mpc_');
    const response = await apiClient.delete(`/api/mpc/drafts/${id}`);
    return response.data;
}

export async function getMpcActivityLogs(params = {}, forceFresh = false) {
    const cacheKey = `mpc_logs_${params.search || ''}_${params.date_filter || 'all'}_${params.date || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/mpc/activity-logs', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMpcTransparency() {
    const response = await apiClient.get('/api/mpc/transparency');
    return response.data;
}

export async function getMpcProfileSettings() {
    const response = await apiClient.get('/api/mpc/profile-settings');
    return response.data;
}

// ==========================================
// MEDIA & COMMUNICATION PORTAL ENDPOINTS
// ==========================================

export async function getMediaDashboard(forceFresh = false) {
    const cacheKey = 'media_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/media/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMediaManageMedia(forceFresh = false) {
    const cacheKey = 'media_manage_media';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/media/manage-media');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function submitMediaPhoto(formData) {
    clearApiCache('media_');
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post('/api/media/submit-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    clearApiCache('media_');
    clearApiCache('mpc_');
    clearApiCache('eic_');
    return response.data;
}

export async function endorseMediaPhoto(id) {
    clearApiCache('media_');
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/media/${id}/endorse`);
    return response.data;
}

export async function returnMediaPhotoForRevision(id, remarks) {
    clearApiCache('media_');
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/media/${id}/revision`, { remarks });
    return response.data;
}

export async function resubmitMediaPhoto(id, formData) {
    clearApiCache('media_');
    clearApiCache('mpc_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/media/${id}/resubmit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function getMediaMyArticles(forceFresh = false) {
    const cacheKey = 'media_my_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/media/manage-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getMediaSubmitData(params = {}, forceFresh = false) {
    const cacheKey = `media_submit_data_${params.draft_id || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/media/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeMediaArticle(payload) {
    clearApiCache('media_');
    clearApiCache('writer_');
    const response = await apiClient.post('/api/media/submit-article', payload);
    return response.data;
}

export async function deleteMediaDraft(id) {
    clearApiCache('media_');
    const response = await apiClient.delete(`/api/media/drafts/${id}`);
    return response.data;
}

export async function getMediaProfileSettings() {
    const response = await apiClient.get('/api/media/profile-settings');
    return response.data;
}

// ==========================================
// CARTOONIST PORTAL ENDPOINTS
// ==========================================

export async function getCartoonistDashboard(forceFresh = false) {
    const cacheKey = 'cartoonist_dashboard';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/cartoonist/dashboard');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getCartoonistManageCartoons(forceFresh = false) {
    const cacheKey = 'cartoonist_manage_cartoons';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/cartoonist/manage-cartoons');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function submitCartoonIllustration(formData) {
    clearApiCache('cartoonist_');
    clearApiCache('eic_');
    const response = await apiClient.post('/api/cartoonist/submit-cartoon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function getCartoonistDesk(forceFresh = false) {
    const cacheKey = 'cartoonist_desk';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/cartoonist/cartoon-desk');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function endorseCartoonIllustration(id) {
    clearApiCache('cartoonist_');
    clearApiCache('eic_');
    clearApiCache('mpc_');
    const response = await apiClient.post(`/api/cartoonist/cartoons/${id}/endorse`);
    return response.data;
}

export async function returnCartoonIllustrationForRevision(id, remarks) {
    clearApiCache('cartoonist_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/cartoonist/cartoons/${id}/revision`, { remarks });
    return response.data;
}

export async function resubmitCartoonIllustration(id, formData) {
    clearApiCache('cartoonist_');
    clearApiCache('eic_');
    const response = await apiClient.post(`/api/cartoonist/cartoons/${id}/resubmit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function getCartoonistMyArticles(forceFresh = false) {
    const cacheKey = 'cartoonist_my_articles';
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/cartoonist/manage-articles');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getCartoonistSubmitData(params = {}, forceFresh = false) {
    const cacheKey = `cartoonist_submit_data_${params.draft_id || ''}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/cartoonist/submit-article', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function storeCartoonistArticle(payload) {
    clearApiCache('cartoonist_');
    clearApiCache('writer_');
    const response = await apiClient.post('/api/cartoonist/submit-article', payload);
    return response.data;
}

export async function deleteCartoonistDraft(id) {
    clearApiCache('cartoonist_');
    const response = await apiClient.delete(`/api/cartoonist/drafts/${id}`);
    return response.data;
}

export async function getCartoonistProfileSettings() {
    const response = await apiClient.get('/api/cartoonist/profile-settings');
    return response.data;
}

// ============================================================================
// Public Reader Website API Endpoints
// ============================================================================

export async function getPublicHome(forceFresh = false) {
    const cacheKey = 'public_home';
    if (!forceFresh) {
        const cached = getCache(cacheKey, 60000);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/public/home');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getPublicCategory(slug, page = 1, forceFresh = false) {
    const cacheKey = `public_category_${slug}_${page}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey, 60000);
        if (cached) return cached;
    }
    const response = await apiClient.get(`/api/public/category/${slug}`, { params: { page } });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getPublicArticle(slug, forceFresh = false) {
    const cacheKey = `public_article_${slug}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey, 30000);
        if (cached) return cached;
    }
    const response = await apiClient.get(`/api/public/article/${slug}`);
    setCache(cacheKey, response.data);
    return response.data;
}

export async function shareArticle(id) {
    const response = await apiClient.post(`/api/public/article/${id}/share`);
    return response.data;
}

export async function getPublicArchives(params = {}, forceFresh = false) {
    const queryStr = new URLSearchParams(params).toString();
    const cacheKey = `public_archives_${queryStr}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey, 30000);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/public/archives', { params });
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getPublicAuthor(id, forceFresh = false) {
    const cacheKey = `public_author_${id}`;
    if (!forceFresh) {
        const cached = getCache(cacheKey, 60000);
        if (cached) return cached;
    }
    const response = await apiClient.get(`/api/public/author/${id}`);
    setCache(cacheKey, response.data);
    return response.data;
}

export async function getPublicOfficers(forceFresh = false) {
    const cacheKey = 'public_officers_list';
    if (!forceFresh) {
        const cached = getCache(cacheKey, 60000);
        if (cached) return cached;
    }
    const response = await apiClient.get('/api/public/officers');
    setCache(cacheKey, response.data);
    return response.data;
}

export async function submitPublicFeedback(payload) {
    const response = await apiClient.post('/api/public/feedback', payload);
    clearApiCache('eic_feedback');
    clearApiCache('executive_feedback');
    return response.data;
}

export default apiClient;
