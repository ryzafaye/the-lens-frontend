<script setup>
import { RouterLink as Link } from 'vue-router';

defineProps({
    article: { type: Object, required: true },
    featured: { type: Boolean, default: false },
});
</script>

<template>
    <article class="story-card" :data-article-id="article.id">
        <Link :to="article.url" class="story-card-image-trigger article-clickable" :aria-label="`Read article: ${article.title}`">
            <div class="article-image story-card-image">
                <img :src="article.imageUrl" :alt="article.title" loading="lazy">
            </div>
        </Link>
        <div class="article-meta">
            <span class="article-category-label">{{ article.category }}</span>
            <span class="article-meta-separator" aria-hidden="true">·</span>
            <time>{{ article.publishedAt }}</time>
        </div>
        <h3 class="story-card-title">
            <Link :to="article.url" class="article-title-button">{{ article.title }}</Link>
        </h3>
        <p class="story-card-excerpt">{{ article.excerpt }}</p>
        <p class="article-byline text-xs">
            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
            <span>By <Link v-if="article.author" :to="article.authorUrl" class="author-profile-link">{{ article.author }}</Link><strong v-else>The Lens Staff</strong></span>
        </p>
        <div class="article-stats text-xs">
            <span class="article-view-count"><i class="fa-regular fa-eye" aria-hidden="true"></i> <span>{{ article.views.toLocaleString() }}</span></span>
            <span class="article-read-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> <span>{{ article.readMinutes }} min read</span></span>
        </div>
    </article>
</template>
