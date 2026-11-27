<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { currentUser, setAuthUser, clearAuthUser, useAuthStore } from '../stores/auth.js';
import { optimizeCloudinaryUrl, resolveUserAvatar } from '../utils/image.js';
import { useSidebarPendingCounts } from '../composables/useSidebarPendingCounts.js';
import LogoutModal from '../components/LogoutModal.vue';
const logoImg = '/images/logo.jpg';
import '../assets/css/executive-dashboard.css';
import '../assets/css/executive-modals.css';

const router = useRouter();
const route = useRoute();

// Global reactive user state
const user = currentUser;

// UI states
const isMobileNavOpen = ref(false);
const clockDisplay = ref('');
let clockTimer = null;

const isSectionHead = computed(() => {
    const roleName = String(user.value?.role || user.value?.role_name || currentUser.role || '').toLowerCase();
    return roleName.includes('head') || roleName.includes('chief');
});

const { pendingCounts } = useSidebarPendingCounts('cartoonist', isSectionHead);

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
    <div class="dashboard-body cartoonist-theme">
        <!-- Reusable Cartoonist Sidebar Component -->
        <aside id="sidebar" class="sidebar" aria-label="Cartoonist Portal Sidebar">
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
                    @click="router.push('/cartoonist/profile-settings')"
                >
                    <div class="profile-avatar">
                        <img
                            id="sidebar-user-avatar"
                            :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Cartoonist'} Avatar`"
                            loading="lazy"
                            @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                        >
                    </div>
                    <div id="sidebar-user-name" class="profile-name">{{ user?.full_name || 'Cartoonist' }}</div>
                    <div id="sidebar-user-role" class="profile-role-text">{{ user?.role || 'Cartoonist' }}</div>
                </div>

                <!-- Navigation Links -->
                <nav class="sidebar-nav" aria-label="Cartoonist Portal Navigation">
                    <router-link
                        to="/cartoonist/dashboard"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path === '/cartoonist/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>

                    <router-link
                        to="/cartoonist/submit-article"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/cartoonist/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit Article</span>
                    </router-link>

                    <router-link
                        to="/cartoonist/manage-articles"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/cartoonist/manage-articles') || route.path.startsWith('/cartoonist/manage-my-articles') || route.path.startsWith('/cartoonist/my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage My Articles</span>
                    </router-link>

                    <router-link
                        to="/cartoonist/submit-cartoon"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/cartoonist/submit-cartoon') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-paintbrush"></i>
                        <span>Submit Cartoon</span>
                    </router-link>

                    <router-link
                        to="/cartoonist/manage-cartoons"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/cartoonist/manage-cartoons') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-palette"></i>
                        <span>Manage My Cartoons</span>
                    </router-link>

                    <router-link
                        v-if="isSectionHead"
                        to="/cartoonist/cartoon-desk"
                        class="sidebar-nav-item"
                        :class="{ 'active active-manual': route.path.startsWith('/cartoonist/cartoon-desk') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-table-cells-large"></i>
                        <span>Cartoon Desk</span>
                        <span
                            v-if="pendingCounts.cartoonDesk !== null"
                            class="sidebar-nav-badge"
                            :class="{ 'is-zero': pendingCounts.cartoonDesk === 0 }"
                            :title="`${pendingCounts.cartoonDesk} pending cartoon approval${pendingCounts.cartoonDesk === 1 ? '' : 's'}`"
                        >
                            {{ pendingCounts.cartoonDesk > 99 ? '99+' : pendingCounts.cartoonDesk }}
                        </span>
                    </router-link>
                </nav>
            </div>

            <!-- Bottom of Sidebar: Profile Settings, View Public Site, Logout -->
            <div class="sidebar-footer" id="sidebar-footer">
                <router-link
                    to="/cartoonist/profile-settings"
                    class="sidebar-footer-link"
                    :class="{ 'active active-manual': route.path.startsWith('/cartoonist/profile-settings') }"
                    @click="closeMobileNav"
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
                    class="sidebar-footer-link logout-btn"
                    style="width: 100%; border: none; background: transparent; cursor: pointer; text-align: left;"
                    @click="promptLogout"
                >
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Logout</span>
                </button>
            </div>
        </aside>

        <!-- MAIN WRAPPER -->
        <div class="main-wrapper">
            <!-- TOPBAR -->
            <header class="topbar">
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

                <div class="topbar-right">
                    <div
                        class="topbar-user-profile"
                        style="cursor: pointer;"
                        title="Profile Settings"
                        @click="router.push('/cartoonist/profile-settings')"
                    >
                        <div class="topbar-avatar-circle" title="User Profile">
                            <img
                                id="topbar-user-avatar"
                                :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                                :alt="`${user?.full_name || 'Cartoonist'} Profile Picture`"
                                loading="lazy"
                                @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                            >
                        </div>
                        <span id="topbar-user-role" class="topbar-role-badge">{{ user?.role || 'Cartoonist' }}</span>
                    </div>
                </div>
            </header>

            <!-- Mobile Navigation Menu Dropdown -->
            <nav
                id="mobile-nav-dropdown"
                class="mobile-nav-dropdown"
                :class="{ 'is-open': isMobileNavOpen }"
                aria-label="Mobile Navigation Menu"
            >
                <div class="mobile-nav-profile" @click="router.push('/cartoonist/profile-settings'); closeMobileNav();">
                    <div class="mobile-nav-avatar">
                        <img
                            id="mobile-user-avatar"
                            :src="resolveAvatarUrl(user?.avatar_url || user?.profile_picture_url || user?.avatar)"
                            :alt="`${user?.full_name || 'Cartoonist'} Avatar`"
                            @error="(e) => e.target.src = '/images/member-placeholder.svg'"
                        >
                    </div>
                    <div class="mobile-nav-user-info">
                        <div id="mobile-user-name" class="mobile-nav-name">{{ user?.full_name || 'Cartoonist' }}</div>
                        <div id="mobile-user-role" class="mobile-nav-role">{{ user?.role || 'Cartoonist' }}</div>
                    </div>
                </div>

                <div class="mobile-nav-links">
                    <router-link
                        to="/cartoonist/dashboard"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path === '/cartoonist/dashboard' }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-chart-pie"></i>
                        <span>Dashboard</span>
                    </router-link>
                    <router-link
                        to="/cartoonist/submit-article"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/submit-article') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Submit Article</span>
                    </router-link>
                    <router-link
                        to="/cartoonist/manage-articles"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/manage-articles') || route.path.startsWith('/cartoonist/manage-my-articles') || route.path.startsWith('/cartoonist/my-articles') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Manage My Articles</span>
                    </router-link>
                    <router-link
                        to="/cartoonist/submit-cartoon"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/submit-cartoon') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-paintbrush"></i>
                        <span>Submit Cartoon</span>
                    </router-link>
                    <router-link
                        to="/cartoonist/manage-cartoons"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/manage-cartoons') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-palette"></i>
                        <span>Manage My Cartoons</span>
                    </router-link>
                    <router-link
                        v-if="isSectionHead"
                        to="/cartoonist/cartoon-desk"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/cartoon-desk') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-table-cells-large"></i>
                        <span>Cartoon Desk</span>
                        <span
                            v-if="pendingCounts.cartoonDesk !== null"
                            class="sidebar-nav-badge"
                            :class="{ 'is-zero': pendingCounts.cartoonDesk === 0 }"
                        >
                            {{ pendingCounts.cartoonDesk > 99 ? '99+' : pendingCounts.cartoonDesk }}
                        </span>
                    </router-link>
                    <router-link
                        to="/cartoonist/profile-settings"
                        class="mobile-nav-item"
                        :class="{ 'active': route.path.startsWith('/cartoonist/profile-settings') }"
                        @click="closeMobileNav"
                    >
                        <i class="fa-solid fa-sliders"></i>
                        <span>Profile Settings</span>
                    </router-link>
                    <a
                        href="/"
                        class="mobile-nav-item"
                        @click="openPublicSite"
                    >
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>View public site</span>
                    </a>
                    <button
                        type="button"
                        class="mobile-nav-item mobile-logout-btn"
                        style="width: 100%; text-align: left; background: transparent; border: none; cursor: pointer;"
                        @click="promptLogout"
                    >
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <!-- Page Content Injection -->
            <slot />
        </div>

        <!-- Global Reusable Logout Confirmation Modal -->
        <LogoutModal
            :is-open="showLogoutModal"
            :is-submitting="isLoggingOut"
            @close="showLogoutModal = false"
            @cancel="showLogoutModal = false"
            @confirm="confirmLogout"
        />
    </div>
</template>

<style scoped>
.cartoonist-theme {
    min-height: 100vh;
}
</style>
