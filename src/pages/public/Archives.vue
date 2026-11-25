<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { getPublicArchives } from '../../services/api.js';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref(null);
const articles = ref([]);
const categories = ref([]);
const pagination = ref([]);
const total = ref(0);

const selectedCategory = ref(route.query.category || 'All');

async function fetchArchives(page = 1) {
    loading.value = true;
    error.value = null;
    try {
        const params = {
            page,
            q: route.query.q || '',
            category: selectedCategory.value || 'All',
            sort: route.query.sort || 'newest',
            dateType: route.query.dateType || 'any',
            dateValue: route.query.dateValue || '',
        };
        const res = await getPublicArchives(params);
        const data = res?.props || res || {};
        articles.value = data.articles || [];
        categories.value = data.categories || [];
        pagination.value = data.pagination || [];
        total.value = data.total || 0;
    } catch (err) {
        console.error('Failed to load archives:', err);
        error.value = 'Failed to load archived articles.';
    } finally {
        loading.value = false;
    }
}

function onCategoryChange() {
    const query = { ...route.query };
    if (selectedCategory.value && selectedCategory.value !== 'All') {
        query.category = selectedCategory.value;
    } else {
        delete query.category;
    }
    delete query.page;
    router.push({ path: '/archives', query });
}

function goToPage(page) {
    if (!page) return;
    const query = { ...route.query, page };
    router.push({ path: '/archives', query });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(() => route.query, () => {
    selectedCategory.value = route.query.category || 'All';
    fetchArchives(route.query.page || 1);
});

onMounted(() => {
    selectedCategory.value = route.query.category || 'All';
    fetchArchives(route.query.page || 1);
});
</script>

<template>
    <PublicLayout>
        <main class="max-w-7xl mx-auto px-6 py-10">
            <!-- Page introduction -->
            <section class="mb-9">
                <p class="text-xs tracking-widest text-wine font-bold mb-3 uppercase">
                    THE LENS COLLECTION
                </p>
                <h1 class="font-display text-4xl md:text-5xl font-extrabold text-wine">
                    Article Archives
                </h1>
                <p class="mt-2 text-stone-600 text-sm max-w-2xl">
                    Explore past coverage, documented campus events, opinions, and feature stories.
                </p>
            </section>

            <!-- Search status message -->
            <p v-if="route.query.q || (selectedCategory !== 'All' && selectedCategory)" id="search-message" class="mb-5 text-sm text-wine font-medium">
                Showing results for 
                <span v-if="route.query.q">“{{ route.query.q }}” </span>
                <span v-if="route.query.q && selectedCategory !== 'All'">in </span>
                <span v-if="selectedCategory !== 'All'">{{ selectedCategory }} </span>
                ({{ total }} {{ total === 1 ? 'article' : 'articles' }} found)
            </p>

            <!-- Category filter & toolbar -->
            <section class="border-t-2 border-wine pt-5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 class="font-display text-2xl font-bold text-stone-900">
                        Browse archived stories
                    </h2>

                    <label class="flex items-center gap-3 text-sm text-stone-600">
                        <span>Category:</span>
                        <select id="archive-filter" v-model="selectedCategory" class="archive-select" @change="onCategoryChange">
                            <option value="All">All categories</option>
                            <option v-for="cat in categories" :key="cat.id" :value="cat.name">
                                {{ cat.name }}
                            </option>
                        </select>
                    </label>
                </div>

                <!-- Loading State -->
                <div v-if="loading" class="py-16 text-center text-stone-400">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-[#5c0a18] mb-4"></div>
                    <p class="text-xs uppercase tracking-widest text-stone-500 font-bold">Retrieving records…</p>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl my-8">
                    <i class="fa-solid fa-circle-exclamation text-3xl mb-3 block"></i>
                    <p class="text-sm font-bold">{{ error }}</p>
                    <button type="button" @click="fetchArchives(1)" class="mt-4 px-4 py-2 bg-[#5c0a18] text-white text-xs font-bold rounded-lg hover:bg-[#400817] transition-colors">
                        Try Again
                    </button>
                </div>

                <!-- Archived Articles Grid -->
                <template v-else>
                    <div id="archive-articles" class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                        <article v-for="article in articles" :key="article.id" class="archive-item flex flex-col sm:flex-row gap-5 p-4 rounded-xl border border-stone-100 hover:border-stone-200 hover:shadow-sm transition-all bg-white" :data-article-id="article.id">
                            <router-link :to="'/article/' + (article.slug || article.id)" class="archive-image-trigger w-full sm:w-44 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-[#571525]" :aria-label="'Read article: ' + article.title">
                                <div class="article-image archive-image w-full h-full bg-[#571525]">
                                    <img :src="article.imageUrl || '/images/maroon.jpg'" :alt="article.title" class="w-full h-full object-contain hover:scale-105 transition-transform duration-300" loading="lazy">
                                </div>
                            </router-link>
                            <div class="archive-item-copy flex flex-col justify-between flex-grow">
                                <div>
                                    <div class="article-meta mb-1 text-xs text-stone-500">
                                        <span class="article-category-label font-bold text-wine">{{ article.category || 'The Lens' }}</span>
                                        <span class="article-meta-separator" aria-hidden="true">·</span>
                                        <time>{{ article.publishedAt }}</time>
                                    </div>
                                    <h3 class="font-display font-bold text-base text-stone-900 line-clamp-2 mb-2">
                                        <router-link :to="'/article/' + (article.slug || article.id)" class="article-title-button">
                                            {{ article.title }}
                                        </router-link>
                                    </h3>
                                    <p class="archive-excerpt text-xs text-stone-500 line-clamp-2 mb-3">
                                        {{ article.excerpt }}
                                    </p>
                                </div>
                                <div>
                                    <p class="article-byline text-[11px] text-stone-500 mb-2">
                                        <i class="fa-solid fa-pen-nib text-stone-400 mr-1" aria-hidden="true"></i>
                                        <span>By 
                                            <template v-if="article.author">
                                                <router-link v-if="article.authorId" class="author-profile-link font-medium text-stone-700 hover:underline" :to="'/author/' + article.authorId">
                                                    {{ article.author }}
                                                </router-link>
                                                <span v-else>{{ article.author }}</span>
                                            </template>
                                            <strong v-else>The Lens Staff</strong>
                                        </span>
                                    </p>
                                    <div class="article-stats flex items-center gap-4 text-[11px] text-stone-400">
                                        <span><i class="fa-regular fa-eye mr-1"></i> {{ Number(article.views || 0).toLocaleString() }} views</span>
                                        <span><i class="fa-regular fa-clock mr-1"></i> {{ article.readMinutes || 1 }} min</span>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <!-- Empty State -->
                        <div v-if="articles.length === 0" class="archive-empty-state col-span-full p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-6">
                            <i class="fa-regular fa-folder-open text-4xl mb-3 text-slate-300 block" aria-hidden="true"></i>
                            <h3 class="font-bold text-lg text-slate-700">No stories found</h3>
                            <p class="text-xs text-slate-500 mt-1">Try another keyword, author, category, or date range.</p>
                        </div>
                    </div>

                    <p id="archive-count" class="mt-6 text-xs text-stone-500">
                        {{ total }} {{ total === 1 ? 'article' : 'articles' }} found
                    </p>

                    <!-- Pagination -->
                    <div v-if="pagination && pagination.length > 3" class="mt-8 flex flex-wrap justify-center items-center gap-1.5">
                        <template v-for="(link, idx) in pagination" :key="idx">
                            <button
                                v-if="link.url"
                                type="button"
                                class="min-w-[40px] min-h-[40px] px-3 py-2 text-xs font-semibold rounded border transition-colors"
                                :class="link.active ? 'bg-wine text-white border-wine' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'"
                                @click="goToPage(parseInt(link.label) || (link.label.includes('Previous') ? Number(route.query.page || 1) - 1 : Number(route.query.page || 1) + 1))"
                                v-html="link.label"
                            ></button>
                            <span
                                v-else
                                class="px-2.5 py-2 text-xs text-stone-400 border border-transparent select-none"
                                v-html="link.label"
                            ></span>
                        </template>
                    </div>
                </template>
            </section>

            <!-- Return to homepage -->
            <div class="mt-12">
                <router-link to="/" class="inline-block border border-wine px-5 py-3 text-wine text-sm font-bold rounded hover:bg-rose-50 transition-colors">
                    ← Back to Homepage
                </router-link>
            </div>
        </main>
    </PublicLayout>
</template>
