<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { getPublicHome, shareArticle } from '../../services/api.js';
const maroonImg = '/images/maroon.jpg';

const router = useRouter();

const loading = ref(true);
const error = ref(null);
const featuredArticle = ref(null);
const latestArticles = ref([]);
const moreStories = ref([]);
const categorySections = ref([]);

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

async function fetchHomeData() {
    loading.value = true;
    error.value = null;
    try {
        const res = await getPublicHome();
        const data = res?.props || res || {};
        featuredArticle.value = data.featuredArticle || null;
        latestArticles.value = (data.latestArticles || []).slice(0, 5);
        moreStories.value = data.moreStories || [];
        categorySections.value = data.categorySections || [];
    } catch (err) {
        console.error('Failed to load homepage data:', err);
        error.value = 'Failed to load stories. Please try refreshing.';
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    fetchHomeData();
});
</script>

<template>
    <PublicLayout>
        <div id="home" class="max-w-7xl mx-auto px-6 py-8">
            <!-- Toast notification for copied link -->
            <transition name="fade">
                <div v-if="copyNotice" class="fixed bottom-6 right-6 z-50 bg-[#5c0a18] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold">
                    <i class="fa-solid fa-check text-rose-300"></i>
                    <span>{{ copyNotice }}</span>
                </div>
            </transition>

            <!-- Loading Skeleton -->
            <div v-if="loading" class="py-12 text-center text-stone-400">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-[#5c0a18] mb-4"></div>
                <p class="text-xs uppercase tracking-widest text-stone-500 font-bold">Loading stories from The Lens…</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl my-8">
                <i class="fa-solid fa-circle-exclamation text-3xl mb-3 block"></i>
                <p class="text-sm font-bold">{{ error }}</p>
                <button type="button" @click="fetchHomeData" class="mt-4 px-4 py-2 bg-[#5c0a18] text-white text-xs font-bold rounded-lg hover:bg-[#400817] transition-colors">
                    Try Again
                </button>
            </div>

            <template v-else>
                <!-- Featured article and latest releases -->
                <section class="home-feature-layout">
                    <div id="featured-article">
                        <article v-if="featuredArticle" class="featured-story" :data-article-id="featuredArticle.id">
                            <router-link :to="'/article/' + (featuredArticle.slug || featuredArticle.id || '')" class="featured-image-trigger article-clickable" :aria-label="'Read article: ' + (featuredArticle.title || 'Featured Article')">
                                <div class="article-image featured-image">
                                    <img :src="featuredArticle.imageUrl || maroonImg" :alt="featuredArticle.title || 'Featured Article'" loading="lazy">
                                </div>
                            </router-link>
                            <div class="article-meta">
                                <span class="article-category-label">{{ featuredArticle.category || 'The Lens' }}</span>
                                <span class="article-meta-separator" aria-hidden="true">·</span>
                                <time>{{ featuredArticle.publishedAt || '' }}</time>
                            </div>
                            <h2 class="featured-title">
                                <router-link :to="'/article/' + (featuredArticle.slug || featuredArticle.id || '')" class="article-title-button featured-headline-button">
                                    {{ featuredArticle.title || '' }}
                                </router-link>
                            </h2>
                            <div class="featured-divider"></div>
                            <p class="featured-excerpt">{{ featuredArticle.excerpt || '' }}</p>
                            <p class="article-byline">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By 
                                    <template v-if="featuredArticle.author">
                                        <router-link v-if="featuredArticle.authorId" class="author-profile-link" :to="'/author/' + featuredArticle.authorId">
                                            {{ featuredArticle.author }}
                                        </router-link>
                                        <span v-else>{{ featuredArticle.author }}</span>
                                    </template>
                                    <strong v-else>The Lens Staff</strong>
                                </span>
                            </p>
                            <div class="article-stats" aria-label="Article engagement and reading time">
                                <span class="article-view-count" title="Views">
                                    <i class="fa-regular fa-eye" aria-hidden="true"></i>
                                    <span>{{ Number(featuredArticle.views || 0).toLocaleString() }}</span>
                                    <span class="stat-label">views</span>
                                </span>
                                <span class="article-read-time" title="Estimated reading time">
                                    <i class="fa-regular fa-clock" aria-hidden="true"></i>
                                    <span>{{ featuredArticle.readMinutes || 1 }} min read</span>
                                </span>
                                <button type="button" class="article-share-button" title="Copy article link" @click="handleShare(featuredArticle, $event)">
                                    <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                    <span>Share</span>
                                    <span class="share-count">{{ featuredArticle.shares || 0 }}</span>
                                </button>
                            </div>
                        </article>

                        <div v-else class="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-4">
                            <i class="fa-regular fa-newspaper text-3xl mb-3 text-slate-300 block"></i>
                            <h3 class="font-bold text-base text-slate-700">No Published Articles Yet</h3>
                            <p class="text-xs text-slate-500 mt-1">Stories published by the editorial team will appear here.</p>
                        </div>
                    </div>

                    <aside id="latest" class="latest-section">
                        <h2 class="section-label">LATEST RELEASES</h2>
                        <div id="latest-articles" class="space-y-7 mt-6">
                            <article v-for="latest in latestArticles" :key="latest.id" class="latest-item" :data-article-id="latest.id">
                                <div class="latest-item-copy">
                                    <p class="latest-category">{{ latest.category || 'Campus' }}</p>
                                    <h3 class="latest-title">
                                        <router-link :to="'/article/' + (latest.slug || latest.id)" class="article-title-button">
                                            {{ latest.title }}
                                        </router-link>
                                    </h3>
                                    <p class="article-byline text-xs">
                                        <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                        <span>By 
                                            <template v-if="latest.author">
                                                <router-link v-if="latest.authorId" class="author-profile-link" :to="'/author/' + latest.authorId">
                                                    {{ latest.author }}
                                                </router-link>
                                                <span v-else>{{ latest.author }}</span>
                                            </template>
                                            <strong v-else>The Lens Staff</strong>
                                        </span>
                                    </p>
                                    <div class="article-stats text-xs">
                                        <span class="article-view-count">
                                            <i class="fa-regular fa-eye"></i> <span>{{ Number(latest.views || 0).toLocaleString() }}</span>
                                        </span>
                                        <span class="article-read-time">
                                            <i class="fa-regular fa-clock"></i> <span>{{ latest.readMinutes || 1 }} min</span>
                                        </span>
                                    </div>
                                </div>
                                <router-link :to="'/article/' + (latest.slug || latest.id)" class="latest-image-trigger article-clickable" :aria-label="'Read article: ' + latest.title">
                                    <div class="article-image latest-image">
                                        <img :src="latest.imageUrl || maroonImg" :alt="latest.title" loading="lazy">
                                    </div>
                                </router-link>
                            </article>
                            <p v-if="latestArticles.length === 0" class="text-xs text-slate-400 py-3 italic">No recent releases yet.</p>
                        </div>
                    </aside>
                </section>

                <!-- More stories -->
                <section v-if="moreStories && moreStories.length > 0" class="mt-14" id="more-stories">
                    <div class="section-heading">
                        <h2>More stories</h2>
                        <router-link to="/category/latest" class="text-wine text-sm font-bold">Explore latest →</router-link>
                    </div>
                    <div id="more-articles" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <article v-for="story in moreStories" :key="story.id" class="story-card" :data-article-id="story.id">
                            <router-link :to="'/article/' + (story.slug || story.id)" class="story-card-image-trigger article-clickable" :aria-label="'Read article: ' + story.title">
                                <div class="article-image story-card-image">
                                    <img :src="story.imageUrl || maroonImg" :alt="story.title" loading="lazy">
                                </div>
                            </router-link>
                            <div class="article-meta">
                                <span class="article-category-label">{{ story.category || 'The Lens' }}</span>
                                <span class="article-meta-separator" aria-hidden="true">·</span>
                                <time>{{ story.publishedAt }}</time>
                            </div>
                            <h3 class="story-card-title">
                                <router-link :to="'/article/' + (story.slug || story.id)" class="article-title-button">
                                    {{ story.title }}
                                </router-link>
                            </h3>
                            <p class="story-card-excerpt">{{ story.excerpt }}</p>
                            <p class="article-byline text-xs">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By 
                                    <template v-if="story.author">
                                        <router-link v-if="story.authorId" class="author-profile-link" :to="'/author/' + story.authorId">
                                            {{ story.author }}
                                        </router-link>
                                        <span v-else>{{ story.author }}</span>
                                    </template>
                                    <strong v-else>The Lens Staff</strong>
                                </span>
                            </p>
                            <div class="article-stats text-xs">
                                <span class="article-view-count">
                                    <i class="fa-regular fa-eye"></i> <span>{{ Number(story.views || 0).toLocaleString() }}</span>
                                </span>
                                <span class="article-read-time">
                                    <i class="fa-regular fa-clock"></i> <span>{{ story.readMinutes || 1 }} min</span>
                                </span>
                            </div>
                        </article>
                    </div>
                </section>

                <!-- Category Sections -->
                <section v-for="section in categorySections" :key="section.id" :id="section.slug" class="category-section mt-14">
                    <div class="section-heading">
                        <h2>{{ section.name }}</h2>
                        <router-link :to="'/category/' + section.slug" class="category-button">View all →</router-link>
                    </div>
                    <div class="category-grid">
                        <article v-for="catArticle in section.articles" :key="catArticle.id" class="category-card" :data-article-id="catArticle.id">
                            <router-link :to="'/article/' + (catArticle.slug || catArticle.id)" class="category-image-trigger article-clickable" :aria-label="'Read article: ' + catArticle.title">
                                <div class="article-image small-image">
                                    <img :src="catArticle.imageUrl || maroonImg" :alt="catArticle.title" loading="lazy">
                                </div>
                            </router-link>
                            <div class="category-card-copy">
                                <div class="article-meta">
                                    <span class="article-category-label">{{ section.name }}</span>
                                    <span class="article-meta-separator" aria-hidden="true">·</span>
                                    <time>{{ catArticle.publishedAt }}</time>
                                </div>
                                <h3 class="category-card-title">
                                    <router-link :to="'/article/' + (catArticle.slug || catArticle.id)" class="article-title-button">
                                        {{ catArticle.title }}
                                    </router-link>
                                </h3>
                                <p class="category-card-excerpt">{{ catArticle.excerpt }}</p>
                                <p class="article-byline text-xs">
                                    <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                    <span>By 
                                        <template v-if="catArticle.author">
                                            <router-link v-if="catArticle.authorId" class="author-profile-link" :to="'/author/' + catArticle.authorId">
                                                {{ catArticle.author }}
                                            </router-link>
                                            <span v-else>{{ catArticle.author }}</span>
                                        </template>
                                        <strong v-else>The Lens Staff</strong>
                                    </span>
                                </p>
                                <div class="article-stats text-xs">
                                    <span class="article-view-count">
                                        <i class="fa-regular fa-eye"></i> <span>{{ Number(catArticle.views || 0).toLocaleString() }}</span>
                                    </span>
                                    <span class="article-read-time">
                                        <i class="fa-regular fa-clock"></i> <span>{{ catArticle.readMinutes || 1 }} min read</span>
                                    </span>
                                </div>
                            </div>
                        </article>
                        <p v-if="!section.articles || section.articles.length === 0" class="empty-state text-xs text-slate-400 italic py-2 col-span-full">
                            No articles available yet in this section.
                        </p>
                    </div>
                </section>
            </template>
        </div>
    </PublicLayout>
</template>
