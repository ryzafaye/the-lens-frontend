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
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/executive-modals.css';

const router = useRouter();
const user = currentUser;

// RBAC
const isPresOrVp = computed(() => {
    return ['President', 'Vice President', 'Executive Vice President'].includes(user?.role || '');
});

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

// Toast
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

// Formatters
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Number(num).toLocaleString('en-US');
}

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 100, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
}

// Fetch articles
async function loadArticles() {
    isLoading.value = true;
    try {
        const data = await getExecutiveManageArticles(true);
        if (Array.isArray(data)) {
            articles.value = data;
        } else if (data && Array.isArray(data.articles)) {
            articles.value = data.articles;
        }
    } catch (err) {
        console.error('Failed to load articles:', err);
        showToast('Failed to load articles.', 'error');
    } finally {
        isLoading.value = false;
    }
}

// Filtered and sorted computed list
const activeArticlesCount = computed(() => {
    return articles.value.filter(a => !a.isArchived).length;
});

const archivedArticlesCount = computed(() => {
    return articles.value.filter(a => a.isArchived).length;
});

const isFilterActive = computed(() => {
    return (
        sortBy.value !== 'newest' ||
        selectedCategory.value !== 'All' ||
        dateFilterType.value !== 'any'
    );
});

const filteredArticles = computed(() => {
    let list = articles.value.filter(a => {
        if (activeTab.value === 'active') return !a.isArchived;
        return a.isArchived;
    });

    // Search query
    const query = searchQuery.value.trim().toLowerCase();
    if (query) {
        list = list.filter(a => {
            const titleMatch = (a.title || '').toLowerCase().includes(query);
            const authorMatch = (a.author || '').toLowerCase().includes(query);
            const catMatch = (a.category || '').toLowerCase().includes(query);
            return titleMatch || authorMatch || catMatch;
        });
    }

    // Category filter
    if (selectedCategory.value !== 'All') {
        const targetCat = selectedCategory.value.toLowerCase();
        list = list.filter(a => (a.category || '').toLowerCase() === targetCat);
    }

    // Date filter
    if (dateFilterType.value === 'today') {
        const todayStr = new Date().toDateString();
        list = list.filter(a => {
            const artDate = new Date(a.rawDate || a.date).toDateString();
            return artDate === todayStr;
        });
    } else if (dateFilterType.value === 'this_week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        list = list.filter(a => {
            const artDate = new Date(a.rawDate || a.date);
            return artDate >= oneWeekAgo;
        });
    } else if (dateFilterType.value === 'choose') {
        list = list.filter(a => {
            const d = new Date(a.rawDate || a.date);
            if (selectedYear.value && d.getFullYear() !== parseInt(selectedYear.value)) return false;
            if (selectedMonth.value && d.getMonth() + 1 !== parseInt(selectedMonth.value)) return false;
            if (selectedDay.value && d.getDate() !== parseInt(selectedDay.value)) return false;
            return true;
        });
    }

    // Sort
    return list.slice().sort((a, b) => {
        if (sortBy.value === 'newest') {
            return new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date);
        }
        if (sortBy.value === 'oldest') {
            return new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date);
        }
        if (sortBy.value === 'popular') {
            return (b.views || 0) - (a.views || 0);
        }
        if (sortBy.value === 'az') {
            return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
    });
});

// UI Actions
function switchTab(tab) {
    activeTab.value = tab;
}

function clearSearch() {
    searchQuery.value = '';
}

function toggleFilterDropdown() {
    isFilterOpen.value = !isFilterOpen.value;
}

function closeFilterDropdown() {
    isFilterOpen.value = false;
}

function resetFilters() {
    sortBy.value = 'newest';
    selectedCategory.value = 'All';
    dateFilterType.value = 'any';
    selectedMonth.value = '';
    selectedDay.value = '';
    selectedYear.value = '';
    isFilterOpen.value = false;
}

// Viewer modal
function openViewer(article) {
    activeArticle.value = article;
    isViewerOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
    document.body.classList.remove('modal-open');
}

// Edit modal
function openEditModal(article) {
    editForm.value = {
        id: article.id,
        title: article.title || '',
        category: article.category || 'News',
        excerpt: article.excerpt || '',
        content: cleanContentForEditing(article.content || ''),
    };
    isEditOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    isEditOpen.value = false;
    document.body.classList.remove('modal-open');
}

async function handleSaveEdit() {
    if (!editForm.value.title.trim()) {
        showToast('Headline cannot be empty.', 'error');
        return;
    }

    isSavingEdit.value = true;
    try {
        const payload = {
            title: editForm.value.title.trim(),
            category: editForm.value.category,
            excerpt: editForm.value.excerpt.trim(),
            content: prepareContentForSaving(editForm.value.content),
        };
        await updateExecutiveArticle(editForm.value.id, payload);
        showToast('Article updated successfully.', 'success');
        closeEditModal();
        await loadArticles();
    } catch (err) {
        console.error('Failed to update article:', err);
        showToast('Failed to update article.', 'error');
    } finally {
        isSavingEdit.value = false;
    }
}

// Confirm action modal (Archive / Restore / Delete)
function promptAction(article, type) {
    actionTargetArticle.value = article;
    confirmActionType.value = type;
    isConfirmActionOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeConfirmAction() {
    isConfirmActionOpen.value = false;
    actionTargetArticle.value = null;
    document.body.classList.remove('modal-open');
}

async function handleConfirmAction() {
    if (!actionTargetArticle.value) return;

    isProcessingAction.value = true;
    try {
        const id = actionTargetArticle.value.id;
        if (confirmActionType.value === 'archive') {
            await archiveExecutiveArticle(id);
            showToast('Article moved to archive successfully.', 'success');
        } else if (confirmActionType.value === 'restore') {
            await restoreExecutiveArticle(id);
            showToast('Article restored to active published articles successfully.', 'success');
        } else if (confirmActionType.value === 'delete') {
            await destroyExecutiveArticle(id);
            showToast('Article permanently deleted.', 'success');
        }
        closeConfirmAction();
        await loadArticles();
    } catch (err) {
        console.error(`Failed to ${confirmActionType.value} article:`, err);
        showToast(`Failed to ${confirmActionType.value} article.`, 'error');
    } finally {
        isProcessingAction.value = false;
    }
}

// Close filter on outside click
function handleClickOutside(e) {
    if (isFilterOpen.value) {
        const filterBox = document.getElementById('filter-dropdown');
        const filterBtn = document.getElementById('sort-filter-btn');
        if (filterBox && !filterBox.contains(e.target) && filterBtn && !filterBtn.contains(e.target)) {
            isFilterOpen.value = false;
        }
    }
}

onMounted(() => {
    loadArticles();
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
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
                <!-- Toast Notification -->
                <transition name="fade">
                    <div v-if="toastMessage" class="toast-container">
                        <div class="toast-message" :class="toastType">
                            <i :class="toastType === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
                            <span>{{ toastMessage }}</span>
                        </div>
                    </div>
                </transition>

                <!-- Page Header & Title Section -->
                <div class="page-title-section animate-fade-in delay-1">
                    <h1 class="page-title">Manage Articles &amp; Archives</h1>
                </div>

                <!-- Tabs Navigation (Active Articles vs. Archived Articles) -->
                <div class="manage-tabs-container animate-fade-in delay-2">
                    <button
                        type="button"
                        id="tab-active-btn"
                        class="manage-tab-btn"
                        :class="{ 'active': activeTab === 'active' }"
                        @click="switchTab('active')"
                    >
                        <i class="fa-regular fa-newspaper"></i>
                        <span>Active Articles</span>
                        <span id="badge-active-count" class="tab-count-badge">{{ activeArticlesCount }}</span>
                    </button>
                    <button
                        type="button"
                        id="tab-archived-btn"
                        class="manage-tab-btn"
                        :class="{ 'active': activeTab === 'archived' }"
                        @click="switchTab('archived')"
                    >
                        <i class="fa-solid fa-box-archive"></i>
                        <span>Archived Articles</span>
                        <span id="badge-archived-count" class="tab-count-badge">{{ archivedArticlesCount }}</span>
                    </button>
                </div>

                <!-- Search & Filter Toolbar -->
                <div class="manage-toolbar animate-fade-in delay-2">
                    <!-- Search Bar -->
                    <div class="manage-search-shell">
                        <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                        <input
                            v-model="searchQuery"
                            type="search"
                            id="manage-search-input"
                            class="manage-search-input"
                            placeholder="Search by article title or author..."
                            aria-label="Search by article title or author"
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

                    <!-- Sort & Filter Dropdown Trigger & Popup -->
                    <div class="sort-filter-wrapper">
                        <button
                            type="button"
                            id="sort-filter-btn"
                            class="sort-filter-btn"
                            :aria-expanded="isFilterOpen"
                            aria-controls="filter-dropdown"
                            @click="toggleFilterDropdown"
                        >
                            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                            <span>Sort &amp; Filter</span>
                            <span v-if="isFilterActive" class="filter-active-indicator" title="Filters active"></span>
                            <i class="fa-solid fa-chevron-down filter-chevron" aria-hidden="true"></i>
                        </button>

                        <!-- Filter Dropdown Popup -->
                        <div v-if="isFilterOpen" id="filter-dropdown" class="filter-dropdown">
                            <div class="filter-panel-heading">
                                <span>Sort &amp; Filter</span>
                                <button type="button" class="icon-button" aria-label="Close filters" @click="closeFilterDropdown">
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
                                            <option value="choose">Choose date</option>
                                        </select>
                                        <div v-if="dateFilterType === 'choose'" class="date-filter-selects" id="date-filter-value-wrap">
                                            <select v-model="selectedMonth" class="archive-select date-filter-select" aria-label="Month">
                                                <option value="">Month</option>
                                                <option value="1">Jan</option><option value="2">Feb</option><option value="3">Mar</option>
                                                <option value="4">Apr</option><option value="5">May</option><option value="6">Jun</option>
                                                <option value="7">Jul</option><option value="8">Aug</option><option value="9">Sep</option>
                                                <option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>
                                            </select>
                                            <select v-model="selectedDay" class="archive-select date-filter-select" aria-label="Day">
                                                <option value="">Day</option>
                                                <option v-for="d in 31" :key="d" :value="d">{{ d }}</option>
                                            </select>
                                            <select v-model="selectedYear" class="archive-select date-filter-select" aria-label="Year">
                                                <option value="">Year</option>
                                                <option value="2026">2026</option>
                                                <option value="2025">2025</option>
                                                <option value="2024">2024</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="filter-panel-footer">
                                <button type="button" class="btn-cancel" @click="resetFilters">Reset</button>
                                <button type="button" class="btn-save" @click="closeFilterDropdown">Apply</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Articles Grid / List -->
                <section class="manage-articles-grid animate-fade-in delay-3" aria-label="Articles list">
                    <article
                        v-for="article in filteredArticles"
                        :key="article.id"
                        class="manage-article-card"
                        :class="{ 'card-archived': article.isArchived }"
                    >
                        <div class="card-image-box">
                            <img :src="article.image || '/images/maroon.jpg'" :alt="article.title" loading="lazy">
                            <span class="card-status-badge" :class="article.isArchived ? 'status-archived' : 'status-published'">
                                {{ article.isArchived ? 'Archived' : 'Published' }}
                            </span>
                        </div>
                        <div class="card-details-box">
                            <div class="card-category-row">
                                <span class="card-category-tag">{{ article.category }}</span>
                                <span class="card-meta-dot">•</span>
                                <span class="card-read-time">{{ article.readTime }}</span>
                            </div>
                            <h2 class="card-title-text" :title="article.title" @click="openViewer(article)">
                                {{ article.title }}
                            </h2>
                            <p class="card-excerpt-text">{{ article.excerpt }}</p>

                            <div class="card-byline-row">
                                <div class="card-author-info">
                                    <img :src="resolveAvatarUrl(article.authorAvatar)" :alt="article.author" class="card-author-avatar">
                                    <span class="card-author-name">{{ article.author }}</span>
                                </div>
                                <div class="card-date-info">
                                    <span>{{ article.date }}</span>
                                </div>
                            </div>

                            <div class="card-metrics-row">
                                <span class="card-metric" title="Total Views">
                                    <i class="fa-regular fa-eye"></i> {{ formatNumber(article.views) }}
                                </span>
                                <span class="card-metric" title="Total Shares">
                                    <i class="fa-solid fa-share-nodes"></i> {{ formatNumber(article.shares) }}
                                </span>
                            </div>

                            <!-- Actions Row -->
                            <div class="card-actions-row">
                                <button
                                    type="button"
                                    class="btn-card-action btn-view"
                                    title="View full article"
                                    @click="openViewer(article)"
                                >
                                    <i class="fa-regular fa-eye"></i>
                                    <span>View</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-card-action btn-edit"
                                    title="Edit manuscript"
                                    @click="openEditModal(article)"
                                >
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Edit</span>
                                </button>
                                <button
                                    v-if="!article.isArchived"
                                    type="button"
                                    class="btn-card-action btn-archive"
                                    title="Move article to archive"
                                    @click="promptAction(article, 'archive')"
                                >
                                    <i class="fa-solid fa-box-archive"></i>
                                    <span>Archive</span>
                                </button>
                                <template v-else>
                                    <button
                                        type="button"
                                        class="btn-card-action btn-restore"
                                        title="Restore article to active published status"
                                        @click="promptAction(article, 'restore')"
                                    >
                                        <i class="fa-solid fa-rotate-left"></i>
                                        <span>Restore</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-card-action btn-delete"
                                        title="Permanently delete article"
                                        @click="promptAction(article, 'delete')"
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
                        <p class="empty-desc">There are no articles matching your current filter criteria.</p>
                    </div>
                </section>
            </div>
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
                        <span class="viewer-read-time">{{ activeArticle?.readTime || '3 min read' }}</span>
                    </div>
                    <button type="button" class="viewer-close-btn" aria-label="Close viewer" @click="closeViewer">
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
                    <button type="button" class="btn-cancel" @click="closeViewer">Close</button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: Edit Manuscript Modal                                         -->
        <!-- ====================================================================== -->
        <div v-if="isEditOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h3 class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-pen-to-square text-[#5c0a18]"></i>
                        <span>Edit Article Manuscript</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" aria-label="Close dialog" @click="closeEditModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="edit-modal-form">
                    <div class="form-field">
                        <label for="edit-title-input">Headline *</label>
                        <input
                            id="edit-title-input"
                            v-model="editForm.title"
                            type="text"
                            class="form-input"
                            placeholder="Enter headline"
                        >
                    </div>

                    <div class="form-field">
                        <label for="edit-category-select">Section Category *</label>
                        <select id="edit-category-select" v-model="editForm.category" class="form-select">
                            <option value="News">News</option>
                            <option value="Features">Features</option>
                            <option value="Opinion">Opinion</option>
                            <option value="Science and Technology">Science &amp; Technology</option>
                            <option value="Literature">Literature</option>
                        </select>
                    </div>

                    <div class="form-field">
                        <label for="edit-excerpt-input">Excerpt / Teaser</label>
                        <textarea
                            id="edit-excerpt-input"
                            v-model="editForm.excerpt"
                            class="form-textarea"
                            rows="2"
                            placeholder="Brief summary..."
                        ></textarea>
                    </div>

                    <div class="form-field">
                        <label for="edit-content-input">Full Article Body *</label>
                        <textarea
                            id="edit-content-input"
                            v-model="editForm.content"
                            class="form-textarea font-serif"
                            rows="9"
                            placeholder="Full manuscript content..."
                        ></textarea>
                    </div>
                </div>

                <div class="edit-modal-footer">
                    <button type="button" class="btn-cancel" @click="closeEditModal">Cancel</button>
                    <button
                        type="button"
                        class="btn-save"
                        :disabled="isSavingEdit"
                        @click="handleSaveEdit"
                    >
                        <i v-if="isSavingEdit" class="fa-solid fa-spinner fa-spin"></i>
                        <span>{{ isSavingEdit ? 'Saving...' : 'Save Changes' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 3: Confirm Action Modal (Archive / Restore / Delete)              -->
        <!-- ====================================================================== -->
        <div v-if="isConfirmActionOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card confirm-modal-card">
                <div class="confirm-icon-wrap" :class="confirmActionType">
                    <i v-if="confirmActionType === 'archive'" class="fa-solid fa-box-archive"></i>
                    <i v-else-if="confirmActionType === 'restore'" class="fa-solid fa-rotate-left"></i>
                    <i v-else class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3 class="confirm-title">
                    {{
                        confirmActionType === 'archive' ? 'Archive This Article?' :
                        confirmActionType === 'restore' ? 'Restore This Article?' :
                        'Permanently Delete Article?'
                    }}
                </h3>

                <p class="confirm-desc">
                    {{
                        confirmActionType === 'archive' ? 'This article will be moved to the archives and removed from public listings.' :
                        confirmActionType === 'restore' ? 'This article will be restored to active published articles and visible to the public.' :
                        'This action cannot be undone. All data associated with this article will be permanently removed from the system.'
                    }}
                </p>

                <div class="confirm-actions">
                    <button type="button" class="btn-cancel" @click="closeConfirmAction">Cancel</button>
                    <button
                        type="button"
                        class="btn-confirm"
                        :class="confirmActionType"
                        :disabled="isProcessingAction"
                        @click="handleConfirmAction"
                    >
                        <i v-if="isProcessingAction" class="fa-solid fa-spinner fa-spin"></i>
                        <span>
                            {{
                                isProcessingAction ? 'Processing...' :
                                confirmActionType === 'archive' ? 'Yes, Archive' :
                                confirmActionType === 'restore' ? 'Yes, Restore' :
                                'Yes, Delete Permanently'
                            }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
</template>
