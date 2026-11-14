<script setup>
import { computed, ref } from 'vue';
import PageHead from '../../components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, kind: { type: String, required: true }, items: { type: Array, default: () => [] }, isSectionHead: { type: Boolean, default: false } });
const query = ref('');
const filter = ref('all');
const revisionItem = ref(null);
const remarks = ref('');
const notice = ref('');
const busy = ref(false);
const isDesk = computed(() => ['desk', 'cartoon-desk'].includes(props.kind));
const pageTitle = computed(() => ({ desk: 'Media Desk', library: 'Manage Media', cartoons: 'Manage Cartoons', 'cartoon-desk': 'Cartoon Desk' })[props.kind] ?? 'Manage Media');
const submitHref = computed(() => `/${props.portal}/${props.kind === 'cartoons' || props.kind === 'cartoon-desk' ? 'submit-cartoon' : 'submit-media'}`);
const filteredItems = computed(() => props.items.filter((item) => {
    const matchesText = `${item.title} ${item.caption} ${item.artist} ${item.connectedArticleTitle}`.toLowerCase().includes(query.value.trim().toLowerCase());
    const normalizedStatus = String(item.status ?? '').toLowerCase();
    const matchesStatus = filter.value === 'all' || (filter.value === 'pending' ? normalizedStatus.includes('pending') : filter.value === 'revision' ? normalizedStatus.includes('revision') : filter.value === 'approved' ? normalizedStatus.includes('approved') || normalizedStatus.includes('published') : normalizedStatus === filter.value);
    return matchesText && matchesStatus;
}));
function canReview(item) {
    const status = String(item.status ?? '').toLowerCase();
    if (props.kind === 'cartoon-desk') return status.includes('pending');
    return props.portal === 'eic' ? status === 'pending eic review' : status === 'pending with head';
}

async function postAction(url, data = {}) {
    busy.value = true;
    notice.value = '';
    try {
        const response = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message ?? 'The media item could not be updated.');
        notice.value = result.message ?? 'Media updated.';
        revisionItem.value = null;
        remarks.value = '';
        router.reload({ only: ['items'], preserveScroll: true });
    } catch (error) { notice.value = error.message; }
    finally { busy.value = false; }
}
function approveOrEndorse(item) {
    const endpoint = props.kind === 'cartoon-desk'
        ? `/cartoonist/cartoons/${item.id}/endorse`
        : `/${props.portal}/media/${item.id}/${props.portal === 'eic' ? 'approve' : 'endorse'}`;
    postAction(endpoint);
}
function returnItem() {
    if (!revisionItem.value || !remarks.value.trim()) { notice.value = 'Add a note explaining what needs to change.'; return; }
    const endpoint = props.kind === 'cartoon-desk'
        ? `/cartoonist/cartoons/${revisionItem.value.id}/revision`
        : `/${props.portal}/media/${revisionItem.value.id}/revision`;
    postAction(endpoint, { remarks: remarks.value });
}
</script>

<template>
    <AdminLayout :title="pageTitle">
        <PageHead>
            <link rel="stylesheet" href="/css/executive-cover-review.css">
            <link rel="stylesheet" href="/css/media-manage-media.css">
        </PageHead>
        <main class="media-page"><header class="media-heading"><div><p class="media-eyebrow">{{ isDesk ? 'EDITORIAL REVIEW' : 'VISUAL LIBRARY' }}</p><h1>{{ pageTitle }}</h1><p>{{ isDesk ? 'Review artwork and share clear direction with contributors.' : 'Browse visual submissions and check their review status.' }}</p></div><RouterLink v-if="!isDesk" :to="submitHref" class="media-submit"><i :class="kind === 'cartoons' ? 'fa-solid fa-paintbrush' : 'fa-solid fa-camera'"></i>{{ kind === 'cartoons' ? 'Submit Cartoon' : 'Submit Media' }}</RouterLink></header>
            <p v-if="notice" class="media-notice" role="status">{{ notice }}</p>
            <div class="media-toolbar"><input v-model="query" type="search" placeholder="Search by title, contributor, or article" aria-label="Search visual submissions"><select v-model="filter" aria-label="Filter by review status"><option value="all">All statuses</option><option value="pending">Pending review</option><option value="revision">For revision</option><option value="approved">Approved or published</option></select><span>{{ filteredItems.length }} items</span></div>
            <section v-if="filteredItems.length" class="media-grid"><article v-for="item in filteredItems" :key="item.id" class="media-card"><a class="media-image-frame" :href="item.image" target="_blank" rel="noopener noreferrer"><img :src="item.image" :alt="item.title || 'Submitted visual artwork'"></a><div class="media-card-body"><div class="media-card-meta"><span class="media-type">{{ item.type || 'Visual' }}</span><span class="media-status" :class="{ pending: String(item.status).toLowerCase().includes('pending'), revision: String(item.status).toLowerCase().includes('revision'), approved: String(item.status).toLowerCase().includes('approved') || String(item.status).toLowerCase() === 'published' }">{{ item.status }}</span></div><h2>{{ item.title || 'Untitled visual' }}</h2><p v-if="item.caption" class="media-caption">{{ item.caption }}</p><p class="media-byline"><i class="fa-regular fa-user"></i> {{ item.artist || item.author }} · {{ item.date }}</p><p v-if="item.remarks" class="media-remarks"><strong>Revision note</strong>{{ item.remarks }}</p><p v-if="item.connectedArticleTitle" class="media-connected">Cover for: {{ item.connectedArticleTitle }}</p><div v-if="isDesk && canReview(item)" class="media-actions"><button type="button" class="media-return" :disabled="busy" @click="revisionItem = item; remarks = ''">Return for revision</button><button type="button" class="media-approve" :disabled="busy" @click="approveOrEndorse(item)">{{ kind === 'cartoon-desk' || portal === 'mpc' ? 'Endorse to EIC' : 'Approve to library' }}</button></div></div></article></section>
            <div v-else class="media-empty"><i class="fa-regular fa-images"></i><h2>{{ items.length ? 'No matching submissions' : 'No submissions yet' }}</h2><p>{{ isDesk ? 'Artwork waiting for review will appear here.' : 'Visual assets will appear here when submitted.' }}</p></div>
        </main>
        <div v-if="revisionItem" class="media-overlay" @click.self="revisionItem = null"><section class="media-dialog" role="dialog" aria-modal="true"><header><h2>Return “{{ revisionItem.title }}”</h2><button type="button" aria-label="Close" @click="revisionItem = null">×</button></header><p>Tell the contributor what needs revision.</p><textarea v-model="remarks" rows="5" autofocus></textarea><footer><button type="button" @click="revisionItem = null">Cancel</button><button type="button" :disabled="busy" @click="returnItem">{{ busy ? 'Sending…' : 'Send revision note' }}</button></footer></section></div>
    </AdminLayout>
</template>

<style scoped>
.media-page{max-width:1450px;margin:0 auto}.media-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:20px}.media-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.media-heading h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.media-heading p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.media-submit{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;color:#fff;background:#700f2b;border-radius:9px;text-decoration:none;font-size:.78rem;font-weight:800}.media-notice{padding:10px 13px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;font-size:.82rem}.media-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:#fff;border:1px solid #eee6e8;border-radius:10px}.media-toolbar input{flex:1;min-width:150px;padding:9px;border:0;outline:0;font-size:.82rem}.media-toolbar select{padding:9px 10px;color:#30282a;background:#fff;border:1px solid #e4dadd;border-radius:8px;font-size:.76rem}.media-toolbar span{color:#82797c;font-size:.72rem;white-space:nowrap}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:15px}.media-card{overflow:hidden;background:#fff;border:1px solid #eee6e8;border-radius:13px;box-shadow:0 4px 15px #3a091409}.media-image-frame{display:grid;place-items:center;height:210px;padding:10px;background:#f7f6f7;border-bottom:1px solid #f0ebed}.media-image-frame img{max-width:100%;max-height:100%;object-fit:contain}.media-card-body{padding:15px}.media-card-meta{display:flex;justify-content:space-between;align-items:center;gap:8px}.media-type,.media-status{padding:4px 8px;border-radius:99px;font-size:.64rem;font-weight:800;text-transform:capitalize}.media-type{color:#700f2b;background:#f9eef2}.media-status{color:#667085;background:#f2f4f7}.media-status.pending{color:#1d4ed8;background:#eff6ff}.media-status.revision{color:#9a3412;background:#fff7ed}.media-status.approved{color:#047857;background:#ecfdf5}.media-card h2{margin:10px 0 5px;color:#2b2225;font:700 1rem 'Playfair Display',Georgia,serif}.media-caption,.media-byline,.media-connected{margin:5px 0;color:#736b6e;font-size:.74rem;line-height:1.45}.media-byline{color:#8b8385}.media-remarks{display:grid;gap:3px;margin:10px 0;padding:9px;color:#7a3a11;background:#fff7ed;border-radius:8px;font-size:.72rem}.media-actions{display:flex;gap:7px;margin-top:12px}.media-actions button,.media-dialog footer button{flex:1;padding:9px 10px;color:#700f2b;background:#fff;border:1px solid #eadde2;border-radius:8px;font-size:.7rem;font-weight:800;cursor:pointer}.media-actions .media-return{color:#9a3412;background:#fff7ed;border-color:#fed7aa}.media-actions .media-approve,.media-dialog footer button:last-child{color:#fff;background:#700f2b;border-color:#700f2b}.media-actions button:disabled,.media-dialog footer button:disabled{opacity:.6}.media-empty{padding:52px 18px;text-align:center;color:#736b6e;background:#fff;border:1px dashed #dfd5d9;border-radius:14px}.media-empty i{color:#700f2b;font-size:1.8rem}.media-empty h2{margin:10px 0 4px;color:#2d2427;font:700 1.2rem 'Playfair Display',Georgia,serif}.media-empty p{margin:0;font-size:.82rem}.media-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:#16101688}.media-dialog{width:min(510px,100%);padding:20px;background:#fff;border-radius:14px;box-shadow:0 18px 60px #0003}.media-dialog header,.media-dialog footer{display:flex;justify-content:space-between;align-items:center;gap:10px}.media-dialog h2{margin:0;color:#2d2427;font:700 1.1rem 'Playfair Display',Georgia,serif}.media-dialog header button{width:30px;height:30px;border:0;border-radius:50%;font-size:1.2rem;cursor:pointer}.media-dialog p{color:#756c6f;font-size:.8rem}.media-dialog textarea{width:100%;padding:10px;border:1px solid #ddd3d7;border-radius:8px;font:400 .84rem/1.5 'DM Sans',sans-serif}.media-dialog footer{justify-content:flex-end;margin-top:12px}.media-dialog footer button{flex:unset}.media-dialog footer button:last-child{color:#fff}@media(max-width:650px){.media-heading{align-items:flex-start;flex-direction:column}.media-toolbar{flex-wrap:wrap}.media-toolbar input{flex-basis:100%}.media-toolbar select{flex:1}}
</style>
