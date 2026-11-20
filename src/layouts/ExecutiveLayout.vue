<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { logout } from '../services/api.js';
import { currentUser, setAuthUser, clearAuthUser, useAuthStore } from '../stores/auth.js';
import { optimizeCloudinaryUrl } from '../utils/image.js';
import LogoutModal from '../components/LogoutModal.vue';
import logoImg from '../assets/images/logo.jpg';
import '../assets/css/executive-dashboard.css';
import '../assets/css/executive-modals.css';

const router = useRouter();
const route = useRoute();

// Global reactive user state
const user = currentUser;
const authStore = useAuthStore();

// RBAC: President and Vice President have elevated administrative capabilities
const isPresOrVp = computed(() => {
    const roleName = user?.role || authStore.currentRole || '';
    return ['President', 'Vice President', 'Executive Vice President'].includes(roleName);
});

// RBAC: Only Auditor and Treasurer roles can access the Transparency module
const canViewTransparency = computed(() => {
    const roleName = user?.role || authStore.currentRole || authStore.user?.role?.role_name || '';
    const norm = String(roleName).toLowerCase().trim();
    return norm === 'auditor' || norm === 'treasurer';
});

// UI states
const isMobileNavOpen = ref(false);
const clockDisplay = ref('');
let clockTimer = null;

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 300, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
}

function updateClock() {
    const now = new Date();
    const datePart = now.toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const timePart = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    clockDisplay.value = `${datePart} | ${timePart}`;
}

function toggleMobileNav() {
    isMobileNavOpen.value = !isMobileNavOpen.value;
    if (isMobileNavOpen.value) {
        document.body.classList.add('mobile-nav-open');
    } else {
        document.body.classList.remove('mobile-nav-open');
    }
}

function closeMobileNav() {
    isMobileNavOpen.value = false;
    document.body.classList.remove('mobile-nav-open');
}

const showLogoutModal = ref(false);
const isLoggingOut = ref(false);

function promptLogout() {
    closeMobileNav();
    showLogoutModal.value = true;
}

async function confirmLogout() {
    isLoggingOut.value = true;
    try {
        const authStore = useAuthStore();
        await authStore.logout();
    } catch (err) {
        console.warn('Logout API error:', err);
    } finally {
        isLoggingOut.value = false;
        showLogoutModal.value = false;
        clearAuthUser();
        router.push('/login');
    }
}

function onProfileUpdated(e) {
    if (e.detail) {
        setAuthUser(e.detail);
    }
}

onMounted(async () => {
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
    window.addEventListener('profile-updated', onProfileUpdated);

    const authStore = useAuthStore();
    if (!authStore.user) {
        try {
            await authStore.fetchUser();
        } catch {
            // Handled by router guard
        }
    }
});

onUnmounted(() => {
    if (clockTimer) clearInterval(clockTimer);
    window.removeEventListener('profile-updated', onProfileUpdated);
    document.body.classList.remove('mobile-nav-open');
});
</script>

<template>
    <div class="dashboard-body executive-theme">
        <!-- Reusable Executive Sidebar Component -->
        <aside id="sidebar" class="sidebar" aria-label="Executive Portal Sidebar">
            <div class="sidebar-top-section">
                <!-- Brand Lockup -->
                <div class="sidebar-header">
                    <div class="sidebar-brand-lockup">
                        <div class="sidebar-logo-square">
                            <img :src="logoImg" alt="The Lens Logo">
                        </div>
                        <span class="sidebar-brand-name">The Lens Publication</span>
                    </div>
                </div>

                <!-- Profile Section -->
                <div
                    class="sidebar-profile"
                    style="cursor: pointer;"
                    title="View Profile Settings"
                    @click="router.push('/executive/profile-settings')"
                >
                    <div class="profile-avatar">
                        <img
                            id="sidebar-user-avatar"
                            :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Executive'} Avatar`"
                            loading="lazy"
                        >
                    </div>
                    <div id="sidebar-user-name" class="profile-name">{{ user?.full_name || 'Executive Officer' }}</div>
                    <div id="sidebar-user-role" class="profile-role-text">{{ user?.role || 'Executive' }}</div>
                </div>

                <!-- Navigation Links with Strict RBAC -->
                <nav class="sidebar-nav" aria-label="Main Navigation">
                    <router-link
                        to="/executive/dashboard"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path === '/executive/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/manage-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/manage-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage Articles</span>
                    </router-link>

                    <router-link
                        to="/executive/manage-my-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/manage-my-articles') || route.path.startsWith('/executive/my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/review-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.includes('/review-articles') || route.path.includes('/review-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/executive/submit-article"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/manage-accounts"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/manage-accounts') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-user-group"></i>
                        <span>Manage Accounts</span>
                    </router-link>

                    <router-link
                        to="/executive/activity-logs"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/activity-logs') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>

                    <router-link
                        v-if="canViewTransparency"
                        to="/executive/transparency"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/transparency') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                        <span>Transparency</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/feedback-inbox"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/executive/feedback') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-comments"></i>
                        <span>Feedback</span>
                    </router-link>
                </nav>
            </div>

            <!-- Bottom of Sidebar: Profile Settings, View Public Site, Logout -->
            <div class="sidebar-footer" id="sidebar-footer">
                <router-link
                    to="/executive/profile-settings"
                    class="sidebar-footer-link"
                    :class="{ 'active active-manual': route.path.includes('/profile-settings') || route.path.includes('/settings') }"
                    @click="closeMobileNav"
                >
                    <i class="fa-solid fa-sliders"></i>
                    <span>Profile Settings</span>
                </router-link>

                <a href="/" target="_blank" rel="noopener noreferrer" class="sidebar-footer-link">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>View public site</span>
                </a>

                <button
                    type="button"
                    id="logout-btn"
                    class="sidebar-footer-link logout-btn"
                    style="width: 100%; border: none; background: transparent; cursor: pointer; text-align: left;"
                    @click="promptLogout"
                >
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Logout</span>
                </button>
            </div>
        </aside>

        <!-- MAIN CONTENT AREA -->
        <div class="main-wrapper">
            <!-- Top Header Bar -->
            <header class="topbar">
                <!-- Left Side: Mobile Hamburger + Logo + Desktop Clock -->
                <div class="topbar-left">
                    <div class="mobile-header-brand">
                        <button
                            type="button"
                            id="mobile-hamburger-btn"
                            class="mobile-hamburger-btn"
                            aria-label="Toggle navigation menu"
                            :aria-expanded="isMobileNavOpen"
                            @click="toggleMobileNav"
                        >
                            <i class="fa-solid fa-bars"></i>
                        </button>
                        <div class="mobile-brand-lockup">
                            <div class="mobile-logo-square">
                                <img :src="logoImg" alt="The Lens Logo">
                            </div>
                            <span class="mobile-brand-title">The Lens</span>
                        </div>
                    </div>

                    <div class="topbar-clock">
                        <i class="fa-regular fa-clock"></i>
                        <span id="topbar-clock-display">{{ clockDisplay || 'Loading date & time…' }}</span>
                    </div>
                </div>

                <!-- Right Side: User Profile Badge -->
                <div class="topbar-right">
                    <div
                        class="topbar-user-profile"
                        style="cursor: pointer;"
                        title="View Profile Settings"
                        @click="router.push('/executive/profile-settings')"
                    >
                        <div class="topbar-avatar-circle" title="User Profile">
                            <img
                                :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                                :alt="`${user?.full_name || 'Executive'} Profile Picture`"
                                loading="lazy"
                            >
                        </div>
                        <span id="topbar-user-role" class="topbar-role-badge">{{ user?.role || 'Executive' }}</span>
                    </div>
                </div>
            </header>

            <!-- Mobile Navigation Menu Dropdown Drawer -->
            <nav
                id="mobile-nav-dropdown"
                class="mobile-nav-dropdown"
                :class="{ 'open': isMobileNavOpen }"
                aria-label="Mobile Navigation Menu"
            >
                <div class="mobile-nav-profile">
                    <div class="mobile-nav-avatar">
                        <img
                            :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Executive'} Avatar`"
                            loading="lazy"
                        >
                    </div>
                    <div class="mobile-nav-user-info">
                        <div id="mobile-user-name" class="mobile-nav-name">{{ user?.full_name || 'Executive' }}</div>
                        <div id="mobile-user-role" class="mobile-nav-role">{{ user?.role || 'Executive' }}</div>
                    </div>
                </div>

                <div class="mobile-nav-links">
                    <router-link
                        to="/executive/dashboard"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path === '/executive/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/manage-articles"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/manage-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage Articles</span>
                    </router-link>

                    <router-link
                        to="/executive/manage-my-articles"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/manage-my-articles') || route.path.startsWith('/executive/my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/review-articles"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.includes('/review-articles') || route.path.includes('/review-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/executive/submit-article"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/manage-accounts"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/manage-accounts') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-user-group"></i>
                        <span>Manage Accounts</span>
                    </router-link>

                    <router-link
                        to="/executive/activity-logs"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/activity-logs') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>

                    <router-link
                        v-if="canViewTransparency"
                        to="/executive/transparency"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/transparency') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                        <span>Transparency</span>
                    </router-link>

                    <router-link
                        v-if="isPresOrVp"
                        to="/executive/feedback-inbox"
                        class="mobile-nav-link"
                        :class="{ 'active': route.path.startsWith('/executive/feedback') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-comments"></i>
                        <span>Feedback</span>
                    </router-link>
                </div>

                <div class="mobile-nav-footer">
                    <router-link
                        to="/executive/profile-settings"
                        class="mobile-nav-footer-link"
                        :class="{ 'active': route.path.includes('/profile-settings') || route.path.includes('/settings') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-sliders"></i>
                        <span>Profile Settings</span>
                    </router-link>

                    <a href="/" target="_blank" rel="noopener noreferrer" class="mobile-nav-footer-link">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>View public site</span>
                    </a>

                    <button
                        type="button"
                        id="mobile-logout-btn"
                        class="mobile-nav-footer-link logout-btn"
                        style="width: 100%; border: none; background: transparent; cursor: pointer; text-align: left;"
                        @click="promptLogout"
                    >
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <!-- Main Page Content Slot -->
            <slot />
        </div>

        <!-- Global Reusable Logout Confirmation Modal -->
        <LogoutModal
            :is-open="showLogoutModal"
            :is-logging-out="isLoggingOut"
            @close="showLogoutModal = false"
            @confirm="confirmLogout"
        />
    </div>
</template>
