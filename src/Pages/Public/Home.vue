<script setup>
import ArticleCard from '../../Components/ArticleCard.vue';
import ShareButton from '../../Components/ShareButton.vue';
import PublicLayout from '../../Layouts/PublicLayout.vue';

defineProps({
    featuredArticle: { type: Object, default: null },
    latestArticles: { type: Array, default: () => [] },
    moreStories: { type: Array, default: () => [] },
    categorySections: { type: Array, default: () => [] },
});
</script>

<template>
    <PublicLayout title="Home">
        <main id="home" class="max-w-7xl mx-auto px-6 py-8 w-full">
            <section class="home-feature-layout">
                <div id="featured-article">
                    <article v-if="featuredArticle" class="featured-story" :data-article-id="featuredArticle.id">
                        <a :href="featuredArticle.url" class="featured-image-trigger article-clickable" :aria-label="`Read article: ${featuredArticle.title}`">
                            <div class="article-image featured-image"><img :src="featuredArticle.imageUrl" :alt="featuredArticle.title" loading="lazy"></div>
                        </a>
                        <div class="article-meta"><span class="article-category-label">{{ featuredArticle.category }}</span><span class="article-meta-separator" aria-hidden="true">·</span><time>{{ featuredArticle.publishedAt }}</time></div>
                        <h2 class="featured-title"><a :href="featuredArticle.url" class="article-title-button featured-headline-button">{{ featuredArticle.title }}</a></h2>
                        <div class="featured-divider"></div>
                        <p class="featured-excerpt">{{ featuredArticle.excerpt }}</p>
                        <p class="article-byline"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>By <a v-if="featuredArticle.author" :href="featuredArticle.authorUrl" class="author-profile-link">{{ featuredArticle.author }}</a><strong v-else>The Lens Staff</strong></span></p>
                        <div class="article-stats" aria-label="Article engagement and reading time">
                            <span class="article-view-count" title="Views"><i class="fa-regular fa-eye" aria-hidden="true"></i><span>{{ featuredArticle.views.toLocaleString() }}</span><span class="stat-label">views</span></span>
                            <span class="article-read-time" title="Estimated reading time"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>{{ featuredArticle.readMinutes }} min read</span></span>
                            <ShareButton :article-id="featuredArticle.id" :article-url="featuredArticle.url" :initial-count="featuredArticle.shares" />
                        </div>
                    </article>
                    <div v-else class="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl my-4">
                        <i class="fa-regular fa-newspaper text-3xl mb-3 text-slate-300 block"></i><h3 class="font-bold text-base text-slate-700">No Published Articles Yet</h3><p class="text-xs text-slate-500 mt-1">Stories published by the editorial team will appear here.</p>
                    </div>
                </div>
                <aside id="latest" class="latest-section">
                    <h2 class="section-label">LATEST RELEASES</h2>
                    <div id="latest-articles" class="space-y-7 mt-6">
                        <article v-for="article in latestArticles" :key="article.id" class="latest-item" :data-article-id="article.id">
                            <div class="latest-item-copy">
                                <p class="latest-category">{{ article.category }}</p>
                                <h3 class="latest-title"><a :href="article.url" class="article-title-button">{{ article.title }}</a></h3>
                                <p class="article-byline text-xs"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>By <a v-if="article.author" :href="article.authorUrl" class="author-profile-link">{{ article.author }}</a><strong v-else>The Lens Staff</strong></span></p>
                                <div class="article-stats text-xs"><span class="article-view-count"><i class="fa-regular fa-eye" aria-hidden="true"></i> <span>{{ article.views.toLocaleString() }}</span></span><span class="article-read-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> <span>{{ article.readMinutes }} min</span></span></div>
                            </div>
                            <a :href="article.url" class="latest-image-trigger article-clickable" :aria-label="`Read article: ${article.title}`"><div class="article-image latest-image"><img :src="article.imageUrl" :alt="article.title" loading="lazy"></div></a>
                        </article>
                        <p v-if="!latestArticles.length" class="text-xs text-slate-400 py-3 italic">No recent releases yet.</p>
                    </div>
                </aside>
            </section>

            <section v-if="moreStories.length" class="mt-14" id="more-stories">
                <div class="section-heading"><h2>More stories</h2><a href="/category/latest" class="text-wine text-sm font-bold">Explore latest →</a></div>
                <div id="more-articles" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"><ArticleCard v-for="article in moreStories" :key="article.id" :article="article" /></div>
            </section>

            <section v-for="category in categorySections" :id="category.slug" :key="category.id" class="category-section mt-14">
                <div class="section-heading"><h2>{{ category.name }}</h2><a :href="category.url" class="category-button">View all →</a></div>
                <div class="category-grid">
                    <article v-for="article in category.articles" :key="article.id" class="category-card" :data-article-id="article.id">
                        <a :href="article.url" class="category-image-trigger article-clickable" :aria-label="`Read article: ${article.title}`"><div class="article-image small-image"><img :src="article.imageUrl" :alt="article.title" loading="lazy"></div></a>
                        <div class="category-card-copy">
                            <div class="article-meta"><span class="article-category-label">{{ category.name }}</span><span class="article-meta-separator" aria-hidden="true">·</span><time>{{ article.publishedAt }}</time></div>
                            <h3 class="category-card-title"><a :href="article.url" class="article-title-button">{{ article.title }}</a></h3>
                            <p class="category-card-excerpt">{{ article.excerpt }}</p>
                            <p class="article-byline text-xs"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>By <a v-if="article.author" :href="article.authorUrl" class="author-profile-link">{{ article.author }}</a><strong v-else>The Lens Staff</strong></span></p>
                            <div class="article-stats text-xs"><span class="article-view-count"><i class="fa-regular fa-eye" aria-hidden="true"></i> <span>{{ article.views.toLocaleString() }}</span></span><span class="article-read-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> <span>{{ article.readMinutes }} min read</span></span></div>
                        </div>
                    </article>
                    <p v-if="!category.articles.length" class="empty-state text-xs text-slate-400 italic py-2 col-span-full">No articles available yet in this section.</p>
                </div>
            </section>
        </main>
    </PublicLayout>
</template>
