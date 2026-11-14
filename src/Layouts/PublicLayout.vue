<script setup>
import PageHead from '../components/PageHead.vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    title: { type: String, default: 'The Lens Publication' },
    reader: { type: Boolean, default: false },
});

const router = useRouter();
const searchQuery = ref('');

function onSearch() {
    const q = searchQuery.value.trim();
    if (q) {
        router.push({ path: '/archives', query: { q } });
    } else {
        router.push('/archives');
    }
}

onMounted(() => {
    if (props.reader) document.body.classList.add('article-reader-body');
});

onBeforeUnmount(() => document.body.classList.remove('article-reader-body'));

const navItems = [
    ['Home', '/'],
    ['Latest', '/category/latest'],
    ['News', '/category/news'],
    ['Features', '/category/feature'],
    ['Opinion', '/category/opinion'],
    ['Science & Technology', '/category/science-technology'],
    ['Literature', '/category/literature'],
    ['Archives', '/archives'],
];
</script>

<template>
    <PageHead :title="`${title} | The Lens`">
        <link rel="stylesheet" href="/css/main.css">
    </PageHead>
        <div :class="['min-h-screen bg-white text-stone-900 font-body antialiased flex flex-col', reader && 'h-screen overflow-hidden']">
        <header v-if="!reader" class="site-header w-full border-b border-stone-200 shadow-sm bg-white">
            <div class="top-bar">
                <div class="top-bar-inner">
                    <div class="top-bar-details">
                        <span class="top-bar-item date-item"><i class="fa-regular fa-calendar" aria-hidden="true"></i><time>{{ new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</time></span>
                        <span class="top-bar-divider" aria-hidden="true">|</span>
                        <span class="campus-name"><i class="fa-solid fa-graduation-cap campus-icon" aria-hidden="true"></i> Polytechnic University of the Philippines – Biñan Campus</span>
                    </div>
                    <div class="top-bar-actions">
                        <a class="facebook-link" href="https://www.facebook.com/profile.php?id=61560889387183" target="_blank" rel="noopener noreferrer" aria-label="The Lens on Facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a>
                        <a class="email-link" href="mailto:thelenspublicationpupbc@gmail.com" aria-label="Email The Lens"><i class="fa-regular fa-envelope" aria-hidden="true"></i></a>
                        <span class="top-bar-divider" aria-hidden="true">|</span>
                        <RouterLink to="/login" class="member-login-btn"><i class="fa-regular fa-user" aria-hidden="true"></i><span>Login as a Member</span></RouterLink>
                    </div>
                </div>
            </div>
            <div class="brand-search-row">
                <RouterLink to="/" class="brand-lockup" aria-label="The Lens home">
                    <img :src="'/images/logo.jpg'" alt="The Lens logo" class="site-logo">
                    <span class="brand-copy"><span class="brand-name">THE LENS</span><span class="brand-tagline">Basta Lente, Abante!</span></span>
                </RouterLink>
                <form class="search-form" @submit.prevent="onSearch" role="search">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input v-model="searchQuery" type="search" name="q" class="search-input" placeholder="Search articles, authors, or topics…" aria-label="Search articles and authors">
                    <button type="submit" class="sort-filter-btn"><span>Search</span></button>
                </form>
                <div class="header-utility-links" aria-label="Publication links">
                    <RouterLink to="/about" class="header-utility-link"><i class="fa-regular fa-circle-question" aria-hidden="true"></i><span>About Us</span></RouterLink>
                    <RouterLink to="/feedback" class="header-utility-link"><i class="fa-regular fa-paper-plane" aria-hidden="true"></i><span>Send Feedback</span></RouterLink>
                </div>
            </div>
            <nav class="navigation" aria-label="Main navigation">
                <div class="navigation-inner"><ul class="nav-list"><li v-for="([label, href]) in navItems" :key="href"><RouterLink :to="href" class="nav-link">{{ label }}</RouterLink></li></ul></div>
            </nav>
        </header>
        <slot />
        <footer v-if="!reader" class="site-footer mt-auto">
            <div class="footer-inner">
                <RouterLink to="/" class="brand-lockup" aria-label="The Lens home">
                    <img :src="'/images/logo.jpg'" alt="The Lens logo" class="site-logo">
                    <span class="brand-copy"><span class="brand-name">THE LENS</span><span class="brand-tagline">Basta Lente, Abante!</span></span>
                </RouterLink>
                <p>Official student publication of PUP Biñan Campus.</p>
                <div class="footer-links"><RouterLink to="/about">About Us</RouterLink><RouterLink to="/feedback">Send Feedback</RouterLink><RouterLink to="/archives">Archives</RouterLink></div>
            </div>
        </footer>
    </div>
</template>
