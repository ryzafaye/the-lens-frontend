<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveSubmitData,
    storeExecutiveArticle,
    deleteExecutiveDraft,
} from '../../services/api.js';
import { cleanContentForEditing } from '../../utils/articleContent.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/shared-submit-article.css';

const router = useRouter();
const route = useRoute();
const user = currentUser;

// User state
const authorName = computed(() => user?.full_name || 'Executive Officer');

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

// Formatting commands
function execCommand(cmd, value = null) {
    if (!editorRef.value) return;
    editorRef.value.focus();
    document.execCommand(cmd, false, value);
    syncEditorContent();
}

function syncEditorContent() {
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
    }
}

// Fetch submit data (categories & drafts)
async function loadSubmitData(draftId = null) {
    isLoading.value = true;
    try {
        const data = await getExecutiveSubmitData(draftId, true);
        if (data) {
            if (Array.isArray(data.categories)) {
                categories.value = data.categories;
                if (!categoryId.value && categories.value.length > 0) {
                    categoryId.value = categories.value[0].id;
                }
            }
            if (Array.isArray(data.drafts)) {
                drafts.value = data.drafts;
            }
            if (data.editingDraft) {
                populateDraft(data.editingDraft);
            }
        }
    } catch (err) {
        console.error('Failed to load submit article data:', err);
        showToast('Failed to load form data.', 'error');
    } finally {
        isLoading.value = false;
    }
}

function populateDraft(draft) {
    articleId.value = draft.id;
    title.value = draft.title || '';
    categoryId.value = draft.category_id || (categories.value[0]?.id ?? '');
    excerpt.value = draft.excerpt || '';
    editorContent.value = cleanContentForEditing(draft.content || '');
    activeTab.value = 'write';

    nextTick(() => {
        if (editorRef.value) {
            editorRef.value.innerHTML = editorContent.value;
        }
    });
}

function resetForm() {
    articleId.value = null;
    title.value = '';
    categoryId.value = categories.value[0]?.id || '';
    excerpt.value = '';
    editorContent.value = '';
    if (editorRef.value) {
        editorRef.value.innerHTML = '';
    }
}

// Submit Article (for review)
async function handleSubmitArticle() {
    syncEditorContent();

    if (!title.value.trim()) {
        showToast('Please enter an article headline.', 'error');
        return;
    }
    if (!categoryId.value) {
        showToast('Please select a category.', 'error');
        return;
    }
    if (!excerpt.value.trim()) {
        showToast('Please provide an article excerpt.', 'error');
        return;
    }
    const cleanBody = cleanContentForEditing(editorContent.value);
    if (!cleanBody.replace(/<[^>]*>/g, '').trim()) {
        showToast('Article content cannot be empty.', 'error');
        return;
    }

    isSubmitting.value = true;
    try {
        const payload = {
            article_id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim(),
            content: cleanBody,
            status: 'Pending EIC Review',
        };

        const res = await storeExecutiveArticle(payload);
        showToast(res.message || 'Article submitted and forwarded to Editor-in-Chief for approval.', 'success');
        resetForm();
        setTimeout(() => {
            router.push('/executive/manage-my-articles');
        }, 1200);
    } catch (err) {
        console.error('Submission failed:', err);
        const msg = err.response?.data?.message || 'Failed to submit article. Please check all fields.';
        showToast(msg, 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Save as Draft
async function handleSaveDraft() {
    syncEditorContent();

    if (!title.value.trim()) {
        showToast('Please enter a headline to save as draft.', 'error');
        return;
    }
    if (!categoryId.value) {
        categoryId.value = categories.value[0]?.id || '';
    }

    isSavingDraft.value = true;
    try {
        const payload = {
            article_id: articleId.value,
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim(),
            content: cleanContentForEditing(editorContent.value),
            status: 'Draft',
        };

        const res = await storeExecutiveArticle(payload);
        showToast(res.message || 'Draft saved successfully.', 'success');
        if (res.article?.id) {
            articleId.value = res.article.id;
        }
        await loadSubmitData();
    } catch (err) {
        console.error('Save draft failed:', err);
        showToast('Failed to save draft.', 'error');
    } finally {
        isSavingDraft.value = false;
    }
}

// Delete Draft
async function handleDeleteDraft(draftId) {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
        await deleteExecutiveDraft(draftId);
        showToast('Draft deleted successfully.', 'success');
        if (articleId.value === draftId) {
            resetForm();
        }
        await loadSubmitData();
    } catch (err) {
        console.error('Failed to delete draft:', err);
        showToast('Failed to delete draft.', 'error');
    }
}

onMounted(() => {
    const draftId = route.query.draft_id;
    if (route.query.tab === 'drafts') {
        activeTab.value = 'drafts';
    }
    loadSubmitData(draftId);
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Toast notification -->
            <transition name="fade">
                <div v-if="toastMessage" class="toast-container">
                    <div class="toast-message" :class="toastType">
                        <i :class="toastType === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
                        <span>{{ toastMessage }}</span>
                    </div>
                </div>
            </transition>

            <div class="submit-article-container">
                <div class="page-title-section">
                    <div class="page-header-row">
                        <h1 class="page-title">Submit Article</h1>
                    </div>
                </div>

                <!-- Tabs Navigation -->
                <div class="submit-tabs-nav" role="tablist" aria-label="Article Views">
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ 'active': activeTab === 'write' }"
                        @click="switchTab('write')"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Write Article</span>
                    </button>
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ 'active': activeTab === 'drafts' }"
                        @click="switchTab('drafts')"
                    >
                        <i class="fa-regular fa-folder-open"></i>
                        <span>Drafts</span>
                        <span class="drafts-tab-badge">{{ drafts.length }}</span>
                    </button>
                </div>

                <!-- Write View -->
                <div v-show="activeTab === 'write'" class="write-view view-container">
                    <div class="writing-canvas-container">
                        <!-- Headline -->
                        <div class="headline-box-wrapper">
                            <textarea
                                v-model="title"
                                class="headline-input"
                                rows="1"
                                placeholder="Write your headline here..."
                                maxlength="255"
                            ></textarea>
                            <div class="headline-helper-row">
                                <span></span>
                                <span class="headline-char-count">{{ title.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Meta Controls: Category + Byline -->
                        <div class="meta-controls-row">
                            <div class="category-select-wrapper">
                                <label for="article-category" class="category-label">
                                    <i class="fa-solid fa-tag"></i>
                                    <span>Section:</span>
                                </label>
                                <div class="select-styled-container">
                                    <select id="article-category" v-model="categoryId" class="category-dropdown-select">
                                        <option value="" disabled>Select category...</option>
                                        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
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

                        <!-- Excerpt -->
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
                            ></textarea>
                            <div class="excerpt-helper-row">
                                <span></span>
                                <span class="excerpt-char-count">{{ excerpt.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Formatting Toolbar -->
                        <div class="formatting-toolbar">
                            <button type="button" class="toolbar-btn" title="Bold" @click="execCommand('bold')">
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Italic" @click="execCommand('italic')">
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Underline" @click="execCommand('underline')">
                                <i class="fa-solid fa-underline"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Strikethrough" @click="execCommand('strikeThrough')">
                                <i class="fa-solid fa-strikethrough"></i>
                            </button>
                            <span class="toolbar-divider"></span>
                            <button type="button" class="toolbar-btn" title="Heading 2" @click="execCommand('formatBlock', '<h2>')">
                                <i class="fa-solid fa-heading"></i>2
                            </button>
                            <button type="button" class="toolbar-btn" title="Heading 3" @click="execCommand('formatBlock', '<h3>')">
                                <i class="fa-solid fa-heading"></i>3
                            </button>
                            <button type="button" class="toolbar-btn" title="Paragraph" @click="execCommand('formatBlock', '<p>')">
                                <i class="fa-solid fa-paragraph"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Quote" @click="execCommand('formatBlock', '<blockquote>')">
                                <i class="fa-solid fa-quote-left"></i>
                            </button>
                            <span class="toolbar-divider"></span>
                            <button type="button" class="toolbar-btn" title="Bullet List" @click="execCommand('insertUnorderedList')">
                                <i class="fa-solid fa-list-ul"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Numbered List" @click="execCommand('insertOrderedList')">
                                <i class="fa-solid fa-list-ol"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Horizontal Rule" @click="execCommand('insertHorizontalRule')">
                                <i class="fa-solid fa-minus"></i>
                            </button>
                            <span class="toolbar-divider"></span>
                            <button type="button" class="toolbar-btn" title="Clear Formatting" @click="execCommand('removeFormat')">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Undo" @click="execCommand('undo')">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                            <button type="button" class="toolbar-btn" title="Redo" @click="execCommand('redo')">
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>
                        </div>

                        <!-- Body Editor Canvas -->
                        <div class="editor-canvas-wrapper">
                            <div
                                ref="editorRef"
                                class="article-body-editor font-serif leading-relaxed"
                                contenteditable="true"
                                spellcheck="true"
                                placeholder="Start writing your article manuscript here..."
                                @input="syncEditorContent"
                            ></div>
                        </div>

                        <!-- Word Count Indicator -->
                        <div class="canvas-footer-meta">
                            <span class="word-counter-text">{{ wordCount }} words</span>
                        </div>

                        <!-- Action Buttons -->
                        <div class="writing-action-bar">
                            <button
                                type="button"
                                class="btn-save-draft"
                                :disabled="isSavingDraft || isSubmitting"
                                @click="handleSaveDraft"
                            >
                                <i v-if="isSavingDraft" class="fa-solid fa-spinner fa-spin"></i>
                                <i v-else class="fa-regular fa-floppy-disk"></i>
                                <span>{{ isSavingDraft ? 'Saving Draft...' : 'Save as Draft' }}</span>
                            </button>

                            <button
                                type="button"
                                class="btn-submit-article"
                                :disabled="isSubmitting || isSavingDraft"
                                @click="handleSubmitArticle"
                            >
                                <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                                <i v-else class="fa-solid fa-paper-plane"></i>
                                <span>{{ isSubmitting ? 'Submitting...' : 'Submit Article' }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Drafts View -->
                <div v-show="activeTab === 'drafts'" class="drafts-view view-container">
                    <div class="drafts-list-container">
                        <div v-for="draft in drafts" :key="draft.id" class="draft-item-card">
                            <div class="draft-info">
                                <div class="draft-meta-top">
                                    <span class="draft-category-badge">{{ draft.category?.name || 'General' }}</span>
                                    <span class="draft-date">{{ draft.created_at ? new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }}</span>
                                </div>
                                <h3 class="draft-title" @click="populateDraft(draft)">{{ draft.title || 'Untitled Draft' }}</h3>
                                <p class="draft-preview">{{ draft.excerpt || 'No excerpt written.' }}</p>
                            </div>
                            <div class="draft-actions">
                                <button type="button" class="btn-draft-action btn-draft-edit" title="Edit draft" @click="populateDraft(draft)">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Edit</span>
                                </button>
                                <button type="button" class="btn-draft-action btn-draft-delete" title="Delete draft" @click="handleDeleteDraft(draft.id)">
                                    <i class="fa-regular fa-trash-can"></i>
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>

                        <div v-if="!isLoading && drafts.length === 0" class="drafts-empty-state">
                            <i class="fa-regular fa-folder-open empty-icon"></i>
                            <h3 class="empty-title">No drafts saved</h3>
                            <p class="empty-desc">Any article you save as a draft will appear here for you to resume editing at any time.</p>
                            <button type="button" class="btn-start-writing" @click="activeTab = 'write'">Start Writing</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
