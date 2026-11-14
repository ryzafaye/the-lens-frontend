<script setup>
import { computed, onMounted, ref } from 'vue';
import { useApiForm } from '../../composables/useApiForm.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({
    portal: { type: String, required: true },
    categories: { type: Array, default: () => [] },
    drafts: { type: Array, default: () => [] },
    editingDraft: { type: Object, default: null },
});

const form = useApiForm({
    article_id: props.editingDraft?.id ?? '',
    title: props.editingDraft?.title ?? '',
    category_id: props.editingDraft?.categoryId ?? '',
    excerpt: props.editingDraft?.excerpt ?? '',
    content: props.editingDraft?.content ?? '',
    status: 'Pending Review',
});
const editorSurface = ref(null);
const wordCount = computed(() => form.content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).filter(Boolean).length);

function sanitizeEditorContent(value) {
    const source = String(value ?? '');
    if (!/<\/?[a-z][^>]*>/i.test(source)) {
        return source.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');
    }
    const parsed = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
    const clean = document.createElement('div');
    const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI']);
    const copyChildren = (sourceNode, targetNode) => {
        for (const child of sourceNode.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                targetNode.append(document.createTextNode(child.textContent ?? ''));
                continue;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            const element = allowedTags.has(child.tagName) ? document.createElement(child.tagName.toLowerCase()) : targetNode;
            if (element !== targetNode) targetNode.append(element);
            copyChildren(child, element);
        }
    };
    copyChildren(parsed.body.firstElementChild ?? parsed.body, clean);
    return clean.innerHTML;
}

onMounted(() => {
    form.content = sanitizeEditorContent(form.content);
    if (editorSurface.value) editorSurface.value.innerHTML = form.content;
});

function updateContent() {
    form.content = sanitizeEditorContent(editorSurface.value?.innerHTML ?? '');
}

function applyFormat(command, value = null) {
    editorSurface.value?.focus();
    document.execCommand(command, false, value);
    updateContent();
}

function submit(status) {
    updateContent();
    form.status = status;
    form.post(`/${props.portal}/submit-article`, { preserveScroll: true });
}
</script>

<template>
    <AdminLayout :title="editingDraft ? 'Edit Article' : 'Submit Article'">
        <main class="article-composer">
            <header class="composer-header"><div><p class="composer-eyebrow">THE LENS NEWSROOM</p><h1>{{ editingDraft ? 'Edit your draft' : 'Submit an article' }}</h1><p>Write a clear, accurate story for the PUP Biñan campus community.</p></div><RouterLink :to="`/${portal}/manage-my-articles`" class="composer-back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> My articles</RouterLink></header>
            <div v-if="editingDraft?.remarks" class="composer-revision-note"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><div><strong>Revision feedback</strong><p>{{ editingDraft.remarks }}</p></div></div>
            <div class="composer-layout">
                <form class="composer-form" @submit.prevent="submit('Pending Review')">
                    <input type="hidden" name="article_id" :value="form.article_id">
                    <div class="composer-field"><label for="article-title">Headline <span>*</span></label><input id="article-title" v-model="form.title" type="text" name="title" maxlength="255" required placeholder="Write a clear, specific headline"><p v-if="form.errors.title" class="composer-error">{{ form.errors.title }}</p></div>
                    <div class="composer-field"><label for="article-category">Section <span>*</span></label><select id="article-category" v-model="form.category_id" name="category_id" required><option value="" disabled>Select a section</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select><p v-if="form.errors.category_id" class="composer-error">{{ form.errors.category_id }}</p></div>
                    <div class="composer-field"><div class="composer-label-row"><label for="article-excerpt">Summary <span>*</span></label><span>{{ form.excerpt.length }} / 255</span></div><textarea id="article-excerpt" v-model="form.excerpt" name="excerpt" maxlength="255" rows="3" required placeholder="In one or two sentences, tell readers what this article covers."></textarea><p v-if="form.errors.excerpt" class="composer-error">{{ form.errors.excerpt }}</p></div>
                    <div class="composer-field"><div class="composer-label-row"><label id="article-content-label">Article body <span>*</span></label><span>{{ wordCount }} words</span></div><div class="composer-toolbar" role="toolbar" aria-label="Article formatting"><button type="button" aria-label="Bold" title="Bold" @mousedown.prevent @click="applyFormat('bold')"><i class="fa-solid fa-bold"></i></button><button type="button" aria-label="Italic" title="Italic" @mousedown.prevent @click="applyFormat('italic')"><i class="fa-solid fa-italic"></i></button><button type="button" aria-label="Underline" title="Underline" @mousedown.prevent @click="applyFormat('underline')"><i class="fa-solid fa-underline"></i></button><span></span><button type="button" title="Heading 2" @mousedown.prevent @click="applyFormat('formatBlock', '<h2>')">H2</button><button type="button" title="Heading 3" @mousedown.prevent @click="applyFormat('formatBlock', '<h3>')">H3</button><button type="button" aria-label="Quote" title="Quote" @mousedown.prevent @click="applyFormat('formatBlock', '<blockquote>')"><i class="fa-solid fa-quote-left"></i></button><span></span><button type="button" aria-label="Bullet list" title="Bullet list" @mousedown.prevent @click="applyFormat('insertUnorderedList')"><i class="fa-solid fa-list-ul"></i></button><button type="button" aria-label="Numbered list" title="Numbered list" @mousedown.prevent @click="applyFormat('insertOrderedList')"><i class="fa-solid fa-list-ol"></i></button></div><div id="article-content" ref="editorSurface" class="composer-editor" contenteditable="true" role="textbox" aria-labelledby="article-content-label" aria-multiline="true" spellcheck="true" data-placeholder="Begin your story here. Use clear paragraphs, verify names and details, and include relevant context." @input="updateContent"></div><p v-if="form.errors.content" class="composer-error">{{ form.errors.content }}</p><p class="composer-hint">Keep the article factual, fair, and easy to follow. The editorial team can return it for revisions.</p></div>
                    <div v-if="form.errors.status || form.errors.article_id" class="composer-error-summary" role="alert">{{ form.errors.status || form.errors.article_id }}</div>
                    <div class="composer-actions"><button type="button" class="composer-save-draft" :disabled="form.processing" @click="submit('Draft')"><i class="fa-regular fa-floppy-disk" aria-hidden="true"></i>{{ form.processing && form.status === 'Draft' ? 'Saving…' : 'Save Draft' }}</button><button type="submit" class="composer-submit" :disabled="form.processing"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>{{ form.processing && form.status !== 'Draft' ? 'Submitting…' : 'Submit for Review' }}</button></div>
                </form>
                <aside class="composer-aside"><section class="composer-guide"><span class="composer-guide-icon"><i class="fa-solid fa-list-check" aria-hidden="true"></i></span><h2>Before you submit</h2><ul><li>Check names, dates, and quotations.</li><li>Explain why the story matters to students.</li><li>Use a concise summary that reflects the article.</li><li>Review your section selection.</li></ul></section><section class="composer-drafts"><div class="composer-drafts-heading"><h2>Your drafts</h2><span>{{ drafts.length }}</span></div><RouterLink v-for="draft in drafts" :key="draft.id" :to="`/${portal}/submit-article?draft_id=${draft.id}`" class="composer-draft-link"><span><strong>{{ draft.title || 'Untitled draft' }}</strong><small>{{ draft.category }} · {{ draft.status }}</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink><p v-if="!drafts.length" class="composer-no-drafts">No saved drafts yet.</p></section></aside>
            </div>
        </main>
    </AdminLayout>
</template>

<style scoped>
.article-composer { max-width:1450px; margin:0 auto; }
.composer-header { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:22px; }
.composer-eyebrow { margin:0 0 6px; color:#700f2b; font-size:.68rem; font-weight:800; letter-spacing:.13em; }
.composer-header h1 { margin:0; color:#251a1e; font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif; }
.composer-header p:last-child { margin:7px 0 0; color:#667085; font-size:.88rem; }
.composer-back { display:inline-flex; align-items:center; gap:7px; padding:9px 12px; color:#700f2b; background:#fff; border:1px solid #eadde2; border-radius:9px; font-size:.78rem; font-weight:700; text-decoration:none; white-space:nowrap; }
.composer-revision-note { display:flex; gap:12px; margin-bottom:18px; padding:14px 16px; color:#7a3a11; background:#fff7ed; border:1px solid #fed7aa; border-radius:11px; }
.composer-revision-note > i { margin-top:2px; }.composer-revision-note strong { font-size:.85rem; }.composer-revision-note p { margin:4px 0 0; font-size:.82rem; }
.composer-layout { display:grid; grid-template-columns:minmax(0,1fr) 290px; gap:20px; align-items:start; }
.composer-form,.composer-guide,.composer-drafts { padding:22px; background:#fff; border:1px solid #eee6e8; border-radius:14px; box-shadow:0 4px 16px #3a09140a; }
.composer-form { display:grid; gap:18px; }.composer-field { display:grid; gap:7px; }
.composer-field > label,.composer-label-row label { color:#383033; font-size:.82rem; font-weight:800; }.composer-field label span { color:#9b1c41; }
.composer-field input,.composer-field select,.composer-field textarea { width:100%; padding:11px 12px; color:#2d2527; background:#fff; border:1px solid #ddd3d7; border-radius:9px; outline:none; font-size:.86rem; }
.composer-field input:focus,.composer-field select:focus,.composer-field textarea:focus { border-color:#8d1337; box-shadow:0 0 0 3px #8d13371b; }
.composer-field textarea { resize:vertical; line-height:1.65; }.composer-label-row { display:flex; justify-content:space-between; align-items:center; gap:10px; }.composer-label-row > span { color:#8c8587; font-size:.7rem; }
.composer-toolbar { display:flex; align-items:center; gap:5px; padding:7px; background:#faf7f8; border:1px solid #e4dade; border-bottom:0; border-radius:9px 9px 0 0; }.composer-toolbar button { display:grid; place-items:center; min-width:32px; height:30px; padding:0 7px; color:#51474a; background:#fff; border:1px solid #eee5e8; border-radius:6px; font-size:.7rem; font-weight:800; cursor:pointer; }.composer-toolbar button:hover { color:#700f2b; background:#f9eef2; }.composer-toolbar span { width:1px; height:21px; margin:0 3px; background:#e4dade; }.composer-editor { min-height:360px; max-height:70vh; overflow:auto; padding:13px 14px; color:#2d2527; background:#fff; border:1px solid #ddd3d7; border-radius:0 0 9px 9px; outline:none; font-size:.87rem; line-height:1.7; }.composer-editor:focus { border-color:#8d1337; box-shadow:0 0 0 3px #8d13371b; }.composer-editor:empty::before { color:#9b9496; content:attr(data-placeholder); pointer-events:none; }.composer-editor :deep(blockquote) { margin:12px 0; padding:8px 12px; color:#665d60; border-left:3px solid #a74d68; background:#faf7f8; }
.composer-hint { margin:0; color:#777176; font-size:.75rem; }.composer-error { margin:0; color:#be123c; font-size:.76rem; }.composer-error-summary { padding:10px 12px; color:#9f1239; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; font-size:.82rem; }
.composer-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:6px; }.composer-actions button { display:inline-flex; align-items:center; gap:8px; padding:11px 15px; border-radius:9px; font-size:.81rem; font-weight:800; cursor:pointer; }.composer-actions button:disabled { opacity:.6; cursor:wait; }
.composer-save-draft { color:#700f2b; background:#fff; border:1px solid #dec9d1; }.composer-submit { color:#fff; background:linear-gradient(120deg,#700f2b,#8d1337); border:1px solid #700f2b; }
.composer-aside { display:grid; gap:16px; }.composer-guide h2,.composer-drafts h2 { margin:0; color:#2a2023; font:700 1.05rem 'Playfair Display',Georgia,serif; }.composer-guide-icon { display:grid; place-items:center; width:38px; height:38px; margin-bottom:12px; color:#700f2b; background:#f9eef2; border-radius:11px; }.composer-guide ul { display:grid; gap:10px; margin:13px 0 0; padding-left:18px; color:#665d60; font-size:.77rem; line-height:1.5; }
.composer-drafts-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }.composer-drafts-heading span { display:grid; place-items:center; min-width:24px; height:24px; padding:0 6px; color:#700f2b; background:#f9eef2; border-radius:999px; font-size:.68rem; font-weight:800; }
.composer-draft-link { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 0; color:#31282b; border-top:1px solid #f0ebed; text-decoration:none; }.composer-draft-link span { display:grid; min-width:0; gap:4px; }.composer-draft-link strong { overflow:hidden; font-size:.76rem; text-overflow:ellipsis; white-space:nowrap; }.composer-draft-link small { color:#847b7e; font-size:.68rem; }.composer-draft-link > i { color:#8d1337; font-size:.75rem; }.composer-no-drafts { margin:0; padding:12px 0 3px; color:#847b7e; font-size:.77rem; }
@media (max-width:950px) { .composer-layout { grid-template-columns:minmax(0,1fr) 250px; } }
@media (max-width:760px) { .composer-layout { grid-template-columns:1fr; }.composer-aside { grid-row:1; grid-template-columns:repeat(2,minmax(0,1fr)); }.composer-header { align-items:flex-start; flex-direction:column; }.composer-back { align-self:flex-start; } }
@media (max-width:560px) { .composer-aside { grid-template-columns:1fr; }.composer-form,.composer-guide,.composer-drafts { padding:16px; }.composer-actions { flex-direction:column-reverse; }.composer-actions button { justify-content:center; } }
</style>
