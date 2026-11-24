<script setup>
import { ref, computed, onMounted } from 'vue';
import MpcLayout from '../../layouts/MpcLayout.vue';
import {
    getMpcPublishArticle,
    publishMpcArticleRelease,
    unpublishMpcArticleRelease,
    assignMpcArticleCover,
    returnMpcArticleForRevision,
} from '../../services/api.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';
import { resolveMediaUrl } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/mpc-publish-article.css';

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const articles = ref([]);
const approvedCovers = ref([]);

// Active Controls
const activeView = ref('ready'); // 'ready' | 'published' | 'unpublished' | 'covers'
const activeCategory = ref('all');
const searchQuery = ref('');
const currentSort = ref('newest');

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Modals State
// 1. Assign Cover Modal
const isAssignCoverOpen = ref(false);
const coverTargetArticle = ref(null);
const selectedCoverId = ref(null);
const coverModalFilter = ref('all'); // 'all' | 'photo' | 'cartoon'

// 2. Manuscript Reader Modal
const isReaderOpen = ref(false);
const activeManuscript = ref(null);

// 3. Return to EIC Modal
const isReturnOpen = ref(false);
const returnTargetArticle = ref(null);
const returnRemarks = ref('');
const returnError = ref('');

// 4. Inspect Artwork Modal
const isInspectOpen = ref(false);
const activeInspectCover = ref(null);

// Helper methods
function calculateReadingTime(text) {
    if (!text) return '1 min read';
    const plain = text.replace(/<[^>]*>/g, ' ').trim();
    const words = plain.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

function resolveCoverType(cover) {
    if (!cover) return 'photo';
    const t = (cover.image_type || cover.type || cover.mediaType || cover.coverType || '').toLowerCase();
    if (t.includes('cartoon') || t.includes('illustration') || t.includes('drawing')) return 'cartoon';
    const title = (cover.title || '').toLowerCase();
    if (title.includes('cartoon') || title.includes('caricature')) return 'cartoon';
    const role = (cover.uploaderRole || cover.role || '').toLowerCase();
    if (role.includes('cartoon')) return 'cartoon';
    return 'photo';
}

function resolveCoverUrl(itemOrUrl) {
    return resolveMediaUrl(itemOrUrl, { width: 800, crop: 'limit' });
}

function formatCategory(cat) {
    if (!cat) return 'General';
    const c = String(cat).trim();
    if (c.toLowerCase().includes('sci') || c.toLowerCase().includes('tech')) return 'SciTech';
    return c;
}

function cleanArtistName(name) {
    if (!name) return 'Media Team Member';
    return String(name).replace(/^By\s+/i, '').trim();
}

function getCoverForArticle(article) {
    if (!article) return null;
    const coverId = article.assignedCoverId || article.cover_id;
    if (coverId) {
        const found = approvedCovers.value.find(c => String(c.id) === String(coverId));
        if (found) return found;
    }
    if (article.coverImage || article.image) {
        return {
            image: article.coverImage || article.image,
            file_url: article.coverImage || article.image,
            artist: article.coverArtist || 'Media Team Member',
            artist_name: article.coverArtist || 'Media Team Member',
            type: article.coverType || 'photo',
            image_type: article.coverType || 'photo',
        };
    }
    return null;
}

function matchesCategory(cat, target) {
    if (!target || target === 'all') return true;
    const c = (cat || '').toLowerCase();
    const t = target.toLowerCase();
    if (t === 'scitech') return c.includes('sci') || c.includes('tech');
    if (t === 'features') return c.includes('feature');
    if (t === 'literature') return c.includes('liter');
    return c.includes(t);
}

// Counts
const countReady = computed(() => {
    return articles.value.filter(a => a.status === 'ready' || a.db_status === 'Approved' || a.db_status === 'Ready to Publish').length;
});

const countPublished = computed(() => {
    return articles.value.filter(a => a.status === 'published' || (a.db_status || '').toLowerCase() === 'published').length;
});

const countUnpublished = computed(() => {
    return articles.value.filter(a => a.status === 'unpublished' || (a.db_status || '').toLowerCase() === 'unpublished').length;
});

const countCovers = computed(() => {
    return approvedCovers.value.length;
});

const coverLibraryFilter = ref('all'); // 'all' | 'photo' | 'cartoon'

const countMediaCovers = computed(() => {
    return approvedCovers.value.filter(c => resolveCoverType(c) === 'photo').length;
});

const countCartoonCovers = computed(() => {
    return approvedCovers.value.filter(c => resolveCoverType(c) === 'cartoon').length;
});

// Filtered articles list
const filteredArticles = computed(() => {
    let list = articles.value.filter(a => {
        if (activeView.value === 'published') {
            return a.status === 'published' || (a.db_status || '').toLowerCase() === 'published';
        }
        if (activeView.value === 'unpublished') {
            return a.status === 'unpublished' || (a.db_status || '').toLowerCase() === 'unpublished';
        }
        return a.status === 'ready' || a.db_status === 'Approved' || a.db_status === 'Ready to Publish';
    });

    if (activeCategory.value !== 'all') {
        list = list.filter(a => matchesCategory(a.category, activeCategory.value));
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(a => {
            const title = (a.title || '').toLowerCase();
            const author = (a.author || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            return title.includes(q) || author.includes(q) || cat.includes(q);
        });
    }

    list.sort((a, b) => {
        const timeA = new Date(a.rawDate || a.dateApproved || a.created_at || 0).getTime();
        const timeB = new Date(b.rawDate || b.dateApproved || b.created_at || 0).getTime();
        return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
});

// Filtered covers list for library gallery view
const filteredApprovedCovers = computed(() => {
    let list = [...approvedCovers.value];

    if (coverLibraryFilter.value !== 'all') {
        list = list.filter(c => resolveCoverType(c) === coverLibraryFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(c => {
            const title = (c.title || '').toLowerCase();
            const artist = (c.artist_name || c.artist || c.uploader_name || '').toLowerCase();
            const type = resolveCoverType(c);
            return title.includes(q) || artist.includes(q) || type.includes(q);
        });
    }

    list.sort((a, b) => {
        const timeA = new Date(a.rawDate || a.date || a.created_at || 0).getTime();
        const timeB = new Date(b.rawDate || b.date || b.created_at || 0).getTime();
        return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
});

// Filtered covers list for assign modal
const filteredModalCovers = computed(() => {
    if (coverModalFilter.value === 'all') return approvedCovers.value;
    return approvedCovers.value.filter(c => resolveCoverType(c) === coverModalFilter.value);
});

// Modal Handlers
function openReaderModal(article) {
    activeManuscript.value = { ...article };
    isReaderOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeReaderModal() {
    isReaderOpen.value = false;
    activeManuscript.value = null;
    document.body.classList.remove('modal-open');
}

function openAssignCoverModal(article) {
    coverTargetArticle.value = article;
    selectedCoverId.value = article.assignedCoverId || article.cover_id || null;
    coverModalFilter.value = 'all';
    isAssignCoverOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeAssignCoverModal() {
    isAssignCoverOpen.value = false;
    coverTargetArticle.value = null;
    selectedCoverId.value = null;
    document.body.classList.remove('modal-open');
}

function openReturnModal(article) {
    returnTargetArticle.value = article;
    returnRemarks.value = '';
    returnError.value = '';
    isReturnOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeReturnModal() {
    isReturnOpen.value = false;
    returnTargetArticle.value = null;
    returnRemarks.value = '';
    returnError.value = '';
    document.body.classList.remove('modal-open');
}

function openInspectModal(cover) {
    activeInspectCover.value = cover;
    isInspectOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectCover.value = null;
    document.body.classList.remove('modal-open');
}

// Action implementations
async function handleConfirmAssignCover() {
    if (!coverTargetArticle.value || !selectedCoverId.value || isSubmitting.value) {
        showToast('Please select a cover image first.', 'warning');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Attach Cover',
        message: 'Are you sure you want to attach this cover artwork to the article?',
        confirmText: 'Attach Cover',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const res = await assignMpcArticleCover(coverTargetArticle.value.id, selectedCoverId.value);
        const selectedObj = approvedCovers.value.find(c => String(c.id) === String(selectedCoverId.value));
        const coverUrl = selectedObj?.file_url || selectedObj?.image || '';
        const coverArtist = selectedObj?.artist_name || selectedObj?.artist || '';

        // Update in memory
        const idx = articles.value.findIndex(a => a.id === coverTargetArticle.value.id);
        if (idx !== -1) {
            articles.value[idx].assignedCoverId = String(selectedCoverId.value);
            articles.value[idx].coverImage = coverUrl;
            articles.value[idx].image = coverUrl;
            articles.value[idx].coverArtist = coverArtist;
        }

        if (activeManuscript.value && activeManuscript.value.id === coverTargetArticle.value.id) {
            activeManuscript.value.assignedCoverId = String(selectedCoverId.value);
            activeManuscript.value.coverImage = coverUrl;
            activeManuscript.value.image = coverUrl;
            activeManuscript.value.coverArtist = coverArtist;
        }

        showToast(res?.message || 'Cover attached successfully.', 'success');
        closeAssignCoverModal();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to attach cover.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function handlePublishArticle(article) {
    if (isSubmitting.value) return;

    const confirmed = await confirmAction({
        title: 'Publish Article Release',
        message: `Are you sure you want to release and publish "${article.title}" to the public website?`,
        confirmText: 'Publish Release',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;

    try {
        const res = await publishMpcArticleRelease(article.id, article.assignedCoverId);
        const idx = articles.value.findIndex(a => a.id === article.id);
        if (idx !== -1) {
            articles.value[idx].status = 'published';
            articles.value[idx].db_status = 'Published';
        }
        if (activeManuscript.value && activeManuscript.value.id === article.id) {
            activeManuscript.value.status = 'published';
            activeManuscript.value.db_status = 'Published';
        }
        showToast(res?.message || 'Article published successfully.', 'success');
        closeReaderModal();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to publish article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function handleUnpublishArticle(article) {
    if (isSubmitting.value) return;

    const confirmed = await confirmAction({
        title: 'Unpublish Article',
        message: `Are you sure you want to unpublish "${article.title}"? It will no longer be visible on the public website.`,
        confirmText: 'Unpublish',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;

    try {
        const res = await unpublishMpcArticleRelease(article.id);
        const idx = articles.value.findIndex(a => a.id === article.id);
        if (idx !== -1) {
            articles.value[idx].status = 'unpublished';
            articles.value[idx].db_status = 'Unpublished';
        }
        if (activeManuscript.value && activeManuscript.value.id === article.id) {
            activeManuscript.value.status = 'unpublished';
            activeManuscript.value.db_status = 'Unpublished';
        }
        showToast(res?.message || 'Article unpublished.', 'success');
        closeReaderModal();
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to unpublish article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function handleConfirmReturn() {
    if (!returnTargetArticle.value || isSubmitting.value) return;

    if (!returnRemarks.value.trim()) {
        returnError.value = 'Please provide revision remarks before returning.';
        return;
    }

    const confirmed = await confirmAction({
        title: 'Return to EIC for Revision',
        message: 'Are you sure you want to return this article to the Editor-in-Chief with revision remarks?',
        confirmText: 'Return Article',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const res = await returnMpcArticleForRevision(returnTargetArticle.value.id, returnRemarks.value.trim());
        articles.value = articles.value.filter(a => a.id !== returnTargetArticle.value.id);
        closeReturnModal();
        closeReaderModal();
        showToast(res?.message || 'Article returned to Editor-in-Chief for revision.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to return article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function loadData(force = false) {
    isLoading.value = true;
    try {
        const res = await getMpcPublishArticle(force);
        if (res) {
            articles.value = Array.isArray(res.articles) ? res.articles : (Array.isArray(res.approvedArticles) ? res.approvedArticles : []);
            approvedCovers.value = Array.isArray(res.approvedCovers) ? res.approvedCovers : [];
        }
    } catch (err) {
        console.error('Failed to load MPC publish article data:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadData(true);
});
</script>

<template>
    <MpcLayout>
        <main class="content-container">
            <!-- Top Section: Header with Title and Sort Control -->
            <div class="page-title-section animate-fade-in delay-1">
                <div class="page-header-row">
                    <h1 class="page-title">Publish Article</h1>

                    <!-- Search & Sort Controls Lockup -->
                    <div class="publish-controls-group">
                        <div class="compact-search-box">
                            <i class="fa-solid fa-magnifying-glass search-icon"></i>
                            <input
                                v-model="searchQuery"
                                type="text"
                                class="compact-search-input"
                                placeholder="Search articles..."
                                aria-label="Search articles"
                            >
                        </div>

                        <div class="review-sort-container">
                            <label for="mpc-sort-select" class="review-sort-label">
                                <i class="fa-solid fa-arrow-down-wide-short"></i>
                                <span>Sort:</span>
                            </label>
                            <div class="sort-select-wrapper">
                                <select id="mpc-sort-select" v-model="currentSort" class="review-sort-select" aria-label="Sort articles">
                                    <option value="newest">Newest Approved</option>
                                    <option value="oldest">Oldest Approved</option>
                                </select>
                                <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Category Filter Pills (when not in covers library view) -->
                <div v-if="activeView !== 'covers'" class="mpc-filters-bar" id="mpc-category-filters-bar">
                    <div class="mpc-category-pills">
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'all' }"
                            @click="activeCategory = 'all'"
                        >
                            All Categories
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'news' }"
                            @click="activeCategory = 'news'"
                        >
                            News
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'opinion' }"
                            @click="activeCategory = 'opinion'"
                        >
                            Opinion
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'features' }"
                            @click="activeCategory = 'features'"
                        >
                            Features
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'scitech' }"
                            @click="activeCategory = 'scitech'"
                        >
                            SciTech
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: activeCategory === 'literature' }"
                            @click="activeCategory = 'literature'"
                        >
                            Literature
                        </button>
                    </div>
                </div>

                <!-- Format Filter Pills (when in covers library view) -->
                <div v-else class="mpc-filters-bar" id="mpc-cover-filters-bar">
                    <div class="mpc-category-pills">
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: coverLibraryFilter === 'all' }"
                            @click="coverLibraryFilter = 'all'"
                        >
                            <i class="fa-solid fa-shapes"></i>
                            <span>All Formats ({{ approvedCovers.length }})</span>
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: coverLibraryFilter === 'photo' }"
                            @click="coverLibraryFilter = 'photo'"
                        >
                            <i class="fa-solid fa-camera"></i>
                            <span>Photos / Media ({{ countMediaCovers }})</span>
                        </button>
                        <button
                            type="button"
                            class="mpc-category-pill"
                            :class="{ active: coverLibraryFilter === 'cartoon' }"
                            @click="coverLibraryFilter = 'cartoon'"
                        >
                            <i class="fa-solid fa-palette"></i>
                            <span>Editorial Cartoons ({{ countCartoonCovers }})</span>
                        </button>
                    </div>
                </div>

                <!-- Primary View Tabs -->
                <div class="mpc-view-tabs manage-tabs-container" role="tablist">
                    <button
                        type="button"
                        class="mpc-view-tab-btn manage-tab-btn"
                        :class="{ active: activeView === 'ready' }"
                        role="tab"
                        :aria-selected="activeView === 'ready'"
                        @click="activeView = 'ready'"
                    >
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>Ready to Publish</span>
                        <span class="mpc-tab-count-pill tab-count-badge">{{ countReady }}</span>
                    </button>

                    <button
                        type="button"
                        class="mpc-view-tab-btn manage-tab-btn"
                        :class="{ active: activeView === 'published' }"
                        role="tab"
                        :aria-selected="activeView === 'published'"
                        @click="activeView = 'published'"
                    >
                        <i class="fa-solid fa-globe"></i>
                        <span>Published Articles</span>
                        <span class="mpc-tab-count-pill tab-count-badge">{{ countPublished }}</span>
                    </button>

                    <button
                        type="button"
                        class="mpc-view-tab-btn manage-tab-btn"
                        :class="{ active: activeView === 'unpublished' }"
                        role="tab"
                        :aria-selected="activeView === 'unpublished'"
                        @click="activeView = 'unpublished'"
                    >
                        <i class="fa-solid fa-box-archive"></i>
                        <span>Unpublished</span>
                        <span class="mpc-tab-count-pill tab-count-badge">{{ countUnpublished }}</span>
                    </button>

                    <button
                        type="button"
                        class="mpc-view-tab-btn manage-tab-btn"
                        :class="{ active: activeView === 'covers' }"
                        role="tab"
                        :aria-selected="activeView === 'covers'"
                        @click="activeView = 'covers'"
                    >
                        <i class="fa-regular fa-image"></i>
                        <span>Approved Covers Library</span>
                        <span class="mpc-tab-count-pill tab-count-badge">{{ countCovers }}</span>
                    </button>
                </div>
            </div>

            <!-- Articles Queue Grid (Ready, Published, Unpublished) -->
            <div v-if="activeView !== 'covers'" class="mpc-articles-grid">
                <div v-if="isLoading" class="mpc-tab-empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 48px; background: #fff; border-radius: 12px;">
                    <p style="color: #667085;">Loading articles...</p>
                </div>

                <div v-else-if="filteredArticles.length === 0" class="mpc-tab-empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 56px 20px; background: #ffffff; border: 1px dashed var(--border-subtle, #eaecf0); border-radius: 12px; margin-top: 10px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fdf2f4; color: var(--sidebar-maroon, #5c0a18); display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-bottom: 14px;">
                        <i class="fa-solid fa-feather-pointed"></i>
                    </div>
                    <h3 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.15rem; font-weight: 700; color: #101828; margin: 0;">
                        No Articles in this section
                    </h3>
                </div>

                <!-- Horizontal M&PC Publish Cards (Design parity with Blade) -->
                <div
                    v-for="article in filteredArticles"
                    :key="article.id"
                    class="mpc-publish-card"
                    :id="`card-${article.id}`"
                    :data-id="article.id"
                >
                    <div class="mpc-card-main-content">
                        <!-- Left Cover Slot -->
                        <div class="mpc-cover-slot">
                            <div
                                class="mpc-cover-preview-box"
                                style="cursor: pointer;"
                                title="Click to assign or change cover"
                                @click="openAssignCoverModal(article)"
                            >
                                <template v-if="getCoverForArticle(article)">
                                    <img
                                        :src="resolveCoverUrl(getCoverForArticle(article))"
                                        alt="Cover Preview"
                                        class="mpc-cover-preview-img"
                                    >
                                    <span
                                        class="mpc-cover-meta-badge"
                                        :class="resolveCoverType(getCoverForArticle(article))"
                                    >
                                        <i :class="resolveCoverType(getCoverForArticle(article)) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                        {{ resolveCoverType(getCoverForArticle(article)).toUpperCase() }}
                                    </span>
                                </template>
                                <template v-else>
                                    <div class="mpc-cover-empty">
                                        <i class="fa-regular fa-image"></i>
                                        <span>No Cover Assigned</span>
                                    </div>
                                </template>
                            </div>

                            <div v-if="getCoverForArticle(article)" class="mpc-cover-artist-note">
                                <i
                                    :class="resolveCoverType(getCoverForArticle(article)) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"
                                    style="color: var(--sidebar-maroon, #5c0a18);"
                                ></i>
                                <span>{{ cleanArtistName(getCoverForArticle(article).artist_name || getCoverForArticle(article).artist) }}</span>
                            </div>
                            <div v-else class="mpc-cover-artist-note" style="color: #b54708;">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                                <span>Requires cover to publish</span>
                            </div>
                        </div>

                        <!-- Right Text & Endorsement Stack -->
                        <div class="mpc-article-details">
                            <div class="mpc-meta-top-row">
                                <span class="mpc-category-tag">{{ formatCategory(article.category) }}</span>
                                <span style="color: #98a2b3;">&bull;</span>
                                <span style="color: #667085; font-weight: 500;">
                                    <i class="fa-regular fa-calendar"></i> Approved: {{ article.dateApproved || article.date || 'Recent' }}
                                </span>
                            </div>

                            <h2
                                class="mpc-article-headline"
                                style="cursor: pointer;"
                                title="Click to read manuscript"
                                @click="openReaderModal(article)"
                            >
                                {{ article.title }}
                            </h2>

                            <div class="mpc-byline-row">
                                <i class="fa-solid fa-pen-nib" style="color: #7b1113;"></i>
                                <span>Author: <strong>{{ article.author }}</strong></span>
                            </div>
                        </div>
                    </div>

                    <!-- Card Action Footer -->
                    <div class="mpc-card-footer">
                        <div>
                            <template v-if="activeView === 'published' || (article.status || '').toLowerCase() === 'published'">
                                <span class="mpc-status-live-indicator live">
                                    <span>Live on Public Website (Published {{ article.publishedAt || article.dateApproved || article.date || 'Recently' }})</span>
                                </span>
                            </template>
                            <template v-else-if="activeView === 'unpublished' || (article.status || '').toLowerCase() === 'unpublished'">
                                <span class="mpc-status-live-indicator unpublished">
                                    <i class="fa-solid fa-box-archive"></i>
                                    <span>Unpublished &bull; Staged for Re-release</span>
                                </span>
                            </template>
                            <template v-else>
                                <span class="mpc-status-live-indicator pending">
                                    <i class="fa-solid fa-hourglass-half"></i>
                                    <span>Pending Release by M&amp;PC</span>
                                </span>
                            </template>
                        </div>

                        <div class="mpc-footer-actions">
                            <!-- If published -->
                            <template v-if="activeView === 'published' || (article.status || '').toLowerCase() === 'published'">
                                <button type="button" class="btn-mpc-read" @click="openReaderModal(article)">
                                    <i class="fa-regular fa-file-lines"></i>
                                    <span>Read Article</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-mpc-unpublish"
                                    :disabled="isSubmitting"
                                    @click="handleUnpublishArticle(article)"
                                >
                                    <i class="fa-solid fa-arrow-rotate-left"></i>
                                    <span>Unpublish</span>
                                </button>
                            </template>

                            <!-- If unpublished -->
                            <template v-else-if="activeView === 'unpublished' || (article.status || '').toLowerCase() === 'unpublished'">
                                <button type="button" class="btn-mpc-read" @click="openReaderModal(article)">
                                    <i class="fa-regular fa-file-lines"></i>
                                    <span>Read Article</span>
                                </button>
                                <button type="button" class="btn-mpc-assign" @click="openAssignCoverModal(article)">
                                    <i class="fa-solid fa-palette"></i>
                                    <span>{{ getCoverForArticle(article) ? 'Change Cover' : 'Assign Cover' }}</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-mpc-publish"
                                    :disabled="isSubmitting"
                                    @click="handlePublishArticle(article)"
                                >
                                    <i class="fa-solid fa-globe"></i>
                                    <span>Republish</span>
                                </button>
                            </template>

                            <!-- If ready to publish -->
                            <template v-else>
                                <button type="button" class="btn-mpc-assign" @click="openAssignCoverModal(article)">
                                    <i class="fa-solid fa-palette"></i>
                                    <span>{{ getCoverForArticle(article) ? 'Change Cover' : 'Assign Cover' }}</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-mpc-publish"
                                    :disabled="isSubmitting"
                                    @click="handlePublishArticle(article)"
                                >
                                    <i class="fa-solid fa-globe"></i>
                                    <span>Publish to Website</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Covers Library Gallery View (Tab: 'covers') -->
            <div v-else class="mpc-covers-library-view">
                <div class="mpc-gallery-grid">
                    <div v-if="filteredApprovedCovers.length === 0" class="mpc-tab-empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 56px 20px; background: #ffffff; border: 1px dashed var(--border-subtle, #eaecf0); border-radius: 12px; margin-top: 10px;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: #fdf2f4; color: var(--sidebar-maroon, #5c0a18); display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-bottom: 14px;">
                            <i class="fa-regular fa-image"></i>
                        </div>
                        <h3 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.15rem; font-weight: 700; color: #101828; margin: 0;">
                            No Approved Artwork Available
                        </h3>
                        <p style="color: #667085; font-size: 0.88rem; margin-top: 6px;">
                            {{ coverLibraryFilter === 'cartoon' ? 'No approved editorial cartoons found.' : (coverLibraryFilter === 'photo' ? 'No approved photos found.' : 'No approved visual assets in library.') }}
                        </p>
                    </div>

                    <div
                        v-for="cover in filteredApprovedCovers"
                        :key="cover.id"
                        class="mpc-gallery-item"
                        style="cursor: pointer; position: relative;"
                        @click="openInspectModal(cover)"
                    >
                        <div class="mpc-gallery-thumb-wrap">
                            <img :src="resolveCoverUrl(cover)" :alt="cover.caption || cover.title || 'Artwork'" class="mpc-gallery-thumb-img">
                            <span class="cover-type-tag" :class="resolveCoverType(cover)" style="position: absolute; top: 8px; right: 8px; z-index: 3;">
                                <i :class="resolveCoverType(cover) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                <span>{{ resolveCoverType(cover).toUpperCase() }}</span>
                            </span>
                        </div>
                        <div class="mpc-gallery-item-body" style="padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                            <div v-if="cover.title" style="font-weight: 600; font-size: 0.84rem; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {{ cover.title }}
                            </div>
                            <div class="mpc-gallery-artist" style="font-size: 0.8rem; color: #344054; display: inline-flex; align-items: center; gap: 6px;">
                                <i :class="resolveCoverType(cover) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: var(--sidebar-maroon, #5c0a18); font-size: 0.75rem;"></i>
                                <span>{{ resolveCoverType(cover) === 'cartoon' ? 'Cartoonist' : 'Photojournalist' }}: <strong style="color: #101828;">{{ cleanArtistName(cover.artist_name || cover.artist) }}</strong></span>
                            </div>
                            <div v-if="cover.date || cover.formattedDate" style="font-size: 0.74rem; color: #64748b; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-regular fa-calendar"></i>
                                <span>{{ cover.date || cover.formattedDate }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal 1: Assign Cover Selection Modal -->
            <div
                v-if="isAssignCoverOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeAssignCoverModal"
            >
                <div class="modal-card mpc-cover-modal-card">
                    <div class="mpc-modal-header">
                        <div class="mpc-modal-header-left">
                            <h2 class="mpc-modal-title">Select Article Cover</h2>
                            <div class="mpc-modal-sub">Choose from approved visual materials for: <strong>{{ coverTargetArticle?.title }}</strong></div>
                        </div>
                        <button type="button" class="viewer-close-btn" aria-label="Close modal" @click="closeAssignCoverModal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="mpc-cover-gallery-body">
                        <div class="mpc-modal-filter-row">
                            <div class="mpc-modal-pills">
                                <button
                                    type="button"
                                    class="mpc-modal-pill"
                                    :class="{ active: coverModalFilter === 'all' }"
                                    @click="coverModalFilter = 'all'"
                                >
                                    All Formats ({{ approvedCovers.length }})
                                </button>
                                <button
                                    type="button"
                                    class="mpc-modal-pill"
                                    :class="{ active: coverModalFilter === 'photo' }"
                                    @click="coverModalFilter = 'photo'"
                                >
                                    <i class="fa-solid fa-camera"></i> PHOTOS ({{ countMediaCovers }})
                                </button>
                                <button
                                    type="button"
                                    class="mpc-modal-pill"
                                    :class="{ active: coverModalFilter === 'cartoon' }"
                                    @click="coverModalFilter = 'cartoon'"
                                >
                                    <i class="fa-solid fa-palette"></i> CARTOON ({{ countCartoonCovers }})
                                </button>
                            </div>
                            <span style="font-size: 0.76rem; color: #667085;">Click an artwork to select</span>
                        </div>

                        <div class="mpc-gallery-grid" style="max-height: 400px; overflow-y: auto; padding: 10px 0;">
                            <div v-if="filteredModalCovers.length === 0" style="grid-column: 1 / -1; text-align: center; padding: 32px; color: #667085;">
                                No approved covers found in this category.
                            </div>
                            <div
                                v-for="c in filteredModalCovers"
                                :key="c.id"
                                class="mpc-gallery-item"
                                :class="{ selected: String(selectedCoverId) === String(c.id) }"
                                style="cursor: pointer; position: relative;"
                                @click="selectedCoverId = c.id"
                            >
                                <div class="mpc-gallery-thumb-wrap" style="position: relative; overflow: hidden; aspect-ratio: 16 / 10; background-color: #f8fafc; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; padding: 6px;">
                                    <img :src="resolveCoverUrl(c)" :alt="c.caption || 'Cover'" class="mpc-gallery-thumb-img" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;">
                                    <span class="cover-type-tag" :class="resolveCoverType(c)" style="position: absolute; top: 8px; right: 8px; z-index: 3;">
                                        <i :class="resolveCoverType(c) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                        <span>{{ resolveCoverType(c).toUpperCase() }}</span>
                                    </span>
                                    <div
                                        v-if="String(selectedCoverId) === String(c.id)"
                                        class="cover-selected-badge"
                                        style="position: absolute; top: 8px; left: 8px; z-index: 4; width: 24px; height: 24px; background: #5c0a18; color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; box-shadow: 0 2px 4px rgba(0,0,0,0.25);"
                                    >
                                        <i class="fa-solid fa-check"></i>
                                    </div>
                                </div>
                                <div class="mpc-gallery-item-body" style="padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                                    <div v-if="c.title" style="font-weight: 600; font-size: 0.82rem; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        {{ c.title }}
                                    </div>
                                    <div class="mpc-gallery-artist" style="font-size: 0.8rem; color: #344054; display: inline-flex; align-items: center; gap: 6px;">
                                        <i :class="resolveCoverType(c) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: var(--sidebar-maroon, #5c0a18); font-size: 0.75rem;"></i>
                                        <span>{{ resolveCoverType(c) === 'cartoon' ? 'Cartoonist' : 'Photojournalist' }}: <strong style="color: #101828;">{{ cleanArtistName(c.artist_name || c.artist) }}</strong></span>
                                    </div>
                                    <div v-if="c.date || c.formattedDate" style="font-size: 0.72rem; color: #64748b; display: inline-flex; align-items: center; gap: 4px;">
                                        <i class="fa-regular fa-calendar"></i>
                                        <span>{{ c.date || c.formattedDate }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mpc-modal-footer">
                        <button type="button" class="btn-modal-cancel" @click="closeAssignCoverModal">
                            <span>Cancel</span>
                        </button>
                        <button
                            type="button"
                            class="btn-inspect-approve"
                            :disabled="!selectedCoverId || isSubmitting"
                            @click="handleConfirmAssignCover"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Confirm &amp; Attach Cover</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal 2: Full Manuscript Reading Modal -->
            <div
                v-if="isReaderOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeReaderModal"
            >
                <div class="modal-card viewer-modal-card">
                    <div class="viewer-modal-header">
                        <div class="viewer-meta-row">
                            <span class="viewer-category-tag">{{ activeManuscript?.category || 'CATEGORY' }}</span>
                            <span class="viewer-dot">&bull;</span>
                            <span class="viewer-date">{{ activeManuscript?.dateApproved || activeManuscript?.date }}</span>
                        </div>
                        <div class="viewer-header-right">
                            <span class="viewer-reading-time">
                                <i class="fa-regular fa-clock"></i> {{ calculateReadingTime(activeManuscript?.content || activeManuscript?.body) }}
                            </span>
                            <button type="button" class="viewer-close-btn" aria-label="Close reader" @click="closeReaderModal">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="viewer-modal-body">
                        <h1 class="viewer-title">{{ activeManuscript?.title }}</h1>

                        <div class="viewer-byline-row">
                            <div class="viewer-author-avatar">
                                <img :src="activeManuscript?.author_avatar || '/images/member-placeholder.svg'" alt="Author avatar">
                            </div>
                            <div class="viewer-byline-text">
                                <span class="viewer-by">By <strong>{{ activeManuscript?.author }}</strong></span>
                            </div>
                        </div>

                        <!-- Excerpt -->
                        <p v-if="activeManuscript?.excerpt" class="viewer-excerpt">
                            {{ activeManuscript.excerpt }}
                        </p>

                        <!-- Assigned cover preview banner -->
                        <div v-if="activeManuscript?.coverImage || activeManuscript?.image" class="viewer-banner" style="position: relative; margin-bottom: 20px;">
                            <img :src="resolveCoverUrl(activeManuscript.coverImage || activeManuscript.image)" alt="Assigned cover" style="width: 100%; max-height: 380px; object-fit: cover; border-radius: 8px;">
                            <div style="position: absolute; bottom: 12px; left: 14px; background: rgba(16, 24, 40, 0.85); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-camera"></i>
                                <span>{{ activeManuscript.coverArtist ? `Cover by ${activeManuscript.coverArtist}` : 'Cover Attached' }}</span>
                            </div>
                        </div>

                        <!-- Clean Formatted Body -->
                        <div class="manuscript-prose" v-html="formatCleanArticleContent(activeManuscript?.content || activeManuscript?.body || activeManuscript?.excerpt)"></div>
                    </div>

                    <div class="viewer-modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <button
                                type="button"
                                class="btn-mpc-assign"
                                @click="openAssignCoverModal(activeManuscript)"
                            >
                                <i class="fa-solid fa-palette"></i>
                                <span>{{ activeManuscript?.coverImage ? 'Change Cover' : 'Assign Cover' }}</span>
                            </button>

                            <button
                                v-if="(activeManuscript?.status || '').toLowerCase() === 'published'"
                                type="button"
                                style="background: #b42318; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600;"
                                :disabled="isSubmitting"
                                @click="handleUnpublishArticle(activeManuscript)"
                            >
                                <i class="fa-solid fa-box-archive"></i>
                                <span>Unpublish</span>
                            </button>
                            <button
                                v-else
                                type="button"
                                class="btn-mpc-publish"
                                :disabled="isSubmitting"
                                @click="handlePublishArticle(activeManuscript)"
                            >
                                <i class="fa-solid fa-globe"></i>
                                <span>Publish to Website</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal 3: Return Article to EIC for Revision Modal -->
            <div
                v-if="isReturnOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeReturnModal"
            >
                <div class="modal-card return-modal-card" style="max-width: 500px;">
                    <div class="mpc-modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eaecf0; padding: 18px 24px;">
                        <div class="mpc-modal-header-left">
                            <h2 class="mpc-modal-title" style="font-size: 1.15rem; font-weight: 700; color: #101828; margin: 0;">Return Article to Editor-in-Chief</h2>
                            <div class="mpc-modal-sub" style="font-size: 0.8rem; color: #667085; margin-top: 4px;">Story: <strong>{{ returnTargetArticle?.title }}</strong></div>
                        </div>
                        <button type="button" class="viewer-close-btn" aria-label="Close modal" @click="closeReturnModal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div style="padding: 20px 24px;">
                        <div style="background: #fdf2f4; border: 1px solid #fecdca; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-rotate-left" style="color: #b42318; font-size: 1rem;"></i>
                            <span style="font-size: 0.82rem; color: #7a1f2e; font-weight: 500;">This article will be returned backwards to the Editor-in-Chief's review queue.</span>
                        </div>

                        <div class="form-group">
                            <label for="mpc-return-remarks" style="display: block; font-weight: 600; font-size: 0.85rem; color: #344054; margin-bottom: 8px;">
                                Revision Remarks for EIC / Writer: <span style="color: #d92d20;">*</span>
                            </label>
                            <textarea
                                id="mpc-return-remarks"
                                v-model="returnRemarks"
                                rows="4"
                                placeholder="Detail any requested editorial or formatting adjustments..."
                                style="width: 100%; border: 1px solid #d0d5dd; border-radius: 8px; padding: 10px 12px; font-family: inherit; font-size: 0.85rem; box-sizing: border-box;"
                            ></textarea>
                            <div v-if="returnError" style="color: #d92d20; font-size: 0.78rem; margin-top: 6px;">{{ returnError }}</div>
                        </div>
                    </div>

                    <div class="mpc-modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid #eaecf0; background: #fafafa; border-radius: 0 0 16px 16px;">
                        <button type="button" class="btn-modal-cancel" style="padding: 8px 16px; border: 1px solid #d0d5dd; background: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: #344054;" @click="closeReturnModal">
                            Cancel
                        </button>
                        <button
                            type="button"
                            style="padding: 8px 18px; border: 1px solid #7b1113; background: #7b1113; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px;"
                            :disabled="isSubmitting"
                            @click="handleConfirmReturn"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Confirm Return</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal 4: Inspect Approved Cover Modal -->
            <div
                v-if="isInspectOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeInspectModal"
            >
                <div class="modal-card cover-inspect-modal-card" style="max-width: 900px; width: 92%; border-radius: 12px; background: #ffffff; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                    <div class="cover-inspect-header" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                        <div class="cover-inspect-header-left" style="display: flex; align-items: center; gap: 10px; flex-direction: row;">
                            <span class="cover-type-tag" :class="resolveCoverType(activeInspectCover)">
                                <i :class="resolveCoverType(activeInspectCover) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                <span>{{ resolveCoverType(activeInspectCover).toUpperCase() }}</span>
                            </span>
                            <span class="media-status-pill approved" style="background: #ecfdf3; color: #027a48; border: 1px solid #a6f4c5; font-size: 0.75rem; font-weight: 600; padding: 3px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-check"></i>
                                <span>APPROVED FOR COVERS</span>
                            </span>
                        </div>
                        <div class="cover-inspect-header-right">
                            <button type="button" class="modal-close-icon" aria-label="Close artwork inspector" @click="closeInspectModal" style="background: none; border: none; font-size: 1.15rem; color: #64748b; cursor: pointer;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="modal-body" style="padding: 16px 20px;">
                        <div class="cover-inspect-theater media-inspect-preview-container" style="height: 60vh; max-height: 65vh; padding: 0; background: transparent; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img :src="resolveCoverUrl(activeInspectCover)" alt="Publication Artwork Full View" class="cover-inspect-image-fullscreen media-inspect-img" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block; margin: 0 auto; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                        </div>

                        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div style="display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: #64748b;">
                                    <span>
                                        <i :class="resolveCoverType(activeInspectCover) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: #700f2b; margin-right: 4px;"></i>
                                        {{ resolveCoverType(activeInspectCover) === 'cartoon' ? 'Cartoonist:' : 'Photojournalist:' }} <strong>{{ cleanArtistName(activeInspectCover?.artist_name || activeInspectCover?.artist) }}</strong>
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                        <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>
                                        {{ activeInspectCover?.date || activeInspectCover?.formattedDate || 'Recent' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </MpcLayout>
</template>

<style scoped>
.viewer-modal-footer {
    display: flex !important;
}

.btn-mpc-assign {
    background-color: #ffffff !important;
    border: 1px solid #d0d5dd !important;
    color: #344054 !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    padding: 8px 14px !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.2s ease !important;
    white-space: nowrap !important;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05) !important;
}

.btn-mpc-assign:hover {
    background-color: #fdf2f2 !important;
    border-color: #7b1113 !important;
    color: #7b1113 !important;
    box-shadow: 0 2px 5px rgba(123, 17, 19, 0.12) !important;
}

.btn-mpc-publish,
.btn-inspect-approve {
    background-color: #7b1113 !important;
    border: 1px solid #7b1113 !important;
    color: #ffffff !important;
}

.btn-mpc-publish:hover,
.btn-inspect-approve:hover {
    background-color: #5c0a18 !important;
    border-color: #5c0a18 !important;
}

.btn-mpc-publish:disabled,
.btn-inspect-approve:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
