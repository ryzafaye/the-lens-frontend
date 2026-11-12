<script setup>
import { computed, ref } from 'vue';
import PublicLayout from '../../Layouts/PublicLayout.vue';

const props = defineProps({
    authorName: { type: String, required: true },
    authorFound: { type: Boolean, default: true },
    articles: { type: Array, default: () => [] },
    roleName: { type: String, default: 'Contributing Writer' },
    beatsWithCount: { type: Array, default: () => [] },
});

const activeCategory = ref('all');
const initials = computed(() => props.authorName.trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase() || 'L');
const filteredArticles = computed(() => activeCategory.value === 'all'
    ? props.articles
    : props.articles.filter((article) => article.categorySlug === activeCategory.value));
</script>

<template>
    <PublicLayout :title="`${authorName} | Author Profile`">
        <main class="author-profile-page" data-page="author-profile">
            <nav class="author-nav-bar" aria-label="Author navigation"><a class="author-back-btn" href="/archives"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back to All Articles</span></a></nav>
            <div id="author-profile-content" aria-live="polite">
                <div v-if="!authorFound && !articles.length" class="author-empty-state"><span class="author-empty-icon" aria-hidden="true"><i class="fa-regular fa-id-card"></i></span><h1 class="author-empty-title">Journalist Profile Not Found</h1><p class="author-empty-desc">We could not locate published dispatches or an accredited portfolio associated with “{{ authorName }}”.</p><a href="/" class="author-explore-btn"><span>Explore Newsroom Home</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
                <template v-else>
                    <header class="author-dossier-card"><div class="author-dossier-layout"><div class="author-avatar-wrap"><div class="author-avatar-ring"><div class="author-avatar-fallback" aria-hidden="true">{{ initials }}</div></div><span class="author-avatar-badge" title="The Lens Contributor" aria-hidden="true"><i class="fa-solid fa-feather-pointed"></i></span></div><div class="author-details"><h1 class="author-dossier-name">{{ authorName }}</h1><div class="author-badges-row"><span class="author-role-pill"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>{{ roleName }}</span></span></div></div><div class="author-article-count-box" aria-label="Author publication count"><strong class="author-article-count-number">{{ articles.length }}</strong><span class="author-article-count-label">{{ articles.length === 1 ? 'Published article' : 'Published articles' }}</span></div></div></header>
                    <section class="author-byline-section" aria-labelledby="byline-heading"><div class="author-byline-header"><div class="byline-header-titles"><h2 id="byline-heading" class="byline-main-title">Published articles and campus reporting filed by {{ authorName }}.</h2></div><div v-if="beatsWithCount.length > 1" class="byline-filter-tabs" role="tablist" aria-label="Filter articles by category"><button type="button" class="filter-tab-btn" :class="{ active: activeCategory === 'all' }" role="tab" :aria-selected="activeCategory === 'all'" @click="activeCategory = 'all'"><span>All Stories</span><span class="tab-count">({{ articles.length }})</span></button><button v-for="beat in beatsWithCount" :key="beat.name" type="button" class="filter-tab-btn" :class="{ active: activeCategory === beat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }" role="tab" :aria-selected="activeCategory === beat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')" @click="activeCategory = beat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')"><span>{{ beat.name }}</span><span class="tab-count">({{ beat.count }})</span></button></div></div>
                        <div class="author-byline-grid" id="author-articles-grid"><article v-for="article in filteredArticles" :key="article.id" class="author-story-card" :data-category="article.categorySlug"><a class="author-story-thumb-frame" :href="article.url" :aria-label="`Read story: ${article.title}`"><img :src="article.imageUrl" :alt="article.title" loading="lazy"><span class="story-category-tag">{{ article.category }}</span></a><div class="author-story-body"><div class="story-meta-row"><span class="story-meta-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i><time>{{ article.publishedAt }}</time></span><span aria-hidden="true">·</span><span><i class="fa-regular fa-clock" aria-hidden="true"></i> {{ article.readMinutes }} min read</span></div><h3 class="author-story-title"><a :href="article.url">{{ article.title }}</a></h3><p class="author-story-excerpt">{{ article.excerpt || 'Read this campus report published by The Lens Publication.' }}</p><div class="author-story-footer"><div class="story-footer-stats"><span><i class="fa-regular fa-eye" aria-hidden="true"></i> {{ article.views.toLocaleString() }} reads</span><span><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {{ article.shares.toLocaleString() }}</span></div><a :href="article.url" class="read-story-link" :aria-label="`Read full article ${article.title}`"><span>Read Dispatch</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div></div></article><div v-if="!filteredArticles.length" class="author-empty-state"><span class="author-empty-icon" aria-hidden="true"><i class="fa-solid fa-newspaper"></i></span><h3 class="author-empty-title">No Published Dispatches Yet</h3><p class="author-empty-desc">{{ authorName }} has not published articles on the public website yet. Check back soon for upcoming investigative reports and coverage.</p><a href="/category/latest" class="author-explore-btn"><span>Browse Latest Newsroom Coverage</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div></div>
                    </section>
                </template>
            </div>
        </main>
    </PublicLayout>
</template>
