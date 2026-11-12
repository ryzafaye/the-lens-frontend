<script setup>
import { ref } from 'vue';
import PageHead from '../../Components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, articles: { type: Array, default: () => [] }, sort: { type: String, default: 'newest' } });
const selected = ref(props.articles[0] ?? null);
const editor = ref(selected.value ? { title: selected.value.title, excerpt: selected.value.excerpt ?? '', content: selected.value.content ?? '' } : null);
const remarks = ref('');
const busy = ref(false);
const message = ref('');

function openArticle(article) { selected.value = article; editor.value = { title: article.title, excerpt: article.excerpt ?? '', content: article.content ?? '' }; remarks.value = article.remarks ?? ''; message.value = ''; }
async function saveChanges() {
    if (!selected.value || !editor.value) return;
    busy.value = true;
    try {
        const response = await apiFetch(`/${props.portal}/review-articles/${selected.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor.value) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message ?? 'Could not save article changes.');
        message.value = result.message;
        router.reload({ only: ['articles'], preserveScroll: true });
    } catch (error) { message.value = error.message; }
    finally { busy.value = false; }
}
function approve() {
    if (!selected.value || !window.confirm('Approve this article and send it to the next editorial desk?')) return;
    sendReviewAction('approve', editor.value ?? {});
}
function returnForRevision() {
    if (!selected.value) return;
    if (!remarks.value.trim()) { message.value = 'Add revision feedback before returning the article.'; return; }
    sendReviewAction('revision', { remarks: remarks.value });
}
async function sendReviewAction(action, data) {
    busy.value = true;
    try {
        const response = await apiFetch(`/${props.portal}/review-articles/${selected.value.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message ?? 'The article could not be updated.');
        selected.value = null;
        editor.value = null;
        router.reload({ only: ['articles'], preserveScroll: true });
    } catch (error) { message.value = error.message; }
    finally { busy.value = false; }
}
</script>

<template>
    <AdminLayout title="Review Articles">
        <PageHead><link rel="stylesheet" href="/css/executive-review-articles.css"></PageHead>
        <main class="review-page"><header class="review-heading"><div><p class="review-eyebrow">EDITORIAL DESK</p><h1>Review Articles</h1><p>Read submissions carefully, make edits, and guide writers with clear feedback.</p></div><label class="review-sort">Sort <select :value="sort" @change="router.get(`/${portal}/review-articles`, { sort: $event.target.value }, { preserveState: true, preserveScroll: true })"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></header>
            <p v-if="message" class="review-notice" role="status">{{ message }}</p>
            <div class="review-layout"><nav class="review-list" aria-label="Articles awaiting review"><button v-for="article in articles" :key="article.id" type="button" class="review-list-item" :class="{ selected: selected?.id === article.id }" @click="openArticle(article)"><span class="review-item-top"><span>{{ article.category }}</span><small>{{ article.date }}</small></span><strong>{{ article.title }}</strong><span class="review-item-author">{{ article.author }}<template v-if="article.endorsedBy"> · Endorsed by {{ article.endorsedBy }}</template></span></button><p v-if="!articles.length" class="review-empty-small">There are no articles waiting for review.</p></nav>
                <section v-if="selected && editor" class="review-editor"><div class="review-editor-top"><span class="review-status">{{ selected.status }}</span><span>{{ selected.author }} · {{ selected.date }}</span></div><label>Headline<input v-model="editor.title" maxlength="255"></label><label>Summary<textarea v-model="editor.excerpt" rows="3"></textarea></label><label>Article body<textarea v-model="editor.content" rows="15"></textarea></label><label class="remarks-label">Revision feedback<textarea v-model="remarks" rows="3" placeholder="Explain what needs to change before returning this article."></textarea></label><div class="review-actions"><button type="button" class="review-save" :disabled="busy" @click="saveChanges">{{ busy ? 'Saving…' : 'Save edits' }}</button><button type="button" class="review-return" :disabled="busy" @click="returnForRevision">Return for revision</button><button type="button" class="review-approve" :disabled="busy" @click="approve">Approve article</button></div></section>
                <section v-else class="review-empty"><i class="fa-regular fa-clipboard"></i><h2>{{ articles.length ? 'Choose an article' : 'All caught up' }}</h2><p>{{ articles.length ? 'Select a submission from the list to review it.' : 'New submissions will appear here.' }}</p></section>
            </div>
        </main>
    </AdminLayout>
</template>

<style scoped>
.review-page{max-width:1450px;margin:0 auto}.review-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:20px}.review-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.review-heading h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.review-heading p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.review-sort{display:flex;align-items:center;gap:8px;color:#667085;font-size:.78rem}.review-sort select{padding:9px 11px;background:#fff;border:1px solid #e8e1e3;border-radius:8px}.review-layout{display:grid;grid-template-columns:minmax(250px,340px) minmax(0,1fr);gap:16px;align-items:start}.review-list,.review-editor,.review-empty{background:#fff;border:1px solid #eee6e8;border-radius:13px;box-shadow:0 4px 16px #3a091408}.review-list{overflow:hidden}.review-list-item{display:grid;gap:7px;width:100%;padding:14px;text-align:left;background:#fff;border:0;border-bottom:1px solid #f0ebed;cursor:pointer}.review-list-item:hover,.review-list-item.selected{background:#fbf5f7}.review-item-top{display:flex;justify-content:space-between;gap:8px;color:#700f2b;font-size:.67rem;font-weight:800;text-transform:uppercase}.review-item-top small,.review-item-author{color:#847b7e;font-size:.69rem;font-weight:500;text-transform:none}.review-list-item strong{color:#2f2528;font:700 .95rem/1.35 'Playfair Display',Georgia,serif}.review-editor{display:grid;gap:13px;padding:20px}.review-editor-top{display:flex;justify-content:space-between;gap:10px;color:#847b7e;font-size:.74rem}.review-status{padding:4px 8px;color:#1d4ed8;background:#eff6ff;border-radius:99px;font-weight:800}.review-editor label{display:grid;gap:6px;color:#383033;font-size:.8rem;font-weight:800}.review-editor input,.review-editor textarea{width:100%;padding:10px 11px;color:#2d2527;background:#fff;border:1px solid #ddd3d7;border-radius:8px;font:400 .85rem/1.55 'DM Sans',sans-serif}.review-editor textarea{resize:vertical}.review-editor .remarks-label{margin-top:4px;color:#7a3a11}.review-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding-top:6px}.review-actions button{padding:10px 13px;border:1px solid #e4d8dc;border-radius:8px;background:#fff;color:#700f2b;font-size:.76rem;font-weight:800;cursor:pointer}.review-actions .review-return{color:#9a3412;background:#fff7ed;border-color:#fed7aa}.review-actions .review-approve{color:#fff;background:#700f2b;border-color:#700f2b}.review-actions button:disabled{opacity:.65}.review-empty{display:grid;place-content:center;min-height:350px;padding:30px;text-align:center;color:#736b6e}.review-empty i{color:#700f2b;font-size:1.8rem}.review-empty h2{margin:10px 0 4px;color:#2c2426;font:700 1.15rem 'Playfair Display',Georgia,serif}.review-empty p{margin:0;font-size:.82rem}.review-empty-small{padding:16px;color:#847b7e;font-size:.8rem}.review-notice{padding:11px 14px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;font-size:.85rem}@media(max-width:850px){.review-layout{grid-template-columns:1fr}.review-list{max-height:290px;overflow:auto}.review-heading{align-items:flex-start;flex-direction:column}}
</style>
