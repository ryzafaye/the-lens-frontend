import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
    {
        path: '/',
        name: 'home',
        redirect: '/login',
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('../pages/Login.vue'),
        meta: { guestOnly: true },
    },

    // Writer Portal Routes
    {
        path: '/writer',
        redirect: '/writer/dashboard',
    },
    {
        path: '/writer/dashboard',
        name: 'writer-dashboard',
        component: () => import('../pages/writer/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Writer' },
    },
    {
        path: '/writer/manage-articles',
        name: 'writer-manage-articles',
        component: () => import('../pages/writer/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Writer' },
    },
    {
        path: '/writer/manage-my-articles',
        redirect: '/writer/manage-articles',
    },
    {
        path: '/writer/submit-article',
        name: 'writer-submit-article',
        component: () => import('../pages/writer/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Writer' },
    },
    {
        path: '/writer/profile-settings',
        name: 'writer-profile-settings',
        component: () => import('../pages/writer/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Writer' },
    },
    {
        path: '/writer/settings',
        redirect: '/writer/profile-settings',
    },

    // Section Head Portal Routes
    {
        path: '/section-head',
        redirect: '/section-head/dashboard',
    },
    {
        path: '/section-head/dashboard',
        name: 'section-head-dashboard',
        component: () => import('../pages/section-head/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/review-articles',
        name: 'section-head-review-articles',
        component: () => import('../pages/section-head/ReviewArticles.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/manage-my-articles',
        name: 'section-head-manage-my-articles',
        component: () => import('../pages/section-head/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/my-articles',
        redirect: '/section-head/manage-my-articles',
    },
    {
        path: '/section-head/manage-articles',
        redirect: '/section-head/manage-my-articles',
    },
    {
        path: '/section-head/submit-article',
        name: 'section-head-submit-article',
        component: () => import('../pages/section-head/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/activity-logs',
        name: 'section-head-activity-logs',
        component: () => import('../pages/section-head/ActivityLogs.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/profile-settings',
        name: 'section-head-profile-settings',
        component: () => import('../pages/section-head/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Section Head' },
    },
    {
        path: '/section-head/settings',
        redirect: '/section-head/profile-settings',
    },

    // Editor-in-Chief & Associate EIC Portal Routes
    {
        path: '/eic',
        redirect: '/eic/dashboard',
    },
    {
        path: '/eic/dashboard',
        name: 'eic-dashboard',
        component: () => import('../pages/eic/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/manage-articles',
        name: 'eic-manage-articles',
        component: () => import('../pages/eic/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/manage-my-articles',
        name: 'eic-manage-my-articles',
        component: () => import('../pages/eic/ManageMyArticles.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/my-articles',
        redirect: '/eic/manage-my-articles',
    },
    {
        path: '/eic/review-articles',
        name: 'eic-review-articles',
        component: () => import('../pages/eic/ReviewArticles.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/media-desk',
        name: 'eic-media-desk',
        component: () => import('../pages/eic/MediaDesk.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/submit-article',
        name: 'eic-submit-article',
        component: () => import('../pages/eic/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/manage-accounts',
        name: 'eic-manage-accounts',
        component: () => import('../pages/eic/ManageAccounts.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/activity-logs',
        name: 'eic-activity-logs',
        component: () => import('../pages/eic/ActivityLogs.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/feedback-inbox',
        name: 'eic-feedback-inbox',
        component: () => import('../pages/eic/FeedbackInbox.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/feedback',
        redirect: '/eic/feedback-inbox',
    },
    {
        path: '/eic/profile-settings',
        name: 'eic-profile-settings',
        component: () => import('../pages/eic/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Editor-in-Chief' },
    },
    {
        path: '/eic/settings',
        redirect: '/eic/profile-settings',
    },

    // Associate Editor-in-Chief Route Aliases (Directs to EIC Portal)
    {
        path: '/aeic',
        redirect: '/eic/dashboard',
    },
    {
        path: '/aeic/:pathMatch(.*)*',
        redirect: to => {
            return `/eic/${to.params.pathMatch || 'dashboard'}`;
        },
    },

    // Executive Portal Routes
    {
        path: '/executive',
        redirect: '/executive/dashboard',
    },
    {
        path: '/executive/dashboard',
        name: 'executive-dashboard',
        component: () => import('../pages/executive/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/manage-articles',
        name: 'executive-manage-articles',
        component: () => import('../pages/executive/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/manage-my-articles',
        name: 'executive-manage-my-articles',
        component: () => import('../pages/executive/ManageMyArticles.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/my-articles',
        redirect: '/executive/manage-my-articles',
    },
    {
        path: '/executive/review-articles',
        name: 'executive-review-articles',
        component: () => import('../pages/executive/ReviewArticles.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/review-article',
        redirect: '/executive/review-articles',
    },
    {
        path: '/executive/submit-article',
        name: 'executive-submit-article',
        component: () => import('../pages/executive/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/manage-accounts',
        name: 'executive-manage-accounts',
        component: () => import('../pages/executive/ManageAccounts.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/activity-logs',
        name: 'executive-activity-logs',
        component: () => import('../pages/executive/ActivityLogs.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/transparency',
        name: 'executive-transparency',
        component: () => import('../pages/executive/Transparency.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/feedback-inbox',
        name: 'executive-feedback-inbox',
        component: () => import('../pages/executive/FeedbackInbox.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/feedback',
        redirect: '/executive/feedback-inbox',
    },
    {
        path: '/executive/profile-settings',
        name: 'executive-profile-settings',
        component: () => import('../pages/executive/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Executive' },
    },
    {
        path: '/executive/settings',
        redirect: '/executive/profile-settings',
    },

    // Wildcard / 404 Fallback
    {
        path: '/:pathMatch(.*)*',
        redirect: () => {
            const authStore = useAuthStore();
            const role = (authStore.currentRole || '').toLowerCase();
            if (role.includes('chief') || role.includes('eic')) {
                return '/eic/dashboard';
            }
            if (
                role.includes('president') ||
                role.includes('secretary') ||
                role.includes('treasurer') ||
                role.includes('auditor') ||
                role.includes('public relations') ||
                role.includes('pro') ||
                role.includes('executive')
            ) {
                return '/executive/dashboard';
            }
            if (role.includes('head')) {
                return '/section-head/dashboard';
            }
            return '/writer/dashboard';
        },
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

// Deduplicated navigation guard utilizing Pinia authStore
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        try {
            await authStore.fetchUser();
        } catch {
            // Failed to fetch or 401 unauthenticated
        }

        if (!authStore.isAuthenticated) {
            return next('/login');
        }
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
        const role = (authStore.currentRole || '').toLowerCase();
        if (role.includes('chief') || role.includes('eic')) {
            return next('/eic/dashboard');
        }
        if (
            role.includes('president') ||
            role.includes('secretary') ||
            role.includes('treasurer') ||
            role.includes('auditor') ||
            role.includes('public relations') ||
            role.includes('pro') ||
            role.includes('executive')
        ) {
            return next('/executive/dashboard');
        }
        if (role.includes('head')) {
            return next('/section-head/dashboard');
        }
        return next('/writer/dashboard');
    }

    // RBAC Guard: Only Auditor and Treasurer can access the Executive Transparency page
    if (to.path === '/executive/transparency' || to.name === 'executive-transparency') {
        const role = (authStore.currentRole || authStore.user?.role?.role_name || currentUser.role || '').toLowerCase();
        if (!role.includes('auditor') && !role.includes('treasurer')) {
            return next('/executive/dashboard');
        }
    }

    next();
});

export default router;
