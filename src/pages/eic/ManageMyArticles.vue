<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import EicLayout from '../../layouts/EicLayout.vue';
import { getEicMyArticles, deleteEicDraft } from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';
import '../../assets/css/shared-manage-my-articles.css';
import '../../assets/css/executive-manage-my-articles.css';

const router = useRouter();

// State
const isLoading = ref(true);
const articles = ref([]);
const activeTab = ref('all');
const searchQuery = ref('');
const currentSort = ref('newest');

// Toast notification state
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

// Modal States
const isViewerOpen = ref(false);
const activeArticle = ref(null);

const isRemarksModalOpen = ref(false);
const remarksArticle = ref(null);

const isDeleteModalOpen = ref(false);
const draftToDelete = ref(null);
const isDeleting = ref(false);

function calculateReadingTime(text) {
    if (!text) return '1 min read';
    const plainText = text.replace(/<[^>]+>/g, '').trim();
    const words = plainText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

function formatNumber(num) {
    if (!num) return '0';
    return Number(num).toLocaleString('en-US');
}

function getBadgeClass(status) {
    if (!status) return 'status-draft';
    const s = status.toLowerCase();
    if (s.includes('published')) return 'status-published';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    if (s.includes('archived')) return 'status-archived';
    return 'status-draft';
}

function getBadgeLabel(status) {
    if (!status) return 'Draft';
    const s = status.toLowerCase();
    if (s.includes('published')) return 'Published';
    if (s.includes('pending')) return 'Pending Review';
    if (s.includes('revision')) return 'For Revision';
    if (s.includes('archived')) return 'Archived';
    return 'Draft';
}

function openViewer(article) {
    activeArticle.value = article;
    isViewerOpen.value = true;
    document.body.style.overflow = 'hidden';
}

function closeViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
    document.body.style.overflow = '';
}

function openRemarks(article) {
    remarksArticle.value = article;
    isRemarksModalOpen.value = true;
    document.body.style.overflow = 'hidden';
}

function closeRemarks() {
    isRemarksModalOpen.value = false;
    remarksArticle.value = null;
    document.body.style.overflow = '';
}

function promptDeleteDraft(article) {
    draftToDelete.value = article;
    isDeleteModalOpen.value = true;
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    isDeleteModalOpen.value = false;
    draftToDelete.value = null;
    document.body.style.overflow = '';
}

async function confirmDeleteDraft() {
    if (!draftToDelete.value) return;
    isDeleting.value = true;
    try {
        await deleteEicDraft(draftToDelete.value.id);
        articles.value = articles.value.filter(a => a.id !== draftToDelete.value.id);
        showToast('Draft deleted successfully.', 'success');
        closeDeleteModal();
    } catch (err) {
        showToast('Could not delete draft. Please try again.', 'error');
    } finally {
        isDeleting.value = false;
    }
}

async function loadArticles(forceFresh = false) {
    isLoading.value = true;
    try {
        const data = await getEicMyArticles(forceFresh);
        if (Array.isArray(data)) {
            articles.value = data;
        }
    } catch (err) {
        console.warn('Could not load EIC authored articles:', err);
    } finally {
        isLoading.value = false;
    }
}

// Counts for filter tabs
const counts = computed(() => {
    const list = articles.value;
    return {
        all: list.length,
        published: list.filter(a => (a.status || '').toLowerCase().includes('published')).length,
        pending: list.filter(a => (a.status || '').toLowerCase().includes('pending')).length,
        draft: list.filter(a => (a.status || '').toLowerCase() === 'draft').length,
        revision: list.filter(a => (a.status || '').toLowerCase().includes('revision')).length,
    };
});

// Filtered and sorted article list
const filteredArticles = computed(() => {
    let list = articles.value;

    if (activeTab.value === 'published') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('published'));
    } else if (activeTab.value === 'pending') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('pending'));
    } else if (activeTab.value === 'draft') {
        list = list.filter(a => (a.status || '').toLowerCase() === 'draft');
    } else if (activeTab.value === 'revision') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('revision'));
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(a => {
            const title = (a.title || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            const status = (a.status || '').toLowerCase();
            return title.includes(q) || cat.includes(q) || status.includes(q);
        });
    }

    return [...list].sort((a, b) => {
        if (currentSort.value === 'oldest') {
            return new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date);
        } else if (currentSort.value === 'views') {
            return (b.views || 0) - (a.views || 0);
        } else if (currentSort.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        return new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date);
    });
});

onMounted(() => {
    loadArticles();
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
            <!-- Header Row -->
            <div class="page-title-section animate-fade-in delay-1">
                <div class="page-title-wrap">
                    <h1 class="page-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                        Manage My Articles
                    </h1>
                </div>
            </div>

            <!-- Filter Tabs Row -->
            <div class="manage-tabs-container animate-fade-in delay-2">
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'all' }"
                    @click="activeTab = 'all'"
                >
                    <i class="fa-solid fa-list-ul"></i>
                    <span>All</span>
                    <span class="tab-count-badge">{{ counts.all }}</span>
                </button>

                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'published' }"
                    @click="activeTab = 'published'"
                >
                    <i class="fa-regular fa-circle-check"></i>
                    <span>Published</span>
                    <span class="tab-count-badge">{{ counts.published }}</span>
                </button>

                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'pending' }"
                    @click="activeTab = 'pending'"
                >
                    <i class="fa-regular fa-clock"></i>
                    <span>Pending</span>
                    <span class="tab-count-badge">{{ counts.pending }}</span>
                </button>

                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'draft' }"
                    @click="activeTab = 'draft'"
                >
                    <i class="fa-regular fa-file-lines"></i>
                    <span>Drafts</span>
                    <span class="tab-count-badge">{{ counts.draft }}</span>
                </button>

                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'revision' }"
                    @click="activeTab = 'revision'"
                >
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>For Revision</span>
                    <span class="tab-count-badge">{{ counts.revision }}</span>
                </button>
            </div>

            <!-- Toolbar (Search & Sort) -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        type="search"
                        v-model="searchQuery"
                        class="manage-search-input"
                        placeholder="Search by article headline, category..."
                        aria-label="Search my articles"
                    >
                    <button
                        v-if="searchQuery"
                        type="button"
                        class="clear-search-icon"
                        @click="searchQuery = ''"
                        title="Clear search"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="toolbar-sort-wrap" style="display: flex; align-items: center; gap: 8px;">
                    <label for="sort-select" style="font-size: 0.88rem; color: #475467; font-weight: 500;">
                        <i class="fa-solid fa-arrow-down-wide-short"></i> Sort:
                    </label>
                    <select
                        id="sort-select"
                        v-model="currentSort"
                        class="archive-select"
                        style="padding: 6px 12px; border: 1px solid #d0d5dd; border-radius: 6px; font-size: 0.88rem; background: #fff;"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="views">Most Views</option>
                        <option value="az">Headline (A–Z)</option>
                    </select>
                </div>
            </div>

            <!-- Articles Feed -->
            <section class="articles-panel animate-fade-in delay-3" aria-labelledby="articles-feed-heading">
                <div class="articles-header-meta">
                    <span class="articles-results-counter">
                        Showing {{ filteredArticles.length }} article{{ filteredArticles.length === 1 ? '' : 's' }}
                    </span>
                </div>

                <div v-if="filteredArticles.length > 0" class="my-articles-feed">
                    <article
                        v-for="item in filteredArticles"
                        :key="item.id"
                        class="my-article-card"
                    >
                        <div class="my-article-card-main">
                            <div class="my-article-header-row">
                                <span class="my-article-cat-badge">{{ item.category || 'General' }}</span>
                                <span class="my-article-status-pill" :class="getBadgeClass(item.status)">
                                    {{ getBadgeLabel(item.status) }}
                                </span>
                            </div>

                            <h3
                                class="my-article-headline"
                                @click="openViewer(item)"
                                style="font-family: 'Playfair Display', Georgia, serif !important; cursor: pointer;"
                            >
                                {{ item.title }}
                            </h3>

                            <p class="my-article-excerpt">
                                {{ item.excerpt || 'No summary excerpt provided for this article.' }}
                            </p>

                            <div class="my-article-footer-meta">
                                <div class="footer-meta-left">
                                    <span class="meta-date">
                                        <i class="fa-regular fa-calendar"></i>
                                        <span>{{ item.date }}</span>
                                    </span>
                                    <span class="meta-dot">•</span>
                                    <span class="meta-views" title="Total Views">
                                        <i class="fa-regular fa-eye"></i>
                                        <span>{{ formatNumber(item.views) }} views</span>
                                    </span>
                                    <span class="meta-dot">•</span>
                                    <span class="meta-reading-time">
                                        <i class="fa-regular fa-clock"></i>
                                        <span>{{ calculateReadingTime(item.content) }}</span>
                                    </span>
                                </div>

                                <div class="footer-meta-actions">
                                    <!-- View Modal Trigger -->
                                    <button
                                        type="button"
                                        class="btn-meta-action btn-meta-view"
                                        @click="openViewer(item)"
                                        title="View manuscript"
                                    >
                                        <i class="fa-regular fa-eye"></i>
                                        <span>View</span>
                                    </button>

                                    <!-- View Remarks Trigger -->
                                    <button
                                        v-if="item.remarks"
                                        type="button"
                                        class="btn-meta-action btn-meta-remarks"
                                        @click="openRemarks(item)"
                                        title="View feedback from section head or EIC"
                                    >
                                        <i class="fa-solid fa-comment-dots"></i>
                                        <span>Remarks</span>
                                    </button>

                                    <!-- Edit / Revise Draft Trigger -->
                                    <router-link
                                        v-if="item.status === 'Draft' || item.status === 'For Revision'"
                                        :to="`/eic/submit-article?draft_id=${item.id}`"
                                        class="btn-meta-action btn-meta-edit"
                                        title="Resume writing"
                                    >
                                        <i class="fa-solid fa-pen-to-square"></i>
                                        <span>Edit</span>
                                    </router-link>

                                    <!-- Delete Draft Trigger -->
                                    <button
                                        v-if="item.status === 'Draft'"
                                        type="button"
                                        class="btn-meta-action btn-meta-delete text-danger"
                                        @click="promptDeleteDraft(item)"
                                        title="Delete draft"
                                    >
                                        <i class="fa-regular fa-trash-can"></i>
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>

                <!-- Empty State -->
                <div v-else-if="!isLoading" class="table-empty-state" style="text-align: center; padding: 48px 16px;">
                    <div class="empty-state-icon" style="font-size: 2.5rem; color: #9ca3af; margin-bottom: 12px;">
                        <i class="fa-regular fa-folder-open"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">
                        No articles found
                    </h3>
                    <p style="font-size: 0.9rem; color: #6b7280; margin: 0;">
                        {{ searchQuery ? 'No articles match your search filter.' : 'You have not submitted or drafted any articles under this category yet.' }}
                    </p>
                </div>
            </section>
        </main>

        <!-- Viewer Modal -->
        <div v-if="isViewerOpen && activeArticle" class="modal-overlay" role="dialog" aria-modal="true" @click.self="closeViewer">
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span class="viewer-category-tag">{{ activeArticle.category || 'General' }}</span>
                        <span class="viewer-dot">·</span>
                        <span class="viewer-date">{{ activeArticle.date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time"><i class="fa-regular fa-clock"></i> {{ calculateReadingTime(activeArticle.content) }}</span>
                        <button type="button" class="viewer-close-btn" @click="closeViewer" aria-label="Close article preview">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 class="viewer-title" style="font-family: 'Playfair Display', Georgia, serif !important;">{{ activeArticle.title }}</h1>
                    
                    <div class="viewer-byline-row">
                        <div class="viewer-byline-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true" style="color: #5c0a18; font-size: 0.85rem; margin-right: 4px;"></i>
                            <span class="viewer-by">By <strong class="viewer-author-name">{{ activeArticle.author || 'Staff Writer' }}</strong></span>
                        </div>
                    </div>

                    <p v-if="activeArticle.excerpt" class="viewer-excerpt" style="display: block; margin: 16px 0; color: #475467; font-style: italic;">
                        {{ activeArticle.excerpt }}
                    </p>

                    <div
                        class="viewer-content-text article-body-streamlined"
                        v-html="formatCleanArticleContent(activeArticle.content)"
                        style="line-height: 1.75; font-size: 1rem; color: #1f2937;"
                    ></div>

                    <!-- Remarks in viewer if present -->
                    <div v-if="activeArticle.remarks" class="manuscript-remarks-section" style="display: block; margin-top: 24px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                        <label class="remarks-label" style="font-weight: 600; color: #92400e; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <i class="fa-solid fa-comment-dots"></i>
                            <span>Editorial Remarks:</span>
                        </label>
                        <div style="font-size: 0.9rem; color: #78350f;">{{ activeArticle.remarks }}</div>
                    </div>
                </div>

                <div class="viewer-modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb;">
                    <router-link
                        v-if="activeArticle.status === 'Draft' || activeArticle.status === 'For Revision'"
                        :to="`/eic/submit-article?draft_id=${activeArticle.id}`"
                        class="btn-manage-action"
                        style="padding: 8px 16px; background: #5c0a18; color: #ffffff; border-radius: 6px; text-decoration: none; font-size: 0.88rem; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit Manuscript</span>
                    </router-link>
                    <button type="button" class="btn-secondary" @click="closeViewer" style="padding: 8px 16px; border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; font-size: 0.88rem; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>

        <!-- Remarks Dialog Modal -->
        <div v-if="isRemarksModalOpen && remarksArticle" class="modal-overlay" role="dialog" aria-modal="true" @click.self="closeRemarks">
            <div class="modal-card" style="max-width: 520px; width: 100%; padding: 24px; border-radius: 12px; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment-dots" style="color: #d97706;"></i>
                        <span>Editorial Remarks</span>
                    </h3>
                    <button type="button" @click="closeRemarks" style="border: none; background: none; font-size: 1.1rem; cursor: pointer; color: #9ca3af;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <p style="font-size: 0.85rem; color: #6b7280; margin: 0 0 12px 0;">
                    Feedback on <strong>"{{ remarksArticle.title }}"</strong>:
                </p>

                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; font-size: 0.92rem; color: #78350f; line-height: 1.6; white-space: pre-wrap;">
                    {{ remarksArticle.remarks }}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <router-link
                        :to="`/eic/submit-article?draft_id=${remarksArticle.id}`"
                        class="btn-edit-revise-now"
                        style="padding: 8px 16px; background: #700f2b !important; color: #ffffff !important; border-radius: 6px; text-decoration: none; font-size: 0.88rem; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit and Revise Now</span>
                    </router-link>
                    <button type="button" @click="closeRemarks" style="padding: 8px 16px; border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; font-size: 0.88rem; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>

        <!-- Delete Draft Modal -->
        <div v-if="isDeleteModalOpen && draftToDelete" class="modal-overlay" role="dialog" aria-modal="true" @click.self="closeDeleteModal">
            <div class="modal-card" style="max-width: 440px; width: 100%; padding: 24px; border-radius: 12px; background: #ffffff;">
                <h3 style="font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 12px 0;">
                    Delete Draft?
                </h3>
                <p style="font-size: 0.9rem; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">
                    Are you sure you want to permanently delete draft <strong>"{{ draftToDelete.title }}"</strong>?
                </p>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" @click="closeDeleteModal" style="padding: 8px 16px; border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; font-size: 0.88rem; cursor: pointer;">
                        Cancel
                    </button>
                    <button
                        type="button"
                        @click="confirmDeleteDraft"
                        :disabled="isDeleting"
                        style="padding: 8px 18px; border: none; border-radius: 6px; background: #dc2626; color: #ffffff; font-weight: 500; font-size: 0.88rem; cursor: pointer;"
                    >
                        {{ isDeleting ? 'Deleting...' : 'Delete' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Floating Toast Notification -->
        <div v-if="toastMessage" id="toast-container" class="toast-container" aria-live="polite">
            <div class="toast-message" :class="toastType">
                <span class="toast-bullet-dot"></span>
                <span>{{ toastMessage }}</span>
            </div>
        </div>
    </EicLayout>
</template>

<style scoped>
.btn-edit-revise-now {
    background-color: #700f2b !important;
    border-color: #700f2b !important;
    color: #ffffff !important;
    transition: background-color 0.18s ease, transform 0.12s ease;
}
.btn-edit-revise-now:hover {
    background-color: #580c22 !important;
    border-color: #580c22 !important;
    color: #ffffff !important;
}
</style>
