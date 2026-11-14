<script setup>
import { useRouter } from 'vue-router';
import PublicLayout from '../../Layouts/PublicLayout.vue';
import ShareButton from '../../components/ShareButton.vue';

const props = defineProps({
    articles: { type: Array, default: () => [] },
    pagination: { type: Array, default: () => [] },
    categories: { type: Array, default: () => [] },
    filters: { type: Object, required: true },
    total: { type: Number, default: 0 },
});

const router = useRouter();

function onCategoryChange(event) {
    const category = event.target.value;
    const query = {};
    if (props.filters?.query) query.q = props.filters.query;
    if (props.filters?.sort) query.sort = props.filters.sort;
    if (props.filters?.dateType) query.dateType = props.filters.dateType;
    if (props.filters?.dateValue) query.dateValue = props.filters.dateValue;
    if (category && category !== 'All') query.category = category;
    router.push({ path: '/archives', query });
}

function onSearchSubmit(event) {
    const formData = new FormData(event.target);
    const query = {};
    const q = formData.get('q');
    const sort = formData.get('sort');
    const dateType = formData.get('dateType');
    const dateValue = formData.get('dateValue');
    const category = formData.get('category');
    if (q) query.q = q;
    if (sort) query.sort = sort;
    if (dateType) query.dateType = dateType;
    if (dateValue) query.dateValue = dateValue;
    if (category && category !== 'All') query.category = category;
    router.push({ path: '/archives', query });
}
</script>

<template>
    <PublicLayout title="Article Archives">
        <main class="max-w-7xl mx-auto px-6 py-10 w-full">
            <section class="mb-9">
                <p class="text-xs tracking-widest text-wine font-bold mb-3 uppercase">THE LENS COLLECTION</p>
                <h1 class="font-display text-4xl md:text-5xl font-extrabold text-wine">Article Archives</h1>
                <p class="mt-2 text-stone-600 text-sm max-w-2xl">Explore past coverage, documented campus events, opinions, and feature stories.</p>
            </section>
            <p v-if="filters.query || filters.category !== 'All'" class="mb-5 text-sm text-wine font-medium">
                Showing results for <span v-if="filters.query">“{{ filters.query }}”</span><span v-if="filters.query && filters.category !== 'All'"> in </span><span v-if="filters.category !== 'All'">{{ filters.category }}</span> ({{ total }} {{ total === 1 ? 'article' : 'articles' }} found)
            </p>
            <section class="border-t-2 border-wine pt-5">
                <form @submit.prevent="onSearchSubmit" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <input type="hidden" name="q" :value="filters.query"><input type="hidden" name="sort" :value="filters.sort"><input type="hidden" name="dateType" :value="filters.dateType"><input type="hidden" name="dateValue" :value="filters.dateValue">
                    <h2 class="font-display text-2xl font-bold text-stone-900">Browse archived stories</h2>
                    <label class="flex items-center gap-3 text-sm text-stone-600"><span>Category:</span><select name="category" class="archive-select" @change="onCategoryChange"><option value="All" :selected="filters.category === 'All'">All categories</option><option v-for="category in categories" :key="category.id" :value="category.name" :selected="filters.category === category.name || filters.category === category.slug">{{ category.name }}</option></select></label>
                </form>
                <div id="archive-articles" class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                    <article v-for="article in articles" :key="article.id" class="archive-item flex flex-col sm:flex-row gap-5 p-4 rounded-xl border border-stone-100 hover:border-stone-200 hover:shadow-sm transition-all bg-white" :data-article-id="article.id">
                        <RouterLink :to="article.url" class="archive-image-trigger w-full sm:w-44 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-[#571525]" :aria-label="`Read article: ${article.title}`"><div class="article-image archive-image w-full h-full bg-[#571525]"><img :src="article.imageUrl" :alt="article.title" class="w-full h-full object-contain hover:scale-105 transition-transform duration-300" loading="lazy"></div></RouterLink>
                        <div class="archive-item-copy flex flex-col justify-between flex-grow">
                            <div><div class="article-meta mb-1 text-xs text-stone-500"><span class="article-category-label font-bold text-wine">{{ article.category }}</span><span class="article-meta-separator" aria-hidden="true">·</span><time>{{ article.publishedAt }}</time></div><h2 class="font-display font-bold text-base text-stone-900 line-clamp-2 mb-2"><RouterLink :to="article.url" class="article-title-button">{{ article.title }}</RouterLink></h2><p class="text-xs text-stone-600 line-clamp-3">{{ article.excerpt }}</p></div>
                            <div class="article-stats text-xs mt-3"><span class="article-view-count"><i class="fa-regular fa-eye" aria-hidden="true"></i> {{ article.views.toLocaleString() }}</span><span class="article-read-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> {{ article.readMinutes }} min</span><ShareButton :article-id="article.id" :article-url="article.url" :initial-count="article.shares" /></div>
                        </div>
                    </article>
                    <div v-if="!articles.length" class="col-span-full p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl"><h2 class="font-bold text-lg text-slate-700">No articles found</h2><p class="text-sm mt-2">Try adjusting the search or category filters.</p></div>
                </div>
                <nav v-if="pagination.length > 1" class="mt-10 flex justify-center gap-2" aria-label="Pagination"><RouterLink v-for="item in pagination" :key="`${item.label}-${item.url}`" :to="item.url || ''" :aria-current="item.active ? 'page' : undefined" :class="['px-3 py-2 rounded border text-sm', item.active ? 'bg-wine text-white border-wine' : 'border-stone-200 text-stone-700', !item.url && 'opacity-50 pointer-events-none']">{{ item.label.replace(/&laquo;|&raquo;/g, '') }}</RouterLink></nav>
            </section>
        </main>
    </PublicLayout>
</template>
