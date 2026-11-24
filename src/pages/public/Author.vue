<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { getPublicAuthor } from '../../services/api.js';

const route = useRoute();

const loading = ref(true);
const error = ref(null);
const author = ref(null);
const authorName = ref('');
const roleName = ref('Staff Contributor');
const articles = ref([]);
const totalViews = ref(0);
const beats = ref([]);
const beatsWithCount = ref({});
const latestArticleDate = ref(null);

const activeFilter = ref('all');

const initials = computed(() => {
    const parts = (authorName.value || 'The Lens').trim().split(/\s+/);
    const first = parts[0]?.charAt(0) || 'L';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
});

const filteredArticles = computed(() => {
    if (activeFilter.value === 'all') {
        return articles.value;
    }
    return articles.value.filter(a => {
        const cat = (a.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return cat === activeFilter.value;
    });
});

async function fetchAuthor() {
    const id = route.params.id;
    if (!id) return;
    loading.value = true;
    error.value = null;
    try {
        const res = await getPublicAuthor(id);
        const data = res?.props || res || {};
        author.value = data.author || null;
        authorName.value = data.authorName || '';
        roleName.value = data.roleName || 'Staff Contributor';
        articles.value = data.articles || [];
        totalViews.value = data.totalViews || 0;
        beats.value = data.beats || [];
        beatsWithCount.value = data.beatsWithCount || {};
        latestArticleDate.value = data.latestArticleDate || null;
    } catch (err) {
        console.error('Failed to load author profile:', err);
        error.value = 'Failed to load journalist portfolio.';
    } finally {
        loading.value = false;
    }
}

watch(() => route.params.id, () => {
    fetchAuthor();
});

onMounted(() => {
    fetchAuthor();
});
</script>

<template>
    <PublicLayout>
        <main class="author-profile-page" data-page="author-profile">
            <!-- Top Navigation -->
            <nav class="author-nav-bar" aria-label="Author navigation">
                <router-link class="author-back-btn" to="/archives">
                    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                    <span>Back to All Articles</span>
                </router-link>
            </nav>

            <!-- Loading State -->
            <div v-if="loading" class="py-20 text-center text-stone-400">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-[#5c0a18] mb-4"></div>
                <p class="text-xs uppercase tracking-widest text-stone-500 font-bold">Retrieving journalist dossier…</p>
            </div>

            <div v-else id="author-profile-content" aria-live="polite">
                <!-- Empty / Not Found State -->
                <div v-if="!author && articles.length === 0" class="author-empty-state">
                    <span class="author-empty-icon" aria-hidden="true">
                        <i class="fa-regular fa-id-card"></i>
                    </span>
                    <h1 class="author-empty-title">Journalist Profile Not Found</h1>
                    <p class="author-empty-desc">
                        We could not locate published dispatches or an accredited portfolio associated with "{{ authorName }}".
                    </p>
                    <router-link to="/" class="author-explore-btn">
                        <span>Explore Newsroom Home</span>
                        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </router-link>
                </div>

                <template v-else>
                    <!-- Editorial Press Pass / Journalist Masthead Hero -->
                    <header class="author-dossier-card">
                        <div class="author-dossier-layout">
                            <!-- Portrait / Monogram Avatar -->
                            <div class="author-avatar-wrap">
                                <div class="author-avatar-ring">
                                    <img v-if="author && author.hasCustomAvatar && author.avatarUrl" :src="author.avatarUrl" :alt="authorName" class="author-avatar-img">
                                    <div v-else class="author-avatar-fallback" aria-hidden="true">
                                        {{ initials }}
                                    </div>
                                </div>
                                <span class="author-avatar-badge" title="The Lens Contributor" aria-hidden="true">
                                    <i class="fa-solid fa-feather-pointed"></i>
                                </span>
                            </div>

                            <!-- Author Identity -->
                            <div class="author-details">
                                <h1 class="author-dossier-name">{{ authorName }}</h1>

                                <!-- Role Badge -->
                                <div class="author-badges-row">
                                    <span class="author-role-pill">
                                        <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                        <span>{{ roleName }}</span>
                                    </span>
                                </div>
                            </div>

                            <!-- Published Articles Count -->
                            <div class="author-article-count-box" aria-label="Author publication count">
                                <strong class="author-article-count-number">{{ articles.length }}</strong>
                                <span class="author-article-count-label">
                                    {{ articles.length === 1 ? 'Published article' : 'Published articles' }}
                                </span>
                            </div>
                        </div>
                    </header>

                    <!-- Byline Articles Section -->
                    <section class="author-byline-section" aria-labelledby="byline-heading">
                        <div class="author-byline-header">
                            <div class="byline-header-titles">
                                <h2 id="byline-heading" class="byline-main-title">
                                    Published articles and campus reporting filed by {{ authorName }}.
                                </h2>
                            </div>

                            <!-- Category Filter Tabs -->
                            <div v-if="beats.length > 1" class="byline-filter-tabs" role="tablist" aria-label="Filter articles by category">
                                <button
                                    type="button"
                                    class="filter-tab-btn"
                                    :class="{ active: activeFilter === 'all' }"
                                    role="tab"
                                    :aria-selected="activeFilter === 'all'"
                                    @click="activeFilter = 'all'"
                                >
                                    <span>All Stories</span>
                                    <span class="tab-count">({{ articles.length }})</span>
                                </button>
                                <button
                                    v-for="(count, beatName) in beatsWithCount"
                                    :key="beatName"
                                    type="button"
                                    class="filter-tab-btn"
                                    :class="{ active: activeFilter === String(beatName).toLowerCase().replace(/[^a-z0-9]+/g, '-') }"
                                    role="tab"
                                    :aria-selected="activeFilter === String(beatName).toLowerCase().replace(/[^a-z0-9]+/g, '-')"
                                    @click="activeFilter = String(beatName).toLowerCase().replace(/[^a-z0-9]+/g, '-')"
                                >
                                    <span>{{ beatName }}</span>
                                    <span class="tab-count">({{ count }})</span>
                                </button>
                            </div>
                        </div>

                        <!-- Articles Grid -->
                        <div class="author-byline-grid" id="author-articles-grid">
                            <article
                                v-for="article in filteredArticles"
                                :key="article.id"
                                class="author-story-card"
                                :data-category="article.categorySlug"
                            >
                                <router-link :to="'/article/' + (article.slug || article.id)" class="author-story-thumb-frame" :aria-label="'Read story: ' + article.title">
                                    <img :src="article.imageUrl || '/images/maroon.jpg'" :alt="article.title" loading="lazy">
                                    <span class="story-category-tag">
                                        {{ article.category || 'The Lens' }}
                                    </span>
                                </router-link>
                                <div class="author-story-body">
                                    <div class="story-meta-row">
                                        <span class="story-meta-date">
                                            <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                                            <time>{{ article.publishedAt }}</time>
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span><i class="fa-regular fa-clock" aria-hidden="true"></i> {{ article.readMinutes || 1 }} min read</span>
                                    </div>

                                    <h3 class="author-story-title">
                                        <router-link :to="'/article/' + (article.slug || article.id)">
                                            {{ article.title }}
                                        </router-link>
                                    </h3>

                                    <p class="author-story-excerpt">
                                        {{ article.excerpt || 'Read this campus report published by The Lens Publication.' }}
                                    </p>

                                    <div class="author-story-footer">
                                        <div class="story-footer-stats">
                                            <span><i class="fa-regular fa-eye" aria-hidden="true"></i> {{ Number(article.views || 0).toLocaleString() }} reads</span>
                                            <span><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {{ Number(article.shares || 0).toLocaleString() }}</span>
                                        </div>
                                        <router-link :to="'/article/' + (article.slug || article.id)" class="read-story-link" :aria-label="'Read full article ' + article.title">
                                            <span>Read Dispatch</span>
                                            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                                        </router-link>
                                    </div>
                                </div>
                            </article>

                            <div v-if="filteredArticles.length === 0" class="author-empty-state">
                                <span class="author-empty-icon" aria-hidden="true">
                                    <i class="fa-solid fa-newspaper"></i>
                                </span>
                                <h3 class="author-empty-title">No Published Dispatches Yet</h3>
                                <p class="author-empty-desc">
                                    {{ authorName }} has not published articles in this category.
                                </p>
                                <router-link to="/category/latest" class="author-explore-btn">
                                    <span>Browse Latest Newsroom Coverage</span>
                                    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                                </router-link>
                            </div>
                        </div>
                    </section>
                </template>
            </div>
        </main>
    </PublicLayout>
</template>
