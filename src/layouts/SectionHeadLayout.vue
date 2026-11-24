<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { logout } from '../services/api.js';
import { currentUser, setAuthUser, clearAuthUser, useAuthStore } from '../stores/auth.js';
import { optimizeCloudinaryUrl, resolveUserAvatar } from '../utils/image.js';
import LogoutModal from '../components/LogoutModal.vue';
const logoImg = '/images/logo.jpg';
import '../assets/css/executive-dashboard.css';
import '../assets/css/executive-modals.css';
import '../assets/css/section-head-dashboard.css';

const router = useRouter();
const route = useRoute();

// Global reactive user state so any profile update immediately reflects across sidebar and header without refresh
const user = currentUser;

// UI states
const isMobileNavOpen = ref(false);
const clockDisplay = ref('');
let clockTimer = null;

function resolveAvatarUrl(url) {
    return resolveUserAvatar(url || user);
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

function openPublicSite(event) {
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1)) {
        return;
    }
    if (event) event.preventDefault();
    closeMobileNav();
    router.push('/').then(() => {
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    }).catch(() => {
        window.location.href = '/';
    });
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

    try {
        const authStore = useAuthStore();
        await authStore.fetchUser();
    } catch (err) {
        console.warn('Could not refresh user profile via authStore:', err);
    }
});

onUnmounted(() => {
    if (clockTimer) clearInterval(clockTimer);
    window.removeEventListener('profile-updated', onProfileUpdated);
    document.body.classList.remove('mobile-nav-open');
});
</script>

<template>
    <div class="dashboard-body min-h-screen">
        <!-- Executive Sidebar Component (Exact match to Blade executive-sidebar) -->
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
                <div class="sidebar-profile">
                    <div class="profile-avatar">
                        <img
                            id="sidebar-user-avatar"
                            :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Section Head'} Avatar`"
                            loading="lazy"
                            @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                        >
                    </div>
                    <div class="profile-name">{{ user.full_name }}</div>
                    <div id="sidebar-user-role" class="profile-role-text">{{ user.role }}</div>
                </div>

                <!-- Navigation Links with Strict Section Head RBAC -->
                <nav class="sidebar-nav" aria-label="Main Navigation">
                    <router-link
                        to="/section-head/dashboard"
                        class="sidebar-nav-item"
                        :class="{ active: route.path === '/section-head/dashboard' }"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        to="/section-head/manage-my-articles"
                        class="sidebar-nav-item"
                        :class="{ active: route.path.startsWith('/section-head/manage-my-articles') || route.path.startsWith('/section-head/my-articles') }"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        to="/section-head/review-articles"
                        class="sidebar-nav-item"
                        :class="{ active: route.path.startsWith('/section-head/review-articles') }"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/section-head/submit-article"
                        class="sidebar-nav-item"
                        :class="{ active: route.path.startsWith('/section-head/submit-article') }"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        to="/section-head/activity-logs"
                        class="sidebar-nav-item"
                        :class="{ active: route.path.startsWith('/section-head/activity-logs') }"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>
                </nav>
            </div>

            <!-- Bottom of Sidebar: Profile Settings, View Public Site, Logout -->
            <div class="sidebar-footer" id="sidebar-footer">
                <router-link
                    to="/section-head/profile-settings"
                    class="sidebar-footer-link"
                    :class="{ active: route.path.startsWith('/section-head/profile-settings') || route.path.startsWith('/section-head/settings') }"
                >
                    <i class="fa-solid fa-sliders"></i>
                    <span>Profile Settings</span>
                </router-link>

                <a href="/" class="sidebar-footer-link" @click="openPublicSite">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>View public site</span>
                </a>

                <button
                    type="button"
                    id="logout-btn"
                    @click="promptLogout"
                    class="sidebar-footer-link logout-btn"
                    style="border: none; background: transparent; cursor: pointer;"
                >
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Logout</span>
                </button>
            </div>
        </aside>

        <!-- MAIN WRAPPER (Exact match to executive-dashboard.css .main-wrapper) -->
        <div class="main-wrapper">
            <!-- TOPBAR (Exact match to Blade header.topbar) -->
            <header class="topbar">
                <div class="topbar-left">
                    <div class="mobile-header-brand">
                        <button
                            type="button"
                            id="mobile-hamburger-btn"
                            class="mobile-hamburger-btn"
                            @click="toggleMobileNav"
                            aria-label="Toggle navigation menu"
                            :aria-expanded="isMobileNavOpen"
                        >
                            <i :class="isMobileNavOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
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
                        <span id="topbar-clock-display">{{ clockDisplay }}</span>
                    </div>
                </div>

                <div class="topbar-right">
                    <div class="topbar-user-profile">
                        <div class="topbar-avatar-circle" title="User Profile">
                            <img
                                id="topbar-user-avatar"
                                :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                                :alt="`${user?.full_name || 'Section Head'} Profile Picture`"
                                loading="lazy"
                                @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                            >
                        </div>
                        <span id="topbar-user-role" class="topbar-role-badge">{{ user.role }}</span>
                    </div>
                </div>
            </header>

            <!-- Mobile Navigation Menu Dropdown (Exact match to Blade #mobile-nav-dropdown) -->
            <div
                v-if="isMobileNavOpen"
                id="mobile-nav-backdrop"
                class="mobile-nav-backdrop open active"
                @click="closeMobileNav"
            ></div>

            <nav
                id="mobile-nav-dropdown"
                class="mobile-nav-dropdown"
                :class="{ open: isMobileNavOpen, active: isMobileNavOpen, expanded: isMobileNavOpen }"
                aria-label="Mobile Navigation Menu"
            >
                <div class="mobile-nav-profile">
                    <div class="mobile-nav-avatar">
                        <img
                            id="mobile-user-avatar"
                            :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Section Head'} Avatar`"
                            loading="lazy"
                            @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                        >
                    </div>
                    <div class="mobile-nav-user-info">
                        <div id="mobile-user-name" class="mobile-nav-name">{{ user.full_name }}</div>
                        <div id="mobile-user-role" class="mobile-nav-role">{{ user.role }}</div>
                    </div>
                </div>

                <div class="mobile-nav-links">
                    <router-link
                        to="/section-head/dashboard"
                        class="mobile-nav-link"
                        :class="{ active: route.path === '/section-head/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        to="/section-head/manage-my-articles"
                        class="mobile-nav-link"
                        :class="{ active: route.path.startsWith('/section-head/manage-my-articles') || route.path.startsWith('/section-head/my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-file-pen"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        to="/section-head/review-articles"
                        class="mobile-nav-link"
                        :class="{ active: route.path.startsWith('/section-head/review-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clipboard-check"></i>
                        <span>Review Article</span>
                    </router-link>

                    <router-link
                        to="/section-head/submit-article"
                        class="mobile-nav-link"
                        :class="{ active: route.path.startsWith('/section-head/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit article</span>
                    </router-link>

                    <router-link
                        to="/section-head/activity-logs"
                        class="mobile-nav-link"
                        :class="{ active: route.path.startsWith('/section-head/activity-logs') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Activity log</span>
                    </router-link>
                </div>

                <div class="mobile-nav-footer">
                    <router-link
                        to="/section-head/profile-settings"
                        class="mobile-nav-footer-link"
                        :class="{ active: route.path.startsWith('/section-head/profile-settings') || route.path.startsWith('/section-head/settings') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-sliders"></i>
                        <span>Profile Settings</span>
                    </router-link>

                    <a href="/" class="mobile-nav-footer-link" @click="openPublicSite">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>View public site</span>
                    </a>

                    <button
                        type="button"
                        id="mobile-logout-btn"
                        @click="promptLogout"
                        class="mobile-nav-footer-link logout-btn"
                        style="width: 100%; border: none; background: transparent; cursor: pointer; text-align: left;"
                    >
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <!-- Page View Render -->
            <slot />
        </div>

        <!-- Confirm Logout Modal -->
        <LogoutModal
            :show="showLogoutModal"
            :loading="isLoggingOut"
            @confirm="confirmLogout"
            @cancel="showLogoutModal = false"
            @close="showLogoutModal = false"
        />
    </div>
</template>
