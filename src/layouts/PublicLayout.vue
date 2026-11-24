<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore, currentUser } from '../stores/auth.js';
const logoImg = '/images/logo.jpg';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Compute member dashboard route if logged in
const dashboardRoute = computed(() => {
    if (!authStore.isAuthenticated) return '/login';
    const rawRole = authStore.currentRole || currentUser.role || '';
    const role = (typeof rawRole === 'string' ? rawRole : (rawRole?.role_name || rawRole?.name || '')).toLowerCase();
    if (role.includes('chief') || role.includes('eic')) return '/eic/dashboard';
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
    if (role.includes('cartoonist')) return '/cartoonist/dashboard';
    if (role.includes('m&pc') || role.includes('media and public') || role.includes('mpc')) return '/mpc/dashboard';
    if (role.includes('photojournalist') || role.includes('media team') || (role.includes('media') && !role.includes('public'))) return '/media/dashboard';
    if (role.includes('head')) return '/section-head/dashboard';
    return '/writer/dashboard';
});

// Current formatted date
const currentDate = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date());
});

// Mobile Navigation State
const isMobileNavOpen = ref(false);
function toggleMobileNav(open) {
    isMobileNavOpen.value = open !== undefined ? open : !isMobileNavOpen.value;
    if (typeof document !== 'undefined' && document.body) {
        if (isMobileNavOpen.value) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

// Search & Filter State
const searchQuery = ref(route?.query?.q || '');
const sortBy = ref(route?.query?.sort || 'newest');
const categoryFilter = ref(route?.query?.category || 'All');
const dateType = ref(route?.query?.dateType || 'any');
const dateValue = ref(route?.query?.dateValue || '');
const isFilterOpen = ref(false);

function toggleFilterDropdown() {
    isFilterOpen.value = !isFilterOpen.value;
}

function closeFilterDropdown() {
    isFilterOpen.value = false;
}

function clearFilters() {
    sortBy.value = 'newest';
    categoryFilter.value = 'All';
    dateType.value = 'any';
    dateValue.value = '';
}

function submitSearch() {
    const query = {};
    if (searchQuery.value && searchQuery.value.trim()) query.q = searchQuery.value.trim();
    if (sortBy.value && sortBy.value !== 'newest') query.sort = sortBy.value;
    if (categoryFilter.value && categoryFilter.value !== 'All') query.category = categoryFilter.value;
    if (dateType.value && dateType.value !== 'any') query.dateType = dateType.value;
    if (dateType.value === 'choose' && dateValue.value) query.dateValue = dateValue.value;

    closeFilterDropdown();
    toggleMobileNav(false);
    router.push({ path: '/archives', query });
}

// Click outside handler for filter dropdown
function handleDocumentClick(e) {
    const filterShell = document.getElementById('global-search-shell');
    if (filterShell && !filterShell.contains(e.target)) {
        isFilterOpen.value = false;
    }
}

onMounted(() => {
    if (typeof document !== 'undefined') {
        document.addEventListener('click', handleDocumentClick);
    }
});

onUnmounted(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener('click', handleDocumentClick);
        if (document.body) {
            document.body.style.overflow = '';
        }
    }
});

// Sync searchQuery when route query changes
watch(() => route?.query?.q, (newQ) => {
    searchQuery.value = newQ || '';
});

// Close mobile nav on route change
watch(() => route?.path, () => {
    toggleMobileNav(false);
    isFilterOpen.value = false;
});
</script>

<template>
    <div class="bg-white text-stone-900 font-body antialiased min-h-screen flex flex-col">
        <!-- Site Header -->
        <header id="header-container" class="site-header w-full font-body border-b border-stone-200 shadow-sm bg-white">
            <!-- Top Bar -->
            <div class="top-bar">
                <div class="top-bar-inner">
                    <div class="top-bar-details">
                        <span class="top-bar-item date-item">
                            <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                            <time id="current-date">{{ currentDate }}</time>
                        </span>
                        <span class="top-bar-divider campus-divider" aria-hidden="true">|</span>
                        <span class="campus-name">
                            <i class="fa-solid fa-graduation-cap campus-icon" aria-hidden="true"></i>
                            <span>Polytechnic University of the Philippines – Biñan Campus</span>
                        </span>
                    </div>
                    <div class="top-bar-actions">
                        <a class="facebook-link" href="https://www.facebook.com/profile.php?id=61560889387183" target="_blank" rel="noopener noreferrer" aria-label="The Lens Publication on Facebook" title="The Lens on Facebook">
                            <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
                        </a>
                        <a class="email-link" href="mailto:thelenspublicationpupbc@gmail.com" aria-label="Email The Lens Publication" title="The Lens email">
                            <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                        </a>
                        <span class="top-bar-divider login-divider" aria-hidden="true">|</span>
                        <router-link :to="authStore.isAuthenticated ? dashboardRoute : '/login'" id="member-login-btn" class="member-login-btn">
                            <i :class="authStore.isAuthenticated ? 'fa-solid fa-gauge' : 'fa-regular fa-user'" aria-hidden="true"></i>
                            <span>{{ authStore.isAuthenticated ? 'Back to Dashboard' : 'Login as a Member' }}</span>
                        </router-link>
                    </div>
                </div>
            </div>

            <!-- Brand & Search Row -->
            <div class="brand-search-row">
                <button id="menu-button" class="mobile-menu-button" type="button" aria-label="Open navigation" :aria-expanded="isMobileNavOpen" @click="toggleMobileNav(true)">
                    <span class="menu-glyph" aria-hidden="true">☰</span>
                </button>

                <router-link to="/" class="brand-lockup" aria-label="The Lens home">
                    <img :src="logoImg" alt="The Lens logo" class="site-logo">
                    <span class="brand-copy">
                        <span class="brand-name">THE LENS</span>
                        <span class="brand-tagline">Basta Lente, Abante!</span>
                    </span>
                </router-link>

                <!-- Search Bar & Dropdown -->
                <div class="search-shell" id="global-search-shell">
                    <form id="search-form" class="search-form" role="search" @submit.prevent="submitSearch">
                        <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                        <input
                            type="search"
                            id="search-input"
                            v-model="searchQuery"
                            class="search-input"
                            placeholder="Search articles, authors, or topics…"
                            aria-label="Search articles and authors"
                            autocomplete="off"
                        >
                        <button
                            type="button"
                            id="sort-filter-btn"
                            class="sort-filter-btn"
                            :aria-expanded="isFilterOpen"
                            aria-controls="filter-dropdown"
                            @click.stop="toggleFilterDropdown"
                        >
                            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                            <span>Sort &amp; Filter</span>
                            <i class="fa-solid fa-chevron-down filter-chevron" aria-hidden="true"></i>
                        </button>

                        <!-- Filter Dropdown Panel -->
                        <div id="filter-dropdown" class="filter-dropdown" :class="{ hidden: !isFilterOpen }" @click.stop>
                            <div class="filter-panel-heading">
                                <span>Sort &amp; Filter</span>
                                <button type="button" id="close-filter-btn" class="icon-button" aria-label="Close filters" @click="closeFilterDropdown">
                                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="filter-grid">
                                <div class="filter-field">
                                    <label for="sort-select">Sort by</label>
                                    <select id="sort-select" v-model="sortBy" class="archive-select">
                                        <option value="newest">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="popular">Most Viewed</option>
                                        <option value="az">A-Z</option>
                                    </select>
                                </div>
                                <div class="filter-field">
                                    <label for="category-select">Category</label>
                                    <select id="category-select" v-model="categoryFilter" class="archive-select">
                                        <option value="All">All categories</option>
                                        <option value="News">News</option>
                                        <option value="Feature">Features</option>
                                        <option value="Opinion">Opinion</option>
                                        <option value="Science & Technology">Science &amp; Technology</option>
                                        <option value="Literature">Literature</option>
                                    </select>
                                </div>
                                <div class="filter-field filter-date-field">
                                    <label for="date-filter-type">Published date</label>
                                    <div class="published-date-controls">
                                        <select id="date-filter-type" v-model="dateType" class="archive-select">
                                            <option value="any">Any date</option>
                                            <option value="today">Today</option>
                                            <option value="this_week">This week</option>
                                            <option value="choose">Choose date</option>
                                        </select>
                                        <input
                                            type="date"
                                            id="date-filter-value"
                                            v-model="dateValue"
                                            class="archive-select mt-2"
                                            :class="{ hidden: dateType !== 'choose' }"
                                        >
                                    </div>
                                </div>
                            </div>
                            <div class="filter-panel-footer">
                                <button type="button" id="clear-filters-btn" class="clear-filters-btn" @click="clearFilters">Clear filters</button>
                                <button type="submit" class="apply-filters-btn">
                                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Apply
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Utility links -->
                <div class="header-utility-links" aria-label="Publication links">
                    <router-link to="/about" class="header-utility-link" :class="{ 'is-active': route?.path === '/about' }" data-header-action="about-us">
                        <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
                        <span>About Us</span>
                    </router-link>
                    <router-link to="/feedback" class="header-utility-link" :class="{ 'is-active': route?.path === '/feedback' }" data-header-action="send-feedback">
                        <i class="fa-regular fa-paper-plane" aria-hidden="true"></i>
                        <span>Send Feedback</span>
                    </router-link>
                </div>
            </div>

            <!-- Mobile Navigation Backdrop -->
            <div
                class="mobile-nav-backdrop"
                id="mobile-nav-backdrop"
                :class="{ 'is-visible': isMobileNavOpen }"
                aria-hidden="true"
                @click="toggleMobileNav(false)"
            ></div>

            <!-- Navigation Bar -->
            <nav class="navigation" id="navigation" :class="{ 'is-open': isMobileNavOpen }" aria-label="Main navigation">
                <div class="navigation-inner">
                    <div class="mobile-nav-top">
                        <span>Explore The Lens</span>
                        <button type="button" id="close-nav-btn" aria-label="Close navigation" @click="toggleMobileNav(false)">
                            <span class="close-glyph" aria-hidden="true">×</span>
                        </button>
                    </div>
                    <ul class="nav-list">
                        <li>
                            <router-link to="/" class="nav-link" :class="{ 'is-active': (route?.path || '') === '/' }">Home</router-link>
                        </li>
                        <li>
                            <router-link to="/category/latest" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/latest') || route?.path === '/latest' }">Latest</router-link>
                        </li>
                        <li>
                            <router-link to="/category/news" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/news') || route?.path === '/news' }">News</router-link>
                        </li>
                        <li>
                            <router-link to="/category/feature" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/feature') || route?.path === '/features' }">Features</router-link>
                        </li>
                        <li>
                            <router-link to="/category/opinion" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/opinion') || route?.path === '/opinion' }">Opinion</router-link>
                        </li>
                        <li>
                            <router-link to="/category/science-technology" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/science') || route?.path === '/science' }">Science &amp; Technology</router-link>
                        </li>
                        <li>
                            <router-link to="/category/literature" class="nav-link" :class="{ 'is-active': (route?.path || '').includes('/category/literature') || route?.path === '/literature' }">Literature</router-link>
                        </li>
                        <li>
                            <router-link to="/archives" class="nav-link" :class="{ 'is-active': route?.path === '/archives' }">Archives</router-link>
                        </li>
                        <li class="mobile-only-nav-item">
                            <router-link to="/about" class="nav-link" :class="{ 'is-active': route?.path === '/about' }">About Us</router-link>
                        </li>
                        <li class="mobile-only-nav-item">
                            <router-link to="/feedback" class="nav-link" :class="{ 'is-active': route?.path === '/feedback' }"><span>Send Feedback</span></router-link>
                        </li>
                        <li class="mobile-only-nav-item">
                            <router-link :to="authStore.isAuthenticated ? dashboardRoute : '/login'" class="nav-link">
                                <i :class="authStore.isAuthenticated ? 'fa-solid fa-gauge' : 'fa-regular fa-user'" class="mr-1"></i>
                                <span>{{ authStore.isAuthenticated ? 'Back to Dashboard' : 'Login as a Member' }}</span>
                            </router-link>
                        </li>
                    </ul>
                    <div class="mobile-nav-socials" aria-label="Publication contact links">
                        <a href="https://www.facebook.com/profile.php?id=61560889387183" target="_blank" rel="noopener noreferrer">
                            <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
                            <span>Visit Facebook Page</span>
                        </a>
                        <a href="mailto:thelenspublicationpupbc@gmail.com">
                            <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                            <span>Email The Lens</span>
                        </a>
                    </div>
                </div>
            </nav>
        </header>

        <!-- Main Content Area -->
        <main class="flex-grow">
            <slot />
        </main>

        <!-- Footer Container -->
        <footer id="footer-container" class="site-footer bg-[#1a050b] text-stone-300">
            <div class="footer-content max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="footer-brand-column">
                    <router-link to="/" class="footer-brand-lockup flex items-center gap-3 mb-3">
                        <img :src="logoImg" alt="The Lens logo" class="footer-brand-logo w-10 h-10 rounded-full border border-rose-900/40">
                        <span>
                            <strong class="footer-brand-name block text-white font-serif tracking-wider">THE LENS</strong>
                            <span class="footer-brand-tagline text-xs text-rose-300 italic">Basta Lente, Abante!</span>
                        </span>
                    </router-link>
                    <p class="footer-description text-xs text-white leading-relaxed">
                        The Official Student Journalism Body of Polytechnic University of the Philippines – Biñan Campus.
                    </p>
                </div>
                <div>
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">Explore</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <router-link to="/category/news" class="footer-link hover:text-white transition-colors">News</router-link>
                        <router-link to="/category/feature" class="footer-link hover:text-white transition-colors">Features</router-link>
                        <router-link to="/category/opinion" class="footer-link hover:text-white transition-colors">Opinion</router-link>
                        <router-link to="/category/science-technology" class="footer-link hover:text-white transition-colors">Science &amp; Technology</router-link>
                        <router-link to="/category/literature" class="footer-link hover:text-white transition-colors">Literature</router-link>
                    </div>
                </div>
                <div>
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">The Publication</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <router-link to="/about" class="footer-link hover:text-white transition-colors">About The Lens</router-link>
                        <router-link to="/members" class="footer-link hover:text-white transition-colors">Our Members</router-link>
                        <router-link to="/about#documents" class="footer-link hover:text-white transition-colors">Financial Records &amp; Documents</router-link>
                        <router-link to="/archives" class="footer-link hover:text-white transition-colors">Article Archives</router-link>
                    </div>
                </div>
                <div id="footer-contact">
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">Contact &amp; Socials</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <a href="https://www.facebook.com/profile.php?id=61560889387183" target="_blank" rel="noopener noreferrer" class="footer-link hover:text-white transition-colors inline-flex items-center gap-2.5">
                            <i class="fa-brands fa-facebook-f text-rose-400 w-4 text-center shrink-0" aria-hidden="true"></i>
                            <span>Facebook Page</span>
                        </a>
                        <a href="mailto:thelenspublicationpupbc@gmail.com" class="footer-link hover:text-white transition-colors inline-flex items-center gap-2.5">
                            <i class="fa-regular fa-envelope text-rose-400 w-4 text-center shrink-0" aria-hidden="true"></i>
                            <span>Email The Lens</span>
                        </a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom border-t border-stone-800 text-center py-4 text-xs text-stone-500">
                <p>© <span id="copyright-year">{{ new Date().getFullYear() }}</span> The Lens. All rights reserved.</p>
            </div>
        </footer>
    </div>
</template>
