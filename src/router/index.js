import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore, currentUser } from '../stores/auth.js';

const routes = [
    // Public Reader Website Routes
    {
        path: '/',
        name: 'public-home',
        component: () => import('../pages/public/Home.vue'),
        alias: ['/home'],
    },
    {
        path: '/article/:slug',
        name: 'public-article',
        component: () => import('../pages/public/Article.vue'),
    },
    {
        path: '/category/:slug',
        name: 'public-category',
        component: () => import('../pages/public/Category.vue'),
    },
    {
        path: '/archives',
        name: 'public-archives',
        component: () => import('../pages/public/Archives.vue'),
    },
    {
        path: '/author/:id',
        name: 'public-author',
        component: () => import('../pages/public/Author.vue'),
    },
    {
        path: '/about',
        name: 'public-about',
        component: () => import('../pages/public/About.vue'),
    },
    {
        path: '/members',
        name: 'public-members',
        component: () => import('../pages/public/Members.vue'),
    },
    {
        path: '/feedback',
        name: 'public-feedback',
        component: () => import('../pages/public/Feedback.vue'),
    },
    // Convenience category redirects
    { path: '/latest', redirect: '/category/latest' },
    { path: '/news', redirect: '/category/news' },
    { path: '/features', redirect: '/category/feature' },
    { path: '/opinion', redirect: '/category/opinion' },
    { path: '/science', redirect: '/category/science-technology' },
    { path: '/literature', redirect: '/category/literature' },

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

    // Media & Public Communications (M&PC) Portal Routes
    {
        path: '/mpc',
        redirect: '/mpc/dashboard',
    },
    {
        path: '/mpc/dashboard',
        name: 'mpc-dashboard',
        component: () => import('../pages/mpc/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/publish-article',
        name: 'mpc-publish-article',
        component: () => import('../pages/mpc/PublishArticle.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/media-desk',
        name: 'mpc-media-desk',
        component: () => import('../pages/mpc/MediaDesk.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/submit-media',
        name: 'mpc-submit-media',
        component: () => import('../pages/mpc/SubmitMedia.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/manage-media',
        name: 'mpc-manage-media',
        component: () => import('../pages/mpc/ManageMedia.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/manage-my-articles',
        name: 'mpc-manage-my-articles',
        component: () => import('../pages/mpc/ManageMyArticles.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/my-articles',
        redirect: '/mpc/manage-my-articles',
    },
    {
        path: '/mpc/manage-articles',
        redirect: '/mpc/manage-my-articles',
    },
    {
        path: '/mpc/submit-article',
        name: 'mpc-submit-article',
        component: () => import('../pages/mpc/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/activity-logs',
        name: 'mpc-activity-logs',
        component: () => import('../pages/mpc/ActivityLogs.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/profile-settings',
        name: 'mpc-profile-settings',
        component: () => import('../pages/mpc/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'MPC' },
    },
    {
        path: '/mpc/settings',
        redirect: '/mpc/profile-settings',
    },

    // Media & Communication Portal Routes
    {
        path: '/media',
        redirect: '/media/dashboard',
    },
    {
        path: '/media/dashboard',
        name: 'media-dashboard',
        component: () => import('../pages/media/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/submit-article',
        name: 'media-submit-article',
        component: () => import('../pages/media/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/manage-articles',
        name: 'media-manage-articles',
        component: () => import('../pages/media/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/manage-my-articles',
        redirect: '/media/manage-articles',
    },
    {
        path: '/media/my-articles',
        redirect: '/media/manage-articles',
    },
    {
        path: '/media/submit-media',
        name: 'media-submit-media',
        component: () => import('../pages/media/SubmitMedia.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/manage-media',
        name: 'media-manage-media',
        component: () => import('../pages/media/ManageMedia.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/profile-settings',
        name: 'media-profile-settings',
        component: () => import('../pages/media/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Media' },
    },
    {
        path: '/media/settings',
        redirect: '/media/profile-settings',
    },

    // Cartoonist Portal Routes
    {
        path: '/cartoonist',
        redirect: '/cartoonist/dashboard',
    },
    {
        path: '/cartoonist/dashboard',
        name: 'cartoonist-dashboard',
        component: () => import('../pages/cartoonist/Dashboard.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/submit-article',
        name: 'cartoonist-submit-article',
        component: () => import('../pages/cartoonist/SubmitArticle.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/manage-articles',
        name: 'cartoonist-manage-articles',
        component: () => import('../pages/cartoonist/ManageArticles.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/manage-my-articles',
        redirect: '/cartoonist/manage-articles',
    },
    {
        path: '/cartoonist/my-articles',
        redirect: '/cartoonist/manage-articles',
    },
    {
        path: '/cartoonist/submit-cartoon',
        name: 'cartoonist-submit-cartoon',
        component: () => import('../pages/cartoonist/SubmitCartoon.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/manage-cartoons',
        name: 'cartoonist-manage-cartoons',
        component: () => import('../pages/cartoonist/ManageCartoons.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/cartoon-desk',
        name: 'cartoonist-cartoon-desk',
        component: () => import('../pages/cartoonist/CartoonDesk.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/profile-settings',
        name: 'cartoonist-profile-settings',
        component: () => import('../pages/cartoonist/ProfileSettings.vue'),
        meta: { requiresAuth: true, role: 'Cartoonist' },
    },
    {
        path: '/cartoonist/settings',
        redirect: '/cartoonist/profile-settings',
    },

    // Wildcard / 404 Fallback
    {
        path: '/:pathMatch(.*)*',
        redirect: () => {
            const authStore = useAuthStore();
            if (!authStore.isAuthenticated) {
                return '/';
            }
            const rawRole = authStore.currentRole || currentUser.role || '';
            const role = (typeof rawRole === 'string' ? rawRole : (rawRole?.role_name || rawRole?.name || '')).toLowerCase();
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
            if (role.includes('cartoonist')) {
                return '/cartoonist/dashboard';
            }
            if (role.includes('m&pc') || role.includes('media and public') || role.includes('mpc')) {
                return '/mpc/dashboard';
            }
            if (role.includes('photojournalist') || role.includes('media team') || (role.includes('media') && !role.includes('public'))) {
                return '/media/dashboard';
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
        const rawRole = authStore.currentRole || currentUser.role || '';
        const role = (typeof rawRole === 'string' ? rawRole : (rawRole?.role_name || rawRole?.name || '')).toLowerCase();
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
        if (role.includes('cartoonist')) {
            return next('/cartoonist/dashboard');
        }
        if (role.includes('m&pc') || role.includes('media and public') || role.includes('mpc')) {
            return next('/mpc/dashboard');
        }
        if (role.includes('photojournalist') || role.includes('media team') || (role.includes('media') && !role.includes('public'))) {
            return next('/media/dashboard');
        }
        if (role.includes('head')) {
            return next('/section-head/dashboard');
        }
        return next('/writer/dashboard');
    }

    // RBAC Guard: Only Auditor and Treasurer can access the Executive Transparency page
    if (to.path === '/executive/transparency' || to.name === 'executive-transparency') {
        const rawRole = authStore.currentRole || authStore.user?.role?.role_name || currentUser.role || '';
        const role = (typeof rawRole === 'string' ? rawRole : (rawRole?.role_name || rawRole?.name || '')).toLowerCase();
        if (!role.includes('auditor') && !role.includes('treasurer')) {
            return next('/executive/dashboard');
        }
    }

    next();
});

router.onError((error) => {
    console.error('Router navigation error:', error);
});

export default router;
