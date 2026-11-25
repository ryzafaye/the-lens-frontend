<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getPublicArticle, shareArticle } from '../../services/api.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref(null);
const article = ref(null);
const relatedArticles = ref([]);

const copyNotice = ref('');
let copyTimeout = null;

function showCopyNotice(msg) {
    copyNotice.value = msg;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
        copyNotice.value = '';
    }, 2500);
}

function closeArticleReader() {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push('/');
    }
}

function handleKeydown(e) {
    if (e.key === 'Escape') {
        closeArticleReader();
    }
}

async function handleShare() {
    if (!article.value) return;
    const url = window.location.href;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            showCopyNotice('Article link copied to clipboard!');
        }
        const res = await shareArticle(article.value.id);
        if (res && res.shares !== undefined) {
            article.value.shares = res.shares;
        } else {
            article.value.shares = (article.value.shares || 0) + 1;
        }
    } catch (err) {
        showCopyNotice('Article link copied!');
    }
}

async function fetchArticle() {
    const slug = route.params.slug;
    if (!slug) return;
    loading.value = true;
    error.value = null;
    try {
        const res = await getPublicArticle(slug);
        const data = res?.props || res || {};
        article.value = data.article || null;
        relatedArticles.value = data.relatedArticles || [];
        if (!article.value) {
            error.value = 'Article not found.';
        }
    } catch (err) {
        console.error('Failed to load article:', err);
        error.value = 'Article not found or could not be loaded.';
    } finally {
        loading.value = false;
    }
}

watch(() => route.params.slug, () => {
    fetchArticle();
});

onMounted(() => {
    fetchArticle();
    window.addEventListener('keydown', handleKeydown);
    const container = document.getElementById('article-reader-container');
    if (container) container.focus();
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div class="bg-white text-stone-900 font-body antialiased h-screen overflow-hidden m-0 p-0 article-reader-body">
        <!-- Toast notice -->
        <transition name="fade">
            <div v-if="copyNotice" class="fixed bottom-6 right-6 z-50 bg-[#5c0a18] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold">
                <i class="fa-solid fa-check text-rose-300"></i>
                <span>{{ copyNotice }}</span>
            </div>
        </transition>

        <!-- Full-Screen Article Reader Shell -->
        <div class="article-reader-fullscreen modal-scroll-container" id="article-reader-container" tabindex="0">
            <!-- Minimalist Top Reader Bar -->
            <header class="modal-topbar">
                <router-link to="/" class="modal-topbar-brand" aria-label="The Lens home">
                    <i class="fa-regular fa-newspaper" aria-hidden="true"></i>
                    <span>THE LENS</span>
                </router-link>
                <button type="button" class="modal-topbar-close" aria-label="Close article reader" title="Close reader (Esc)" @click="closeArticleReader">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <!-- Loading State -->
            <div v-if="loading" class="py-24 text-center text-stone-400">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-[#5c0a18] mb-4"></div>
                <p class="text-xs uppercase tracking-widest text-stone-500 font-bold">Opening dispatch…</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="max-w-2xl mx-auto my-16 p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-3 block"></i>
                <h2 class="font-display font-bold text-lg text-rose-950 mb-2">{{ error }}</h2>
                <p class="text-xs text-rose-700 mb-6">The article you requested might have been moved or unpublished.</p>
                <router-link to="/" class="inline-block border border-[#5c0a18] px-5 py-2.5 text-[#5c0a18] text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors">
                    ← Back to Newsroom Home
                </router-link>
            </div>

            <!-- Reading Content -->
            <div v-else-if="article" class="modal-reader">
                <article class="modal-reading-content">
                    <!-- Category & Reading Time Row -->
                    <div class="modal-category-row">
                        <span class="modal-category">
                            <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                            <router-link :to="'/category/' + (article.category?.slug || 'news')">
                                {{ article.category?.name || 'The Lens' }}
                            </router-link>
                        </span>
                        <span class="modal-reading-time">
                            <i class="fa-regular fa-clock" aria-hidden="true"></i>
                            <span>{{ article.readingTime || 1 }} min read</span>
                        </span>
                    </div>

                    <!-- Headline -->
                    <h1 class="modal-title">
                        {{ article.title }}
                    </h1>

                    <!-- Byline & Published Date -->
                    <div class="modal-byline">
                        <span>
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By 
                                <template v-if="article.author">
                                    <router-link v-if="article.author.id" class="author-profile-link font-bold text-wine hover:underline" :to="'/author/' + article.author.id">
                                        {{ article.author.name }}
                                    </router-link>
                                    <strong v-else>{{ article.author.name }}</strong>
                                </template>
                                <strong v-else>The Lens Staff</strong>
                            </span>
                        </span>
                        <span class="text-stone-300">•</span>
                        <span>
                            <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                            <span>Published {{ article.publishedAt }}</span>
                        </span>
                    </div>

                    <!-- Lead Excerpt Callout -->
                    <p v-if="article.excerpt" class="modal-lead-excerpt">
                        {{ article.excerpt }}
                    </p>

                    <!-- Cover Image Figure -->
                    <figure class="modal-figure">
                        <div class="modal-image">
                            <img :src="article.coverUrl || '/images/maroon.jpg'" :alt="article.title" loading="eager">
                        </div>
                        <figcaption class="modal-caption">
                            <span><i class="fa-solid fa-camera mr-1" aria-hidden="true"></i> {{ article.title }}</span>
                            <span>THE LENS / {{ (article.category?.name || 'COVER MEDIA').toUpperCase() }}</span>
                        </figcaption>
                    </figure>

                    <!-- Sanitized Article Body -->
                    <div class="modal-body article-content prose prose-stone max-w-none" v-html="formatCleanArticleContent(article?.content)"></div>

                    <!-- Engagement & Sharing Row -->
                    <div class="modal-engagement-row flex items-center justify-between">
                        <div class="article-stats flex items-center gap-6">
                            <span class="article-view-count flex items-center gap-2" title="Views">
                                <i class="fa-regular fa-eye text-stone-400" aria-hidden="true"></i>
                                <strong class="font-bold text-stone-800">{{ Number(article.views || 0).toLocaleString() }}</strong>
                                <span class="stat-label text-xs text-stone-500">views</span>
                            </span>
                            <button type="button" class="copy-link-btn inline-flex items-center gap-2" title="Copy article link" @click="handleShare">
                                <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                <span>Share</span>
                                <span class="share-count">{{ article.shares || 0 }}</span>
                            </button>
                        </div>
                        <div>
                            <router-link :to="'/category/' + (article.category?.slug || 'news')" class="more-in-category-link">
                                More in {{ article.category?.name || 'Section' }} →
                            </router-link>
                        </div>
                    </div>

                    <!-- Continue Reading Section -->
                    <section v-if="relatedArticles && relatedArticles.length > 0" class="continue-reading" aria-labelledby="continue-reading-title">
                        <div class="continue-reading-heading">
                            <p class="continue-reading-eyebrow">MORE FROM THE LENS</p>
                            <h2 id="continue-reading-title">Continue reading</h2>
                            <p>Explore more campus stories selected for you.</p>
                        </div>
                        <div class="continue-reading-grid">
                            <article v-for="rel in relatedArticles" :key="rel.id" class="continue-story-card" :data-article-id="rel.id">
                                <router-link :to="'/article/' + (rel.slug || rel.id)" class="continue-story-image" :aria-label="'Read article: ' + rel.title">
                                    <div class="continue-story-thumb">
                                        <img :src="rel.imageUrl || '/images/maroon.jpg'" :alt="rel.title" loading="lazy">
                                    </div>
                                </router-link>
                                <div class="continue-story-copy">
                                    <p class="continue-story-category">
                                        {{ rel.category || 'The Lens' }}
                                    </p>
                                    <h3>
                                        <router-link :to="'/article/' + (rel.slug || rel.id)" class="continue-story-title">
                                            {{ rel.title }}
                                        </router-link>
                                    </h3>
                                    <p class="continue-story-excerpt">
                                        {{ rel.excerpt || 'Read more from The Lens.' }}
                                    </p>
                                    <div class="continue-story-meta">
                                        <span><i class="fa-regular fa-clock mr-1" aria-hidden="true"></i> {{ rel.readMinutes || 1 }} min read</span>
                                        <span>{{ rel.publishedAt }}</span>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </section>
                </article>
            </div>
        </div>
    </div>
</template>
