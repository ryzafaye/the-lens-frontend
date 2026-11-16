<script setup>
import PageHead from '../components/PageHead.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '@/assets/css/main.css';
import logoImg from '@/assets/images/logo.jpg';

const props = defineProps({
    title: { type: String, default: 'The Lens Publication' },
    reader: { type: Boolean, default: false },
});

const route = useRoute();
const router = useRouter();

const searchQuery = ref('');
const sortValue = ref('newest');
const categoryValue = ref('All');
const dateTypeValue = ref('any');
const dateValueInput = ref('');

const isFilterOpen = ref(false);
const isNavOpen = ref(false);

const currentDate = computed(() => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
});

const currentYear = computed(() => new Date().getFullYear());

const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Latest', path: '/category/latest' },
    { label: 'News', path: '/category/news' },
    { label: 'Features', path: '/category/feature' },
    { label: 'Opinion', path: '/category/opinion' },
    { label: 'Science & Technology', path: '/category/science-technology' },
    { label: 'Literature', path: '/category/literature' },
    { label: 'Archives', path: '/archives' },
];

function isRouteActive(path) {
    if (path === '/') return route.path === '/';
    if (path === '/category/feature') {
        return route.path === '/category/feature' || route.path === '/category/features';
    }
    return route.path === path;
}

function toggleNav(open) {
    isNavOpen.value = open;
    if (typeof document !== 'undefined') {
        document.body.classList.toggle('nav-open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    }
}

function toggleFilter() {
    isFilterOpen.value = !isFilterOpen.value;
}

function submitSearchAndFilters() {
    isFilterOpen.value = false;
    const query = {
        q: searchQuery.value.trim(),
        sort: sortValue.value,
        category: categoryValue.value,
        dateType: dateTypeValue.value,
        dateValue: dateTypeValue.value === 'choose' ? dateValueInput.value : '',
    };
    router.push({ path: '/archives', query });
}

function onSearch() {
    submitSearchAndFilters();
}

function applyFilters() {
    submitSearchAndFilters();
}

function clearFilters() {
    sortValue.value = 'newest';
    categoryValue.value = 'All';
    dateTypeValue.value = 'any';
    dateValueInput.value = '';
}

watch(dateTypeValue, (val) => {
    if (val !== 'choose') {
        dateValueInput.value = '';
    }
});

watch(
    () => route.query,
    (newQuery) => {
        searchQuery.value = typeof newQuery.q === 'string' ? newQuery.q : '';
        sortValue.value = typeof newQuery.sort === 'string' ? newQuery.sort : 'newest';
        categoryValue.value = typeof newQuery.category === 'string' ? newQuery.category : 'All';
        dateTypeValue.value = typeof newQuery.dateType === 'string' ? newQuery.dateType : 'any';
        dateValueInput.value = typeof newQuery.dateValue === 'string' ? newQuery.dateValue : '';
    },
    { immediate: true }
);

watch(
    () => route.path,
    () => {
        toggleNav(false);
        isFilterOpen.value = false;
    }
);

onMounted(() => {
    if (props.reader) document.body.classList.add('article-reader-body');
});

onBeforeUnmount(() => {
    if (props.reader) document.body.classList.remove('article-reader-body');
    if (typeof document !== 'undefined') {
        document.body.classList.remove('nav-open');
        document.body.style.overflow = '';
    }
});
</script>

<template>
    <PageHead :title="`${title} | The Lens`">
        
    </PageHead>
    <div :class="['min-h-screen bg-white text-stone-900 font-body antialiased flex flex-col', reader && 'h-screen overflow-hidden']">
        <!-- Site Header -->
        <header v-if="!reader" id="header-container" class="site-header w-full font-body border-b border-stone-200 shadow-sm bg-white">
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
                        <a
                            class="facebook-link"
                            href="https://www.facebook.com/profile.php?id=61560889387183"
                            data-publication-link="facebook"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="The Lens Publication on Facebook"
                            title="The Lens on Facebook"
                        >
                            <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
                        </a>
                        <a
                            class="email-link"
                            href="mailto:thelenspublicationpupbc@gmail.com"
                            data-publication-link="email"
                            aria-label="Email The Lens Publication"
                            title="The Lens email"
                        >
                            <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                        </a>
                        <span class="top-bar-divider login-divider" aria-hidden="true">|</span>
                        <RouterLink to="/login" id="member-login-btn" class="member-login-btn">
                            <i class="fa-regular fa-user" aria-hidden="true"></i>
                            <span>Login as a Member</span>
                        </RouterLink>
                    </div>
                </div>
            </div>

            <!-- Brand & Search Row -->
            <div class="brand-search-row">
                <button
                    id="menu-button"
                    class="mobile-menu-button cursor-pointer"
                    type="button"
                    aria-label="Open navigation"
                    :aria-expanded="isNavOpen"
                    aria-controls="navigation"
                    @click="toggleNav(true)"
                >
                    <span class="menu-glyph" aria-hidden="true">☰</span>
                </button>

                <RouterLink to="/" class="brand-lockup" aria-label="The Lens home">
                    <img :src="logoImg" alt="The Lens logo" class="site-logo">
                    <span class="brand-copy">
                        <span class="brand-name">THE LENS</span>
                        <span class="brand-tagline">Basta Lente, Abante!</span>
                    </span>
                </RouterLink>

                <!-- Search Bar & Dropdown -->
                <div class="search-shell" id="global-search-shell">
                    <form id="search-form" class="search-form" @submit.prevent="onSearch" role="search">
                        <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                        <input
                            type="search"
                            id="search-input"
                            v-model="searchQuery"
                            name="q"
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
                            @click.stop="toggleFilter"
                        >
                            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                            <span>Sort &amp; Filter</span>
                            <i class="fa-solid fa-chevron-down filter-chevron" aria-hidden="true"></i>
                        </button>

                        <!-- Filter Dropdown Panel -->
                        <div
                            id="filter-dropdown"
                            class="filter-dropdown"
                            :class="{ hidden: !isFilterOpen }"
                            @click.stop
                        >
                            <div class="filter-panel-heading">
                                <span>Sort &amp; Filter</span>
                                <button
                                    type="button"
                                    id="close-filter-btn"
                                    class="icon-button cursor-pointer"
                                    aria-label="Close filters"
                                    @click="isFilterOpen = false"
                                >
                                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="filter-grid">
                                <div class="filter-field">
                                    <label for="sort-select">Sort by</label>
                                    <select id="sort-select" v-model="sortValue" name="sort" class="archive-select">
                                        <option value="newest">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="popular">Most Viewed</option>
                                        <option value="az">A-Z</option>
                                    </select>
                                </div>
                                <div class="filter-field">
                                    <label for="category-select">Category</label>
                                    <select id="category-select" v-model="categoryValue" name="category" class="archive-select">
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
                                        <select id="date-filter-type" v-model="dateTypeValue" name="dateType" class="archive-select">
                                            <option value="any">Any date</option>
                                            <option value="today">Today</option>
                                            <option value="this_week">This week</option>
                                            <option value="choose">Choose date</option>
                                        </select>
                                        <input
                                            v-model="dateValueInput"
                                            type="date"
                                            id="date-filter-value"
                                            name="dateValue"
                                            class="archive-select mt-2"
                                            :class="{ hidden: dateTypeValue !== 'choose' }"
                                        >
                                    </div>
                                </div>
                            </div>
                            <div class="filter-panel-footer">
                                <button type="button" id="clear-filters-btn" class="clear-filters-btn cursor-pointer" @click="clearFilters">Clear filters</button>
                                <button type="button" class="apply-filters-btn cursor-pointer" @click="applyFilters">
                                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Apply
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Utility links -->
                <div class="header-utility-links" aria-label="Publication links">
                    <RouterLink
                        to="/about"
                        class="header-utility-link"
                        :class="{ 'is-active': route.path === '/about' }"
                        data-header-action="about-us"
                    >
                        <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
                        <span>About Us</span>
                    </RouterLink>
                    <RouterLink
                        to="/feedback"
                        class="header-utility-link"
                        :class="{ 'is-active': route.path === '/feedback' }"
                        data-header-action="send-feedback"
                    >
                        <i class="fa-regular fa-paper-plane" aria-hidden="true"></i>
                        <span>Send Feedback</span>
                    </RouterLink>
                </div>
            </div>



            <!-- Main Navigation Bar & Mobile Drawer -->
            <nav
                class="navigation"
                id="navigation"
                :class="{ 'mobile-open': isNavOpen, 'is-open': isNavOpen }"
                aria-label="Main navigation"
            >
                <div class="navigation-inner">
                    <div class="mobile-nav-top">
                        <span>Explore The Lens</span>
                        <button type="button" id="close-nav-btn" class="cursor-pointer" aria-label="Close navigation" @click="toggleNav(false)">
                            <span class="close-glyph" aria-hidden="true">×</span>
                        </button>
                    </div>
                    <ul class="nav-list">
                        <li v-for="item in navItems" :key="item.path">
                            <RouterLink
                                :to="item.path"
                                class="nav-link"
                                :class="{ active: isRouteActive(item.path), 'is-active': isRouteActive(item.path) }"
                                @click="toggleNav(false)"
                            >
                                {{ item.label }}
                            </RouterLink>
                        </li>
                        <li class="mobile-only-nav-item">
                            <RouterLink
                                to="/about"
                                class="nav-link"
                                :class="{ active: isRouteActive('/about'), 'is-active': isRouteActive('/about') }"
                                @click="toggleNav(false)"
                            >
                                About Us
                            </RouterLink>
                        </li>
                        <li class="mobile-only-nav-item">
                            <RouterLink
                                to="/feedback"
                                class="nav-link"
                                :class="{ active: isRouteActive('/feedback'), 'is-active': isRouteActive('/feedback') }"
                                @click="toggleNav(false)"
                            >
                                <span>Send Feedback</span>
                            </RouterLink>
                        </li>
                    </ul>
                    <div class="mobile-nav-socials" aria-label="Publication contact links">
                        <a
                            href="https://www.facebook.com/profile.php?id=61560889387183"
                            data-publication-link="facebook"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
                            <span>Visit Facebook Page</span>
                        </a>
                        <a href="mailto:thelenspublicationpupbc@gmail.com" data-publication-link="email">
                            <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                            <span>Email The Lens</span>
                        </a>
                    </div>
                </div>
            </nav>
            <!-- Mobile Nav Backdrop -->
            <div
                class="mobile-nav-backdrop"
                :class="{ 'is-visible': isNavOpen }"
                aria-hidden="true"
                @click="toggleNav(false)"
            ></div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-grow">
            <slot />
        </main>

        <!-- Footer Container -->
        <footer v-if="!reader" id="footer-container" class="site-footer bg-[#1a050b] text-stone-300">
            <div class="footer-content max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="footer-brand-column">
                    <RouterLink to="/" class="footer-brand-lockup flex items-center gap-3 mb-3">
                        <img :src="logoImg" alt="The Lens logo" class="footer-brand-logo w-10 h-10 rounded-full border border-rose-900/40">
                        <span>
                            <strong class="footer-brand-name block text-white font-serif tracking-wider">THE LENS</strong>
                            <span class="footer-brand-tagline text-xs text-rose-300 italic">Basta Lente, Abante!</span>
                        </span>
                    </RouterLink>
                    <p class="footer-description text-xs text-white leading-relaxed">
                        The Official Student Journalism Body of Polytechnic University of the Philippines – Biñan Campus.
                    </p>
                </div>
                <div>
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">Explore</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <RouterLink to="/category/news" class="footer-link hover:text-white transition-colors">News</RouterLink>
                        <RouterLink to="/category/feature" class="footer-link hover:text-white transition-colors">Features</RouterLink>
                        <RouterLink to="/category/opinion" class="footer-link hover:text-white transition-colors">Opinion</RouterLink>
                        <RouterLink to="/category/science-technology" class="footer-link hover:text-white transition-colors">Science &amp; Technology</RouterLink>
                        <RouterLink to="/category/literature" class="footer-link hover:text-white transition-colors">Literature</RouterLink>
                    </div>
                </div>
                <div>
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">The Publication</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <RouterLink to="/about" class="footer-link hover:text-white transition-colors">About The Lens</RouterLink>
                        <RouterLink to="/members" class="footer-link hover:text-white transition-colors">Our Members</RouterLink>
                        <RouterLink to="/about#documents" class="footer-link hover:text-white transition-colors">Financial Records &amp; Documents</RouterLink>
                        <RouterLink to="/archives" class="footer-link hover:text-white transition-colors">Article Archives</RouterLink>
                    </div>
                </div>
                <div id="footer-contact">
                    <h3 class="footer-heading text-sm font-semibold text-white uppercase tracking-wider mb-3">Contact &amp; Socials</h3>
                    <div class="flex flex-col space-y-2 text-xs text-stone-400">
                        <a
                            href="https://www.facebook.com/profile.php?id=61560889387183"
                            data-publication-link="facebook"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="footer-link hover:text-white transition-colors flex items-center gap-2"
                        >
                            <i class="fa-brands fa-facebook-f text-rose-400" aria-hidden="true"></i>
                            <span>Facebook Page</span>
                        </a>
                        <a
                            href="mailto:thelenspublicationpupbc@gmail.com"
                            data-publication-link="email"
                            class="footer-link hover:text-white transition-colors flex items-center gap-2"
                        >
                            <i class="fa-regular fa-envelope text-rose-400" aria-hidden="true"></i>
                            <span>Email The Lens</span>
                        </a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom border-t border-stone-800 text-center py-4 text-xs text-stone-500">
                <p>© <span id="copyright-year">{{ currentYear }}</span> The Lens. All rights reserved.</p>
            </div>
        </footer>
    </div>
</template>
