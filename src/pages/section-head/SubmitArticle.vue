<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import {
    getSectionHeadSubmitData,
    storeSectionHeadArticle,
    deleteSectionHeadDraft,
} from '../../services/api.js';
import { cleanContentForEditing } from '../../utils/articleContent.js';
import '../../assets/css/shared-submit-article.css';

const router = useRouter();
const route = useRoute();

// User state
const authorName = ref(localStorage.getItem('userName') || localStorage.getItem('sectionHeadName') || 'Section Head');
const userRole = ref(localStorage.getItem('userRole') || 'Section Head');

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
const isDeleting = ref(false);

function openDeleteModal(draft) {
    draftToDelete.value = draft;
    isDeleteModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeDeleteModal() {
    isDeleteModalOpen.value = false;
    draftToDelete.value = null;
    document.body.classList.remove('modal-open');
}

async function confirmDeleteDraft() {
    if (!draftToDelete.value || isDeleting.value) return;

    isDeleting.value = true;
    try {
        await deleteSectionHeadDraft(draftToDelete.value.id);
        drafts.value = drafts.value.filter(d => d.id !== draftToDelete.value.id);
        if (articleId.value === draftToDelete.value.id) {
            clearForm();
        }
        showToast('Draft deleted successfully.', 'success');
        closeDeleteModal();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to delete draft.', 'error');
    } finally {
        isDeleting.value = false;
    }
}

// Save as Draft
async function handleSaveDraft() {
    if (isSavingDraft.value || isSubmitting.value) return;

    if (!title.value.trim()) {
        showToast('Please provide an article headline before saving as draft.', 'error');
        return;
    }

    if (!categoryId.value) {
        showToast('Please select a section category.', 'error');
        return;
    }

    isSavingDraft.value = true;
    try {
        const payload = {
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim() || null,
            content: cleanContentForEditing(editorContent.value || ''),
            status: 'Draft',
            article_id: articleId.value,
        };

        const res = await storeSectionHeadArticle(payload);
        showToast(res.message || 'Draft saved successfully.', 'success');

        if (res.article?.id) {
            articleId.value = res.article.id;
        }

        const refreshData = await getSectionHeadSubmitData(null, true);
        if (refreshData?.drafts) {
            drafts.value = refreshData.drafts;
        }
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to save draft.', 'error');
    } finally {
        isSavingDraft.value = false;
    }
}

// Submit Article (Endorses directly to EIC)
async function handleSubmitArticle() {
    if (isSavingDraft.value || isSubmitting.value) return;

    if (!title.value.trim()) {
        showToast('Please provide an article headline.', 'error');
        return;
    }

    if (!categoryId.value) {
        showToast('Please choose a section category.', 'error');
        return;
    }

    if (!excerpt.value.trim()) {
        showToast('Please provide a story excerpt/summary.', 'error');
        return;
    }

    const plainText = (editorContent.value || '').replace(/<[^>]+>/g, '').trim();
    if (!plainText) {
        showToast('Article body cannot be empty. Please write your article content.', 'error');
        return;
    }

    isSubmitting.value = true;
    try {
        const payload = {
            title: title.value.trim(),
            category_id: categoryId.value,
            excerpt: excerpt.value.trim(),
            content: cleanContentForEditing(editorContent.value),
            status: 'Pending EIC Review',
            article_id: articleId.value,
        };

        const res = await storeSectionHeadArticle(payload);
        showToast(res.message || 'Article submitted and forwarded to Editor-in-Chief for approval.', 'success');

        setTimeout(() => {
            router.push('/section-head/manage-my-articles');
        }, 800);
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to submit article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function loadData() {
    try {
        const draftIdParam = route.query.draft_id || null;
        const data = await getSectionHeadSubmitData(draftIdParam);

        if (data?.categories) {
            categories.value = data.categories;
        }
        if (data?.drafts) {
            drafts.value = data.drafts;
        }
        if (data?.editingDraft) {
            loadDraftIntoEditor(data.editingDraft);
        } else if (categories.value.length > 0 && !categoryId.value) {
            const role = userRole.value.toLowerCase();
            const matchingCat = categories.value.find(c => {
                const cname = c.name.toLowerCase();
                if (role.includes('news')) return cname.includes('news');
                if (role.includes('feature')) return cname.includes('feature');
                if (role.includes('liter')) return cname.includes('liter');
                if (role.includes('science')) return cname.includes('science');
                return false;
            });
            if (matchingCat) {
                categoryId.value = matchingCat.id;
            }
        }
    } catch (err) {
        console.error('Failed to load Section Head submit page data:', err);
    }
}

onMounted(() => {
    loadData();
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container">
            <!-- Exact Blade executive/submit-article.blade.php hierarchy -->
            <div class="submit-article-container">
                <div class="page-title-section">
                    <div class="page-header-row">
                        <h1 class="page-title">Submit Article</h1>
                    </div>
                </div>

                <div class="submit-tabs-nav" role="tablist" aria-label="Article Views">
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ active: activeTab === 'write' }"
                        @click="switchTab('write')"
                        id="tab-write-btn"
                        role="tab"
                        :aria-selected="activeTab === 'write'"
                    >
                        <i class="fa-solid fa-pen-to-square"></i><span>Write Article</span>
                    </button>
                    <button
                        type="button"
                        class="submit-tab-btn"
                        :class="{ active: activeTab === 'drafts' }"
                        @click="switchTab('drafts')"
                        id="tab-drafts-btn"
                        role="tab"
                        :aria-selected="activeTab === 'drafts'"
                    >
                        <i class="fa-regular fa-folder-open"></i><span>Drafts</span>
                        <span class="drafts-tab-badge" id="drafts-count-badge">{{ drafts.length }}</span>
                    </button>
                </div>

                <!-- View 1: Write Article Canvas -->
                <div v-show="activeTab === 'write'" class="write-view view-container" id="write-view" role="tabpanel">
                    <div class="writing-canvas-container">
                        <!-- Headline Input -->
                        <div class="headline-box-wrapper" id="headline-box-wrapper">
                            <textarea
                                id="article-headline"
                                v-model="title"
                                class="headline-input"
                                rows="1"
                                placeholder="Write your headline here..."
                                maxlength="255"
                                required
                            ></textarea>
                            <div class="headline-helper-row">
                                <span></span>
                                <span id="headline-char-count" class="headline-char-count">{{ title.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Section & Byline Row -->
                        <div class="meta-controls-row">
                            <div class="category-select-wrapper">
                                <label for="article-category" class="category-label">
                                    <i class="fa-solid fa-tag"></i><span>Section:</span>
                                </label>
                                <div class="select-styled-container" id="category-select-container">
                                    <select
                                        id="article-category"
                                        v-model="categoryId"
                                        class="category-dropdown-select"
                                        required
                                    >
                                        <option value="" disabled>Select category...</option>
                                        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                                            {{ cat.name }}
                                        </option>
                                    </select>
                                    <i class="fa-solid fa-chevron-down select-chevron"></i>
                                </div>
                            </div>
                            <div class="author-byline-display">
                                <i class="fa-solid fa-pen-nib"></i><span>By <strong>{{ authorName }}</strong></span>
                            </div>
                        </div>

                        <!-- Story Excerpt -->
                        <div class="excerpt-box-wrapper" id="excerpt-box-wrapper">
                            <label for="article-excerpt" class="excerpt-label">
                                <i class="fa-solid fa-align-left"></i><span>Excerpt</span>
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
                                <span id="excerpt-char-count" class="excerpt-char-count">{{ excerpt.length }} / 255</span>
                            </div>
                        </div>

                        <!-- Formatting Toolbar -->
                        <div class="editor-toolbar" id="editor-toolbar" role="toolbar">
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

                        <!-- Editor Content -->
                        <div class="editor-body-wrapper" id="editor-body-wrapper">
                            <div
                                id="editor-content"
                                ref="editorRef"
                                class="rich-editor-content"
                                contenteditable="true"
                                spellcheck="true"
                                data-placeholder="Write your article here..."
                                @input="onEditorInput"
                            ></div>
                        </div>

                        <!-- Footer Actions Bar -->
                        <div class="editor-footer-bar">
                            <div class="editor-metrics-left">
                                <span class="metric-pill">
                                    <i class="fa-solid fa-font"></i><span id="words-count">{{ wordCount }} words</span>
                                </span>
                            </div>
                            <div class="editor-actions-right">
                                <button
                                    type="button"
                                    id="btn-save-draft"
                                    class="btn-secondary-action"
                                    :disabled="isSavingDraft || isSubmitting"
                                    @click="handleSaveDraft"
                                >
                                    <i class="fa-regular fa-floppy-disk"></i>
                                    <span>{{ isSavingDraft ? 'Saving...' : 'Save Draft' }}</span>
                                </button>
                                <button
                                    type="button"
                                    id="btn-submit-article"
                                    class="btn-submit-primary"
                                    :disabled="isSavingDraft || isSubmitting"
                                    @click="handleSubmitArticle"
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                    <span>{{ isSubmitting ? 'Submitting...' : 'Submit Article' }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- View 2: Drafts View Container -->
                <div v-show="activeTab === 'drafts'" class="drafts-view view-container" id="drafts-view" role="tabpanel">
                    <div class="drafts-view-container">
                        <div class="drafts-list-container" id="drafts-list-container">
                            <div
                                v-for="draft in drafts"
                                :key="draft.id"
                                class="draft-box"
                                :data-id="draft.id"
                            >
                                <div class="draft-box-content">
                                    <div class="draft-box-meta">
                                        <span class="draft-box-category">{{ draft.category || 'General' }}</span>
                                        <span class="draft-box-date">
                                            <i class="fa-regular fa-calendar" aria-hidden="true"></i> Saved {{ draft.date }}
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
                                        <i class="fa-solid fa-pen"></i><span>Edit Draft</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-draft-delete"
                                        @click="openDeleteModal(draft)"
                                        title="Delete draft"
                                    >
                                        <i class="fa-regular fa-trash-can"></i><span>Delete</span>
                                    </button>
                                </div>
                            </div>

                            <div v-if="drafts.length === 0" id="empty-drafts-state" class="empty-drafts-box">
                                <i class="fa-regular fa-folder-open"></i>
                                <h3 class="empty-drafts-title">No drafts yet</h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- Delete Draft Confirmation Modal -->
        <div
            v-if="isDeleteModalOpen && draftToDelete"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeDeleteModal"
        >
            <div class="modal-card" style="max-width: 440px; padding: 24px; text-align: center;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee4e2; color: #d92d20; display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-bottom: 16px;">
                    <i class="fa-regular fa-trash-can"></i>
                </div>
                <h3 style="margin: 0 0 8px; font-size: 1.15rem; color: #101828;">Delete Draft?</h3>
                <p style="font-size: 0.88rem; color: #475467; margin-bottom: 24px;">
                    Are you sure you want to delete "<strong>{{ draftToDelete.title }}</strong>"? This action cannot be undone.
                </p>
                <div style="display: flex; justify-content: center; gap: 12px;">
                    <button type="button" class="btn-card-action" @click="closeDeleteModal" :disabled="isDeleting">
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-primary-action"
                        style="background: #d92d20 !important; border-color: #d92d20 !important;"
                        @click="confirmDeleteDraft"
                        :disabled="isDeleting"
                    >
                        {{ isDeleting ? 'Deleting...' : 'Yes, Delete' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Toast Notification -->
        <div
            v-if="toastMessage"
            class="toast-message"
            :class="toastType"
            style="position: fixed; bottom: 24px; right: 24px; z-index: 9999; background: #101828; color: #fff; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
        >
            {{ toastMessage }}
        </div>
    </SectionHeadLayout>
</template>
