<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EicLayout from '../layouts/EicLayout.vue';
import ExecutiveLayout from '../layouts/ExecutiveLayout.vue';
import SectionHeadLayout from '../layouts/SectionHeadLayout.vue';
import WriterLayout from '../layouts/WriterLayout.vue';
import MpcLayout from '../layouts/MpcLayout.vue';
import MediaLayout from '../layouts/MediaLayout.vue';
import CartoonistLayout from '../layouts/CartoonistLayout.vue';
import { formatCategoryDisplay } from '../utils/categoryFormat.js';
import {
    getSectionHeadArticles,
    deleteSectionHeadDraft,
    getEicMyArticles,
    deleteEicDraft,
    getExecutiveMyArticles,
    deleteExecutiveDraft,
    getWriterArticles,
    deleteWriterDraft,
    getMpcMyArticles,
    deleteMpcDraft,
    getMediaMyArticles,
    deleteMediaDraft,
    getCartoonistMyArticles,
    deleteCartoonistDraft,
} from '../services/api.js';
import { optimizeCloudinaryUrl } from '../utils/image.js';
import { formatCleanArticleContent } from '../utils/articleContent.js';
import { useAuthStore } from '../stores/auth.js';
import { confirmAction, showToast as globalShowToast } from '../utils/modal.js';
import '../assets/css/shared-manage-my-articles.css';
import '../assets/css/executive-manage-my-articles.css';

const props = defineProps({
    role: {
        type: String,
        default: '', // 'section-head' | 'eic' | 'executive' | 'writer'
    },
    pageTitle: {
        type: String,
        default: 'Manage My Articles',
    },
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Detect active role from props or route path or auth store
const activeRole = computed(() => {
    if (props.role) return props.role.toLowerCase();
    const path = route.path.toLowerCase();
    if (path.includes('/section-head')) return 'section-head';
    if (path.includes('/eic')) return 'eic';
    if (path.includes('/executive')) return 'executive';
    if (path.includes('/writer')) return 'writer';
    if (path.includes('/mpc')) return 'mpc';
    if (path.includes('/media')) return 'media';
    if (path.includes('/cartoonist')) return 'cartoonist';
    const storeRole = (authStore.user?.role?.name || authStore.user?.role?.role_name || authStore.currentRole || '').toLowerCase();
    if (storeRole.includes('cartoonist')) return 'cartoonist';
    if (storeRole.includes('mpc') || storeRole.includes('m&pc') || storeRole.includes('media and public')) return 'mpc';
    if (storeRole.includes('media') || storeRole.includes('photojournalist')) return 'media';
    if (storeRole.includes('editor') || storeRole.includes('eic')) return 'eic';
    if (storeRole.includes('exec')) return 'executive';
    if (storeRole.includes('writer')) return 'writer';
    if (storeRole.includes('head')) return 'section-head';
    return 'section-head';
});

// Dynamic layout matching the active role
const CurrentLayout = computed(() => {
    switch (activeRole.value) {
        case 'eic':
            return EicLayout;
        case 'executive':
            return ExecutiveLayout;
        case 'writer':
            return WriterLayout;
        case 'mpc':
            return MpcLayout;
        case 'media':
            return MediaLayout;
        case 'cartoonist':
            return CartoonistLayout;
        case 'section-head':
        default:
            return SectionHeadLayout;
    }
});

// Dynamic route for submitting or revising articles
const submitRoute = computed(() => {
    switch (activeRole.value) {
        case 'eic':
            return '/eic/submit-article';
        case 'executive':
            return '/executive/submit-article';
        case 'writer':
            return '/writer/submit-article';
        case 'mpc':
            return '/mpc/submit-article';
        case 'media':
            return '/media/submit-article';
        case 'cartoonist':
            return '/cartoonist/submit-article';
        case 'section-head':
        default:
            return '/section-head/submit-article';
    }
});

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

function canEdit(item) {
    if (!item) return false;
    const s = (item.status || '').toLowerCase();
    return s === 'draft' || s.includes('revision');
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
    const published = articles.value.filter(a => (a.status || '').toLowerCase().includes('publish')).length;
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
        list = list.filter(a => (a.status || '').toLowerCase().includes('publish'));
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
            const author = (a.author || '').toLowerCase();
            return title.includes(q) || category.includes(q) || excerpt.includes(q) || author.includes(q);
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

async function openDeleteModal(art, event) {
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

    await confirmDeleteDraft();
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
        switch (activeRole.value) {
            case 'eic':
                await deleteEicDraft(draftToDelete.value.id);
                break;
            case 'executive':
                await deleteExecutiveDraft(draftToDelete.value.id);
                break;
            case 'writer':
                await deleteWriterDraft(draftToDelete.value.id);
                break;
            case 'mpc':
                await deleteMpcDraft(draftToDelete.value.id);
                break;
            case 'media':
                await deleteMediaDraft(draftToDelete.value.id);
                break;
            case 'cartoonist':
                await deleteCartoonistDraft(draftToDelete.value.id);
                break;
            case 'section-head':
            default:
                await deleteSectionHeadDraft(draftToDelete.value.id);
                break;
        }
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
        path: submitRoute.value,
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
    isLoading.value = true;
    try {
        let data = null;
        switch (activeRole.value) {
            case 'eic':
                data = await getEicMyArticles(forceFresh);
                break;
            case 'executive':
                data = await getExecutiveMyArticles(forceFresh);
                break;
            case 'writer':
                data = await getWriterArticles(forceFresh);
                break;
            case 'mpc':
                data = await getMpcMyArticles(forceFresh);
                break;
            case 'media':
                data = await getMediaMyArticles(forceFresh);
                break;
            case 'cartoonist':
                data = await getCartoonistMyArticles(forceFresh);
                break;
            case 'section-head':
            default:
                data = await getSectionHeadArticles(forceFresh);
                break;
        }
        if (Array.isArray(data)) {
            articles.value = data;
        } else if (data && Array.isArray(data.articles)) {
            articles.value = data.articles;
        } else {
            articles.value = [];
        }
    } catch (err) {
        console.error(`Failed to load ${activeRole.value} articles:`, err);
        showToast('Could not load articles. Please refresh.', 'error');
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    if (route.query.tab) {
        activeTab.value = route.query.tab;
    }
    if (route.query.sort) {
        currentSort.value = route.query.sort;
    }
    loadArticles();
});
</script>

<template>
    <component :is="CurrentLayout">
        <main class="content-container manage-my-articles-page">
            <!-- Page Title Section with Total Views Counter & Action Button -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="page-title">{{ pageTitle }}</h1>
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

                    <router-link :to="submitRoute" class="btn-primary-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- Tabs Navigation (Directly under Page Title) -->
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

            <!-- Search Bar & Sort Dropdown Toolbar -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <!-- Search Bar -->
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        type="search"
                        id="manage-search-input"
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
                    <label for="manage-sort-select" class="review-sort-label">
                        <i class="fa-solid fa-arrow-down-short-wide"></i>
                        <span>Sort:</span>
                    </label>
                    <div class="sort-select-wrapper">
                        <select
                            id="manage-sort-select"
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
            <section class="writer-articles-list animate-fade-in delay-3" id="manage-articles-list" aria-label="My articles list">
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
                            <span class="article-card-category">{{ formatCategoryDisplay(item.category) }}</span>
                            <span class="meta-dot">&bull;</span>
                            <span class="article-card-date">
                                <i class="fa-regular fa-calendar"></i> {{ item.date }}
                            </span>
                            <template v-if="(item.status || '').toLowerCase().includes('publish') && item.views !== undefined">
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

                        <!-- Card Actions: Placed beside title & excerpt -->
                        <div
                            v-if="canEdit(item)"
                            class="article-card-actions"
                            @click.stop
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
                role="status"
                aria-live="polite"
            >
                <div class="manage-empty-icon-wrap">
                    <i class="fa-solid fa-file-circle-xmark"></i>
                </div>
                <h3 class="manage-empty-title">
                    {{ searchQuery ? 'No Matching Articles' : (activeTab === 'all' ? 'No Articles Yet' : 'No Articles in this Tab') }}
                </h3>
                <p class="manage-empty-desc">
                    {{ searchQuery ? `We couldn't find any articles matching "${searchQuery}". Try a different keyword.` : (activeTab === 'all' ? 'You have not drafted or submitted any articles yet. Begin your journalism journey today.' : `There are currently no articles under the ${activeTab} category.`) }}
                </p>
                <div v-if="!searchQuery && (activeTab === 'all' || activeTab === 'drafts')" class="manage-empty-action">
                    <router-link :to="submitRoute" class="btn-primary-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Write Your First Article</span>
                    </router-link>
                </div>
                <button
                    v-if="searchQuery"
                    type="button"
                    class="btn-reset-filters"
                    @click="clearSearch"
                >
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Clear Search</span>
                </button>
            </div>
        </main>

        <!-- Article Viewer Modal -->
        <div
            v-if="isViewerOpen && activeArticle"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeArticleViewer"
        >
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span id="viewer-category" class="viewer-category-tag">
                            {{ formatCategoryDisplay(activeArticle.category) }}
                        </span>
                        <span class="viewer-dot">&bull;</span>
                        <span id="viewer-date" class="viewer-date">{{ activeArticle.date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time">
                            <i class="fa-regular fa-clock"></i>
                            <span id="viewer-read-time">{{ calculateReadingTime(activeArticle.content) }}</span>
                        </span>
                        <button type="button" class="viewer-close-btn" @click="closeArticleViewer" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 id="viewer-title" class="viewer-title">{{ activeArticle.title }}</h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img
                                :src="optimizeCloudinaryUrl(activeArticle.authorAvatar || activeArticle.avatar, 80, 80) || '/images/default-avatar.svg'"
                                :alt="activeArticle.author || 'Author'"
                            >
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By</span>
                            <span id="viewer-author" class="viewer-author-name">{{ activeArticle.author || 'Staff Writer' }}</span>
                        </div>
                    </div>
                    <p v-if="activeArticle.excerpt" class="viewer-excerpt-lead">
                        {{ activeArticle.excerpt }}
                    </p>
                    <div
                        class="viewer-content-text article-body-streamlined"
                        v-html="formatCleanArticleContent(activeArticle.content)"
                    ></div>

                    <!-- Editorial Feedback Box in Viewer -->
                    <div v-if="activeArticle.remarks" class="remarks-alert-box" style="margin-top: 20px;">
                        <div class="remarks-alert-title">
                            <i class="fa-solid fa-comment-dots"></i>
                            <span>Editorial Remarks:</span>
                        </div>
                        <div class="remarks-alert-content">
                            {{ activeArticle.remarks }}
                        </div>
                    </div>
                </div>

                <div class="viewer-modal-footer">
                    <router-link
                        v-if="canEdit(activeArticle)"
                        :to="`${submitRoute}?draft_id=${activeArticle.id}`"
                        class="btn-manage-action"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit Manuscript</span>
                    </router-link>
                    <button type="button" class="btn-viewer-secondary" @click="closeArticleViewer">
                        Close
                    </button>
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
            aria-labelledby="manage-remarks-title"
            @click.self="closeRemarksModal"
        >
            <div class="modal-card remarks-modal-card" style="max-width: 560px !important; width: 100% !important; border-radius: 14px !important; background: #ffffff !important; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18) !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; margin: 16px !important;">
                <div class="remarks-modal-header" style="display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 18px 24px !important; border-bottom: 1px solid #eaecf0 !important; background: #fafbfc !important; width: 100% !important; box-sizing: border-box !important; flex-shrink: 0 !important;">
                    <div style="display: flex !important; align-items: center !important; gap: 8px !important;">
                        <i class="fa-solid fa-comment-dots" style="color: #700f2b !important; font-size: 1.1rem !important;"></i>
                        <h2 id="manage-remarks-title" style="margin: 0 !important; font-size: 1.05rem !important; font-weight: 700 !important; color: #111827 !important; line-height: 1.3 !important;">Editorial Remarks</h2>
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
                <div class="remarks-modal-body" style="padding: 24px !important; overflow-y: auto !important; flex: 1 !important;">
                    <p style="font-size: 1.05rem !important; font-weight: 700 !important; color: #101828 !important; margin: 0 0 14px 0 !important; line-height: 1.4 !important; ">
                        {{ remarksArticle.title }}
                    </p>
                    <div class="remarks-content-box" style="background-color: #fff1f2 !important; border: 1px solid #fecdd3 !important; border-radius: 8px !important; padding: 16px !important;">
                        <div style="display: flex !important; align-items: center !important; gap: 6px !important; font-weight: 700 !important; font-size: 0.85rem !important; color: #9f1239 !important; margin-bottom: 6px !important;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>Feedback:</span>
                        </div>
                        <p style="margin: 0 !important; color: #4c0519 !important; font-size: 0.92rem !important; line-height: 1.55 !important; white-space: pre-wrap !important; word-break: break-word !important;">
                            {{ remarksArticle.remarks || 'No remarks provided.' }}
                        </p>
                    </div>
                    <div class="remarks-modal-footer" style="margin-top: 24px !important; display: flex !important; justify-content: flex-end !important; align-items: center !important; gap: 10px !important;">
                        <button
                            type="button"
                            class="btn-cancel"
                            @click="closeRemarksModal"
                            style="height: 38px !important; padding: 0 16px !important; border: 1px solid #d0d5dd !important; background: #ffffff !important; color: #344054 !important; border-radius: 8px !important; font-weight: 600 !important; font-size: 0.88rem !important; cursor: pointer !important; transition: all 0.15s ease !important;"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            class="btn-primary-action btn-edit-revise-now"
                            style="height: 38px !important; padding: 0 18px !important; background-color: #700f2b !important; color: #ffffff !important; border: 1px solid #700f2b !important; border-radius: 8px !important; font-weight: 600 !important; font-size: 0.88rem !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; cursor: pointer !important; transition: all 0.15s ease !important;"
                            @click="editFromRemarks(remarksArticle)"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Edit and Revise Now</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </component>
</template>

<style scoped>
.remarks-modal-card {
    max-width: 560px !important;
    width: 100% !important;
    background-color: #ffffff !important;
    border-radius: 14px !important;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18) !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    margin: 16px !important;
}

.remarks-modal-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 18px 24px !important;
    border-bottom: 1px solid #eaecf0 !important;
    background: #fafbfc !important;
    width: 100% !important;
    box-sizing: border-box !important;
    flex-shrink: 0 !important;
}

.remarks-modal-header h2 {
    margin: 0 !important;
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    color: #111827 !important;
    line-height: 1.3 !important;
}

.remarks-modal-header .viewer-close-btn {
    background: transparent !important;
    border: none !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px !important;
    color: #667085 !important;
    font-size: 1.1rem !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 0 0 auto !important;
    flex-shrink: 0 !important;
    transition: all 0.2s ease !important;
}

.remarks-modal-header .viewer-close-btn:hover {
    background-color: #fdf2f2 !important;
    color: #700f2b !important;
    transform: rotate(90deg) !important;
}

.btn-edit-revise-now {
    background-color: #700f2b !important;
    border-color: #700f2b !important;
    color: #ffffff !important;
    transition: background-color 0.18s ease, transform 0.12s ease !important;
}

.btn-edit-revise-now:hover {
    background-color: #580c22 !important;
    border-color: #580c22 !important;
    color: #ffffff !important;
    transform: translateY(-1px) !important;
}
</style>
