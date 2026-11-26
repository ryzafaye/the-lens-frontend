<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicManageArticles,
    archiveEicArticle,
    restoreEicArticle,
    updateEicArticle,
    destroyEicArticle,
} from '../../services/api.js';
import {
    formatCleanArticleContent,
    cleanContentForEditing,
    prepareContentForSaving,
} from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/executive-modals.css';

// State
const isLoading = ref(true);
const articles = ref([]);
const activeTab = ref('active'); // 'active' | 'archived'
const searchQuery = ref('');
const isFilterOpen = ref(false);

// Filter selections
const sortBy = ref('newest');
const selectedCategory = ref('All');
const dateFilterType = ref('any'); // 'any' | 'today' | 'this_week' | 'choose'
const selectedMonth = ref('');
const selectedDay = ref('');
const selectedYear = ref('');

// Modals
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
const confirmActionType = ref('archive'); // 'archive' | 'restore' | 'delete'
const actionTargetArticle = ref(null);
const isProcessingAction = ref(false);

// Toast replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 100, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
}

function resolveCoverUrl(url) {
    if (!url) return '/images/maroon.jpg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 600, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
}

function calculateReadingTime(content) {
    if (!content) return '1 min read';
    const text = content.replace(/<[^>]+>/g, ' ').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
}

async function loadArticles(forceFresh = false) {
    isLoading.value = true;
    try {
        const data = await getEicManageArticles(forceFresh);
        if (Array.isArray(data)) {
            articles.value = data;
        }
    } catch (err) {
        console.warn('Could not load EIC articles:', err);
    } finally {
        isLoading.value = false;
    }
}

// Counts
const activeArticlesCount = computed(() => {
    return articles.value.filter(a => !a.isArchived && (a.status || '').toLowerCase() !== 'archived').length;
});

const archivedArticlesCount = computed(() => {
    return articles.value.filter(a => a.isArchived || (a.status || '').toLowerCase() === 'archived').length;
});

// Filtered & Sorted list
const filteredArticles = computed(() => {
    let list = articles.value.filter(item => {
        const isArchived = item.isArchived || (item.status || '').toLowerCase() === 'archived';
        return activeTab.value === 'archived' ? isArchived : !isArchived;
    });

    // Search query
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(item => {
            const title = (item.title || '').toLowerCase();
            const author = (item.author || '').toLowerCase();
            const category = (item.category || '').toLowerCase();
            return title.includes(q) || author.includes(q) || category.includes(q);
        });
    }

    // Category filter
    if (selectedCategory.value !== 'All') {
        list = list.filter(item => {
            return (item.category || '').toLowerCase() === selectedCategory.value.toLowerCase();
        });
    }

    // Date filter
    const now = Date.now();
    const oneDayMs = 24 * 3600 * 1000;
    if (dateFilterType.value === 'today') {
        list = list.filter(item => {
            const rawDate = item.rawDate || item.date;
            if (!rawDate) return false;
            return (now - new Date(rawDate).getTime()) <= oneDayMs;
        });
    } else if (dateFilterType.value === 'this_week') {
        list = list.filter(item => {
            const rawDate = item.rawDate || item.date;
            if (!rawDate) return false;
            return (now - new Date(rawDate).getTime()) <= 7 * oneDayMs;
        });
    } else if (dateFilterType.value === 'choose') {
        if (selectedYear.value || selectedMonth.value || selectedDay.value) {
            list = list.filter(item => {
                const rawDate = item.rawDate || item.date;
                if (!rawDate) return false;
                const d = new Date(rawDate);
                if (selectedYear.value && d.getFullYear() !== parseInt(selectedYear.value)) return false;
                if (selectedMonth.value && (d.getMonth() + 1) !== parseInt(selectedMonth.value)) return false;
                if (selectedDay.value && d.getDate() !== parseInt(selectedDay.value)) return false;
                return true;
            });
        }
    }

    // Sort
    list = [...list].sort((a, b) => {
        if (sortBy.value === 'oldest') {
            return new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date);
        } else if (sortBy.value === 'popular') {
            return (b.views || 0) - (a.views || 0);
        } else if (sortBy.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        // newest (default)
        return new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date);
    });

    return list;
});

// Dropdown menu state
const openMenuId = ref(null);
function toggleCardMenu(id, e) {
    e.stopPropagation();
    openMenuId.value = openMenuId.value === id ? null : id;
}

function closeCardMenus() {
    openMenuId.value = null;
}

// Viewer Modal
function openViewer(item) {
    closeCardMenus();
    activeArticle.value = item;
    isViewerOpen.value = true;
    document.body.style.overflow = 'hidden';
}

function closeViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
    document.body.style.overflow = '';
}

function normalizeCategoryValue(cat) {
    if (!cat) return 'News';
    const c = String(cat).trim().toLowerCase();
    if (c.includes('sci') || c.includes('tech')) return 'Science & Technology';
    if (c.includes('feat')) return 'Feature';
    if (c.includes('opin')) return 'Opinion';
    if (c.includes('lit')) return 'Literature';
    if (c.includes('news')) return 'News';
    return cat;
}

// Edit Modal
function openEditModal(item) {
    closeCardMenus();
    editForm.value = {
        id: item.id,
        title: item.title || '',
        category: normalizeCategoryValue(item.category),
        excerpt: item.excerpt || '',
        content: cleanContentForEditing(item.content || item.excerpt || ''),
    };
    isEditOpen.value = true;
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    isEditOpen.value = false;
    document.body.style.overflow = '';
}

async function saveEdit() {
    if (!editForm.value.title.trim()) {
        showToast('Article title is required.', 'error');
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
            id: editForm.value.id,
            title: editForm.value.title.trim(),
            category: editForm.value.category,
            excerpt: editForm.value.excerpt.trim(),
            content: prepareContentForSaving(editForm.value.content),
        };
        const res = await updateEicArticle(editForm.value.id, payload);
        if (res) {
            const updatedCategory = res.article?.category || editForm.value.category;
            const updatedContent = res.article?.content || payload.content;
            const target = articles.value.find(a => String(a.id) === String(editForm.value.id));
            if (target) {
                target.title = payload.title;
                target.category = updatedCategory;
                target.excerpt = payload.excerpt;
                target.content = updatedContent;
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(editForm.value.id)) {
                activeArticle.value.title = payload.title;
                activeArticle.value.category = updatedCategory;
                activeArticle.value.excerpt = payload.excerpt;
                activeArticle.value.content = updatedContent;
            }
            showToast('Article changes saved successfully.', 'success');
            closeEditModal();
        }
    } catch (err) {
        showToast('Could not save article changes. Please try again.', 'error');
    } finally {
        isSavingEdit.value = false;
    }
}

// Confirmation Action Modal
async function promptAction(item, type) {
    closeCardMenus();
    actionTargetArticle.value = item;
    confirmActionType.value = type;

    let title = 'Confirm Action';
    let message = `Are you sure you want to ${type} "${item?.title}"?`;
    let confirmText = 'Confirm';
    let modalType = 'maroon';

    if (type === 'archive') {
        title = 'Move to Archive';
        message = `Are you sure you want to move "${item?.title}" to the archive?`;
        confirmText = 'Archive Article';
    } else if (type === 'restore') {
        title = 'Restore Article';
        message = `Are you sure you want to restore "${item?.title}" to published?`;
        confirmText = 'Restore Article';
    } else if (type === 'delete') {
        title = 'Emergency Delete';
        message = `Are you sure you want to permanently delete "${item?.title}"? All manuscript records will be permanently removed. This action cannot be undone.`;
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
    document.body.style.overflow = '';
}

async function executeConfirmedAction() {
    if (!actionTargetArticle.value) return;
    isProcessingAction.value = true;
    const targetId = actionTargetArticle.value.id;

    try {
        if (confirmActionType.value === 'archive') {
            await archiveEicArticle(targetId);
            const a = articles.value.find(item => String(item.id) === String(targetId));
            if (a) {
                a.isArchived = true;
                a.status = 'Archived';
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                activeArticle.value.isArchived = true;
                activeArticle.value.status = 'Archived';
            }
            showToast('Article moved to archive successfully.', 'success');
        } else if (confirmActionType.value === 'restore') {
            await restoreEicArticle(targetId);
            const a = articles.value.find(item => String(item.id) === String(targetId));
            if (a) {
                a.isArchived = false;
                a.status = 'Published';
            }
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                activeArticle.value.isArchived = false;
                activeArticle.value.status = 'Published';
            }
            showToast('Article restored to published status.', 'success');
        } else if (confirmActionType.value === 'delete') {
            await destroyEicArticle(targetId);
            articles.value = articles.value.filter(item => String(item.id) !== String(targetId));
            if (activeArticle.value && String(activeArticle.value.id) === String(targetId)) {
                closeViewer();
            }
            showToast('Article permanently deleted from database.', 'success');
        }
        closeConfirmActionModal();
    } catch (err) {
        showToast('Action failed. Please try again.', 'error');
    } finally {
        isProcessingAction.value = false;
    }
}

function handleViewerEdit() {
    if (!activeArticle.value) return;
    const art = activeArticle.value;
    closeViewer();
    openEditModal(art);
}

function handleViewerArchiveToggle() {
    if (!activeArticle.value) return;
    const art = activeArticle.value;
    promptAction(art, art.isArchived ? 'restore' : 'archive');
}

function handleViewerDelete() {
    if (!activeArticle.value) return;
    const art = activeArticle.value;
    promptAction(art, 'delete');
}

function clearFilters() {
    sortBy.value = 'newest';
    selectedCategory.value = 'All';
    dateFilterType.value = 'any';
    selectedMonth.value = '';
    selectedDay.value = '';
    selectedYear.value = '';
    isFilterOpen.value = false;
}

onMounted(() => {
    loadArticles();
    document.addEventListener('click', closeCardMenus);
});

onUnmounted(() => {
    document.removeEventListener('click', closeCardMenus);
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
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
                                <label for="sort-select">Sort by</label>
                                <select id="sort-select" v-model="sortBy" class="archive-select">
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="popular">Most Viewed</option>
                                    <option value="az">A-Z</option>
                                </select>
                            </div>
                            <div class="filter-field">
                                <label for="category-select">Category</label>
                                <select id="category-select" v-model="selectedCategory" class="archive-select">
                                    <option value="All">All categories</option>
                                    <option value="News">News</option>
                                    <option value="Features">Features</option>
                                    <option value="Opinion">Opinion</option>
                                    <option value="Science and Technology">Science &amp; Technology</option>
                                    <option value="Literature">Literature</option>
                                </select>
                            </div>
                            <div class="filter-field filter-date-field">
                                <label for="date-filter-type">Published date</label>
                                <div class="published-date-controls">
                                    <select id="date-filter-type" v-model="dateFilterType" class="archive-select">
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

                <!-- 2-column Grid of Article Cards (Exact Blade .article-box Layout) -->
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

                <!-- Empty State -->
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
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL 1: Full Article Viewer Modal (Exact Blade Structure)              -->
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
        <!-- MODAL 2: Edit Article Modal (Cleanly Arranged Fields, No Readtime, No Cancel Btn) -->
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
                        <label for="edit-title-input">Article Title / Headline <span class="required-star">*</span></label>
                        <input id="edit-title-input" v-model="editForm.title" type="text" class="form-input" placeholder="Enter headline title..." required>
                    </div>

                    <div class="form-field">
                        <label for="edit-category-select">Category <span class="required-star">*</span></label>
                        <select id="edit-category-select" v-model="editForm.category" class="form-select">
                            <option value="News">News</option>
                            <option value="Feature">Feature</option>
                            <option value="Opinion">Opinion</option>
                            <option value="Science & Technology">SciTech</option>
                            <option value="Literature">Literature</option>
                        </select>
                    </div>

                    <div class="form-field">
                        <label for="edit-excerpt-input">Excerpt / Brief Summary <span class="required-star">*</span></label>
                        <textarea id="edit-excerpt-input" v-model="editForm.excerpt" class="form-textarea" rows="3" placeholder="Brief summary or lead paragraph..." required></textarea>
                    </div>

                    <div class="form-field">
                        <label for="edit-body-input">Article Body / Manuscript Content <span class="required-star">*</span></label>
                        <textarea id="edit-body-input" v-model="editForm.content" class="form-textarea edit-body-textarea" rows="10" placeholder="Type or paste the manuscript content..." required></textarea>
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

    </EicLayout>
</template>
