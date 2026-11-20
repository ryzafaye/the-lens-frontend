<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import { getSectionHeadArticles, deleteSectionHeadDraft } from '../../services/api.js';
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
    if (s.includes('publish')) return 'status-published';
    if (s.includes('approve')) return 'status-approved';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    return 'status-draft';
}

function getStatusLabel(status) {
    if (!status) return 'Draft';
    if (status === 'Pending EIC Review' || status === 'Pending Review') return 'Pending Review';
    return status;
}

// Total views counter computed from published articles
const totalPublishedViews = computed(() => {
    return articles.value
        .filter(a => (a.status || '').toLowerCase().includes('publish'))
        .reduce((sum, a) => sum + (Number(a.views) || 0), 0);
});

// Tab counts
const counts = computed(() => {
    const all = articles.value.length;
    const published = articles.value.filter(a => (a.status || '').toLowerCase() === 'published').length;
    const pending = articles.value.filter(a => (a.status || '').toLowerCase().includes('pending')).length;
    const revision = articles.value.filter(a => (a.status || '').toLowerCase().includes('revision')).length;
    const drafts = articles.value.filter(a => (a.status || '').toLowerCase() === 'draft').length;
    return { all, published, pending, revision, drafts };
});

// Filtered and sorted articles
const filteredArticles = computed(() => {
    let list = [...articles.value];

    // Filter by tab
    if (activeTab.value === 'published') {
        list = list.filter(a => (a.status || '').toLowerCase() === 'published');
    } else if (activeTab.value === 'pending') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('pending'));
    } else if (activeTab.value === 'revision') {
        list = list.filter(a => (a.status || '').toLowerCase().includes('revision'));
    } else if (activeTab.value === 'drafts') {
        list = list.filter(a => (a.status || '').toLowerCase() === 'draft');
    }

    // Filter by search query
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(a => {
            const title = (a.title || '').toLowerCase();
            const category = (a.category || '').toLowerCase();
            const excerpt = (a.excerpt || '').toLowerCase();
            return title.includes(q) || category.includes(q) || excerpt.includes(q);
        });
    }

    // Sort
    list.sort((a, b) => {
        if (currentSort.value === 'popular') {
            return (Number(b.views) || 0) - (Number(a.views) || 0);
        }
        if (currentSort.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        if (currentSort.value === 'oldest') {
            return new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date);
        }
        return new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date);
    });

    return list;
});

function openArticleViewer(art) {
    activeArticle.value = art;
    isViewerOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeArticleViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
    document.body.classList.remove('modal-open');
}

function openRemarksModal(art, event) {
    if (event) event.stopPropagation();
    remarksArticle.value = art;
    isRemarksModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeRemarksModal() {
    isRemarksModalOpen.value = false;
    remarksArticle.value = null;
    document.body.classList.remove('modal-open');
}

function openDeleteModal(art, event) {
    if (event) event.stopPropagation();
    draftToDelete.value = art;
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
        articles.value = articles.value.filter(a => a.id !== draftToDelete.value.id);
        showToast('Draft deleted successfully.', 'success');
        closeDeleteModal();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to delete draft.', 'error');
    } finally {
        isDeleting.value = false;
    }
}

function editDraft(art, event) {
    if (event) event.stopPropagation();
    router.push({
        path: '/section-head/submit-article',
        query: { draft_id: art.id },
    });
}

function editFromRemarks(art) {
    closeRemarksModal();
    editDraft(art);
}

function clearSearch() {
    searchQuery.value = '';
}

async function loadArticles(forceFresh = false) {
    try {
        const data = await getSectionHeadArticles(forceFresh);
        if (data?.articles) {
            articles.value = data.articles;
        }
    } catch (err) {
        console.error('Failed to load Section Head articles:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadArticles();
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container">
            <!-- Page Title Section with Total Views Counter & Action Button (Exact Blade executive-manage-my-articles) -->
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
                            <span id="stat-total-views" class="views-badge-val">{{ formatNumber(totalPublishedViews) }}</span>
                        </span>
                    </div>

                    <router-link to="/section-head/submit-article" class="btn-primary-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- Tabs Navigation Adjusted Directly Under Page Title -->
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
                    <span id="badge-count-all" class="tab-count-badge">{{ counts.all }}</span>
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
                    <span id="badge-count-published" class="tab-count-badge">{{ counts.published }}</span>
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
                    <span id="badge-count-pending" class="tab-count-badge">{{ counts.pending }}</span>
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
                    <span id="badge-count-revision" class="tab-count-badge">{{ counts.revision }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: activeTab === 'drafts' }"
                    @click="activeTab = 'drafts'"
                    role="tab"
                    :aria-selected="activeTab === 'drafts'"
                >
                    <i class="fa-regular fa-file-lines"></i>
                    <span>Drafts</span>
                    <span id="badge-count-drafts" class="tab-count-badge">{{ counts.drafts }}</span>
                </button>
            </div>

            <!-- Search Bar & Sort Dropdown Toolbar (Exact match to executive/manage-my-articles.blade.php) -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <!-- Search Bar -->
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        type="search"
                        id="executive-search-input"
                        v-model="searchQuery"
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
                        @click="clearSearch"
                        title="Clear search"
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
                        <select
                            id="executive-sort-select"
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

            <!-- Articles List Container -->
            <section class="writer-articles-list animate-fade-in delay-3" id="executive-manage-list" aria-label="My articles list">
                <article
                    v-for="item in filteredArticles"
                    :key="item.id"
                    class="writer-article-card"
                    :data-id="item.id"
                    tabindex="0"
                    role="button"
                    @click="openArticleViewer(item)"
                    :aria-label="'View article: ' + item.title"
                >
                    <div class="article-card-header">
                        <div class="article-card-meta">
                            <span class="article-card-category">{{ item.category || 'General' }}</span>
                            <span class="meta-dot">&bull;</span>
                            <span class="article-card-date">
                                <i class="fa-regular fa-calendar"></i> {{ item.date }}
                            </span>
                            <template v-if="(item.status || '').toLowerCase() === 'published' && item.views !== undefined">
                                <span class="meta-dot">&bull;</span>
                                <span class="article-card-date">
                                    <i class="fa-regular fa-eye"></i> {{ formatNumber(item.views) }} views
                                </span>
                            </template>
                            <template v-if="item.remarks">
                                <span class="meta-dot">&bull;</span>
                                <span
                                    class="btn-show-remarks"
                                    @click="openRemarksModal(item, $event)"
                                    style="color: #b42318; font-size: 0.74rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"
                                    title="View feedback"
                                >
                                    <i class="fa-solid fa-comment-dots"></i> Feedback
                                </span>
                            </template>
                        </div>
                        <div class="article-card-status-top">
                            <span class="status-badge" :class="getBadgeClass(item.status)">
                                {{ getStatusLabel(item.status) }}
                            </span>
                        </div>
                    </div>

                    <div class="article-card-body">
                        <div class="article-card-body-content">
                            <h3 class="article-card-title">{{ item.title }}</h3>
                            <p v-if="item.excerpt" class="article-card-excerpt">
                                {{ item.excerpt }}
                            </p>
                        </div>

                        <!-- Card Actions: Placed katapat of title & excerpt -->
                        <div
                            v-if="(item.status || '').toLowerCase() === 'draft' || (item.status || '').toLowerCase().includes('revision')"
                            class="article-card-actions"
                        >
                            <button
                                type="button"
                                class="btn-box-view btn-box-edit"
                                @click="editDraft(item, $event)"
                                :title="(item.status || '').toLowerCase() === 'draft' ? 'Edit draft in editor' : 'Edit and revise manuscript'"
                            >
                                <i class="fa-solid fa-pen-to-square"></i>
                                <span>Edit</span>
                            </button>

                            <button
                                v-if="(item.status || '').toLowerCase() === 'draft'"
                                type="button"
                                class="btn-box-view btn-delete-draft"
                                @click="openDeleteModal(item, $event)"
                                style="color: #b42318;"
                                title="Delete draft"
                            >
                                <i class="fa-regular fa-trash-can"></i>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </article>
            </section>

            <!-- Empty State -->
            <div
                v-if="!isLoading && filteredArticles.length === 0"
                id="manage-empty-state"
                class="manage-empty-state animate-fade-in delay-3"
            >
                <div class="manage-empty-icon">
                    <i class="fa-regular fa-newspaper"></i>
                </div>
                <h3 class="manage-empty-title">
                    {{ searchQuery ? 'No articles found matching your search' : 'No articles yet' }}
                </h3>
            </div>
        </main>

        <!-- Full Article Viewer Modal (Executive Parity Design) -->
        <div
            v-if="isViewerOpen && activeArticle"
            id="article-viewer-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-title"
            @click.self="closeArticleViewer"
        >
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span id="viewer-category" class="viewer-category-tag">{{ activeArticle.category || 'General' }}</span>
                        <span class="viewer-dot">·</span>
                        <span id="viewer-date" class="viewer-date">{{ activeArticle.date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time">
                            <i class="fa-regular fa-clock"></i>
                            <span id="viewer-read-time">{{ calculateReadingTime(activeArticle.content) }}</span>
                        </span>
                        <button type="button" id="close-viewer-btn" class="viewer-close-btn" @click="closeArticleViewer" aria-label="Close article preview">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 id="viewer-title" class="viewer-title">{{ activeArticle.title }}</h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img :src="optimizeCloudinaryUrl(activeArticle.author_avatar, { width: 100, crop: 'limit' }) || '/images/member-placeholder.svg'" alt="Author avatar" loading="lazy">
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author }}</strong></span>
                        </div>
                    </div>
                    <div id="viewer-content" class="viewer-content-text" v-html="formatCleanArticleContent(activeArticle.content || activeArticle.excerpt)"></div>
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
            aria-labelledby="sh-remarks-title"
            @click.self="closeRemarksModal"
        >
            <div class="modal-card remarks-modal-card" style="max-width: 560px; width: 100%; border-radius: 14px; background: #ffffff; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18); overflow: hidden;">
                <div class="remarks-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment-dots" style="color: #700f2b; font-size: 1.1rem;"></i>
                        <h2 id="sh-remarks-title" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #111827;">Editorial Remarks</h2>
                    </div>
                    <button type="button" class="viewer-close-btn" @click="closeRemarksModal" aria-label="Close modal">
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
                            @click="editFromRemarks(remarksArticle)"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Edit and Revise Now</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
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
        <div v-if="toastMessage" id="toast-container" class="toast-container" aria-live="polite">
            <div class="toast-message" :class="toastType">
                <span class="toast-bullet-dot"></span>
                <span>{{ toastMessage }}</span>
            </div>
        </div>
    </SectionHeadLayout>
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
