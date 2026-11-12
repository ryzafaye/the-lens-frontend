<script setup>
import { computed, ref } from 'vue';
import PageHead from '../../Components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, articles: { type: Array, default: () => [] }, approvedCovers: { type: Array, default: () => [] }, counts: { type: Object, default: () => ({}) } });
const tab = ref('ready');
const query = ref('');
const selected = ref(null);
const revisionArticle = ref(null);
const remarks = ref('');
const coverSelections = ref({});
const notice = ref('');
const busy = ref(false);
const filteredArticles = computed(() => props.articles.filter((article) => article.status === tab.value && `${article.title} ${article.author} ${article.category}`.toLowerCase().includes(query.value.trim().toLowerCase())));

async function action(url, data = {}) {
    busy.value = true;
    notice.value = '';
    try {
        const response = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message ?? 'The change could not be saved.');
        notice.value = result.message ?? 'Saved.';
        revisionArticle.value = null;
        remarks.value = '';
        router.reload({ only: ['articles', 'approvedCovers', 'counts'], preserveScroll: true });
    } catch (error) { notice.value = error.message; }
    finally { busy.value = false; }
}
function publish(article) {
    const coverId = coverSelections.value[article.id] || article.assignedCoverId;
    if (!window.confirm(`Publish “${article.title}”${coverId ? ' with its selected cover' : ''}?`)) return;
    action(`/mpc/articles/${article.id}/publish`, coverId ? { cover_id: coverId } : {});
}
function unpublish(article) {
    if (!window.confirm(`Unpublish “${article.title}”?`)) return;
    action(`/mpc/articles/${article.id}/unpublish`);
}
function assignCover(article) {
    const coverId = coverSelections.value[article.id];
    if (!coverId) { notice.value = 'Choose an approved cover first.'; return; }
    action(`/mpc/articles/${article.id}/assign-cover`, { cover_id: coverId });
}
function returnForRevision() {
    if (!revisionArticle.value || !remarks.value.trim()) { notice.value = 'Add a note explaining what needs revision.'; return; }
    action(`/mpc/articles/${revisionArticle.value.id}/revision`, { remarks: remarks.value });
}
function cleanText(value) { return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
</script>

<template>
    <AdminLayout title="Publish Article">
        <PageHead>
            <link rel="stylesheet" href="/css/mpc-publish-article.css">
            <link rel="stylesheet" href="/css/executive-manage-articles.css">
        </PageHead>
        <main class="publish-page"><header class="publish-header"><div><p class="publish-eyebrow">PUBLICATION RELEASE</p><h1>Publish Article</h1><p>Prepare approved stories for the public site and manage published releases.</p></div><label class="publish-search"><i class="fa-solid fa-magnifying-glass"></i><input v-model="query" type="search" placeholder="Search articles" aria-label="Search articles"></label></header>
            <p v-if="notice" class="publish-notice" role="status">{{ notice }}</p>
            <nav class="publish-tabs" aria-label="Publication workflow"><button v-for="option in [['ready','Ready to publish',counts.ready],['published','Published',counts.published],['unpublished','Unpublished',counts.unpublished],['covers','Approved covers',counts.covers]]" :key="option[0]" type="button" :class="{ active: tab === option[0] }" @click="tab = option[0]">{{ option[1] }} <span>{{ option[2] ?? (option[0] === 'covers' ? approvedCovers.length : 0) }}</span></button></nav>
            <section v-if="tab === 'covers'" class="publish-covers"><article v-for="cover in approvedCovers" :key="cover.id" class="publish-cover"><img :src="cover.image" :alt="cover.title"><div><strong>{{ cover.title }}</strong><span>{{ cover.artist }} · {{ cover.date }}</span><small>{{ cover.isCover ? 'Assigned to an article' : 'Available' }}</small></div></article><div v-if="!approvedCovers.length" class="publish-empty">No approved covers are available yet.</div></section>
            <section v-else-if="filteredArticles.length" class="publish-grid"><article v-for="article in filteredArticles" :key="article.id" class="publish-card"><div class="publish-card-meta"><span>{{ article.category }}</span><small>{{ article.dateApproved }}</small></div><img v-if="article.coverImage" class="publish-card-cover" :src="article.coverImage" :alt="`Cover for ${article.title}`"><h2>{{ article.title }}</h2><p class="publish-excerpt">{{ cleanText(article.excerpt) }}</p><div class="publish-byline">{{ article.author }}<span> · </span>{{ article.readTime }}</div><label v-if="tab === 'ready' || tab === 'published'" class="publish-cover-choice">Cover<select v-model="coverSelections[article.id]"><option value="">{{ article.assignedCoverId ? 'Keep current cover' : 'No cover selected' }}</option><option v-for="cover in approvedCovers" :key="cover.id" :value="cover.id">{{ cover.title }} · {{ cover.artist }}</option></select></label><div class="publish-actions"><button type="button" class="publish-read" @click="selected = article">Read story</button><button v-if="tab === 'ready'" type="button" class="publish-return" @click="revisionArticle = article; remarks = ''">Return to EIC</button><button v-if="tab === 'ready'" type="button" class="publish-primary" :disabled="busy" @click="publish(article)">Publish</button><button v-else-if="tab === 'published'" type="button" class="publish-return" :disabled="busy" @click="unpublish(article)">Unpublish</button><button v-if="coverSelections[article.id] && tab !== 'unpublished'" type="button" class="publish-read" :disabled="busy" @click="assignCover(article)">Assign cover</button></div></article></section>
            <div v-else class="publish-empty"><i class="fa-regular fa-newspaper"></i><h2>No articles in this queue</h2><p>Stories will appear here as they move through editorial review.</p></div>
        </main>
        <div v-if="selected" class="publish-overlay" @click.self="selected = null"><section class="publish-dialog" role="dialog" aria-modal="true"><header><div><span>{{ selected.category }} · {{ selected.author }}</span><h2>{{ selected.title }}</h2></div><button type="button" aria-label="Close" @click="selected = null">×</button></header><p>{{ cleanText(selected.excerpt) }}</p><div class="publish-body">{{ cleanText(selected.body) }}</div></section></div>
        <div v-if="revisionArticle" class="publish-overlay" @click.self="revisionArticle = null"><section class="publish-dialog revision-dialog" role="dialog" aria-modal="true"><header><div><span>RETURN TO EDITOR-IN-CHIEF</span><h2>{{ revisionArticle.title }}</h2></div><button type="button" aria-label="Close" @click="revisionArticle = null">×</button></header><label>Revision note<textarea v-model="remarks" rows="5" placeholder="Explain what the story needs before publication."></textarea></label><footer><button type="button" @click="revisionArticle = null">Cancel</button><button type="button" :disabled="busy" @click="returnForRevision">{{ busy ? 'Sending…' : 'Send for revision' }}</button></footer></section></div>
    </AdminLayout>
</template>

<style scoped>
.publish-page{max-width:1450px;margin:0 auto}.publish-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.publish-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.publish-header h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.publish-header p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.publish-search{display:flex;align-items:center;gap:8px;width:min(300px,45vw);padding:10px 12px;color:#82797c;background:#fff;border:1px solid #eee6e8;border-radius:9px}.publish-search input{width:100%;border:0;outline:0;font-size:.8rem}.publish-notice{padding:10px 13px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;font-size:.82rem}.publish-tabs{display:flex;gap:7px;overflow:auto;margin-bottom:16px;padding:5px;background:#f3edef;border-radius:10px}.publish-tabs button{display:flex;align-items:center;gap:8px;padding:9px 12px;color:#71686b;background:transparent;border:0;border-radius:7px;font-size:.73rem;font-weight:800;white-space:nowrap;cursor:pointer}.publish-tabs button.active{color:#700f2b;background:#fff;box-shadow:0 2px 7px #2b0a140d}.publish-tabs span{display:grid;place-items:center;min-width:21px;height:21px;padding:0 5px;color:#700f2b;background:#f9eef2;border-radius:99px;font-size:.63rem}.publish-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px}.publish-card{padding:16px;background:#fff;border:1px solid #eee6e8;border-radius:13px;box-shadow:0 4px 15px #3a091409}.publish-card-meta{display:flex;justify-content:space-between;gap:8px;color:#700f2b;font-size:.68rem;font-weight:800}.publish-card-meta small{color:#847b7e;font-weight:500}.publish-card-cover{width:100%;height:145px;margin:12px 0 2px;object-fit:cover;border-radius:8px;background:#f4f1f2}.publish-card h2{margin:12px 0 6px;color:#2b2225;font:700 1.08rem/1.35 'Playfair Display',Georgia,serif}.publish-excerpt{display:-webkit-box;overflow:hidden;margin:0;color:#6f6769;font-size:.78rem;line-height:1.5;-webkit-line-clamp:3;-webkit-box-orient:vertical}.publish-byline{margin:10px 0;color:#82797c;font-size:.72rem}.publish-cover-choice{display:grid;gap:5px;margin:10px 0;color:#4b4245;font-size:.72rem;font-weight:800}.publish-cover-choice select{padding:8px;color:#30282a;background:#fff;border:1px solid #e4dadd;border-radius:8px;font-size:.72rem}.publish-actions{display:flex;flex-wrap:wrap;gap:6px;padding-top:11px;border-top:1px solid #f0ebed}.publish-actions button,.publish-dialog footer button{padding:8px 10px;color:#700f2b;background:#fff;border:1px solid #eadde2;border-radius:8px;font-size:.69rem;font-weight:800;cursor:pointer}.publish-actions .publish-return{color:#9a3412;background:#fff7ed;border-color:#fed7aa}.publish-actions .publish-primary,.publish-dialog footer button:last-child{color:#fff;background:#700f2b;border-color:#700f2b}.publish-actions button:disabled,.publish-dialog footer button:disabled{opacity:.6}.publish-covers{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.publish-cover{display:grid;gap:9px;padding:12px;background:#fff;border:1px solid #eee6e8;border-radius:11px}.publish-cover img{width:100%;height:150px;object-fit:contain;background:#f6f4f5;border-radius:8px}.publish-cover div{display:grid;gap:4px}.publish-cover strong{color:#302629;font-size:.8rem}.publish-cover span,.publish-cover small{color:#81797b;font-size:.68rem}.publish-cover small{color:#047857}.publish-empty{display:grid;justify-items:center;padding:50px 18px;color:#736b6e;background:#fff;border:1px dashed #dfd5d9;border-radius:14px;text-align:center}.publish-empty i{color:#700f2b;font-size:1.8rem}.publish-empty h2{margin:10px 0 4px;color:#2d2427;font:700 1.15rem 'Playfair Display',Georgia,serif}.publish-empty p{margin:0;font-size:.82rem}.publish-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:#16101688}.publish-dialog{width:min(850px,100%);max-height:88vh;overflow:auto;padding:22px;background:#fff;border-radius:14px;box-shadow:0 18px 60px #0003}.publish-dialog header{display:flex;justify-content:space-between;gap:12px}.publish-dialog header span{color:#700f2b;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.publish-dialog h2{margin:5px 0;color:#2b2225;font:700 1.35rem/1.35 'Playfair Display',Georgia,serif}.publish-dialog header button{width:32px;height:32px;border:0;border-radius:50%;font-size:1.3rem;cursor:pointer}.publish-dialog>p{color:#6f6769;font-weight:600}.publish-body{color:#393033;font-size:.9rem;line-height:1.8;white-space:pre-wrap}.revision-dialog label{display:grid;gap:7px;margin-top:16px;color:#41383b;font-size:.78rem;font-weight:800}.revision-dialog textarea{padding:10px;border:1px solid #ddd3d7;border-radius:8px;font:400 .84rem/1.5 'DM Sans',sans-serif}.revision-dialog footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}@media(max-width:650px){.publish-header{align-items:flex-start;flex-direction:column}.publish-search{width:100%}}
</style>
