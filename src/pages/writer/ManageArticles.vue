<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import WriterLayout from '../../layouts/WriterLayout.vue';
import { getWriterArticles, deleteWriterDraft } from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/shared-manage-my-articles.css';

const router = useRouter();
const route = useRoute();

// State
const isLoading = ref(true);
const articles = ref([]);
const activeTab = ref('all');
const searchQuery = ref('');
const currentSort = ref('newest');

// Centered Modal Toast/Feedback replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Modal States
const isViewerOpen = ref(false);
const activeArticle = ref(null);

function getAuthorAvatar(article) {
    const raw = article?.author_avatar || article?.authorAvatar || localStorage.getItem('userAvatar');
    if (!raw) return '/images/member-placeholder.svg';
    return optimizeCloudinaryUrl(raw, { width: 100, crop: 'limit' });
}

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
    if (s.includes('publish') || s.includes('approve')) return 'status-published';
    if (s.includes('section')) return 'status-pending';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    return 'status-draft';
}

// Tab empty state info (separated from search empty state)
const tabEmptyInfo = computed(() => {
    switch (activeTab.value) {
        case 'published':
            return { icon: 'fa-solid fa-circle-check', title: 'No published articles yet' };
        case 'pending':
            return { icon: 'fa-regular fa-clock', title: 'No pending articles' };
        case 'revision':
            return { icon: 'fa-solid fa-rotate-left', title: 'No articles for revision' };
        case 'drafts':
            return { icon: 'fa-regular fa-folder-open', title: 'No drafts yet' };
        default:
            return { icon: 'fa-regular fa-newspaper', title: 'No articles yet' };
    }
});

// Counts for each tab badge
const tabCounts = computed(() => {
    const counts = { all: articles.value.length, published: 0, pending: 0, revision: 0, drafts: 0 };
    articles.value.forEach(art => {
        const s = (art.status || '').toLowerCase();
        if (s.includes('publish') || s.includes('approve')) counts.published++;
        else if (s.includes('head revision') || s.includes('section revision')) {
            // Strictly between EIC and Section Head; do not put on pending review or revision of writer
        }
        else if (s.includes('pending')) counts.pending++;
        else if (s.includes('revision')) counts.revision++;
        else if (s.includes('draft')) counts.drafts++;
    });
    return counts;
});

// Filtered and Sorted Articles
const filteredArticles = computed(() => {
    let list = articles.value.slice();

    // 1. Tab filter
    if (activeTab.value !== 'all') {
        list = list.filter(art => {
            const s = (art.status || '').toLowerCase();
            if (activeTab.value === 'published') return s.includes('publish') || s.includes('approve');
            if (activeTab.value === 'pending') return s.includes('pending') && !s.includes('head revision') && !s.includes('section revision');
            if (activeTab.value === 'revision') return s.includes('revision') && !s.includes('head revision') && !s.includes('section revision');
            if (activeTab.value === 'drafts') return s.includes('draft');
            return true;
        });
    }

    // 2. Search query filter
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(art => {
            const title = (art.title || '').toLowerCase();
            const category = (art.category || '').toLowerCase();
            const excerpt = (art.excerpt || '').toLowerCase();
            return title.includes(q) || category.includes(q) || excerpt.includes(q);
        });
    }

    // 3. Sorting
    list.sort((a, b) => {
        if (currentSort.value === 'newest') {
            return new Date(b.rawDate || b.created_at || 0) - new Date(a.rawDate || a.created_at || 0);
        }
        if (currentSort.value === 'oldest') {
            return new Date(a.rawDate || a.created_at || 0) - new Date(b.rawDate || b.created_at || 0);
        }
        if (currentSort.value === 'popular') {
            return (b.views || 0) - (a.views || 0);
        }
        if (currentSort.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
    });

    return list;
});

function clearSearch() {
    searchQuery.value = '';
}

function resetFilters() {
    searchQuery.value = '';
    activeTab.value = 'all';
    currentSort.value = 'newest';
}

// Viewer Modal actions
function openViewer(art) {
    activeArticle.value = art;
    isViewerOpen.value = true;
}

function closeViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
}

// Remarks Modal actions
function openRemarksModal(art, event) {
    if (event) event.stopPropagation();
    remarksArticle.value = art;
    isRemarksModalOpen.value = true;
}

function closeRemarksModal() {
    isRemarksModalOpen.value = false;
    remarksArticle.value = null;
}

function editFromRemarks() {
    if (!remarksArticle.value) return;
    const id = remarksArticle.value.id;
    closeRemarksModal();
    router.push({ path: '/writer/submit-article', query: { draft_id: id } });
}

// Edit & Delete actions
function goToEdit(id, event) {
    if (event) event.stopPropagation();
    router.push({ path: '/writer/submit-article', query: { draft_id: id } });
}

async function confirmDeleteDraft(art, event) {
    if (event) event.stopPropagation();
    draftToDelete.value = art;

    const confirmed = await confirmAction({
        title: 'Delete Draft',
        message: `Are you sure you want to delete "${art.title}"?`,
        confirmText: 'Delete Draft',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;

    await executeDeleteDraft();
}

function cancelDelete() {
    isDeleteModalOpen.value = false;
    draftToDelete.value = null;
}

async function executeDeleteDraft() {
    if (!draftToDelete.value || isDeleting.value) return;
    isDeleting.value = true;
    const id = draftToDelete.value.id;

    try {
        await deleteWriterDraft(id);
        articles.value = articles.value.filter(a => a.id !== id);
        showToast('Draft deleted successfully.', 'success');
        cancelDelete();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to delete draft.', 'danger');
    } finally {
        isDeleting.value = false;
    }
}

function syncFiltersFromRoute() {
    if (route.query.tab) {
        const validTabs = ['all', 'published', 'pending', 'revision', 'drafts'];
        const tabLower = String(route.query.tab).toLowerCase();
        if (validTabs.includes(tabLower)) {
            activeTab.value = tabLower;
        }
    }
    if (route.query.sort) {
        const validSorts = ['newest', 'oldest', 'popular', 'az'];
        const sortLower = String(route.query.sort).toLowerCase();
        if (validSorts.includes(sortLower)) {
            currentSort.value = sortLower;
        }
    }
}

watch(() => route.query.tab, syncFiltersFromRoute);
watch(() => route.query.sort, syncFiltersFromRoute);

onMounted(async () => {
    syncFiltersFromRoute();
    try {
        const data = await getWriterArticles();
        if (data?.articles) {
            articles.value = data.articles;
        }
    } catch (err) {
        console.warn('Error loading articles:', err);
    } finally {
        isLoading.value = false;
    }
});
</script>

<template>
    <WriterLayout>
        <main class="content-container">
            <!-- Header Row -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="page-title">Manage My Articles</h1>
                </div>
                <div class="writer-header-right">
                    <router-link to="/writer/submit-article" class="btn-primary-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="manage-tabs-container animate-fade-in delay-2" role="tablist" aria-label="Filter my articles">
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'all' }"
                    @click="activeTab = 'all'"
                    role="tab"
                    :aria-selected="activeTab === 'all'"
                >
                    <i class="fa-solid fa-layer-group"></i>
                    <span>All Articles</span>
                    <span id="badge-count-all" class="tab-count-badge">{{ tabCounts.all }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'published' }"
                    @click="activeTab = 'published'"
                    role="tab"
                    :aria-selected="activeTab === 'published'"
                >
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Published</span>
                    <span id="badge-count-published" class="tab-count-badge">{{ tabCounts.published }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'pending' }"
                    @click="activeTab = 'pending'"
                    role="tab"
                    :aria-selected="activeTab === 'pending'"
                >
                    <i class="fa-regular fa-clock"></i>
                    <span>Pending Review</span>
                    <span id="badge-count-pending" class="tab-count-badge">{{ tabCounts.pending }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'revision' }"
                    @click="activeTab = 'revision'"
                    role="tab"
                    :aria-selected="activeTab === 'revision'"
                >
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>For Revision</span>
                    <span id="badge-count-revision" class="tab-count-badge">{{ tabCounts.revision }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'drafts' }"
                    @click="activeTab = 'drafts'"
                    role="tab"
                    :aria-selected="activeTab === 'drafts'"
                >
                    <i class="fa-regular fa-folder-open"></i>
                    <span>Drafts</span>
                    <span id="badge-count-drafts" class="tab-count-badge">{{ tabCounts.drafts }}</span>
                </button>
            </div>

            <!-- Toolbar: Search Bar & Sort Dropdown -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        type="text"
                        id="writer-search-input"
                        class="manage-search-input"
                        v-model="searchQuery"
                        placeholder="Search my articles by title, section, or keyword..."
                        aria-label="Search my articles"
                        autocomplete="off"
                    >
                    <button
                        v-if="searchQuery"
                        type="button"
                        id="clear-search-btn"
                        class="clear-search-icon"
                        @click="clearSearch"
                        title="Clear search"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="review-sort-container">
                    <label for="writer-sort-select" class="review-sort-label">
                        <i class="fa-solid fa-arrow-down-short-wide"></i>
                        <span>Sort:</span>
                    </label>
                    <div class="sort-select-wrapper">
                        <select
                            id="writer-sort-select"
                            v-model="currentSort"
                            class="review-sort-select"
                            aria-label="Sort articles"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Most Viewed</option>
                            <option value="az">A–Z</option>
                        </select>
                        <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                    </div>
                </div>
            </div>

            <!-- Articles List -->
            <section class="writer-articles-list animate-fade-in delay-3" id="writer-manage-list" aria-label="My articles list">
                <article
                    v-for="art in filteredArticles"
                    :key="art.id"
                    class="writer-article-card manage-article-card"
                    tabindex="0"
                    role="button"
                    :aria-label="'View article: ' + art.title"
                    @click="openViewer(art)"
                    @keydown.enter="openViewer(art)"
                >
                    <div class="article-card-header">
                        <div class="article-card-meta">
                            <span class="article-card-category">{{ art.category || 'General' }}</span>
                            <span class="meta-dot">&bull;</span>
                            <span class="article-card-date">
                                <i class="fa-regular fa-calendar"></i> {{ art.date }}
                            </span>
                            <template v-if="art.status === 'Published' && art.views !== undefined">
                                <span class="meta-dot">&bull;</span>
                                <span class="article-card-date">
                                    <i class="fa-regular fa-eye"></i> {{ formatNumber(art.views) }} views
                                </span>
                            </template>
                            <template v-if="art.content">
                                <span class="meta-dot">&bull;</span>
                                <span class="article-card-date">
                                    <i class="fa-regular fa-clock"></i> {{ calculateReadingTime(art.content) }}
                                </span>
                            </template>
                            <template v-if="art.remarks && (art.status.includes('Revision') || art.status.includes('revision')) && !art.status.toLowerCase().includes('head') && !art.status.toLowerCase().includes('section')">
                                <span class="meta-dot">&bull;</span>
                                <span
                                    class="btn-show-remarks"
                                    @click="openRemarksModal(art, $event)"
                                    style="color: #700f2b; font-size: 0.74rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"
                                    title="View feedback"
                                >
                                    <i class="fa-solid fa-comment-dots"></i> Feedback
                                </span>
                            </template>
                        </div>
                        <div class="article-card-status-top">
                            <span class="status-badge" :class="getBadgeClass(art.status)">{{ art.status }}</span>
                        </div>
                    </div>

                    <div class="article-card-body">
                        <div class="article-card-body-content">
                            <h3 class="article-card-title">{{ art.title }}</h3>
                            <p v-if="art.excerpt" class="article-card-excerpt">{{ art.excerpt }}</p>
                        </div>

                        <!-- Card Actions: Placed katapat (opposite/adjacent) of title & excerpt -->
                        <div
                            v-if="art.status === 'Draft' || ((art.status.includes('Revision') || art.status.includes('revision')) && !art.status.toLowerCase().includes('head') && !art.status.toLowerCase().includes('section'))"
                            class="article-card-actions"
                        >
                            <button
                                type="button"
                                class="btn-box-view btn-box-edit"
                                :title="art.status === 'Draft' ? 'Edit draft in editor' : 'Edit and revise manuscript'"
                                @click.stop="goToEdit(art.id, $event)"
                            >
                                <i class="fa-solid fa-pen-to-square"></i>
                                <span>Edit</span>
                            </button>

                            <button
                                v-if="art.status === 'Draft'"
                                type="button"
                                class="btn-box-delete btn-delete-draft"
                                title="Delete draft"
                                @click.stop="confirmDeleteDraft(art, $event)"
                            >
                                <i class="fa-regular fa-trash-can"></i>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </article>

                <!-- Search Empty State (when search query yields 0 results) -->
                <div v-if="!isLoading && searchQuery.trim() && filteredArticles.length === 0" class="manage-empty-state" role="status">
                    <div class="manage-empty-icon">
                        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    </div>
                    <h3 class="manage-empty-title">No articles found</h3>
                    <button type="button" id="reset-filters-btn" class="btn-reset-filters btn-reset-search" @click="clearSearch">
                        <i class="fa-solid fa-rotate-left"></i> Reset Search
                    </button>
                </div>

                <!-- Tab / Category Empty State (when active tab has 0 articles and not searching) -->
                <div v-if="!isLoading && !searchQuery.trim() && filteredArticles.length === 0" class="manage-empty-state" role="status">
                    <div class="manage-empty-icon">
                        <i :class="tabEmptyInfo.icon" aria-hidden="true"></i>
                    </div>
                    <h3 class="manage-empty-title">{{ tabEmptyInfo.title }}</h3>
                </div>
            </section>
        </main>

        <!-- Article Viewer Modal -->
        <div
            v-if="isViewerOpen && activeArticle"
            id="article-viewer-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-title"
            @click.self="closeViewer"
        >
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span class="viewer-category-tag">{{ activeArticle.category }}</span>
                        <span class="viewer-dot">·</span>
                        <span class="viewer-date">{{ activeArticle.date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time">
                            <i class="fa-regular fa-clock"></i>
                            <span>{{ calculateReadingTime(activeArticle.content) }}</span>
                        </span>
                        <button type="button" class="viewer-close-btn" @click="closeViewer" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 class="viewer-title">{{ activeArticle.title }}</h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img
                                :src="getAuthorAvatar(activeArticle)"
                                :alt="(activeArticle.author || 'Author') + ' avatar'"
                                loading="lazy"
                            >
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong>{{ activeArticle.author }}</strong></span>
                        </div>
                    </div>

                    <div v-if="activeArticle.remarks && (activeArticle.status.includes('Revision') || activeArticle.status.includes('revision')) && !activeArticle.status.toLowerCase().includes('head') && !activeArticle.status.toLowerCase().includes('section')" class="viewer-remarks-container" style="margin-bottom: 20px; padding: 12px 16px; background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 4px;">
                        <h4 style="margin: 0 0 4px; font-size: 0.85rem; font-weight: 700; color: #9f1239;">Revision Remarks:</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: #4c0519;">{{ activeArticle.remarks }}</p>
                    </div>

                    <div class="viewer-content-text" v-html="formatCleanArticleContent(activeArticle.content || activeArticle.excerpt)"></div>
                </div>
            </div>
        </div>

        <!-- Remarks Modal -->
        <div
            v-if="isRemarksModalOpen && remarksArticle"
            id="remarks-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remarks-modal-title"
            @click.self="closeRemarksModal"
        >
            <div class="modal-card remarks-modal-card" style="max-width: 560px; width: 100%; border-radius: 14px; background: #ffffff; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18); overflow: hidden;">
                <div class="remarks-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment-dots" style="color: #700f2b; font-size: 1.1rem;"></i>
                        <h2 id="remarks-modal-title" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #111827;">Revision Remarks</h2>
                    </div>
                    <button
                        type="button"
                        class="viewer-close-btn"
                        @click="closeRemarksModal"
                        aria-label="Close modal"
                        style="background: transparent !important; border: none !important; width: 32px !important; height: 32px !important; border-radius: 8px !important; color: #667085 !important; font-size: 1.1rem !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 0 0 auto !important; flex-shrink: 0 !important; transition: all 0.2s ease !important;"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="remarks-modal-body" style="padding: 24px;">
                    <p style="font-size: 1.05rem; font-weight: 700; color: #101828; margin: 0 0 14px 0; line-height: 1.4;">
                        {{ remarksArticle.title }}
                    </p>
                    <div class="remarks-content-box" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.85rem; color: #9f1239; margin-bottom: 6px;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>Feedback:</span>
                        </div>
                        <p style="margin: 0; color: #4c0519; font-size: 0.92rem; line-height: 1.55; white-space: pre-wrap;">
                            {{ remarksArticle.remarks || 'No remarks provided.' }}
                        </p>
                    </div>
                    <div class="remarks-modal-footer" style="margin-top: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
                        <button
                            type="button"
                            class="btn-cancel"
                            @click="closeRemarksModal"
                            style="height: 38px; padding: 0 16px; border: 1px solid #d0d5dd; background: #ffffff; color: #344054; border-radius: 8px; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            class="btn-primary-action btn-edit-revise-now"
                            style="height: 38px; padding: 0 18px; background-color: #700f2b !important; color: #ffffff !important; border: 1px solid #700f2b !important; border-radius: 8px; font-weight: 600; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.15s ease;"
                            @click="editFromRemarks"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Edit and Revise Now</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </WriterLayout>
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
