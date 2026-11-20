<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicSubmitData,
    storeEicArticle,
    deleteEicDraft,
} from '../../services/api.js';
import { cleanContentForEditing } from '../../utils/articleContent.js';
import '../../assets/css/shared-submit-article.css';

const router = useRouter();
const route = useRoute();

// User state
const authorName = ref(localStorage.getItem('userName') || localStorage.getItem('eicName') || 'Editor-in-Chief');

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
const editorRef = ref(null);

// Button loading states
const isSavingDraft = ref(false);
const isSubmitting = ref(false);
const isLoading = ref(true);

// Toast notification
const toastMessage = ref('');
const toastType = ref('success');
let toastTimer = null;

function showToast(msg, type = 'success') {
    toastMessage.value = msg;
    toastType.value = type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastMessage.value = '';
    }, 3400);
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

// Editor Formatting commands
function execFormat(command, value = null) {
    document.execCommand(command, false, value);
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
        editorRef.value.focus();
    }
}

function onEditorInput() {
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
    }
}

function clearForm() {
    articleId.value = null;
    title.value = '';
    excerpt.value = '';
    editorContent.value = '';
    if (editorRef.value) editorRef.value.innerHTML = '';
}

function loadDraftIntoEditor(draft) {
    articleId.value = draft.id;
    title.value = draft.title || '';
    categoryId.value = draft.category_id || '';
    excerpt.value = draft.excerpt || '';
    editorContent.value = draft.content || '';
    if (editorRef.value) {
        editorRef.value.innerHTML = draft.content || '';
    }
    switchTab('write');
    showToast(`Loaded draft: "${draft.title}"`, 'success');
}

// Delete Draft Modal
const isDeleteModalOpen = ref(false);
const draftToDelete = ref(null);

function openDeleteModal(draft) {
    draftToDelete.value = draft;
    isDeleteModalOpen.value = true;
}

function closeDeleteModal() {
    isDeleteModalOpen.value = false;
    draftToDelete.value = null;
}

async function confirmDeleteDraft() {
    if (!draftToDelete.value) return;
    const id = draftToDelete.value.id;
    try {
        await deleteEicDraft(id);
        drafts.value = drafts.value.filter(d => d.id !== id);
        if (articleId.value === id) {
            clearForm();
        }
        showToast('Draft deleted successfully.', 'success');
    } catch (err) {
        console.error('Failed to delete draft:', err);
        showToast('Failed to delete draft.', 'error');
    } finally {
        closeDeleteModal();
    }
}

// Save Draft
async function handleSaveDraft() {
    if (!title.value.trim()) {
        showToast('Please provide a headline for your draft.', 'error');
        return;
    }

    isSavingDraft.value = true;
    try {
        const payload = {
            article_id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value || null,
            excerpt: excerpt.value.trim(),
            content: cleanContentForEditing(editorRef.value?.innerHTML || editorContent.value),
            action: 'draft',
            status: 'draft',
        };

        const res = await storeEicArticle(payload);
        if (res && res.article) {
            articleId.value = res.article.id;
        }

        // Refresh drafts
        const fresh = await getEicSubmitData(null, true);
        if (fresh && fresh.drafts) {
            drafts.value = fresh.drafts;
        }

        showToast('Draft saved successfully.', 'success');
    } catch (err) {
        console.error('Failed to save draft:', err);
        showToast('Failed to save draft.', 'error');
    } finally {
        isSavingDraft.value = false;
    }
}

// Submit Article
async function handleSubmitArticle() {
    if (!title.value.trim()) {
        showToast('Headline is required.', 'error');
        return;
    }
    if (!categoryId.value) {
        showToast('Please select a section category.', 'error');
        return;
    }
    if (!excerpt.value.trim()) {
        showToast('Excerpt is required.', 'error');
        return;
    }

    const contentHtml = editorRef.value?.innerHTML || editorContent.value;
    const cleanText = contentHtml.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) {
        showToast('Article manuscript content cannot be empty.', 'error');
        return;
    }

    isSubmitting.value = true;
    try {
        const payload = {
            article_id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim(),
            content: cleanContentForEditing(contentHtml),
            action: 'submit',
            status: 'Pending Review',
        };

        await storeEicArticle(payload);

        showToast('Article submitted successfully!', 'success');
        clearForm();

        // Redirect to Manage My Articles after submission
        setTimeout(() => {
            router.push('/eic/manage-my-articles');
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
        const res = await getEicSubmitData(editDraftId, true);
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
    <EicLayout>
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
                        <div class="editor-toolbar" role="toolbar">
                            <button type="button" class="tool-btn" @click="execFormat('bold')" title="Bold (Ctrl+B)">
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button type="button" class="tool-btn" @click="execFormat('italic')" title="Italic (Ctrl+I)">
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <button type="button" class="tool-btn" @click="execFormat('underline')" title="Underline (Ctrl+U)">
                                <i class="fa-solid fa-underline"></i>
                            </button>
                            <div class="toolbar-divider"></div>
                            <button type="button" class="tool-btn" @click="execFormat('formatBlock', '<h2>')">
                                <span>H2</span>
                            </button>
                            <button type="button" class="tool-btn" @click="execFormat('formatBlock', '<h3>')">
                                <span>H3</span>
                            </button>
                            <button type="button" class="tool-btn" @click="execFormat('formatBlock', '<blockquote>')">
                                <i class="fa-solid fa-quote-left"></i>
                            </button>
                            <div class="toolbar-divider"></div>
                            <button type="button" class="tool-btn" @click="execFormat('insertUnorderedList')" title="Bullet List">
                                <i class="fa-solid fa-list-ul"></i>
                            </button>
                            <button type="button" class="tool-btn" @click="execFormat('insertOrderedList')" title="Numbered List">
                                <i class="fa-solid fa-list-ol"></i>
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

        <!-- Delete Draft Confirmation Modal -->
        <div
            v-if="isDeleteModalOpen"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeDeleteModal"
        >
            <div class="modal-card" style="max-width: 440px; padding: 24px;">
                <div class="modal-header-simple" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 class="modal-title font-semibold text-base text-rose-700" style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Delete Draft</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" @click="closeDeleteModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div style="font-size: 0.9rem; color: #4b5563; line-height: 1.5; margin-bottom: 20px;">
                    Are you sure you want to permanently delete draft <strong>"{{ draftToDelete?.title }}"</strong>? This action cannot be undone.
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button
                        type="button"
                        class="btn-box-save"
                        style="background: #e5e7eb; color: #374151;"
                        @click="closeDeleteModal"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-modal-submit-deactivate"
                        @click="confirmDeleteDraft"
                    >
                        <i class="fa-regular fa-trash-can"></i>
                        <span>Delete Draft</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Global Toast Notification -->
        <div v-if="toastMessage" class="toast-container">
            <div class="custom-toast" :class="toastType">
                <i v-if="toastType === 'success'" class="fa-solid fa-circle-check"></i>
                <i v-else-if="toastType === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
                <i v-else class="fa-solid fa-circle-exclamation"></i>
                <span>{{ toastMessage }}</span>
            </div>
        </div>
    </EicLayout>
</template>
