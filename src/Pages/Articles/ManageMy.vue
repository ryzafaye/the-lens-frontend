<script setup>
import { computed, ref } from 'vue';
import { apiRequest } from '../../services/api.js';
import { appState } from '../../state/appState.js';
import { router } from '../../router/index.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({
    portal: { type: String, required: true },
    articles: { type: Array, default: () => [] },
});

const search = ref('');
const statusFilter = ref('all');
const filteredArticles = computed(() => props.articles.filter((article) => {
    const query = search.value.trim().toLowerCase();
    const matchesQuery = !query || [article.title, article.category, article.status, article.excerpt].some((value) => String(value ?? '').toLowerCase().includes(query));
    const matchesStatus = statusFilter.value === 'all' || String(article.status ?? '').toLowerCase() === statusFilter.value;
    return matchesQuery && matchesStatus;
}));

function canEdit(article) {
    return ['draft', 'for revision'].includes(String(article.status ?? '').toLowerCase());
}

function editUrl(article) {
    return `/${props.portal}/submit-article?draft_id=${encodeURIComponent(article.id)}`;
}

async function removeDraft(article) {
    if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
    try {
        await apiRequest(`/${props.portal}/drafts/${article.id}`, { method: 'DELETE' });
        await router.reload({ preserveScroll: true });
    } catch (error) {
        appState.error = error.response?.data?.message ?? 'The draft could not be deleted.';
    }
}
</script>

<template>
    <AdminLayout title="Manage My Articles">
        <section class="my-articles-page">
            <header class="my-articles-header"><div><p class="my-articles-eyebrow">MY WORKSPACE</p><h1>Manage My Articles</h1><p>Review your drafts, submissions, and published stories.</p></div><RouterLink :to="`/${portal}/submit-article`" class="my-articles-create"><i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> New Article</RouterLink></header>
            <div class="my-articles-toolbar"><label class="my-articles-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input v-model="search" type="search" placeholder="Search by title, category, or status" aria-label="Search your articles"></label><label class="my-articles-filter"><span>Status</span><select v-model="statusFilter"><option value="all">All statuses</option><option value="draft">Draft</option><option value="for revision">For revision</option><option value="pending review">Pending review</option><option value="pending eic review">Pending EIC review</option><option value="published">Published</option></select></label><span class="my-articles-count">{{ filteredArticles.length }} {{ filteredArticles.length === 1 ? 'article' : 'articles' }}</span></div>
            <div v-if="filteredArticles.length" class="my-articles-list"><article v-for="article in filteredArticles" :key="article.id" class="my-article-card"><div class="my-article-main"><div class="my-article-topline"><span class="my-article-category">{{ article.category || 'General' }}</span><span class="my-article-status" :class="`status-${String(article.status ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`">{{ article.status }}</span></div><h2>{{ article.title }}</h2><p v-if="article.excerpt" class="my-article-excerpt">{{ article.excerpt }}</p><p v-if="article.remarks" class="my-article-remarks"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i> {{ article.remarks }}</p><div class="my-article-meta"><span><i class="fa-regular fa-calendar" aria-hidden="true"></i> {{ article.date }}</span><span v-if="article.author"><i class="fa-regular fa-user" aria-hidden="true"></i> {{ article.author }}</span><span v-if="article.views !== undefined"><i class="fa-regular fa-eye" aria-hidden="true"></i> {{ Number(article.views).toLocaleString() }} views</span><span v-if="article.shares !== undefined"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {{ Number(article.shares).toLocaleString() }} shares</span></div></div><div class="my-article-actions"><RouterLink v-if="canEdit(article)" :to="editUrl(article)" class="my-article-edit"><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i> Edit</RouterLink><button v-if="canEdit(article)" type="button" class="my-article-delete" @click="removeDraft(article)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i><span class="sr-only">Delete draft</span></button></div></article></div>
            <div v-else class="my-articles-empty"><span><i class="fa-regular fa-folder-open" aria-hidden="true"></i></span><h2>{{ articles.length ? 'No matching articles' : 'No articles yet' }}</h2><p>{{ articles.length ? 'Try another search or status filter.' : 'Your drafts and submissions will appear here.' }}</p><RouterLink v-if="!articles.length" :to="`/${portal}/submit-article`" class="my-articles-create"><i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> Write your first article</RouterLink></div>
        </section>
    </AdminLayout>
</template>

<style scoped>
.my-articles-page { max-width: 1400px; margin: 0 auto; }
.my-articles-header { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:24px; }
.my-articles-eyebrow { margin:0 0 6px; color:#700f2b; font-size:.68rem; font-weight:800; letter-spacing:.13em; }
.my-articles-header h1 { margin:0; color:#251a1e; font-family:'Playfair Display',Georgia,serif; font-size:clamp(1.8rem,3vw,2.4rem); font-weight:800; }
.my-articles-header p:last-child { margin:7px 0 0; color:#667085; font-size:.88rem; }
.my-articles-create { display:inline-flex; align-items:center; justify-content:center; gap:9px; padding:11px 16px; color:#fff; background:linear-gradient(120deg,#700f2b,#8d1337); border:0; border-radius:10px; font-size:.82rem; font-weight:700; text-decoration:none; white-space:nowrap; }
.my-articles-toolbar { display:flex; align-items:center; gap:14px; margin-bottom:16px; padding:14px; background:#fff; border:1px solid #eee6e8; border-radius:12px; }
.my-articles-search { display:flex; align-items:center; gap:9px; flex:1; min-width:170px; color:#8c8587; }
.my-articles-search input { width:100%; padding:9px 0; color:#282124; outline:none; font-size:.84rem; }
.my-articles-filter { display:flex; align-items:center; gap:8px; color:#667085; font-size:.78rem; }
.my-articles-filter select { padding:8px 10px; color:#30282a; background:#fff; border:1px solid #e8e1e3; border-radius:8px; font-size:.8rem; }
.my-articles-count { color:#777176; font-size:.76rem; white-space:nowrap; }
.my-articles-list { display:grid; gap:12px; }
.my-article-card { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 20px; background:#fff; border:1px solid #eee6e8; border-radius:13px; box-shadow:0 3px 12px #3a091407; }
.my-article-main { min-width:0; flex:1; }
.my-article-topline { display:flex; align-items:center; gap:9px; margin-bottom:7px; }
.my-article-category { color:#700f2b; font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
.my-article-status { padding:4px 8px; color:#475467; background:#f2f4f7; border-radius:999px; font-size:.65rem; font-weight:800; text-transform:capitalize; }
.status-published { color:#047857; background:#ecfdf5; }.status-draft { color:#75510b; background:#fff7df; }.status-for-revision { color:#9a3412; background:#fff7ed; }.status-pending-review,.status-pending-eic-review { color:#1d4ed8; background:#eff6ff; }
.my-article-card h2 { margin:0; overflow-wrap:anywhere; color:#261d20; font-family:'Playfair Display',Georgia,serif; font-size:1.12rem; font-weight:700; }
.my-article-excerpt { margin:7px 0 0; color:#6b6466; font-size:.82rem; line-height:1.5; }
.my-article-remarks { margin:10px 0 0; padding:9px 11px; color:#7a3a11; background:#fff7ed; border-radius:8px; font-size:.78rem; }
.my-article-meta { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; color:#8c8587; font-size:.72rem; }
.my-article-meta span { display:inline-flex; align-items:center; gap:5px; }
.my-article-actions { display:flex; align-items:center; gap:7px; }
.my-article-edit,.my-article-delete { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:7px 10px; color:#700f2b; background:#fff; border:1px solid #eadde2; border-radius:8px; font-size:.74rem; font-weight:700; text-decoration:none; cursor:pointer; }
.my-article-delete { width:34px; color:#b42318; }
.my-articles-empty { display:flex; flex-direction:column; align-items:center; gap:9px; padding:55px 18px; color:#736b6e; background:#fff; border:1px dashed #dfd5d9; border-radius:14px; text-align:center; }
.my-articles-empty > span { display:grid; place-items:center; width:48px; height:48px; color:#700f2b; background:#f9eef2; border-radius:50%; font-size:1.2rem; }
.my-articles-empty h2 { margin:0; color:#2c2426; font-family:'Playfair Display',Georgia,serif; font-size:1.2rem; }
.my-articles-empty p { margin:0 0 8px; font-size:.84rem; }
@media (max-width:650px) { .my-articles-header { align-items:flex-start; flex-direction:column; }.my-articles-toolbar { align-items:stretch; flex-wrap:wrap; }.my-articles-search { flex-basis:100%; }.my-articles-filter { flex:1; }.my-article-card { flex-direction:column; }.my-article-actions { align-self:flex-end; } }
</style>
