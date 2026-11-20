<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import { getExecutiveMyArticles, deleteExecutiveDraft } from '../../services/api.js';
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
    if (s === 'published') return 'status-published';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    if (s === 'draft') return 'status-draft';
    return 'status-draft';
}

async function loadArticles() {
    isLoading.value = true;
    try {
        const data = await getExecutiveMyArticles(true);
        if (data && Array.isArray(data.articles)) {
            articles.value = data.articles;
        } else if (Array.isArray(data)) {
            articles.value = data;
        }
    } catch (err) {
        console.error('Failed to load executive my articles:', err);
        showToast('Failed to load articles.', 'error');
    } finally {
        isLoading.value = false;
    }
}

// Counts for tabs
const totalViews = computed(() => {
    return articles.value
        .filter(a => (a.status || '').toLowerCase() === 'published')
        .reduce((sum, a) => sum + (parseInt(a.views) || 0), 0);
});

const countAll = computed(() => articles.value.length);
const countPublished = computed(() => articles.value.filter(a => (a.status || '').toLowerCase() === 'published').length);
const countPending = computed(() => articles.value.filter(a => (a.status || '').toLowerCase().includes('pending')).length);
const countRevision = computed(() => articles.value.filter(a => (a.status || '').toLowerCase().includes('revision')).length);
const countDrafts = computed(() => articles.value.filter(a => (a.status || '').toLowerCase() === 'draft').length);

// Filtered and sorted articles
const filteredArticles = computed(() => {
    let list = articles.value;

    // Tab filter
    if (activeTab.value === 'published') {
        list = list.filter(a => (a.status || '').toLowerCase() === 'published');
    } else if (activeTab.value === 'pending') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('pending'));
    } else if (activeTab.value === 'revision') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('revision'));
    } else if (activeTab.value === 'drafts') {
        list = list.filter(a => (a.status || '').toLowerCase() === 'draft');
    }

    // Search query
    const query = searchQuery.value.toLowerCase().trim();
    if (query) {
        list = list.filter(a => {
            const titleMatch = (a.title || '').toLowerCase().includes(query);
            const catMatch = (a.category || '').toLowerCase().includes(query);
            const excerptMatch = (a.excerpt || '').toLowerCase().includes(query);
            return titleMatch || catMatch || excerptMatch;
        });
    }

    // Sort
    return list.slice().sort((a, b) => {
        if (currentSort.value === 'newest') {
            return new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date);
        }
        if (currentSort.value === 'oldest') {
            return new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date);
        }
        if (currentSort.value === 'popular') {
            return (b.views || 0) - (a.views || 0);
        }
        if (currentSort.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
    });
});

function switchTab(tab) {
    activeTab.value = tab;
}

function clearSearch() {
    searchQuery.value = '';
}

// Viewer modal
function openArticleViewer(article) {
    activeArticle.value = article;
    isViewerOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeArticleViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
    document.body.classList.remove('modal-open');
}

// Remarks modal
function openRemarksModal(article) {
    remarksArticle.value = article;
    isRemarksModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeRemarksModal() {
    isRemarksModalOpen.value = false;
    remarksArticle.value = null;
    document.body.classList.remove('modal-open');
}

// Delete Draft modal
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

async function handleDeleteDraft() {
    if (!draftToDelete.value) return;
    isDeleting.value = true;
    try {
        await deleteExecutiveDraft(draftToDelete.value.id);
        showToast('Draft deleted successfully.', 'success');
        closeDeleteModal();
        await loadArticles();
    } catch (err) {
        console.error('Failed to delete draft:', err);
        showToast('Failed to delete draft.', 'error');
    } finally {
        isDeleting.value = false;
    }
}

function editDraft(draft) {
    router.push({
        path: '/executive/submit-article',
        query: { draft_id: draft.id },
    });
}

onMounted(() => {
    loadArticles();
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

            <!-- Page Title Section with Total Views Counter & Action Button -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="page-title">Manage My Articles</h1>
                </div>

                <div class="writer-header-right">
                    <!-- Total Views Header Metric Pill -->
                    <div class="header-views-badge" title="Total Views Across Published Articles">
                        <span class="views-badge-icon">
                            <i class="fa-regular fa-eye"></i>
                        </span>
                        <span class="views-badge-content">
                            <span class="views-badge-label">Total Views</span>
                            <span id="stat-total-views" class="views-badge-val">{{ formatNumber(totalViews) }}</span>
                        </span>
                    </div>

                    <router-link to="/executive/submit-article" class="btn-primary-action">
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
                    :class="{ 'active': activeTab === 'all' }"
                    @click="switchTab('all')"
                >
                    <span>All Articles</span>
                    <span id="badge-count-all" class="tab-count-badge">{{ countAll }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ 'active': activeTab === 'published' }"
                    @click="switchTab('published')"
                >
                    <span>Published</span>
                    <span id="badge-count-published" class="tab-count-badge">{{ countPublished }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ 'active': activeTab === 'pending' }"
                    @click="switchTab('pending')"
                >
                    <span>Pending Review</span>
                    <span id="badge-count-pending" class="tab-count-badge">{{ countPending }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ 'active': activeTab === 'revision' }"
                    @click="switchTab('revision')"
                >
                    <span>For Revision</span>
                    <span id="badge-count-revision" class="tab-count-badge">{{ countRevision }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ 'active': activeTab === 'drafts' }"
                    @click="switchTab('drafts')"
                >
                    <span>Drafts</span>
                    <span id="badge-count-drafts" class="tab-count-badge">{{ countDrafts }}</span>
                </button>
            </div>

            <!-- Search Bar & Sort Dropdown Toolbar -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <!-- Search Bar -->
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        v-model="searchQuery"
                        type="search"
                        id="executive-search-input"
                        class="manage-search-input"
                        placeholder="Search my articles by title, section, or keyword..."
                        aria-label="Search my articles"
                        autocomplete="off"
                    >
                    <button
                        v-if="searchQuery"
                        type="button"
                        id="clear-search-btn"
                        class="clear-search-icon"
                        title="Clear search"
                        @click="clearSearch"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Sort Control -->
                <div class="review-sort-container">
                    <label for="executive-sort-select" class="review-sort-label">
                        <i class="fa-solid fa-arrow-down-short-wide"></i>
                        <span>Sort:</span>
                    </label>
                    <div class="sort-select-wrapper">
                        <select id="executive-sort-select" v-model="currentSort" class="review-sort-select" aria-label="Sort articles">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Most Viewed</option>
                            <option value="az">A–Z</option>
                        </select>
                        <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                    </div>
                </div>
            </div>

            <!-- Articles List Container -->
            <section class="writer-articles-list animate-fade-in delay-3" aria-label="My articles list">
                <article
                    v-for="art in filteredArticles"
                    :key="art.id"
                    class="article-row-card"
                >
                    <div class="article-meta-header">
                        <span class="category-pill">{{ art.category || 'General' }}</span>
                        <span class="dot-separator">•</span>
                        <span class="date-text">{{ art.date }}</span>
                        <span class="status-badge" :class="getBadgeClass(art.status)">{{ art.status }}</span>
                    </div>

                    <h2 class="article-title" :title="art.title" @click="openArticleViewer(art)">
                        {{ art.title }}
                    </h2>

                    <p class="article-excerpt">{{ art.excerpt || 'No excerpt available.' }}</p>

                    <div class="article-footer-row">
                        <div class="article-author-info">
                            <i class="fa-solid fa-pen-nib author-icon"></i>
                            <span class="author-name">By <strong>{{ art.author || 'Author' }}</strong></span>
                            <span class="read-time-pill">{{ calculateReadingTime(art.content || '') }}</span>
                        </div>

                        <div class="article-actions-group">
                            <button
                                v-if="(art.status || '').toLowerCase().includes('revision') && art.remarks"
                                type="button"
                                class="btn-action-outline btn-remarks-trigger"
                                title="View revision remarks"
                                @click="openRemarksModal(art)"
                            >
                                <i class="fa-solid fa-comments"></i>
                                <span>Remarks</span>
                            </button>

                            <button
                                type="button"
                                class="btn-action-outline btn-view"
                                title="View full article"
                                @click="openArticleViewer(art)"
                            >
                                <i class="fa-regular fa-eye"></i>
                                <span>View</span>
                            </button>

                            <template v-if="(art.status || '').toLowerCase() === 'draft'">
                                <button
                                    type="button"
                                    class="btn-action-outline btn-edit"
                                    title="Edit Draft"
                                    @click="editDraft(art)"
                                >
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Edit</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-action-outline btn-delete"
                                    title="Delete Draft"
                                    @click="openDeleteModal(art)"
                                >
                                    <i class="fa-regular fa-trash-can"></i>
                                    <span>Delete</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </article>

                <!-- Empty State -->
                <div v-if="!isLoading && filteredArticles.length === 0" class="manage-empty-state">
                    <i class="fa-regular fa-folder-open empty-icon"></i>
                    <h3 class="empty-title">No articles found</h3>
                    <p class="empty-desc">You do not have any articles matching the selected tab or search query.</p>
                </div>
            </section>
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL 1: Clean Article Viewer Modal (Reading mode)                     -->
        <!-- ====================================================================== -->
        <div v-if="isViewerOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card viewer-modal-card">
                <div class="viewer-header">
                    <div class="viewer-meta-row">
                        <span class="viewer-category-tag">{{ activeArticle?.category || 'News' }}</span>
                        <span class="viewer-meta-divider">•</span>
                        <span class="viewer-read-time">{{ calculateReadingTime(activeArticle?.content || '') }}</span>
                    </div>
                    <button type="button" class="viewer-close-btn" aria-label="Close viewer" @click="closeArticleViewer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="viewer-body">
                    <h2 class="viewer-title">{{ activeArticle?.title }}</h2>
                    <div class="viewer-byline-banner">
                        <i class="fa-solid fa-pen-nib"></i>
                        <span>By <strong>{{ activeArticle?.author || 'Author' }}</strong> • Published on {{ activeArticle?.date }}</span>
                    </div>

                    <div v-if="activeArticle?.excerpt" class="viewer-excerpt">
                        <p>{{ activeArticle.excerpt }}</p>
                    </div>

                    <div class="viewer-content font-serif leading-relaxed" v-html="formatCleanArticleContent(activeArticle?.content, activeArticle?.excerpt)"></div>
                </div>

                <div class="viewer-footer">
                    <button type="button" class="btn-cancel" @click="closeArticleViewer">Close</button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: Revision Remarks Modal                                        -->
        <!-- ====================================================================== -->
        <div v-if="isRemarksModalOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card remarks-modal-card">
                <div class="modal-header-simple">
                    <h3 class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
                        <span>Revision Remarks from Editorial Board</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" aria-label="Close dialog" @click="closeRemarksModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="remarks-modal-body">
                    <div class="remarks-article-preview">
                        <strong>{{ remarksArticle?.title }}</strong>
                    </div>
                    <div class="remarks-content-box">
                        <p>{{ remarksArticle?.remarks || 'No specific remarks entered.' }}</p>
                    </div>
                </div>

                <div class="remarks-modal-footer">
                    <button type="button" class="btn-cancel" @click="closeRemarksModal">Close</button>
                    <button
                        type="button"
                        class="btn-save btn-edit-revise-now"
                        style="background: #700f2b !important; border-color: #700f2b !important; color: #ffffff !important;"
                        @click="editDraft(remarksArticle)"
                    >
                        Edit and Revise Now
                    </button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 3: Delete Draft Modal                                            -->
        <!-- ====================================================================== -->
        <div v-if="isDeleteModalOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card confirm-modal-card">
                <div class="confirm-icon-wrap delete">
                    <i class="fa-solid fa-trash-can"></i>
                </div>

                <h3 class="confirm-title">Delete Draft?</h3>
                <p class="confirm-desc">Are you sure you want to delete this draft? This action cannot be undone.</p>

                <div class="confirm-actions">
                    <button type="button" class="btn-cancel" @click="closeDeleteModal">Cancel</button>
                    <button
                        type="button"
                        class="btn-confirm delete"
                        :disabled="isDeleting"
                        @click="handleDeleteDraft"
                    >
                        <i v-if="isDeleting" class="fa-solid fa-spinner fa-spin"></i>
                        <span>{{ isDeleting ? 'Deleting...' : 'Yes, Delete' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
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
