<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { getPublicCategory, shareArticle } from '../../services/api.js';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref(null);
const currentCategory = ref({ name: '', slug: '', description: '' });
const articles = ref([]);
const pagination = ref([]);
const currentPage = ref(1);
const totalArticles = ref(0);

const copyNotice = ref('');
let copyTimeout = null;

function showCopyNotice(msg) {
    copyNotice.value = msg;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
        copyNotice.value = '';
    }, 2500);
}

async function handleShare(article, e) {
    if (e) e.preventDefault();
    const url = `${window.location.origin}/article/${article.slug || article.id}`;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            showCopyNotice('Article link copied to clipboard!');
        }
        const res = await shareArticle(article.id);
        if (res && res.shares !== undefined) {
            article.shares = res.shares;
        } else {
            article.shares = (article.shares || 0) + 1;
        }
    } catch (err) {
        showCopyNotice('Article link copied!');
    }
}

async function fetchCategory(page = 1) {
    const slug = route.params.slug || 'latest';
    loading.value = true;
    error.value = null;
    try {
        const res = await getPublicCategory(slug, page);
        const data = res?.props || res || {};
        currentCategory.value = data.currentCategory || { name: 'Section', slug };
        articles.value = data.articles || [];
        pagination.value = data.pagination || [];
        currentPage.value = data.currentPage || 1;
        totalArticles.value = data.total || 0;
    } catch (err) {
        console.error('Failed to load category:', err);
        error.value = 'Failed to load stories for this section.';
    } finally {
        loading.value = false;
    }
}

function goToPage(page) {
    if (!page || page === currentPage.value) return;
    fetchCategory(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(() => route.params.slug, () => {
    fetchCategory(1);
});

onMounted(() => {
    fetchCategory(1);
});
</script>

<template>
    <PublicLayout>
        <main class="max-w-7xl mx-auto px-6 py-10" data-page="category" :data-category="currentCategory.slug">
            <!-- Toast notification -->
            <transition name="fade">
                <div v-if="copyNotice" class="fixed bottom-6 right-6 z-50 bg-[#5c0a18] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold">
                    <i class="fa-solid fa-check text-rose-300"></i>
                    <span>{{ copyNotice }}</span>
                </div>
            </transition>

            <!-- Category Header -->
            <section class="mb-10 pb-6 border-b border-stone-200">
                <p class="text-xs tracking-widest text-wine font-bold mb-2 uppercase">
                    The Lens Publication · Section
                </p>
                <h1 class="font-display text-4xl md:text-5xl font-extrabold text-wine">
                    {{ currentCategory.name }}
                </h1>
                <p v-if="currentCategory.description" class="mt-3 text-stone-600 text-sm max-w-2xl leading-relaxed">
                    {{ currentCategory.description }}
                </p>
            </section>

            <!-- Loading State -->
            <div v-if="loading" class="py-16 text-center text-stone-400">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-[#5c0a18] mb-4"></div>
                <p class="text-xs uppercase tracking-widest text-stone-500 font-bold">Loading stories…</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl my-8">
                <i class="fa-solid fa-circle-exclamation text-3xl mb-3 block"></i>
                <p class="text-sm font-bold">{{ error }}</p>
                <button type="button" @click="fetchCategory(1)" class="mt-4 px-4 py-2 bg-[#5c0a18] text-white text-xs font-bold rounded-lg hover:bg-[#400817] transition-colors">
                    Try Again
                </button>
            </div>

            <!-- Articles Feed -->
            <template v-else>
                <section class="space-y-6">
                    <article v-for="article in articles" :key="article.id" class="category-list-card" :data-article-id="article.id">
                        <router-link :to="'/article/' + (article.slug || article.id)" class="category-list-image article-clickable" :aria-label="'Read article: ' + article.title">
                            <div class="article-image category-list-thumb">
                                <img :src="article.imageUrl || '/images/maroon.jpg'" :alt="article.title" loading="lazy">
                            </div>
                        </router-link>
                        <div class="category-list-copy">
                            <div class="article-meta">
                                <span class="article-category-label">{{ article.category || currentCategory.name }}</span>
                                <span class="article-meta-separator" aria-hidden="true">·</span>
                                <time>{{ article.publishedAt }}</time>
                            </div>
                            <h3 class="category-list-title">
                                <router-link :to="'/article/' + (article.slug || article.id)" class="article-title-button">
                                    {{ article.title }}
                                </router-link>
                            </h3>
                            <p class="category-list-excerpt">{{ article.excerpt }}</p>
                            <p class="article-byline">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By 
                                    <template v-if="article.author">
                                        <router-link v-if="article.authorId" class="author-profile-link" :to="'/author/' + article.authorId">
                                            {{ article.author }}
                                        </router-link>
                                        <span v-else>{{ article.author }}</span>
                                    </template>
                                    <strong v-else>The Lens Staff</strong>
                                </span>
                            </p>
                            <div class="article-stats" aria-label="Article engagement and reading time">
                                <span class="article-view-count" title="Views">
                                    <i class="fa-regular fa-eye" aria-hidden="true"></i>
                                    <span>{{ Number(article.views || 0).toLocaleString() }}</span>
                                    <span class="stat-label">views</span>
                                </span>
                                <span class="article-read-time" title="Estimated reading time">
                                    <i class="fa-regular fa-clock" aria-hidden="true"></i>
                                    <span>{{ article.readMinutes || 1 }} min read</span>
                                </span>
                                <button type="button" class="article-share-button" title="Copy article link" @click="handleShare(article, $event)">
                                    <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                    <span>Share</span>
                                    <span class="share-count">{{ article.shares || 0 }}</span>
                                </button>
                            </div>
                        </div>
                    </article>

                    <!-- Empty State -->
                    <div v-if="articles.length === 0" class="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-8">
                        <i class="fa-regular fa-newspaper text-4xl mb-3 text-slate-300 block"></i>
                        <h3 class="font-bold text-lg text-slate-700">No Published Stories in this Section Yet</h3>
                        <p class="text-xs text-slate-500 mt-1">Articles published by the editorial team will appear here.</p>
                        <div class="mt-6">
                            <router-link to="/" class="inline-block border border-wine px-4 py-2 text-wine text-xs font-bold rounded hover:bg-rose-50 transition-colors">
                                ← Back to Homepage
                            </router-link>
                        </div>
                    </div>
                </section>

                <!-- Pagination -->
                <div v-if="pagination && pagination.length > 3" class="mt-10 flex justify-center items-center gap-1">
                    <template v-for="(link, idx) in pagination" :key="idx">
                        <button
                            v-if="link.url"
                            type="button"
                            class="px-3 py-1.5 text-xs font-semibold rounded border transition-colors"
                            :class="link.active ? 'bg-wine text-white border-wine' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'"
                            @click="goToPage(parseInt(link.label) || (link.label.includes('Previous') ? currentPage - 1 : currentPage + 1))"
                            v-html="link.label"
                        ></button>
                        <span
                            v-else
                            class="px-3 py-1.5 text-xs text-stone-400 border border-transparent select-none"
                            v-html="link.label"
                        ></span>
                    </template>
                </div>
            </template>
        </main>
    </PublicLayout>
</template>
