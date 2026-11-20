<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
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

// Global reactive user state so any profile update immediately reflects across sidebar and header without refresh
const user = currentUser;

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
    <div class="dashboard-body eic-theme">
        <!-- Reusable EIC Sidebar Component -->
        <aside id="sidebar" class="sidebar" aria-label="Editor-in-Chief Portal Sidebar">
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
                    @click="router.push(route.path.startsWith('/aeic') ? '/aeic/profile-settings' : '/eic/profile-settings')"
                >
                    <div class="profile-avatar">
                        <img
                            id="sidebar-user-avatar"
                            :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'User'} Avatar`"
                            loading="lazy"
                        >
                    </div>
                    <div id="sidebar-user-name" class="profile-name">{{ user?.full_name || 'Editor-in-Chief' }}</div>
                    <div id="sidebar-user-role" class="profile-role-text">{{ user?.role || 'Editor-in-Chief' }}</div>
                </div>

                <!-- Navigation Links -->
                <nav class="sidebar-nav" aria-label="Main Navigation">
                    <router-link
                        to="/eic/dashboard"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path === '/eic/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/manage-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage Articles</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-my-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/manage-my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        to="/eic/review-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.includes('/review-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/eic/media-desk"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/media-desk') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-image"></i>
                        <span>Media Desk</span>
                    </router-link>

                    <router-link
                        to="/eic/submit-article"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-accounts"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/manage-accounts') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-user-group"></i>
                        <span>Manage Accounts</span>
                    </router-link>

                    <router-link
                        to="/eic/activity-logs"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/activity-logs') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>

                    <router-link
                        to="/eic/feedback-inbox"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/eic/feedback-inbox') }"
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
                    :to="route.path.startsWith('/aeic') ? '/aeic/profile-settings' : '/eic/profile-settings'"
                    class="sidebar-footer-link"
                    :class="{ 'active active-manual': route.path.includes('/profile-settings') }"
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

                <!-- Right Side: User Profile -->
                <div class="topbar-right">
                    <!-- User Profile Lockup -->
                    <div
                        class="topbar-user-profile"
                        @click="router.push(route.path.startsWith('/aeic') ? '/aeic/profile-settings' : '/eic/profile-settings')"
                        style="cursor: pointer;"
                        title="Profile Settings"
                    >
                        <div class="topbar-avatar-circle" title="User Profile">
                            <img
                                :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                                alt="User Profile Picture"
                                loading="lazy"
                            >
                        </div>
                        <span id="topbar-user-role" class="topbar-role-badge">{{ user?.role || 'Editor-in-Chief' }}</span>
                    </div>
                </div>
            </header>

            <!-- Mobile Accordion Dropdown -->
            <nav
                id="mobile-nav-dropdown"
                class="mobile-nav-dropdown"
                :class="{ active: isMobileNavOpen }"
                aria-label="Mobile Navigation Menu"
            >
                <div class="mobile-nav-profile">
                    <div class="mobile-nav-avatar">
                        <img
                            :src="resolveAvatarUrl(user?.profile_picture_url || user?.avatar)"
                            alt="Avatar"
                            loading="lazy"
                        >
                    </div>
                    <div class="mobile-nav-info">
                        <span id="mobile-user-name" class="mobile-nav-name">{{ user?.full_name || 'Editor-in-Chief' }}</span>
                        <span id="mobile-user-role" class="mobile-nav-role">{{ user?.role || 'Editor-in-Chief' }}</span>
                    </div>
                </div>

                <div class="mobile-nav-links">
                    <router-link
                        to="/eic/dashboard"
                        class="mobile-nav-item"
                        :class="{ active: route.path === '/eic/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-articles"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/manage-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage Articles</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-my-articles"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/manage-my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        to="/eic/review-articles"
                        class="mobile-nav-item"
                        :class="{ active: route.path.includes('/review-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/eic/media-desk"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/media-desk') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-image"></i>
                        <span>Media Desk</span>
                    </router-link>

                    <router-link
                        to="/eic/submit-article"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        to="/eic/manage-accounts"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/manage-accounts') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-user-group"></i>
                        <span>Manage Accounts</span>
                    </router-link>

                    <router-link
                        to="/eic/activity-logs"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/activity-logs') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>

                    <router-link
                        to="/eic/feedback-inbox"
                        class="mobile-nav-item"
                        :class="{ active: route.path.startsWith('/eic/feedback-inbox') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-comments"></i>
                        <span>Feedback</span>
                    </router-link>

                    <div class="mobile-nav-divider"></div>

                    <router-link
                        :to="route.path.startsWith('/aeic') ? '/aeic/profile-settings' : '/eic/profile-settings'"
                        class="mobile-nav-item"
                        :class="{ active: route.path.includes('/profile-settings') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-sliders"></i>
                        <span>Profile Settings</span>
                    </router-link>

                    <a href="/" target="_blank" rel="noopener noreferrer" class="mobile-nav-item">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>View public site</span>
                    </a>

                    <button
                        type="button"
                        class="mobile-nav-item logout-link"
                        style="width: 100%; border: none; background: transparent; text-align: left; cursor: pointer;"
                        @click="promptLogout"
                    >
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <!-- Slot for page contents -->
            <slot />
        </div>

        <!-- Global Reusable Logout Confirmation Modal -->
        <LogoutModal
            :show="showLogoutModal"
            :loading="isLoggingOut"
            :is-open="showLogoutModal"
            :is-loading="isLoggingOut"
            @confirm="confirmLogout"
            @cancel="showLogoutModal = false"
        />
    </div>
</template>
