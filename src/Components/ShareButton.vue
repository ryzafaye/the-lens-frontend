<script setup>
import { ref } from 'vue';
import { apiRequest } from '../services/api.js';

const props = defineProps({
    articleId: { type: Number, required: true },
    articleUrl: { type: String, required: true },
    initialCount: { type: Number, default: 0 },
});

const count = ref(props.initialCount);
const copied = ref(false);

async function copyArticleLink() {
    try {
        await navigator.clipboard.writeText(props.articleUrl);

        const { data } = await apiRequest(`/article/${props.articleId}/share`, { method: 'POST', data: {} });

        if (typeof data.shares === 'number') {
            count.value = data.shares;
        }

        copied.value = true;
        window.setTimeout(() => { copied.value = false; }, 2000);
    } catch {
        copied.value = false;
    }
}
</script>

<template>
    <button type="button" class="article-share-button" :data-copy-article-id="articleId" :data-article-url="articleUrl" :title="copied ? 'Link copied' : 'Copy article link'" @click="copyArticleLink">
        <i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-share-nodes'" aria-hidden="true"></i>
        <span>{{ copied ? 'Copied!' : 'Share' }}</span>
        <span class="share-count" :data-share-count="articleId">{{ count }}</span>
    </button>
</template>
