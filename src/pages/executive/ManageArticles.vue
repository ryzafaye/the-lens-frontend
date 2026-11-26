<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveManageArticles,
    archiveExecutiveArticle,
    restoreExecutiveArticle,
    updateExecutiveArticle,
    destroyExecutiveArticle,
} from '../../services/api.js';
import {
    formatCleanArticleContent,
    cleanContentForEditing,
    prepareContentForSaving,
} from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { currentUser } from '../../stores/auth.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/executive-modals.css';

const router = useRouter();
const user = currentUser;

// RBAC: President & Vice President
const isPresOrVp = computed(() => {
    const rawRole = (
        localStorage.getItem('userRole') ||
        localStorage.getItem('execRole') ||
        user?.role?.name ||
        user?.role ||
        ''
    ).toLowerCase();
    return rawRole.includes('president') || rawRole.includes('vp');
});

// State
const isLoading = ref(true);
const articles = ref([]);
const activeTab = ref('active'); // 'active' | 'archived'
const searchQuery = ref('');
const isFilterOpen = ref(false);

// Filter selections
const sortBy = ref('newest'); // 'newest' | 'oldest' | 'popular' | 'az'
const selectedCategory = ref('All');
const dateFilterType = ref('any'); // 'any' | 'today' | 'this_week'

// Modals State
const isViewerOpen = ref(false);
const activeArticle = ref(null);

const isEditOpen = ref(false);
const editForm = ref({
    id: null,
    title: '',
    category: 'News',
    excerpt: '',
    content: '',
});
const isSavingEdit = ref(false);

const isConfirmActionOpen = ref(false);
const confirmActionType = ref(''); // 'archive' | 'restore' | 'delete'
const actionTargetArticle = ref(null);
const isProcessingAction = ref(false);

// Active card menu
const openMenuId = ref(null);

// Toast notification replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Media URL Resolver
function resolveCoverUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 400, crop: 'limit' });
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 100, crop: 'limit' });
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function calculateReadingTime(content) {
    if (!content) return '1 min read';
    const clean = content.replace(/<[^>]+>/g, '').trim();
    const words = clean.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

// Load articles from Executive API
async function loadArticles(forceFresh = false) {
    isLoading.value = true;
    try {
        const data = await getExecutiveManageArticles(forceFresh);
        if (Array.isArray(data)) {
            articles.value = data;
        }
    } catch (err) {
        console.warn('Could not load Executive articles:', err);
    } finally {
        isLoading.value = false;
    }
}

// Counts
const activeArticlesCount = computed(() => {
    return articles.value.filter(a => !a.isArchived).length;
});

const archivedArticlesCount = computed(() => {
    return articles.value.filter(a => !!a.isArchived).length;
});

// Filter & Sort Pipeline
const filteredArticles = computed(() => {
    let list = articles.value;

    // 1. Tab filter (active vs archived)
    if (activeTab.value === 'active') {
        list = list.filter(a => !a.isArchived);
    } else {
        list = list.filter(a => !!a.isArchived);
    }

    // 2. Search query filter
    const query = searchQuery.value.toLowerCase().trim();
    if (query) {
        list = list.filter(a => {
            const titleMatch = (a.title || '').toLowerCase().includes(query);
            const authorMatch = (a.author || '').toLowerCase().includes(query);
            const excerptMatch = (a.excerpt || '').toLowerCase().includes(query);
            const catMatch = (a.category || '').toLowerCase().includes(query);
            return titleMatch || authorMatch || excerptMatch || catMatch;
        });
    }

    // 3. Category filter
    if (selectedCategory.value !== 'All') {
        list = list.filter(a => (a.category || '').toLowerCase() === selectedCategory.value.toLowerCase());
    }

    // 4. Date filter
    if (dateFilterType.value !== 'any') {
        const now = new Date();
        list = list.filter(a => {
            if (!a.published_at && !a.date) return false;
            const artDate = new Date(a.published_at || a.date);
            if (isNaN(artDate.getTime())) return true;

            if (dateFilterType.value === 'today') {
                return (
                    artDate.getDate() === now.getDate() &&
                    artDate.getMonth() === now.getMonth() &&
                    artDate.getFullYear() === now.getFullYear()
                );
            } else if (dateFilterType.value === 'this_week') {
                const diffTime = Math.abs(now.getTime() - artDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            }
            return true;
        });
    }

    // 5. Sort Pipeline
    const copy = [...list];
    if (sortBy.value === 'newest') {
        copy.sort((a, b) => new Date(b.published_at || b.date || 0) - new Date(a.published_at || a.date || 0));
    } else if (sortBy.value === 'oldest') {
        copy.sort((a, b) => new Date(a.published_at || a.date || 0) - new Date(b.published_at || b.date || 0));
    } else if (sortBy.value === 'popular') {
        copy.sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0));
    } else if (sortBy.value === 'az') {
        copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return copy;
});

function clearFilters() {
    sortBy.value = 'newest';
    selectedCategory.value = 'All';
    dateFilterType.value = 'any';
    searchQuery.value = '';
    isFilterOpen.value = false;
}

// 3-Dots Action Dropdown Menu
function toggleCardMenu(articleId, event) {
    if (event) event.stopPropagation();
    openMenuId.value = openMenuId.value === articleId ? null : articleId;
}

function closeAllMenus() {
    openMenuId.value = null;
    isFilterOpen.value = false;
}

// Viewer Modal
function openViewer(article) {
    closeAllMenus();
    activeArticle.value = article;
    isViewerOpen.value = true;
}

function closeViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
}

function handleViewerEdit() {
    if (!activeArticle.value) return;
    const a = activeArticle.value;
    closeViewer();
    openEditModal(a);
}

function handleViewerArchiveToggle() {
    if (!activeArticle.value) return;
    const a = activeArticle.value;
    const action = a.isArchived ? 'restore' : 'archive';
    promptAction(a, action);
}

function handleViewerDelete() {
    if (!activeArticle.value) return;
    promptAction(activeArticle.value, 'delete');
}

// Edit Modal
function openEditModal(article) {
    closeAllMenus();
    editForm.value = {
        id: article.id,
        title: article.title || '',
        category: article.category || 'News',
        excerpt: article.excerpt || '',
        content: cleanContentForEditing(article.content || ''),
    };
    isEditOpen.value = true;
}

function closeEditModal() {
    isEditOpen.value = false;
    editForm.value = { id: null, title: '', category: 'News', excerpt: '', content: '' };
}

async function saveEdit() {
    if (!editForm.value.title.trim()) {
        showToast('Please provide an article headline.', 'danger');
        return;
    }
    if (!editForm.value.excerpt.trim()) {
        showToast('Please provide an excerpt / lead paragraph.', 'danger');
        return;
    }
    if (!editForm.value.content.trim()) {
        showToast('Article content cannot be empty.', 'danger');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Save Article Changes',
        message: 'Are you sure you want to save changes to this article?',
        confirmText: 'Save Changes',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSavingEdit.value = true;
    try {
        const payload = {
            title: editForm.value.title.trim(),
            category: editForm.value.category,
            excerpt: editForm.value.excerpt.trim(),
            content: prepareContentForSaving(editForm.value.content),
        };
        const res = await updateExecutiveArticle(editForm.value.id, payload);
        if (res) {
            const updatedCategory = res.article?.category || editForm.value.category;
            const updatedContent = res.article?.content || payload.content;

            const target = articles.value.find(item => String(item.id) === String(editForm.value.id));
            if (target) {
                target.title = editForm.value.title;
                target.category = updatedCategory;
                target.excerpt = editForm.value.excerpt;
                target.content = updatedContent;
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(editForm.value.id)) {
                activeArticle.value.title = editForm.value.title;
                activeArticle.value.category = updatedCategory;
                activeArticle.value.excerpt = editForm.value.excerpt;
                activeArticle.value.content = updatedContent;
            }
            showToast('Article changes saved successfully.', 'success');
            closeEditModal();
        }
    } catch (err) {
        console.error('Failed to update article:', err);
        showToast(err.response?.data?.message || 'Failed to update article.', 'danger');
    } finally {
        isSavingEdit.value = false;
    }
}

// Action Confirmation Modal (Archive, Restore, Delete)
async function promptAction(article, actionType) {
    closeAllMenus();
    actionTargetArticle.value = article;
    confirmActionType.value = actionType;

    let title = 'Confirm Action';
    let message = `Are you sure you want to ${actionType} "${article?.title}"?`;
    let confirmText = 'Confirm';
    let modalType = 'maroon';

    if (actionType === 'archive') {
        title = 'Move to Archive';
        message = `Are you sure you want to move "${article?.title}" to the archive?`;
        confirmText = 'Archive Article';
    } else if (actionType === 'restore') {
        title = 'Restore Article';
        message = `Are you sure you want to restore "${article?.title}" to published?`;
        confirmText = 'Restore Article';
    } else if (actionType === 'delete') {
        title = 'Emergency Delete';
        message = `Are you sure you want to permanently delete "${article?.title}"? All manuscript records and media attachments will be permanently removed. This action cannot be undone.`;
        confirmText = 'Emergency Delete';
        modalType = 'danger';
    }

    const confirmed = await confirmAction({
        title,
        message,
        confirmText,
        cancelText: 'Cancel',
        type: modalType,
    });
    if (!confirmed) return;

    await executeConfirmedAction();
}

function closeConfirmActionModal() {
    isConfirmActionOpen.value = false;
    actionTargetArticle.value = null;
    confirmActionType.value = '';
}

async function executeConfirmedAction() {
    if (!actionTargetArticle.value || isProcessingAction.value) return;

    const targetId = actionTargetArticle.value.id;
    isProcessingAction.value = true;

    try {
        if (confirmActionType.value === 'archive') {
            await archiveExecutiveArticle(targetId);
            const a = articles.value.find(item => String(item.id) === String(targetId));
            if (a) {
                a.isArchived = true;
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                activeArticle.value.isArchived = true;
            }
            showToast('Article moved to archive successfully.', 'success');
        } else if (confirmActionType.value === 'restore') {
            await restoreExecutiveArticle(targetId);
            const a = articles.value.find(item => String(item.id) === String(targetId));
            if (a) {
                a.isArchived = false;
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                activeArticle.value.isArchived = false;
            }
            showToast('Article restored to published status.', 'success');
        } else if (confirmActionType.value === 'delete') {
            await destroyExecutiveArticle(targetId);
            articles.value = articles.value.filter(item => String(item.id) !== String(targetId));
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                closeViewer();
            }
            showToast('Article permanently deleted from database.', 'success');
        }
        closeConfirmActionModal();
    } catch (err) {
        console.error(`Failed to ${confirmActionType.value} article:`, err);
        showToast(`Failed to ${confirmActionType.value} article. Please try again.`, 'danger');
    } finally {
        isProcessingAction.value = false;
    }
}

function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
        closeAllMenus();
        if (isViewerOpen.value) closeViewer();
        if (isEditOpen.value) closeEditModal();
        if (isConfirmActionOpen.value) closeConfirmActionModal();
    }
}

onMounted(() => {
    loadArticles(true);
    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
    document.removeEventListener('click', closeAllMenus);
    document.removeEventListener('keydown', handleGlobalKeydown);
    if (toastTimer) clearTimeout(toastTimer);
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Access Check for Non-Pres/VP -->
            <div v-if="!isPresOrVp" class="card-panel text-center py-12">
                <i class="fa-solid fa-lock text-4xl text-[#700f2b] mb-4"></i>
                <h2 class="text-xl font-bold text-stone-800">Access Restricted</h2>
                <p class="text-stone-500 mt-2 max-w-md mx-auto text-sm">
                    This section is restricted to the President and Vice President of the executive board.
                </p>
                <router-link to="/executive/dashboard" class="btn-primary mt-6 inline-block">
                    Return to Dashboard
                </router-link>
            </div>

            <div v-else>
                <!-- Page Header & Title Section -->
                <div class="page-title-section animate-fade-in delay-1">
                    <h1 class="page-title">Manage Articles &amp; Archives</h1>
                </div>

                <!-- Tabs Navigation (Active Articles vs. Archived Articles) -->
                <div class="manage-tabs-container animate-fade-in delay-2" role="tablist">
                    <button
                        type="button"
                        class="manage-tab-btn"
                        :class="{ active: activeTab === 'active' }"
                        @click="activeTab = 'active'"
                        role="tab"
                        :aria-selected="activeTab === 'active'"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Active Articles</span>
                        <span class="tab-count-badge">{{ activeArticlesCount }}</span>
                    </button>
                    <button
                        type="button"
                        class="manage-tab-btn"
                        :class="{ active: activeTab === 'archived' }"
                        @click="activeTab = 'archived'"
                        role="tab"
                        :aria-selected="activeTab === 'archived'"
                    >
                        <i class="fa-solid fa-box-archive"></i>
                        <span>Archived Articles</span>
                        <span class="tab-count-badge">{{ archivedArticlesCount }}</span>
                    </button>
                </div>

                <!-- Search & Filter Toolbar -->
                <div class="manage-toolbar animate-fade-in delay-2">
                    <!-- Search Bar -->
                    <div class="manage-search-shell">
                        <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                        <input
                            type="search"
                            v-model="searchQuery"
                            class="manage-search-input"
                            placeholder="Search by article title or author..."
                            aria-label="Search by article title or author"
                            autocomplete="off"
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

                    <!-- Sort & Filter Dropdown Trigger & Popup -->
                    <div class="sort-filter-wrapper" :class="{ 'is-open': isFilterOpen }">
                        <button
                            type="button"
                            class="sort-filter-btn"
                            :aria-expanded="isFilterOpen"
                            @click.stop="isFilterOpen = !isFilterOpen"
                        >
                            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                            <span>Sort &amp; Filter</span>
                            <i class="fa-solid fa-chevron-down filter-chevron" aria-hidden="true"></i>
                        </button>

                        <!-- Filter Dropdown Popup -->
                        <div v-if="isFilterOpen" class="filter-dropdown" @click.stop>
                            <div class="filter-panel-heading">
                                <span>Sort &amp; Filter</span>
                                <button type="button" class="icon-button" @click="isFilterOpen = false" aria-label="Close filters">
                                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="filter-grid">
                                <div class="filter-field">
                                    <label for="exec-sort-select">Sort by</label>
                                    <select id="exec-sort-select" v-model="sortBy" class="archive-select">
                                        <option value="newest">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="popular">Most Viewed</option>
                                        <option value="az">A-Z</option>
                                    </select>
                                </div>
                                <div class="filter-field">
                                    <label for="exec-category-select">Category</label>
                                    <select id="exec-category-select" v-model="selectedCategory" class="archive-select">
                                        <option value="All">All categories</option>
                                        <option value="News">News</option>
                                        <option value="Features">Features</option>
                                        <option value="Opinion">Opinion</option>
                                        <option value="Science and Technology">Science &amp; Technology</option>
                                        <option value="Literature">Literature</option>
                                    </select>
                                </div>
                                <div class="filter-field filter-date-field">
                                    <label for="exec-date-filter-type">Published date</label>
                                    <div class="published-date-controls">
                                        <select id="exec-date-filter-type" v-model="dateFilterType" class="archive-select">
                                            <option value="any">Any date</option>
                                            <option value="today">Today</option>
                                            <option value="this_week">This week</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="filter-panel-footer">
                                <button type="button" class="clear-filters-btn" @click="clearFilters">Clear filters</button>
                                <button type="button" class="apply-filters-btn" @click="isFilterOpen = false">
                                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                                    <span>Apply</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Articles Cards Panel -->
                <section class="articles-panel animate-fade-in delay-3" aria-labelledby="articles-panel-heading">
                    <!-- Section Header Metadata -->
                    <div class="articles-header-meta">
                        <div class="meta-left">
                            <span class="articles-results-counter">
                                Showing {{ filteredArticles.length }} {{ activeTab === 'active' ? 'active' : 'archived' }} article{{ filteredArticles.length === 1 ? '' : 's' }}
                            </span>
                        </div>
                    </div>

                    <!-- Loading State -->
                    <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                        <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                        <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading articles…</p>
                    </div>

                    <!-- 2-column Grid of Article Cards (Exact EIC .article-box Layout) -->
                    <div v-else-if="filteredArticles.length > 0" id="articles-grid" class="articles-grid" aria-label="Article cards list">
                        <article
                            v-for="article in filteredArticles"
                            :key="article.id"
                            class="article-box"
                            :class="{ 'menu-open': openMenuId === article.id }"
                            :data-article-id="article.id"
                        >
                            <!-- 3-Dots Action Menu (Upper Right) -->
                            <div class="card-menu-anchor">
                                <button
                                    type="button"
                                    class="card-dots-btn"
                                    :aria-label="'Actions for ' + article.title"
                                    :aria-expanded="openMenuId === article.id"
                                    @click.stop="toggleCardMenu(article.id, $event)"
                                >
                                    <i class="fa-solid fa-ellipsis-vertical"></i>
                                </button>
                                <div v-if="openMenuId === article.id" class="card-actions-menu" @click.stop>
                                    <button type="button" class="action-menu-item" @click="openViewer(article)">
                                        <i class="fa-regular fa-eye"></i>
                                        <span>Read Article</span>
                                    </button>
                                    <button type="button" class="action-menu-item" @click="openEditModal(article)">
                                        <i class="fa-regular fa-pen-to-square"></i>
                                        <span>Edit Article</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="action-menu-item"
                                        :class="{ restore: article.isArchived }"
                                        @click="promptAction(article, article.isArchived ? 'restore' : 'archive')"
                                    >
                                        <i :class="article.isArchived ? 'fa-solid fa-arrow-rotate-left' : 'fa-solid fa-box-archive'"></i>
                                        <span>{{ article.isArchived ? 'Restore to Active' : 'Move to Archive' }}</span>
                                    </button>
                                    <div class="menu-divider"></div>
                                    <button type="button" class="action-menu-item danger" @click="promptAction(article, 'delete')">
                                        <i class="fa-regular fa-trash-can"></i>
                                        <span>Emergency Delete</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Image Thumbnail Trigger -->
                            <button
                                type="button"
                                class="article-box-image-trigger"
                                @click="openViewer(article)"
                                :aria-label="'View ' + article.title"
                            >
                                <div class="article-box-thumb">
                                    <img
                                        v-if="article.image"
                                        :src="resolveCoverUrl(article.image)"
                                        :alt="article.title"
                                        loading="lazy"
                                    >
                                    <div v-else class="image-fallback">
                                        <i class="fa-solid fa-newspaper"></i>
                                    </div>
                                </div>
                            </button>

                            <!-- Content Area -->
                            <div class="article-box-content">
                                <div class="article-box-meta">
                                    <span class="article-box-category">{{ article.category || 'General' }}</span>
                                    <span class="article-box-separator">·</span>
                                    <time class="article-box-date">{{ article.date || 'Recent' }}</time>
                                </div>

                                <h3 class="article-box-title">
                                    <button type="button" class="article-title-link" @click="openViewer(article)">
                                        {{ article.title }}
                                    </button>
                                </h3>

                                <p v-if="article.excerpt" class="article-box-excerpt">{{ article.excerpt }}</p>

                                <p class="article-box-byline">
                                    <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                    <span>By <strong>{{ article.author || 'Staff Writer' }}</strong></span>
                                </p>

                                <div class="article-box-stats">
                                    <span class="stat-views" title="Views">
                                        <i class="fa-regular fa-eye"></i>
                                        <span>{{ Number(article.views || 0).toLocaleString() }}</span>
                                    </span>
                                    <span class="stat-read-time" title="Reading Time">
                                        <i class="fa-regular fa-clock"></i>
                                        <span>{{ article.readTime || calculateReadingTime(article.content) }}</span>
                                    </span>
                                    <button type="button" class="stat-shares" title="Share Article">
                                        <i class="fa-solid fa-share-nodes"></i>
                                        <span class="share-badge">{{ article.shares || 0 }}</span>
                                    </button>
                                </div>
                            </div>
                        </article>
                    </div>

                    <!-- Clean Empty State Display -->
                    <div v-else class="table-empty-state">
                        <div class="empty-state-icon">
                            <i :class="activeTab === 'archived' ? 'fa-solid fa-box-archive' : 'fa-regular fa-newspaper'"></i>
                        </div>
                        <div class="empty-state-title">
                            {{ searchQuery ? 'No articles match your search' : (activeTab === 'archived' ? 'No archived articles yet' : 'No active articles yet') }}
                        </div>
                        <p class="empty-state-desc" style="color: #667085; font-size: 0.9rem; margin-top: 4px;">
                            {{ searchQuery ? 'Try adjusting your search terms, categories, or filters.' : 'Articles will appear here once published or moved to archive.' }}
                        </p>
                    </div>
                </section>
            </div>
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL 1: Full Article Viewer Modal (Exact EIC Structure)               -->
        <!-- ====================================================================== -->
        <div v-if="isViewerOpen && activeArticle" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="viewer-title" @click.self="closeViewer">
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span id="viewer-category" class="viewer-category-tag">{{ activeArticle.category || 'News' }}</span>
                        <span class="viewer-dot">·</span>
                        <span id="viewer-date" class="viewer-date">{{ activeArticle.date || 'Recent' }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time">
                            <i class="fa-regular fa-clock"></i>
                            <span id="viewer-read-time">{{ activeArticle.readTime || calculateReadingTime(activeArticle.content) }}</span>
                        </span>
                        <button type="button" id="close-viewer-btn" class="viewer-close-btn" @click="closeViewer" aria-label="Close article preview">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 id="viewer-title" class="viewer-title">{{ activeArticle.title }}</h1>
                    
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img :src="resolveAvatarUrl(activeArticle.authorAvatar)" alt="Author avatar">
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author || 'Staff Writer' }}</strong></span>
                        </div>
                    </div>

                    <p v-if="activeArticle.excerpt" id="viewer-excerpt" class="viewer-excerpt">
                        {{ activeArticle.excerpt }}
                    </p>

                    <div v-if="activeArticle.image" id="viewer-banner-wrap" class="viewer-banner">
                        <img id="viewer-banner-img" :src="resolveCoverUrl(activeArticle.image)" alt="Article banner">
                    </div>

                    <div id="viewer-content" class="viewer-content-text" v-html="formatCleanArticleContent(activeArticle.content || activeArticle.excerpt)"></div>

                    <div class="viewer-stats-bar">
                        <span class="stat-pill"><i class="fa-regular fa-eye"></i> <span>{{ Number(activeArticle.views || 0).toLocaleString() }}</span></span>
                        <span class="stat-pill"><i class="fa-solid fa-share-nodes"></i> <span>{{ activeArticle.shares || 0 }}</span></span>
                    </div>
                </div>

                <div class="viewer-modal-footer">
                    <button type="button" class="modal-btn modal-btn-secondary" @click="handleViewerEdit">
                        <i class="fa-regular fa-pen-to-square"></i> Edit Article
                    </button>
                    <button type="button" class="modal-btn modal-btn-warning" @click="handleViewerArchiveToggle">
                        <i :class="activeArticle.isArchived ? 'fa-solid fa-arrow-rotate-left' : 'fa-solid fa-box-archive'"></i>
                        <span>{{ activeArticle.isArchived ? 'Restore to Active' : 'Move to Archive' }}</span>
                    </button>
                    <button type="button" class="modal-btn modal-btn-danger" @click="handleViewerDelete">
                        <i class="fa-regular fa-trash-can"></i> Emergency Delete
                    </button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: Edit Article Modal                                            -->
        <!-- ====================================================================== -->
        <div v-if="isEditOpen" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" @click.self="closeEditModal">
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h2 id="edit-modal-title" class="modal-title">
                        <i class="fa-solid fa-pen-nib"></i> Edit Article
                    </h2>
                    <button type="button" class="icon-button" @click="closeEditModal" aria-label="Close edit dialog">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form class="edit-modal-form" @submit.prevent="saveEdit">
                    <div class="form-field">
                        <label for="exec-edit-title-input">Article Title / Headline <span class="required-star">*</span></label>
                        <input id="exec-edit-title-input" v-model="editForm.title" type="text" class="form-input" placeholder="Enter headline title..." required>
                    </div>

                    <div class="form-field">
                        <label for="exec-edit-category-select">Category <span class="required-star">*</span></label>
                        <select id="exec-edit-category-select" v-model="editForm.category" class="form-select">
                            <option value="News">News</option>
                            <option value="Feature">Feature</option>
                            <option value="Opinion">Opinion</option>
                            <option value="Science & Technology">SciTech</option>
                            <option value="Literature">Literature</option>
                        </select>
                    </div>

                    <div class="form-field">
                        <label for="exec-edit-excerpt-input">Excerpt / Brief Summary <span class="required-star">*</span></label>
                        <textarea id="exec-edit-excerpt-input" v-model="editForm.excerpt" class="form-textarea" rows="3" placeholder="Brief summary or lead paragraph..." required></textarea>
                    </div>

                    <div class="form-field">
                        <label for="exec-edit-body-input">Article Body / Manuscript Content <span class="required-star">*</span></label>
                        <textarea id="exec-edit-body-input" v-model="editForm.content" class="form-textarea edit-body-textarea" rows="10" placeholder="Type or paste the manuscript content..." required></textarea>
                    </div>

                    <div class="modal-footer edit-modal-footer">
                        <button type="submit" class="modal-btn modal-btn-confirm-primary btn-save-maroon" :disabled="isSavingEdit">
                            <i v-if="!isSavingEdit" class="fa-solid fa-check"></i>
                            <i v-else class="fa-solid fa-spinner fa-spin"></i>
                            <span>{{ isSavingEdit ? 'Saving Changes…' : 'Save Changes' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

    </ExecutiveLayout>
</template>
