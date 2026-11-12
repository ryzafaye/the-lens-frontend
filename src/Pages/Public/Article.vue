<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import PublicLayout from '../../Layouts/PublicLayout.vue';
import ShareButton from '../../Components/ShareButton.vue';

const props = defineProps({
    article: { type: Object, required: true },
    relatedArticles: { type: Array, default: () => [] },
});

function closeReader() {
    if (document.referrer && document.referrer.includes(window.location.host) && window.history.length > 1) {
        window.history.back();
        return;
    }

    window.location.href = '/';
}

function onKeydown(event) {
    if (event.key === 'Escape') closeReader();
}

onMounted(() => {
    document.getElementById('article-reader-container')?.focus();
    window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <PublicLayout :title="article.title" reader>
        <div class="article-reader-fullscreen modal-scroll-container" id="article-reader-container" tabindex="0">
            <header class="modal-topbar">
                <a href="/" class="modal-topbar-brand" aria-label="The Lens home"><i class="fa-regular fa-newspaper" aria-hidden="true"></i><span>THE LENS</span></a>
                <button type="button" class="modal-topbar-close" @click="closeReader" aria-label="Close article reader" title="Close reader (Esc)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </header>
            <div class="modal-reader">
                <article class="modal-reading-content">
                    <div class="modal-category-row"><span class="modal-category"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><a :href="article.categoryUrl">{{ article.category }}</a></span><span class="modal-reading-time"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>{{ article.readMinutes }} min read</span></span></div>
                    <h1 class="modal-title">{{ article.title }}</h1>
                    <div class="modal-byline">
                        <span><i class="fa-solid fa-pen-nib" aria-hidden="true"></i><span>By <a v-if="article.author" class="author-profile-link font-bold text-wine hover:underline" :href="article.authorUrl">{{ article.author }}</a><strong v-else>The Lens Staff</strong></span></span>
                        <span class="text-stone-300">•</span>
                        <span><i class="fa-regular fa-calendar" aria-hidden="true"></i><span>Published {{ article.publishedAt }}</span></span>
                    </div>
                    <p v-if="article.excerpt" class="modal-lead-excerpt">{{ article.excerpt }}</p>
                    <figure class="modal-figure">
                        <div class="modal-image"><img :src="article.imageUrl" :alt="article.title" loading="eager"></div>
                        <figcaption class="modal-caption"><span><i class="fa-solid fa-camera mr-1" aria-hidden="true"></i>{{ article.title }}</span><span>THE LENS / {{ article.category.toUpperCase() }}</span></figcaption>
                    </figure>
                    <div class="modal-body prose prose-stone max-w-none" v-html="article.bodyHtml"></div>
                    <div class="modal-engagement-row flex items-center justify-between">
                        <div class="article-stats flex items-center gap-6"><span class="article-view-count flex items-center gap-2" title="Views"><i class="fa-regular fa-eye text-stone-400" aria-hidden="true"></i><strong class="font-bold text-stone-800">{{ article.views.toLocaleString() }}</strong><span class="stat-label text-xs text-stone-500">views</span></span><ShareButton :article-id="article.id" :article-url="article.url" :initial-count="article.shares" /></div>
                        <a :href="article.categoryUrl" class="more-in-category-link">More in {{ article.category }} →</a>
                    </div>
                    <section v-if="relatedArticles.length" class="continue-reading" aria-labelledby="continue-reading-title">
                        <div class="continue-reading-heading"><p class="continue-reading-eyebrow">MORE FROM THE LENS</p><h2 id="continue-reading-title">Continue reading</h2><p>Explore more campus stories selected for you.</p></div>
                        <div class="continue-reading-grid">
                            <article v-for="related in relatedArticles" :key="related.id" class="continue-story-card" :data-article-id="related.id">
                                <a :href="related.url" class="continue-story-image" :aria-label="`Read article: ${related.title}`"><div class="continue-story-thumb"><img :src="related.imageUrl" :alt="related.title" loading="lazy"></div></a>
                                <div class="continue-story-copy"><p class="continue-story-category">{{ related.category }}</p><h3><a :href="related.url" class="continue-story-title">{{ related.title }}</a></h3><p class="continue-story-excerpt">{{ related.excerpt || 'Read more from The Lens.' }}</p><div class="continue-story-meta"><span><i class="fa-regular fa-clock mr-1" aria-hidden="true"></i>{{ related.readMinutes }} min read</span><span>{{ related.publishedAt }}</span></div></div>
                            </article>
                        </div>
                    </section>
                </article>
            </div>
        </div>
    </PublicLayout>
</template>
