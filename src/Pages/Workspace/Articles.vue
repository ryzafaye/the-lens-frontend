<script setup>
import { computed, ref } from 'vue';
import PageHead from '../../Components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, articles: { type: Array, default: () => [] }, categories: { type: Array, default: () => [] } });
const query = ref('');
const status = ref('active');
const editor = ref(null);
const busy = ref(false);
const message = ref('');
const filteredArticles = computed(() => props.articles.filter((article) => {
    const matchesStatus = status.value === 'all' || (status.value === 'archived' ? article.isArchived : !article.isArchived);
    const text = `${article.title} ${article.author} ${article.category}`.toLowerCase();
    return matchesStatus && text.includes(query.value.trim().toLowerCase());
}));

async function send(path, method, data = {}) {
    busy.value = true;
    message.value = '';
    try {
        const response = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message ?? 'The change could not be saved.');
        message.value = result.message ?? 'Saved.';
        editor.value = null;
        router.reload({ only: ['articles'], preserveScroll: true });
    } catch (error) {
        message.value = error.message;
    } finally {
        busy.value = false;
    }
}

function saveArticle() {
    if (!editor.value) return;
    send(`/${props.portal}/manage-articles/${editor.value.id}`, 'PUT', editor.value);
}
function toggleArchive(article) {
    const verb = article.isArchived ? 'restore' : 'archive';
    if (!window.confirm(`${article.isArchived ? 'Restore' : 'Archive'} “${article.title}”?`)) return;
    send(`/${props.portal}/manage-articles/${article.id}/${verb}`, 'POST');
}
function deleteArticle(article) {
    if (!window.confirm(`Permanently delete “${article.title}”? This cannot be undone.`)) return;
    send(`/${props.portal}/manage-articles/${article.id}`, 'DELETE');
}
</script>

<template>
    <AdminLayout title="Manage Articles">
        <PageHead>
            <link rel="stylesheet" href="/css/executive-manage-articles.css">
        </PageHead>
        <main class="workspace-page">
            <header class="workspace-header"><div><p class="workspace-eyebrow">PUBLICATION LIBRARY</p><h1>Manage Articles &amp; Archives</h1><p>Review published stories, edit details, and manage archived articles.</p></div></header>
            <p v-if="message" class="workspace-notice" role="status">{{ message }}</p>
            <nav class="workspace-tabs" aria-label="Article status"><button v-for="tab in [['active','Published'],['archived','Archived'],['all','All'] ]" :key="tab[0]" type="button" :class="{ active: status === tab[0] }" @click="status = tab[0]">{{ tab[1] }}</button></nav>
            <div class="workspace-toolbar"><input v-model="query" type="search" aria-label="Search articles" placeholder="Search by title, author, or section"><span>{{ filteredArticles.length }} stories</span></div>
            <section v-if="filteredArticles.length" class="workspace-grid"><article v-for="article in filteredArticles" :key="article.id" class="workspace-card">
                <img v-if="article.image" class="workspace-cover" :src="article.image" alt="Article cover">
                <div class="workspace-card-content"><div class="workspace-card-tags"><span>{{ article.category }}</span><span :class="article.isArchived ? 'tag-muted' : 'tag-good'">{{ article.isArchived ? 'Archived' : 'Published' }}</span></div><h2>{{ article.title }}</h2><p>{{ article.excerpt }}</p><div class="workspace-meta"><span>{{ article.author }}</span><span>{{ article.date }}</span><span>{{ Number(article.views ?? 0).toLocaleString() }} views</span></div><div class="workspace-actions"><button type="button" @click="editor = { ...article }"><i class="fa-regular fa-pen-to-square"></i> Edit</button><button type="button" @click="toggleArchive(article)">{{ article.isArchived ? 'Restore' : 'Archive' }}</button><button type="button" class="danger" @click="deleteArticle(article)">Delete</button></div></div>
            </article></section>
            <div v-else class="workspace-empty"><i class="fa-regular fa-folder-open"></i><h2>No stories found</h2><p>Try changing the search or status filter.</p></div>
        </main>
        <div v-if="editor" class="workspace-overlay" @click.self="editor = null"><section class="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="article-edit-title"><header><h2 id="article-edit-title">Edit article</h2><button type="button" aria-label="Close" @click="editor = null">×</button></header><form @submit.prevent="saveArticle"><label>Headline<input v-model="editor.title" maxlength="255" required></label><label>Section<select v-model="editor.category"><option v-for="category in categories" :key="category.id" :value="category.name">{{ category.name }}</option></select></label><label>Summary<textarea v-model="editor.excerpt" rows="3"></textarea></label><label>Article body<textarea v-model="editor.content" rows="10" required></textarea></label><footer><button type="button" class="secondary" @click="editor = null">Cancel</button><button type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save changes' }}</button></footer></form></section></div>
    </AdminLayout>
</template>

<style scoped>
.workspace-page{max-width:1400px;margin:0 auto}.workspace-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px}.workspace-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.workspace-header h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.workspace-header p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.workspace-tabs{display:flex;gap:6px;margin-bottom:14px;padding:5px;background:#f3edef;border-radius:10px;width:max-content}.workspace-tabs button{padding:9px 14px;color:#71686b;background:transparent;border:0;border-radius:7px;font-weight:700;cursor:pointer}.workspace-tabs button.active{color:#700f2b;background:#fff;box-shadow:0 2px 7px #2b0a140d}.workspace-toolbar{display:flex;align-items:center;gap:14px;margin-bottom:16px;padding:12px 15px;background:#fff;border:1px solid #eee6e8;border-radius:11px}.workspace-toolbar input{flex:1;min-width:0;border:0;outline:0;font-size:.86rem}.workspace-toolbar span,.workspace-meta{color:#82797c;font-size:.74rem;white-space:nowrap}.workspace-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.workspace-card{overflow:hidden;background:#fff;border:1px solid #eee6e8;border-radius:13px;box-shadow:0 4px 16px #3a091409}.workspace-cover{display:block;width:100%;height:170px;object-fit:cover;background:#f4f1f2}.workspace-card-content{padding:17px}.workspace-card-tags,.workspace-meta,.workspace-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px}.workspace-card-tags span{padding:4px 8px;color:#700f2b;background:#f9eef2;border-radius:99px;font-size:.66rem;font-weight:800}.workspace-card-tags .tag-good{color:#047857;background:#ecfdf5}.workspace-card-tags .tag-muted{color:#667085;background:#f2f4f7}.workspace-card h2{margin:10px 0 5px;color:#2a2023;font:700 1.1rem/1.35 'Playfair Display',Georgia,serif}.workspace-card p{display:-webkit-box;overflow:hidden;margin:0;color:#6b6466;font-size:.8rem;line-height:1.5;-webkit-line-clamp:3;-webkit-box-orient:vertical}.workspace-meta{margin:12px 0}.workspace-actions{padding-top:12px;border-top:1px solid #f1ecee}.workspace-actions button,.workspace-dialog footer button{padding:8px 11px;color:#700f2b;background:#fff;border:1px solid #e7d9de;border-radius:8px;font-size:.74rem;font-weight:700;cursor:pointer}.workspace-actions button.danger{color:#b42318}.workspace-notice{padding:11px 14px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;font-size:.85rem}.workspace-empty{padding:50px 18px;color:#736b6e;background:#fff;border:1px dashed #dfd5d9;border-radius:14px;text-align:center}.workspace-empty i{color:#700f2b;font-size:1.7rem}.workspace-empty h2{margin:10px 0 4px;font:700 1.15rem 'Playfair Display',Georgia,serif}.workspace-empty p{margin:0;font-size:.83rem}.workspace-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:#16101688}.workspace-dialog{width:min(680px,100%);max-height:90vh;overflow:auto;padding:21px;background:#fff;border-radius:14px;box-shadow:0 18px 60px #0003}.workspace-dialog header,.workspace-dialog footer{display:flex;justify-content:space-between;align-items:center;gap:10px}.workspace-dialog header h2{margin:0;font:700 1.25rem 'Playfair Display',Georgia,serif}.workspace-dialog header button{width:32px;height:32px;border:0;background:#f5f1f2;border-radius:50%;font-size:1.3rem;cursor:pointer}.workspace-dialog form{display:grid;gap:13px;margin-top:18px}.workspace-dialog label{display:grid;gap:6px;color:#40383b;font-size:.78rem;font-weight:700}.workspace-dialog input,.workspace-dialog textarea,.workspace-dialog select{width:100%;padding:10px;border:1px solid #ddd3d7;border-radius:8px;font:400 .84rem inherit}.workspace-dialog footer{justify-content:flex-end;padding-top:6px}.workspace-dialog footer button:last-child{color:#fff;background:#700f2b;border-color:#700f2b}.workspace-dialog footer button:disabled{opacity:.6}@media(max-width:600px){.workspace-toolbar{flex-wrap:wrap}.workspace-toolbar input{flex-basis:100%}}
</style>
