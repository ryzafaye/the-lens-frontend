<script setup>
import PublicLayout from '../../Layouts/PublicLayout.vue';
import ShareButton from '../../Components/ShareButton.vue';

defineProps({
    currentCategory: { type: Object, required: true },
    articles: { type: Array, default: () => [] },
    pagination: { type: Array, default: () => [] },
});
</script>

<template>
    <PublicLayout :title="currentCategory.name">
        <main class="max-w-7xl mx-auto px-6 py-10 w-full" data-page="category" :data-category="currentCategory.slug">
            <section class="mb-10 pb-6 border-b border-stone-200">
                <p class="text-xs tracking-widest text-wine font-bold mb-2 uppercase">The Lens Publication · Section</p>
                <h1 class="font-display text-4xl md:text-5xl font-extrabold text-wine">{{ currentCategory.name }}</h1>
                <p v-if="currentCategory.description" class="mt-3 text-stone-600 text-sm max-w-2xl leading-relaxed">{{ currentCategory.description }}</p>
            </section>

            <section class="space-y-6">
                <article v-for="article in articles" :key="article.id" class="category-list-card" :data-article-id="article.id">
                    <a :href="article.url" class="category-list-image article-clickable" :aria-label="`Read article: ${article.title}`"><div class="article-image category-list-thumb"><img :src="article.imageUrl" :alt="article.title" loading="lazy"></div></a>
                    <div class="category-list-copy">
                        <div class="article-meta"><span class="article-category-label">{{ article.category }}</span><span class="article-meta-separator" aria-hidden="true">·</span><time>{{ article.publishedAt }}</time></div>
                        <h2 class="category-list-title"><a :href="article.url" class="article-title-button">{{ article.title }}</a></h2>
                        <p class="category-list-excerpt">{{ article.excerpt }}</p>
                        <p class="article-byline"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>By <a v-if="article.author" :href="article.authorUrl" class="author-profile-link">{{ article.author }}</a><strong v-else>The Lens Staff</strong></span></p>
                        <div class="article-stats" aria-label="Article engagement and reading time">
                            <span class="article-view-count" title="Views"><i class="fa-regular fa-eye" aria-hidden="true"></i><span>{{ article.views.toLocaleString() }}</span><span class="stat-label">views</span></span>
                            <span class="article-read-time" title="Estimated reading time"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>{{ article.readMinutes }} min read</span></span>
                            <ShareButton :article-id="article.id" :article-url="article.url" :initial-count="article.shares" />
                        </div>
                    </div>
                </article>
                <div v-if="!articles.length" class="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-8">
                    <i class="fa-regular fa-newspaper text-4xl mb-3 text-slate-300 block"></i><h2 class="font-bold text-lg text-slate-700">No Published Stories in this Section Yet</h2><p class="text-xs text-slate-500 mt-1">Articles published by the editorial team will appear here.</p><div class="mt-6"><a href="/" class="inline-block border border-wine px-4 py-2 text-wine text-xs font-bold rounded hover:bg-rose-50 transition-colors">← Back to Homepage</a></div>
                </div>
            </section>

            <nav v-if="pagination.length > 1" class="mt-10 flex justify-center gap-2" aria-label="Pagination">
                <a v-for="item in pagination" :key="`${item.label}-${item.url}`" :href="item.url || undefined" :aria-current="item.active ? 'page' : undefined" :class="['px-3 py-2 rounded border text-sm', item.active ? 'bg-wine text-white border-wine' : 'border-stone-200 text-stone-700', !item.url && 'opacity-50 pointer-events-none']">{{ item.label.replace(/&laquo;|&raquo;/g, '') }}</a>
            </nav>
        </main>
    </PublicLayout>
</template>
