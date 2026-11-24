<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveSubmitData,
    storeExecutiveArticle,
    deleteExecutiveDraft,
} from '../../services/api.js';
import { cleanContentForEditing, formatCleanArticleContent, sanitizeRichArticleHtml, isRevisionStatus, isArticleBodyModified } from '../../utils/articleContent.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/shared-submit-article.css';

const router = useRouter();
const route = useRoute();
const user = currentUser;

// User state
const authorName = computed(() => user?.full_name || localStorage.getItem('userName') || 'Executive Officer');

// Tabs
const activeTab = ref('write');
const categories = ref([]);
const drafts = ref([]);

// Form field states
const articleId = ref(null);
const title = ref('');
const categoryId = ref('');
const excerpt = ref('');
const editorContent = ref('');
const initialBodyContent = ref('');
const loadedArticleStatus = ref('');
const editorRef = ref(null);

// Button loading states
const isSavingDraft = ref(false);
const isSubmitting = ref(false);
const isLoading = ref(true);

// Centered Modal Toast/Feedback replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Live metrics
const wordCount = computed(() => {
    const text = (editorContent.value || '').replace(/<[^>]+>/g, ' ').trim();
    if (!text) return 0;
    const words = text.match(/\b[\w'-]+\b/g);
    return words ? words.length : 0;
});

function switchTab(tab) {
    activeTab.value = tab;
}

// Toolbar active states
const toolbarActive = ref({
    undo: false,
    redo: false,
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    subscript: false,
    superscript: false,
    h2: false,
    h3: false,
    blockquote: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
});

function updateToolbarStates() {
    try {
        toolbarActive.value.bold = document.queryCommandState('bold');
        toolbarActive.value.italic = document.queryCommandState('italic');
        toolbarActive.value.underline = document.queryCommandState('underline');
        toolbarActive.value.strikeThrough = document.queryCommandState('strikeThrough');
        toolbarActive.value.subscript = document.queryCommandState('subscript');
        toolbarActive.value.superscript = document.queryCommandState('superscript');
        toolbarActive.value.insertUnorderedList = document.queryCommandState('insertUnorderedList');
        toolbarActive.value.insertOrderedList = document.queryCommandState('insertOrderedList');
        toolbarActive.value.justifyLeft = document.queryCommandState('justifyLeft');
        toolbarActive.value.justifyCenter = document.queryCommandState('justifyCenter');
        toolbarActive.value.justifyRight = document.queryCommandState('justifyRight');
        toolbarActive.value.justifyFull = document.queryCommandState('justifyFull');

        const blockValue = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/<|>/g, '');
        toolbarActive.value.h2 = blockValue === 'h2';
        toolbarActive.value.h3 = blockValue === 'h3';
        toolbarActive.value.blockquote = blockValue === 'blockquote';
    } catch (e) {
        // queryCommand may throw if selection is outside
    }
}

// Editor Formatting commands
function execFormat(command, value = null) {
    if (!editorRef.value) return;
    editorRef.value.focus();

    if (command === 'createLink') {
        const url = prompt('Enter link URL (e.g., https://thelens.example.com):', 'https://');
        if (url && url.trim().length > 0) {
            const formattedUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://')
                ? url.trim()
                : `https://${url.trim()}`;
            document.execCommand('createLink', false, formattedUrl);
        }
    } else if (command === 'formatBlock') {
        const currentTag = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/<|>/g, '');
        const targetTag = value.replace(/<|>/g, '').toLowerCase();

        if (currentTag === targetTag) {
            document.execCommand('formatBlock', false, '<div>');
        } else {
            document.execCommand('formatBlock', false, value);
        }
    } else {
        document.execCommand(command, false, value);
    }

    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
    }
    updateToolbarStates();
}

function onEditorInput() {
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
    }
    updateToolbarStates();
}

function onEditorKeyup() {
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
    }
    updateToolbarStates();
}

function onEditorKeydown(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            document.execCommand('outdent', false, null);
        } else {
            document.execCommand('indent', false, null);
        }
        if (editorRef.value) {
            editorContent.value = editorRef.value.innerHTML;
        }
        updateToolbarStates();
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            execFormat('bold');
        } else if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            execFormat('italic');
        } else if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            execFormat('underline');
        } else if (e.key === 'z' || e.key === 'Z') {
            if (e.shiftKey) {
                e.preventDefault();
                execFormat('redo');
            } else {
                e.preventDefault();
                execFormat('undo');
            }
        } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            execFormat('redo');
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            handleSaveDraft();
        }
    }
}

function clearForm() {
    articleId.value = null;
    title.value = '';
    excerpt.value = '';
    editorContent.value = '';
    initialBodyContent.value = '';
    loadedArticleStatus.value = '';
    if (editorRef.value) editorRef.value.innerHTML = '';
}

function loadDraftIntoEditor(draft) {
    articleId.value = draft.id;
    title.value = draft.title || '';
    categoryId.value = draft.category_id || '';
    excerpt.value = draft.excerpt || '';
    editorContent.value = draft.content || '';
    initialBodyContent.value = draft.content || '';
    loadedArticleStatus.value = draft.status || '';
    if (editorRef.value) {
        editorRef.value.innerHTML = draft.content ? formatCleanArticleContent(draft.content) : '';
    }
    switchTab('write');
    showToast(`Loaded draft: "${draft.title}"`, 'success');
}

// Delete Draft Modal
const isDeleteModalOpen = ref(false);
const draftToDelete = ref(null);

async function openDeleteModal(draft) {
    if (!draft) return;
    draftToDelete.value = draft;

    const confirmed = await confirmAction({
        title: 'Delete Draft',
        message: `Are you sure you want to delete "${draft.title}"?`,
        confirmText: 'Delete Draft',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;

    await confirmDeleteDraft();
}

function closeDeleteModal() {
    isDeleteModalOpen.value = false;
    draftToDelete.value = null;
}

async function confirmDeleteDraft() {
    if (!draftToDelete.value) return;

    const id = draftToDelete.value.id;
    try {
        await deleteExecutiveDraft(id);
        drafts.value = drafts.value.filter(d => d.id !== id);
        if (articleId.value === id) {
            clearForm();
        }
        showToast('Draft deleted successfully.', 'success');
        closeDeleteModal();
    } catch (err) {
        console.error('Failed to delete draft:', err);
        showToast('Failed to delete draft.', 'error');
    }
}

// Save as Draft
async function handleSaveDraft() {
    if (!title.value.trim()) {
        showToast('Please provide a headline for your draft.', 'error');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Save Draft',
        message: 'Are you sure you want to save this article as a draft?',
        confirmText: 'Save Draft',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSavingDraft.value = true;
    try {
        const payload = {
            id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value || null,
            excerpt: excerpt.value.trim(),
            content: sanitizeRichArticleHtml(editorRef.value ? editorRef.value.innerHTML : editorContent.value),
            action: 'draft',
            status: 'Draft',
        };

        const res = await storeExecutiveArticle(payload);
        if (res && res.article) {
            articleId.value = res.article.id;
            const idx = drafts.value.findIndex(d => d.id === res.article.id);
            if (idx !== -1) {
                drafts.value[idx] = res.article;
            } else {
                drafts.value.unshift(res.article);
            }
        }
        showToast('Draft saved successfully!', 'success');
    } catch (err) {
        console.error('Failed to save draft:', err);
        showToast(err.response?.data?.message || 'Failed to save draft.', 'error');
    } finally {
        isSavingDraft.value = false;
    }
}

// Submit Article for Review
async function handleSubmitArticle() {
    if (!title.value.trim()) {
        showToast('Please provide an article headline.', 'error');
        return;
    }
    if (!categoryId.value) {
        showToast('Please select a category.', 'error');
        return;
    }
    if (!editorContent.value.trim() || editorContent.value === '<br>') {
        showToast('Article content cannot be empty.', 'error');
        return;
    }

    if (isRevisionStatus(loadedArticleStatus.value)) {
        const rawCurrent = editorRef.value ? editorRef.value.innerHTML : editorContent.value;
        if (!isArticleBodyModified(initialBodyContent.value, rawCurrent)) {
            showToast('You cannot submit an article returned for revision without editing the article body. Please revise the manuscript before submitting.', 'error');
            return;
        }
    }

    const confirmed = await confirmAction({
        title: 'Submit Article',
        message: 'Are you sure you want to submit this article and forward it to the Editor-in-Chief for approval?',
        confirmText: 'Submit Article',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const payload = {
            id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim(),
            content: sanitizeRichArticleHtml(editorRef.value ? editorRef.value.innerHTML : editorContent.value),
            action: 'submit',
            status: 'Pending EIC Review',
        };

        const res = await storeExecutiveArticle(payload);

        showToast(res?.message || 'Article submitted and forwarded to Editor-in-Chief for approval.', 'success');
        clearForm();

        // Redirect to Manage My Articles after submission
        setTimeout(() => {
            router.push('/executive/manage-my-articles');
        }, 1200);
    } catch (err) {
        console.error('Failed to submit article:', err);
        showToast(err.response?.data?.message || 'Failed to submit article. Please check required fields.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Initial Data Fetch
async function loadInitialData() {
    isLoading.value = true;
    try {
        const editDraftId = route.query.draft_id || null;
        const res = await getExecutiveSubmitData(editDraftId, true);
        if (res) {
            categories.value = res.categories || [];
            drafts.value = res.drafts || [];
            if (res.editingDraft) {
                loadDraftIntoEditor(res.editingDraft);
            }
        }
    } catch (err) {
        console.error('Failed to load submit article data:', err);
        showToast('Failed to initialize submission form.', 'error');
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadInitialData();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <div class="submit-article-container">
                <div class="page-title-section">
                    <div class="page-header-row">
                        <h1 class="page-title">Submit Article</h1>
                    </div>
                </div>

                <!-- Tabs Nav -->
                <div class="submit-tabs-nav" role="tablist" aria-label="Article Views">
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ active: activeTab === 'write' }"
                        @click="switchTab('write')"
                        role="tab"
                        :aria-selected="activeTab === 'write'"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Write Article</span>
                    </button>
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ active: activeTab === 'drafts' }"
                        @click="switchTab('drafts')"
                        role="tab"
                        :aria-selected="activeTab === 'drafts'"
                    >
                        <i class="fa-regular fa-folder-open"></i>
                        <span>Drafts</span>
                        <span class="drafts-tab-badge">{{ drafts.length }}</span>
                    </button>
                </div>

                <!-- View 1: Writing Canvas -->
                <div v-show="activeTab === 'write'" class="write-view view-container" role="tabpanel">
                    <div class="writing-canvas-container">
                        <!-- Headline Input -->
                        <div class="headline-box-wrapper">
                            <textarea
                                v-model="title"
                                class="headline-input"
                                rows="1"
                                placeholder="Write your headline here..."
                                maxlength="255"
                                required
                            ></textarea>
                            <div class="headline-helper-row">
                                <span></span>
                                <span class="headline-char-count">{{ title.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Meta Controls Row -->
                        <div class="meta-controls-row">
                            <div class="category-select-wrapper">
                                <label for="article-category" class="category-label">
                                    <i class="fa-solid fa-tag"></i>
                                    <span>Section:</span>
                                </label>
                                <div class="select-styled-container">
                                    <select
                                        id="article-category"
                                        v-model="categoryId"
                                        class="category-dropdown-select"
                                        required
                                    >
                                        <option value="" disabled>Select category...</option>
                                        <option
                                            v-for="cat in categories"
                                            :key="cat.id"
                                            :value="cat.id"
                                        >
                                            {{ cat.name }}
                                        </option>
                                    </select>
                                    <i class="fa-solid fa-chevron-down select-chevron"></i>
                                </div>
                            </div>
                            <div class="author-byline-display">
                                <i class="fa-solid fa-pen-nib"></i>
                                <span>By <strong>{{ authorName }}</strong></span>
                            </div>
                        </div>

                        <!-- Excerpt Input -->
                        <div class="excerpt-box-wrapper">
                            <label for="article-excerpt" class="excerpt-label">
                                <i class="fa-solid fa-align-left"></i>
                                <span>Excerpt</span>
                            </label>
                            <textarea
                                id="article-excerpt"
                                v-model="excerpt"
                                class="excerpt-input"
                                rows="2"
                                maxlength="255"
                                placeholder="Write a brief excerpt or teaser..."
                                required
                            ></textarea>
                            <div class="excerpt-helper-row">
                                <span></span>
                                <span class="excerpt-char-count">{{ excerpt.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Formatting Toolbar -->
                        <div class="editor-toolbar" id="editor-toolbar" role="toolbar" aria-label="Editor controls">
                            <!-- History -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('undo')"
                                title="Undo (Ctrl+Z)"
                            >
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('redo')"
                                title="Redo (Ctrl+Y)"
                            >
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Typography & Styling -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.bold }"
                                @mousedown.prevent
                                @click="execFormat('bold')"
                                title="Bold (Ctrl+B)"
                            >
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.italic }"
                                @mousedown.prevent
                                @click="execFormat('italic')"
                                title="Italic (Ctrl+I)"
                            >
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.underline }"
                                @mousedown.prevent
                                @click="execFormat('underline')"
                                title="Underline (Ctrl+U)"
                            >
                                <i class="fa-solid fa-underline"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.strikeThrough }"
                                @mousedown.prevent
                                @click="execFormat('strikeThrough')"
                                title="Strikethrough"
                            >
                                <i class="fa-solid fa-strikethrough"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.subscript }"
                                @mousedown.prevent
                                @click="execFormat('subscript')"
                                title="Subscript"
                            >
                                <i class="fa-solid fa-subscript"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.superscript }"
                                @mousedown.prevent
                                @click="execFormat('superscript')"
                                title="Superscript"
                            >
                                <i class="fa-solid fa-superscript"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Structural Blocks -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.h2 }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<h2>')"
                                title="Heading 2"
                            >
                                <span>H2</span>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.h3 }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<h3>')"
                                title="Heading 3"
                            >
                                <span>H3</span>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.blockquote }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<blockquote>')"
                                title="Blockquote / Pull Quote"
                            >
                                <i class="fa-solid fa-quote-left"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Lists -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.insertUnorderedList }"
                                @mousedown.prevent
                                @click="execFormat('insertUnorderedList')"
                                title="Bullet List"
                            >
                                <i class="fa-solid fa-list-ul"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.insertOrderedList }"
                                @mousedown.prevent
                                @click="execFormat('insertOrderedList')"
                                title="Numbered List"
                            >
                                <i class="fa-solid fa-list-ol"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Alignment -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyLeft }"
                                @mousedown.prevent
                                @click="execFormat('justifyLeft')"
                                title="Align Left"
                            >
                                <i class="fa-solid fa-align-left"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyCenter }"
                                @mousedown.prevent
                                @click="execFormat('justifyCenter')"
                                title="Align Center"
                            >
                                <i class="fa-solid fa-align-center"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyRight }"
                                @mousedown.prevent
                                @click="execFormat('justifyRight')"
                                title="Align Right"
                            >
                                <i class="fa-solid fa-align-right"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyFull }"
                                @mousedown.prevent
                                @click="execFormat('justifyFull')"
                                title="Justify"
                            >
                                <i class="fa-solid fa-align-justify"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Links & Elements -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('createLink')"
                                title="Insert Link"
                            >
                                <i class="fa-solid fa-link"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('unlink')"
                                title="Remove Link"
                            >
                                <i class="fa-solid fa-link-slash"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('insertHorizontalRule')"
                                title="Horizontal Divider Line"
                            >
                                <i class="fa-solid fa-minus"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Clear Formatting -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('removeFormat')"
                                title="Clear Formatting"
                            >
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                        </div>

                        <!-- Rich Editor Body -->
                        <div class="editor-body-wrapper">
                            <div
                                ref="editorRef"
                                class="rich-editor-content"
                                contenteditable="true"
                                spellcheck="true"
                                data-placeholder="Write your article here..."
                                @input="onEditorInput"
                                @keyup="onEditorKeyup"
                                @mouseup="updateToolbarStates"
                                @keydown="onEditorKeydown"
                            ></div>
                        </div>

                        <!-- Editor Footer Bar -->
                        <div class="editor-footer-bar">
                            <div class="editor-metrics-left">
                                <span class="metric-pill">
                                    <i class="fa-solid fa-font"></i>
                                    <span>{{ wordCount }} words</span>
                                </span>
                            </div>
                            <div class="editor-actions-right">
                                <button
                                    type="button"
                                    class="btn-secondary-action"
                                    :disabled="isSavingDraft || isSubmitting"
                                    @click="handleSaveDraft"
                                >
                                    <i class="fa-regular fa-floppy-disk"></i>
                                    <span>{{ isSavingDraft ? 'Saving...' : 'Save Draft' }}</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-submit-primary"
                                    :disabled="isSubmitting || isSavingDraft"
                                    @click="handleSubmitArticle"
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                    <span>{{ isSubmitting ? 'Submitting...' : 'Submit Article' }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- View 2: Drafts View -->
                <div v-show="activeTab === 'drafts'" class="drafts-view view-container" role="tabpanel">
                    <div class="drafts-view-container">
                        <div v-if="drafts.length === 0" class="empty-drafts-box">
                            <i class="fa-regular fa-folder-open"></i>
                            <h3 class="empty-drafts-title">No Drafts Saved</h3>
                            <p class="empty-drafts-subtitle">Any articles you save as drafts will appear here for easy editing.</p>
                        </div>
                        <div v-else class="drafts-list-container">
                            <div
                                v-for="draft in drafts"
                                :key="draft.id"
                                class="draft-box"
                            >
                                <div class="draft-box-content">
                                    <div class="draft-box-meta">
                                        <span class="draft-box-category">{{ draft.category?.name || 'Uncategorized' }}</span>
                                        <span class="draft-box-date">
                                            <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                                            Saved {{ draft.created_at ? new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently' }}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        class="draft-box-title"
                                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                                        @click="loadDraftIntoEditor(draft)"
                                        :title="draft.title"
                                    >
                                        {{ draft.title }}
                                    </button>
                                    <p v-if="draft.excerpt" class="draft-box-excerpt">{{ draft.excerpt }}</p>
                                </div>
                                <div class="draft-box-actions">
                                    <button
                                        type="button"
                                        class="btn-draft-edit"
                                        @click="loadDraftIntoEditor(draft)"
                                        title="Edit this draft"
                                    >
                                        <i class="fa-solid fa-pen"></i>
                                        <span>Edit Draft</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-draft-delete"
                                        @click="openDeleteModal(draft)"
                                        title="Delete draft"
                                    >
                                        <i class="fa-regular fa-trash-can"></i>
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
