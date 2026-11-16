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
        <template v-if="copied">
            <i class="fa-solid fa-check text-emerald-600" aria-hidden="true"></i>
            <span class="text-emerald-700 font-medium">Copied!</span>
        </template>
        <template v-else>
            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
            <span>Share</span>
            <span class="share-count" :data-share-count="articleId">{{ count }}</span>
        </template>
    </button>
</template>
