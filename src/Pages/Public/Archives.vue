<script setup>
import { useRouter } from 'vue-router';
import PublicLayout from '../../Layouts/PublicLayout.vue';

const props = defineProps({
    articles: { type: Array, default: () => [] },
    pagination: { type: Array, default: () => [] },
    categories: { type: Array, default: () => [] },
    filters: { type: Object, default: () => ({}) },
    total: { type: Number, default: 0 },
});

const router = useRouter();

function resolveRoutePath(url) {
    if (!url) return '';
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const parsed = new URL(url);
            return parsed.pathname + parsed.search + parsed.hash;
        }
    } catch {
        // Fallback if parsing fails
    }
    return url;
}

function onCategoryChange(event) {
    const category = event.target.value;
    const query = {
        q: props.filters?.query ?? '',
        sort: props.filters?.sort ?? 'newest',
        dateType: props.filters?.dateType ?? 'any',
        dateValue: props.filters?.dateValue ?? '',
        category: category,
    };
    router.push({ path: '/archives', query });
}

function onSearchSubmit(event) {
    const formData = new FormData(event.target);
    const query = {
        q: formData.get('q') ?? '',
        sort: formData.get('sort') ?? 'newest',
        dateType: formData.get('dateType') ?? 'any',
        dateValue: formData.get('dateValue') ?? '',
        category: formData.get('category') ?? 'All',
    };
    router.push({ path: '/archives', query });
}
</script>

<template>
    <PublicLayout title="Article Archives">
        <main class="max-w-7xl mx-auto px-6 py-10 w-full">
            <!-- Page introduction -->
            <section class="mb-9">
                <p class="text-xs tracking-widest text-wine font-bold mb-3 uppercase">THE LENS COLLECTION</p>
                <h1 class="font-display text-4xl md:text-5xl font-extrabold text-wine">Article Archives</h1>
                <p class="mt-2 text-stone-600 text-sm max-w-2xl">Explore past coverage, documented campus events, opinions, and feature stories.</p>
            </section>

            <!-- Search status message -->
            <p v-if="filters?.query || (filters?.category && filters.category !== 'All')" id="search-message" class="mb-5 text-sm text-wine font-medium">
                Showing results for 
                <template v-if="filters?.query">“{{ filters.query }}”</template>
                <template v-if="filters?.query && filters?.category && filters.category !== 'All'"> in </template>
                <template v-if="filters?.category && filters.category !== 'All'">{{ filters.category }}</template>
                ({{ total }} {{ total === 1 ? 'article' : 'articles' }} found)
            </p>

            <!-- Category filter & toolbar -->
            <section class="border-t-2 border-wine pt-5">
                <form @submit.prevent="onSearchSubmit" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <input type="hidden" name="q" :value="filters?.query ?? ''">
                    <input type="hidden" name="sort" :value="filters?.sort ?? 'newest'">
                    <input type="hidden" name="dateType" :value="filters?.dateType ?? 'any'">
                    <input type="hidden" name="dateValue" :value="filters?.dateValue ?? ''">

                    <h2 class="font-display text-2xl font-bold text-stone-900">Browse archived stories</h2>

                    <label class="flex items-center gap-3 text-sm text-stone-600">
                        <span>Category:</span>
                        <select id="archive-filter" name="category" class="archive-select" @change="onCategoryChange">
                            <option value="All" :selected="!filters?.category || filters.category === 'All'">All categories</option>
                            <option v-for="category in categories" :key="category.id" :value="category.name" :selected="filters?.category === category.name || filters?.category === category.slug">
                                {{ category.name }}
                            </option>
                        </select>
                    </label>
                </form>

                <!-- Archived Articles Grid -->
                <div id="archive-articles" class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                    <article v-for="article in articles" :key="article.id" class="archive-item flex flex-col sm:flex-row gap-5 p-4 rounded-xl border border-stone-100 hover:border-stone-200 hover:shadow-sm transition-all bg-white" :data-article-id="article.id">
                        <RouterLink :to="resolveRoutePath(article.url)" class="archive-image-trigger w-full sm:w-44 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-[#571525]" :aria-label="`Read article: ${article.title}`">
                            <div class="article-image archive-image w-full h-full bg-[#571525]">
                                <img :src="article.imageUrl" :alt="article.title" class="w-full h-full object-contain hover:scale-105 transition-transform duration-300" loading="lazy">
                            </div>
                        </RouterLink>
                        <div class="archive-item-copy flex flex-col justify-between flex-grow">
                            <div>
                                <div class="article-meta mb-1 text-xs text-stone-500">
                                    <span class="article-category-label font-bold text-wine">{{ article.category || 'The Lens' }}</span>
                                    <span class="article-meta-separator" aria-hidden="true">·</span>
                                    <time>{{ article.publishedAt }}</time>
                                </div>
                                <h3 class="font-display font-bold text-base text-stone-900 line-clamp-2 mb-2">
                                    <RouterLink :to="resolveRoutePath(article.url)" class="article-title-button">{{ article.title }}</RouterLink>
                                </h3>
                                <p class="archive-excerpt text-xs text-stone-500 line-clamp-2 mb-3">{{ article.excerpt }}</p>
                            </div>
                            <div>
                                <p class="article-byline text-[11px] text-stone-500 mb-2">
                                    <i class="fa-solid fa-pen-nib text-stone-400 mr-1" aria-hidden="true"></i>
                                    <span>By 
                                        <RouterLink v-if="article.author" :to="resolveRoutePath(article.authorUrl)" class="author-profile-link font-medium text-stone-700 hover:underline">{{ article.author }}</RouterLink>
                                        <strong v-else>The Lens Staff</strong>
                                    </span>
                                </p>
                                <div class="article-stats flex items-center gap-4 text-[11px] text-stone-400">
                                    <span><i class="fa-regular fa-eye mr-1"></i> {{ article.views.toLocaleString() }} views</span>
                                    <span><i class="fa-regular fa-clock mr-1"></i> {{ article.readMinutes }} min</span>
                                </div>
                            </div>
                        </div>
                    </article>

                    <!-- Empty state -->
                    <div v-if="!articles.length" class="archive-empty-state col-span-full p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-6">
                        <i class="fa-regular fa-folder-open text-4xl mb-3 text-slate-300 block" aria-hidden="true"></i>
                        <h3 class="font-bold text-lg text-slate-700">No stories found</h3>
                        <p class="text-xs text-slate-500 mt-1">Try another keyword, author, category, or date range.</p>
                    </div>
                </div>

                <!-- Archive count -->
                <p id="archive-count" class="mt-6 text-xs text-stone-500">
                    {{ total }} {{ total === 1 ? 'article' : 'articles' }} found
                </p>

                <!-- Pagination -->
                <nav v-if="pagination.length > 1" class="mt-8 flex justify-center gap-2" aria-label="Pagination">
                    <RouterLink
                        v-for="item in pagination"
                        :key="`${item.label}-${item.url}`"
                        :to="resolveRoutePath(item.url) || ''"
                        :aria-current="item.active ? 'page' : undefined"
                        :class="['px-3 py-2 rounded border text-sm', item.active ? 'bg-wine text-white border-wine' : 'border-stone-200 text-stone-700', !item.url && 'opacity-50 pointer-events-none']"
                    >
                        {{ item.label.replace(/&laquo;|&raquo;/g, '').trim() }}
                    </RouterLink>
                </nav>
            </section>

            <!-- Return to homepage -->
            <div class="mt-12">
                <RouterLink to="/" class="inline-block border border-wine px-5 py-3 text-wine text-sm font-bold rounded hover:bg-rose-50 transition-colors">
                    ← Back to Homepage
                </RouterLink>
            </div>
        </main>
    </PublicLayout>
</template>
