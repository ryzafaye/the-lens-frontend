import { createRouter, createWebHistory } from 'vue-router';
import { apiRequest } from '../services/api.js';
import { appState, setPageResponse } from '../state/appState.js';

const pageComponents = import.meta.glob('../Pages/**/*.vue');

const routes = [
    { path: '/', name: 'home', component: () => import('../Pages/Public/Home.vue'), meta: { endpoint: '/api/pages/public/home' } },
    { path: '/about', name: 'about', component: () => import('../Pages/Public/About.vue'), meta: { endpoint: '/api/pages/public/about' } },
    { path: '/archives', name: 'archives', component: () => import('../Pages/Public/Archives.vue'), meta: { endpoint: '/api/pages/public/archives' } },
    { path: '/articles/:slug', name: 'article', alias: '/article/:slug', component: () => import('../Pages/Public/Article.vue'), meta: { endpoint: '/api/pages/public/article' } },
    { path: '/authors/:slug', name: 'author', alias: '/author/:slug', component: () => import('../Pages/Public/Author.vue'), meta: { endpoint: '/api/pages/public/author' } },
    { path: '/category/:slug', name: 'category', component: () => import('../Pages/Public/Category.vue'), meta: { endpoint: '/api/pages/public/category' } },
    { path: '/feedback', name: 'public-feedback', component: () => import('../Pages/Public/Feedback.vue'), meta: { endpoint: '/api/pages/public/feedback' } },
    { path: '/members', name: 'members', component: () => import('../Pages/Public/Members.vue'), meta: { endpoint: '/api/pages/public/members' } },
    { path: '/login', name: 'login', component: () => import('../Pages/Auth/Login.vue'), meta: { localProps: (to) => ({ studentNumber: to.query.student_number ?? '' }) } },

    portalRoute('/:portal/dashboard', 'dashboard', 'Dashboard/Overview', '/api/pages/dashboard'),
    portalRoute('/:portal/manage-my-articles', 'manage-my-articles', 'Articles/ManageMy', '/api/pages/articles/manage-my'),
    portalRoute('/:portal/submit-article', 'submit-article', 'Articles/Submit', '/api/pages/articles/submit'),
    portalRoute('/:portal/profile-settings', 'profile-settings', 'Settings/Profile', '/api/pages/profile'),
    portalRoute('/:portal/manage-accounts', 'manage-accounts', 'Workspace/Accounts', '/api/pages/workspace/accounts'),
    portalRoute('/:portal/activity-logs', 'activity-logs', 'Workspace/ActivityLogs', '/api/pages/workspace/activity-logs'),
    portalRoute('/:portal/manage-articles', 'manage-articles', 'Workspace/Articles', '/api/pages/workspace/articles'),
    portalRoute('/:portal/feedback', 'workspace-feedback', 'Workspace/Feedback', '/api/pages/workspace/feedback'),
    portalRoute('/:portal/feedback-inbox', 'workspace-feedback-inbox', 'Workspace/Feedback', '/api/pages/workspace/feedback'),
    portalRoute('/:portal/media-desk', 'media-desk', 'Workspace/Media', '/api/pages/workspace/media', { kind: 'desk' }),
    portalRoute('/:portal/manage-media', 'manage-media', 'Workspace/Media', '/api/pages/workspace/media', { kind: 'library' }),
    portalRoute('/:portal/manage-cartoons', 'manage-cartoons', 'Workspace/Media', '/api/pages/workspace/media', { kind: 'cartoons' }),
    portalRoute('/:portal/cartoon-desk', 'cartoon-desk', 'Workspace/Media', '/api/pages/workspace/media', { kind: 'cartoon-desk' }),
    portalRoute('/:portal/publish-article', 'publish-article', 'Workspace/Publish', '/api/pages/workspace/publish'),
    portalRoute('/:portal/review-articles', 'review-articles', 'Workspace/Review', '/api/pages/workspace/review'),
    portalRoute('/:portal/transparency', 'transparency', 'Workspace/Transparency', '/api/pages/workspace/transparency'),
    portalRoute('/:portal/submit-media', 'submit-media', 'Workspace/UploadVisual', '/api/pages/workspace/upload-visual', { kind: 'photo' }),
    portalRoute('/:portal/submit-cartoon', 'submit-cartoon', 'Workspace/UploadVisual', '/api/pages/workspace/upload-visual', { kind: 'cartoon' }),

    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../Pages/NotFound.vue') },
];

function portalRoute(path, name, componentName, endpoint, options = {}) {
    return {
        path,
        name,
        component: pageComponents[`../Pages/${componentName}.vue`],
        meta: { endpoint, requiresAuth: true, kind: options.kind },
    };
}

const vueRouter = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});

async function loadRoute(route, extraParams = {}) {
    const endpoint = route.meta.endpoint;
    if (!endpoint) {
        setPageResponse({
            shared: appState.shared,
            props: route.meta.localProps?.(route) ?? {},
        });
        return;
    }

    const params = {
        ...route.params,
        ...route.query,
        ...(route.meta.kind ? { kind: route.meta.kind } : {}),
        ...extraParams,
    };

    const response = await apiRequest(endpoint, { params });
    const payload = response.data ?? {};
    const pageProps = { ...(payload.props ?? {}) };
    if (route.params.portal) pageProps.portal ??= route.params.portal;
    if (route.meta.kind) pageProps.kind ??= route.meta.kind;
    setPageResponse({ shared: payload.shared, props: pageProps });
}

vueRouter.beforeEach(async (to) => {
    appState.loading = true;
    appState.error = null;
    try {
        await loadRoute(to);
        return true;
    } catch (error) {
        const status = error.response?.status;
        if (status === 401 && to.meta.requiresAuth) {
            return { name: 'login', query: { redirect: to.fullPath } };
        }
        appState.error = error.response?.data?.message ?? 'Could not load this page. Check the API URL and try again.';
        return true;
    } finally {
        appState.loading = false;
    }
});

export const router = {
    push(target) {
        return vueRouter.push(target);
    },
    replace(target) {
        return vueRouter.replace(target);
    },
    async reload(options = {}) {
        try {
            await loadRoute(vueRouter.currentRoute.value, options.only ? { only: options.only.join(',') } : {});
        } catch (error) {
            appState.error = error.response?.data?.message ?? 'Could not refresh this page.';
        }
    },
    async delete(path) {
        try {
            await apiRequest(path, { method: 'DELETE' });
            await this.reload();
        } catch (error) {
            appState.error = error.response?.data?.message ?? 'The request could not be completed.';
        }
    },
};

vueRouter.reload = router.reload.bind(router);

export default vueRouter;
