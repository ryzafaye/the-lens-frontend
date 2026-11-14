<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHead from '../components/PageHead.vue';
import { apiFetch } from '../services/api.js';
import { updateShared, useAppState } from '../state/appState.js';

defineProps({ title: { type: String, default: 'Dashboard' } });

const page = useAppState();
const route = useRoute();
const router = useRouter();
const mobileOpen = ref(false);
const timeLabel = ref('');
const user = computed(() => page.props.auth?.user ?? {});
const role = computed(() => user.value.role ?? 'Member');
const firstName = computed(() => user.value.name?.trim().split(/\s+/)[0] ?? 'Member');
async function logout() {
    const response = await apiFetch('/logout', { method: 'POST' });
    if (!response.ok) return;
    updateShared({ auth: { user: null } });
    router.push('/login');
}

const prefix = computed(() => {
    const value = role.value.toLowerCase();
    if (value.includes('cartoonist')) return 'cartoonist';
    if (value.includes('photojournalist') || value.includes('media team') || value.includes('media & communication')) return 'media';
    if (value.includes('m&pc') || value.includes('media and public')) return 'mpc';
    if (value.includes('editor-in-chief') || value.includes('associate editor')) return 'eic';
    if (['writer'].includes(value)) return 'writer';
    if (value.endsWith('head')) return 'section-head';
    return 'executive';
});

const navItems = computed(() => {
    const base = `/${prefix.value}`;
    const items = {
        writer: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Manage My Articles', `${base}/manage-my-articles`, 'fa-solid fa-file-pen'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        'section-head': [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Manage My Articles', `${base}/manage-my-articles`, 'fa-solid fa-file-pen'],
            ['Review Articles', `${base}/review-articles`, 'fa-solid fa-clipboard-check'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Activity Logs', `${base}/activity-logs`, 'fa-solid fa-clock-rotate-left'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        executive: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Manage My Articles', `${base}/manage-my-articles`, 'fa-solid fa-file-pen'],
            ['Review Articles', `${base}/review-articles`, 'fa-solid fa-clipboard-check'],
            ['Manage Articles', `${base}/manage-articles`, 'fa-regular fa-newspaper'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Manage Accounts', `${base}/manage-accounts`, 'fa-solid fa-user-group'],
            ['Activity Logs', `${base}/activity-logs`, 'fa-solid fa-clock-rotate-left'],
            ['Transparency', `${base}/transparency`, 'fa-solid fa-file-invoice-dollar'],
            ['Feedback', `${base}/feedback`, 'fa-regular fa-comments'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        eic: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Manage Articles', `${base}/manage-articles`, 'fa-regular fa-newspaper'],
            ['Manage My Articles', `${base}/manage-my-articles`, 'fa-solid fa-file-pen'],
            ['Review Articles', `${base}/review-articles`, 'fa-solid fa-clipboard-check'],
            ['Media Desk', `${base}/media-desk`, 'fa-solid fa-images'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Manage Accounts', `${base}/manage-accounts`, 'fa-solid fa-user-group'],
            ['Activity Logs', `${base}/activity-logs`, 'fa-solid fa-clock-rotate-left'],
            ['Transparency', `${base}/transparency`, 'fa-solid fa-file-invoice-dollar'],
            ['Feedback Inbox', `${base}/feedback-inbox`, 'fa-regular fa-comments'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        mpc: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Media Desk', `${base}/media-desk`, 'fa-solid fa-images'],
            ['Publish Article', `${base}/publish-article`, 'fa-regular fa-newspaper'],
            ['Manage Media', `${base}/manage-media`, 'fa-solid fa-photo-film'],
            ['Manage My Articles', `${base}/manage-my-articles`, 'fa-solid fa-file-pen'],
            ['Submit Media', `${base}/submit-media`, 'fa-solid fa-camera'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Activity Logs', `${base}/activity-logs`, 'fa-solid fa-clock-rotate-left'],
            ['Transparency', `${base}/transparency`, 'fa-solid fa-file-invoice-dollar'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        media: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Manage Media', `${base}/manage-media`, 'fa-solid fa-photo-film'],
            ['Submit Media', `${base}/submit-media`, 'fa-solid fa-camera'],
            ['Manage Articles', `${base}/manage-articles`, 'fa-regular fa-newspaper'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
        cartoonist: [
            ['Dashboard', `${base}/dashboard`, 'fa-solid fa-chart-pie'],
            ['Cartoon Desk', `${base}/cartoon-desk`, 'fa-solid fa-palette'],
            ['Manage Cartoons', `${base}/manage-cartoons`, 'fa-solid fa-images'],
            ['Submit Cartoon', `${base}/submit-cartoon`, 'fa-solid fa-paintbrush'],
            ['Manage Articles', `${base}/manage-articles`, 'fa-regular fa-newspaper'],
            ['Submit Article', `${base}/submit-article`, 'fa-solid fa-feather-pointed'],
            ['Profile Settings', `${base}/profile-settings`, 'fa-solid fa-sliders'],
        ],
    };

    return items[prefix.value] ?? items.executive;
});

const currentPath = computed(() => route?.path || '');

function updateClock() {
    timeLabel.value = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date());
}

let clockInterval;
onMounted(() => {
    document.body.classList.add('dashboard-body');
    updateClock();
    clockInterval = window.setInterval(updateClock, 60000);
});
onBeforeUnmount(() => {
    document.body.classList.remove('dashboard-body');
    window.clearInterval(clockInterval);
});
</script>

<template>
    <PageHead :title="`${title} | The Lens`">
        <link rel="stylesheet" href="/css/executive-dashboard.css">
        <link rel="stylesheet" href="/css/executive-modals.css">
        <link rel="stylesheet" href="/css/writer-dashboard.css">
    </PageHead>
    <aside id="sidebar" class="sidebar" :class="{ 'is-open': mobileOpen }" aria-label="Member portal navigation">
        <div class="sidebar-top-section">
            <div class="sidebar-header"><RouterLink to="/" class="sidebar-brand-lockup"><span class="sidebar-logo-square"><img :src="'/images/logo.jpg'" alt="The Lens logo"></span><span class="sidebar-brand-name">The Lens Publication</span></RouterLink></div>
            <div class="sidebar-profile"><div class="profile-avatar"><img :src="user.avatarUrl ?? '/images/member-placeholder.svg'" :alt="`${user.name ?? 'Member'} avatar`"></div><div class="profile-name">{{ user.name ?? 'Member' }}</div><div class="profile-role-text">{{ role }}</div></div>
            <nav class="sidebar-nav" aria-label="Main navigation"><RouterLink v-for="[label, href, icon] in navItems" :key="href" :to="href" class="sidebar-nav-item" :class="{ active: currentPath === href || (href !== `/${prefix}/dashboard` && currentPath.startsWith(`${href}/`)) }"><i :class="icon" aria-hidden="true"></i><span>{{ label }}</span></RouterLink></nav>
        </div>
        <div class="sidebar-footer"><a href="/" target="_blank" rel="noopener noreferrer" class="sidebar-footer-link"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>View public site</span></a><form @submit.prevent="logout"><button type="submit" class="sidebar-footer-link logout-btn"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Logout</span></button></form></div>
    </aside>
    <div v-if="mobileOpen" class="sidebar-backdrop" @click="mobileOpen = false"></div>
    <div class="main-wrapper">
        <header class="topbar">
            <div class="topbar-left"><div class="mobile-header-brand"><button type="button" id="mobile-hamburger-btn" class="mobile-hamburger-btn" aria-label="Toggle navigation menu" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen"><i class="fa-solid fa-bars" aria-hidden="true"></i></button><RouterLink to="/" class="mobile-brand-lockup"><span class="mobile-logo-square"><img :src="'/images/logo.jpg'" alt="The Lens logo"></span><span class="mobile-brand-title">The Lens</span></RouterLink></div><div class="topbar-clock"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>{{ timeLabel }}</span></div></div>
            <div class="topbar-right"><div class="topbar-divider"></div><div class="topbar-user-profile"><div class="topbar-avatar-circle"><img :src="user.avatarUrl ?? '/images/member-placeholder.svg'" alt="User profile picture"></div><div><span class="topbar-user-name">{{ user.name ?? 'Member' }}</span><span class="topbar-role-badge">{{ role }}</span></div></div></div>
        </header>
        <main class="content-container"><div v-if="page.props.flash?.success" class="portal-flash-success" role="status">{{ page.props.flash.success }}</div><div v-if="page.props.flash?.error" class="portal-flash-error" role="alert">{{ page.props.flash.error }}</div><div v-if="page.props.flash?.warning" class="portal-flash-warning" role="status">{{ page.props.flash.warning }}</div><slot /></main>
    </div>
</template>

<style scoped>
.sidebar-backdrop { display: none; }
.sidebar-footer form { margin: 0; }
.sidebar-footer button { width: 100%; cursor: pointer; }
.topbar-user-profile { display:flex; align-items:center; gap:10px; }
.topbar-user-profile > div:last-child { display:flex; flex-direction:column; gap:2px; }
.topbar-user-name { font-size:.82rem; font-weight:700; }
.portal-flash-success,.portal-flash-error { margin:0 0 20px; padding:12px 16px; border-radius:10px; font-size:.9rem; }
.portal-flash-success { color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; }
.portal-flash-error { color:#9f1239; background:#fff1f2; border:1px solid #fecdd3; }
.portal-flash-warning { margin:0 0 20px; padding:12px 16px; color:#7a3a11; background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; font-size:.9rem; }
@media (max-width: 900px) { .sidebar-backdrop { display:block; position:fixed; inset:0; z-index:39; background:rgba(15,23,42,.45); } }
</style>
