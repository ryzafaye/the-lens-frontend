<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MpcLayout from '../../layouts/MpcLayout.vue';
import {
    getMpcDashboard,
    publishMpcArticleRelease,
    assignMpcArticleCover,
} from '../../services/api.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';
import {
    formatActivityStatement,
    formatPhilippineDateTime,
    formatPhilippineRelativeTime,
} from '../../utils/activityGrammar.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/section-head-dashboard.css';
import '../../assets/css/mpc-publish-article.css';

const router = useRouter();

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const isPublishingId = ref(null);
const metrics = ref({
    pending: 0,
    total_views: 0,
    published_stories: 0,
    active_members: 0,
});
const pendingArticles = ref([]);
const displayedPendingArticles = computed(() => {
    return (pendingArticles.value || []).slice(0, 5);
});
const publishedArticles = ref([]);
const recentActivities = ref([]);
const topJournalists = ref([]);
const approvedCovers = ref([]);

// Modals State
const isViewerOpen = ref(false);
const activeArticle = ref(null);

const isAssignCoverOpen = ref(false);
const coverTargetArticle = ref(null);
const selectedCoverId = ref(null);
const coverModalFilter = ref('all'); // 'all' | 'photo' | 'cartoon'

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Helpers
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Number(num).toLocaleString('en-US');
}

function calculateReadingTime(text) {
    if (!text) return '1 min read';
    const plain = text.replace(/<[^>]*>/g, ' ').trim();
    const words = plain.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

function formatCategory(cat) {
    if (!cat) return 'General';
    const c = String(cat).trim();
    if (c.toLowerCase().includes('sci') || c.toLowerCase().includes('tech')) return 'SciTech';
    return c;
}

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 120, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
}

function resolveCoverUrl(url) {
    if (!url) return '';
    return optimizeCloudinaryUrl(url, { width: 800, crop: 'limit' });
}

function resolveCoverType(cover) {
    if (!cover) return 'photo';
    const t = (cover.image_type || cover.type || cover.mediaType || cover.coverType || '').toLowerCase();
    if (t.includes('cartoon') || t.includes('illustration') || t.includes('drawing')) return 'cartoon';
    return 'photo';
}

function cleanArtistName(name) {
    if (!name) return 'Media Team Member';
    return String(name).replace(/^By\s+/i, '').trim();
}

const filteredModalCovers = computed(() => {
    if (coverModalFilter.value === 'all') return approvedCovers.value;
    return approvedCovers.value.filter(c => resolveCoverType(c) === coverModalFilter.value);
});

const currentMonth = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
});

// Activity helpers
function getStatement(act) {
    return formatActivityStatement(act);
}

function getTimestampText(act) {
    if (!act) return 'Recently';
    const dateInput = act?.isoDate || act?.created_at || act?.rawDate;
    if (dateInput) {
        return formatPhilippineRelativeTime(dateInput);
    }
    return act?.timestampText || act?.timeAgo || act?.time || 'Recently';
}

function getFormattedDate(act) {
    if (!act) return '';
    const dateInput = act?.isoDate || act?.created_at || act?.rawDate;
    if (dateInput) {
        return formatPhilippineDateTime(dateInput);
    }
    return act?.formattedDate || act?.date || '';
}

function getCauserRole(act) {
    return act?.causerRole || act?.role || 'Editorial Board';
}

// Reader Modal
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

// Assign Cover Modal
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

        // Update locally in pendingArticles
        const idx = pendingArticles.value.findIndex(a => a.id === coverTargetArticle.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].assignedCoverId = String(selectedCoverId.value);
            pendingArticles.value[idx].coverImage = coverUrl;
        }

        if (activeArticle.value && activeArticle.value.id === coverTargetArticle.value.id) {
            activeArticle.value.assignedCoverId = String(selectedCoverId.value);
            activeArticle.value.coverImage = coverUrl;
        }

        showToast(res?.message || 'Cover attached successfully.', 'success');
        closeAssignCoverModal();
    } catch (err) {
        console.error('Assign cover error:', err);
        showToast(err.response?.data?.message || 'Failed to attach cover.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Publish Flow
async function promptQuickPublish(article) {
    if (!article || isSubmitting.value) return;

    const confirmed = await confirmAction({
        title: 'Publish Article Release',
        message: `Are you sure you want to release and publish "${article.title}" to the public website?`,
        confirmText: 'Publish Release',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    await executePublish(article);
}

async function executePublish(article) {
    if (!article || isSubmitting.value) return;

    isPublishingId.value = article.id;
    isSubmitting.value = true;
    try {
        const res = await publishMpcArticleRelease(article.id, article.assignedCoverId);
        showToast(res?.message || 'Article published successfully.', 'success');

        // Remove from pending list
        pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);

        // Update metrics
        metrics.value.pending = Math.max(0, metrics.value.pending - 1);
        metrics.value.published_stories += 1;

        // Add to published list
        const publishedObj = {
            ...article,
            status: 'Published',
            views: 0,
            shares: 0,
            date: 'Today',
        };
        publishedArticles.value.unshift(publishedObj);

        // Recompute top journalists if needed
        computeTopJournalists();

        if (isViewerOpen.value && activeArticle.value?.id === article.id) {
            closeArticleViewer();
        }
    } catch (err) {
        console.error('Publish error:', err);
        showToast(err.response?.data?.message || 'Failed to publish article.', 'error');
    } finally {
        isPublishingId.value = null;
        isSubmitting.value = false;
    }
}

function computeTopJournalists() {
    if (topJournalists.value.length > 0) return;
    const counts = {};
    publishedArticles.value.forEach(art => {
        if ((art.status || '').toLowerCase() === 'published' && art.author) {
            counts[art.author] = (counts[art.author] || 0) + 1;
        }
    });
    topJournalists.value = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count], id) => ({
            id,
            name,
            article_count: count,
            count,
        }));
}

async function loadDashboard() {
    isLoading.value = true;
    try {
        const res = await getMpcDashboard();
        if (res) {
            metrics.value = {
                pending: Number(res.metrics?.pending || 0),
                total_views: Number(res.metrics?.total_views || 0),
                published_stories: Number(res.metrics?.published_stories || 0),
                active_members: Number(res.metrics?.active_members || 0),
            };
            pendingArticles.value = Array.isArray(res.pendingArticles) ? res.pendingArticles : [];
            publishedArticles.value = Array.isArray(res.publishedArticles) ? res.publishedArticles : [];
            recentActivities.value = Array.isArray(res.recentActivities) ? res.recentActivities : [];
            if (Array.isArray(res.topJournalists) && res.topJournalists.length > 0) {
                topJournalists.value = res.topJournalists;
            } else {
                computeTopJournalists();
            }
            if (Array.isArray(res.approvedCovers)) {
                approvedCovers.value = res.approvedCovers;
            }
        }
    } catch (err) {
        console.error('Failed to load MPC dashboard:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboard();
});
</script>

<template>
    <MpcLayout>
        <main class="content-container">
            <!-- Page Title Section -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 class="page-title">Dashboard</h1>
            </div>

            <!-- Metrics Row (3 Cards Layout on Desktop) -->
            <section id="metrics-grid" class="metrics-grid metrics-grid-3" aria-label="Operational metrics">
                <div class="metric-card animate-fade-in delay-1">
                    <div class="metric-header">
                        <span class="metric-label">Pending Release</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-clock"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.pending) }}</div>
                    <div class="metric-subtitle">Awaiting publication release</div>
                </div>

                <div class="metric-card animate-fade-in delay-2">
                    <div class="metric-header">
                        <span class="metric-label">Monthly Readership</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-eye"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.total_views) }}</div>
                    <div class="metric-subtitle">Views across all desks for {{ currentMonth }}</div>
                </div>

                <div class="metric-card animate-fade-in delay-3">
                    <div class="metric-header">
                        <span class="metric-label">Published Stories</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-newspaper"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.published_stories) }}</div>
                    <div class="metric-subtitle">Total overall published</div>
                </div>
            </section>

            <!-- Main Grid -->
            <div class="main-grid">
                <!-- Left Column: Editorial Operations Stack -->
                <div class="left-column-stack">
                    <!-- Section 1: Pending Release Table -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="pending-release-heading">
                        <div class="panel-header">
                            <div class="panel-title-group" style="display: flex; align-items: center; gap: 8px;">
                                <h2 id="pending-release-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                    Pending Release
                                </h2>
                                <span class="panel-count-badge" :title="`Total ${metrics.pending ?? pendingArticles.length} articles awaiting release`">{{ formatNumber(metrics.pending ?? pendingArticles.length) }}</span>
                            </div>
                            <router-link to="/mpc/publish-article" class="panel-action-link">View all &rarr;</router-link>
                        </div>

                        <div class="pending-release-wrap">
                            <table class="data-table pending-approvals-table pending-release-table">
                                <colgroup>
                                    <col class="col-title" style="width: 34%;">
                                    <col class="col-category" style="width: 14%;">
                                    <col class="col-date" style="width: 14%;">
                                    <col class="col-actions" style="width: 38%;">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th class="col-title" style="text-align: center !important;">Article Title</th>
                                        <th class="col-category" style="text-align: center !important;">Category</th>
                                        <th class="col-date" style="text-align: center !important;">Date</th>
                                        <th class="col-actions" style="text-align: center !important;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="isLoading">
                                        <td colspan="4" class="empty-state-cell" style="text-align: center; color: #667085; padding: 28px;">
                                            <i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Loading pending releases…
                                        </td>
                                    </tr>
                                    <tr v-else-if="pendingArticles.length === 0">
                                        <td colspan="4" class="empty-state-cell" style="text-align: center; color: #667085; padding: 28px;">
                                            No pending articles awaiting release.
                                        </td>
                                    </tr>
                                    <tr v-for="article in displayedPendingArticles" :key="article.id">
                                        <!-- Column 1: Article Title + Author below title -->
                                        <td class="col-title" style="padding-left: 16px;">
                                            <div class="table-article-info" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0;">
                                                <button
                                                    type="button"
                                                    class="table-article-btn"
                                                    :title="article.title"
                                                    style="font-family: 'Playfair Display', Georgia, serif !important; text-align: left; display: block; width: 100%; padding: 0; margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 600; line-height: 1.35; color: #101828; white-space: normal; word-break: break-word; overflow-wrap: break-word;"
                                                    @click="openArticleViewer(article)"
                                                >
                                                    {{ article.title }}
                                                </button>
                                                <div class="table-author-subline" style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #475467; flex-wrap: wrap;">
                                                    <i class="fa-solid fa-pen-nib" style="color: #7b1113; font-size: 0.75rem;"></i>
                                                    <span>By <strong>{{ article.author || 'Author' }}</strong></span>
                                                    <span v-if="article.coverImage" class="cover-indicator-pill" style="display: inline-flex; align-items: center; gap: 4px; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 1px 6px; border-radius: 4px; font-size: 0.70rem; font-weight: 600;">
                                                        <i class="fa-solid fa-image"></i> Cover attached
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <!-- Column 2: Category -->
                                        <td class="col-category" style="text-align: center;">
                                            <span class="table-section-tag" :title="article.category">{{ formatCategory(article.category) }}</span>
                                        </td>

                                        <!-- Column 3: Date -->
                                        <td class="col-date" style="text-align: center;">
                                            <span class="table-date" style="color: #667085; font-size: 0.82rem; white-space: normal; word-break: break-word;">{{ article.date || article.dateApproved }}</span>
                                        </td>

                                        <!-- Column 4: Actions (Assign Cover and Publish) -->
                                        <td class="col-actions text-right" style="text-align: right; padding-right: 16px;">
                                            <div class="table-actions-group">
                                                <!-- Action 1: Assign Cover -->
                                                <button
                                                    type="button"
                                                    class="btn-table-action btn-table-cover"
                                                    title="Assign Cover Photo"
                                                    @click="openAssignCoverModal(article)"
                                                >
                                                    <i class="fa-regular fa-image"></i>
                                                    <span>{{ article.coverImage ? 'Change Cover' : 'Assign Cover' }}</span>
                                                </button>

                                                <!-- Action 2: Publish -->
                                                <button
                                                    type="button"
                                                    class="btn-table-action btn-table-publish"
                                                    title="Publish Article Immediately"
                                                    :disabled="isPublishingId === article.id"
                                                    @click="promptQuickPublish(article)"
                                                >
                                                    <i class="fa-solid fa-globe"></i>
                                                    <span>{{ isPublishingId === article.id ? 'Publishing…' : 'Publish' }}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <!-- Section 2: Activity Log -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="activity-log-heading">
                        <div class="panel-header">
                            <h2 id="activity-log-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Activity Log
                            </h2>
                            <router-link to="/mpc/activity-logs" class="panel-action-link">View all &rarr;</router-link>
                        </div>
                        <div class="activity-timeline">
                            <div
                                v-for="(act, idx) in recentActivities"
                                :key="act.id || idx"
                                class="activity-item"
                                @click="router.push('/mpc/activity-logs')"
                                style="cursor: pointer;"
                                title="Open Activity Logs"
                            >
                                <div class="activity-avatar">
                                    <img :src="resolveAvatarUrl(act.causerAvatar || act.avatar)" :alt="getStatement(act).causer" loading="lazy">
                                </div>
                                <div class="activity-details">
                                    <div class="activity-text-col" style="min-width: 0; flex: 1;">
                                        <p class="activity-text" style="margin: 0; line-height: 1.45;">
                                            <strong class="causer-name-token" style="color: #101828; font-weight: 600; margin-right: 4px;">{{ getStatement(act).causer }}</strong>
                                            <span>{{ getStatement(act).beforeSubject }}</span>
                                            <template v-if="getStatement(act).subjectName">
                                                <em style="font-family: 'Playfair Display', Georgia, serif !important; font-style: normal; font-weight: 600; color: #101828; margin: 0 4px;">
                                                    "{{ getStatement(act).subjectName }}"
                                                </em>
                                            </template>
                                            <span v-if="getStatement(act).afterSubject" :style="{ marginLeft: getStatement(act).subjectName ? '0px' : '4px' }">
                                                {{ getStatement(act).afterSubject }}
                                            </span>
                                            <span style="color: #667085; font-size: 0.75rem; margin-left: 4px;">{{ getTimestampText(act) }}.</span>
                                        </p>
                                        <div class="activity-meta-subrow" style="font-size: 0.72rem; color: #98a2b3; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                                            <span style="font-weight: 500; color: #475467;">{{ getCauserRole(act) }}</span>
                                            <span>•</span>
                                            <span>{{ getFormattedDate(act) || getTimestampText(act) }}</span>
                                        </div>
                                    </div>
                                    <span class="activity-time" style="align-self: flex-start; margin-top: 2px;">{{ getTimestampText(act) }}</span>
                                </div>
                            </div>
                            <div v-if="!isLoading && recentActivities.length === 0" class="activity-empty-state-mini" style="text-align: center; color: #667085; padding: 24px;">
                                <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.5rem; color: #98a2b3; margin-bottom: 8px;"></i>
                                <h4 style="font-family: 'Playfair Display', Georgia, serif !important; margin: 4px 0; color: #101828;">No activity logs recorded</h4>
                                <p style="font-size: 0.82rem; color: #667085; margin: 0;">Editorial and system activities will appear here as they occur.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <!-- Right Column: Analytics & Leaderboard Stack -->
                <div class="right-column-stack">
                    <!-- Section 1: Most Viewed Articles (With Views & Shares) -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="most-viewed-heading">
                        <div class="panel-header">
                            <h2 id="most-viewed-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Most Viewed Articles
                            </h2>
                            <span class="panel-badge">{{ currentMonth }}</span>
                        </div>
                        <div class="ranked-list">
                            <div v-if="publishedArticles.length === 0" class="empty-state-cell" style="text-align: center; color: #667085; padding: 24px;">
                                No published articles recorded yet.
                            </div>
                            <div
                                v-for="(pubArt, index) in publishedArticles.slice(0, 5)"
                                :key="pubArt.id"
                                class="ranked-item"
                                style="cursor: pointer;"
                                @click="openArticleViewer(pubArt)"
                            >
                                <span class="rank-number" :class="{ 'top-rank': index === 0 }">{{ index + 1 }}</span>
                                <div class="ranked-content">
                                    <div class="ranked-category-tag">{{ pubArt.category || 'General' }}</div>
                                    <button
                                        type="button"
                                        class="ranked-title-btn"
                                        :title="pubArt.title"
                                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                                        @click.stop="openArticleViewer(pubArt)"
                                    >
                                        {{ pubArt.title }}
                                    </button>
                                    <div class="ranked-meta-row">
                                        <span class="ranked-author">
                                            <i class="fa-solid fa-pen-nib" aria-hidden="true" style="font-size: 0.70rem; margin-right: 4px; color: var(--sidebar-maroon, #5c0a18);"></i>
                                            {{ pubArt.author || 'Author' }}
                                        </span>
                                        <span class="ranked-stats">
                                            <span class="stat-metric" title="Views">
                                                <i class="fa-regular fa-eye"></i> {{ formatNumber(pubArt.views) }}
                                            </span>
                                            <span class="stat-sep">•</span>
                                            <span class="stat-metric" title="Shares">
                                                <i class="fa-solid fa-share-nodes"></i> {{ formatNumber(pubArt.shares || 0) }}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Section 2: Top Performing Journalists (Leaderboard) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="top-journalists-heading">
                        <div class="panel-header">
                            <h2 id="top-journalists-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Top Performing Journalists
                            </h2>
                            <span class="panel-badge">Leaderboard</span>
                        </div>
                        <div class="journalists-table-wrap">
                            <table class="data-table journalists-table" style="width: 100% !important; table-layout: fixed !important;">
                                <thead>
                                    <tr>
                                        <th class="col-author" style="width: 58% !important; text-align: center !important;">Author</th>
                                        <th class="col-article-count" style="width: 42% !important; min-width: 80px !important; text-align: center !important;">Article Count</th>
                                    </tr>
                                </thead>
                                <tbody id="top-journalists-table-body">
                                    <tr v-for="j in topJournalists" :key="j.id || j.name">
                                        <td class="col-author">
                                            <span class="author-name">{{ j.name }}</span>
                                        </td>
                                        <td class="col-article-count">
                                            <span class="article-count-pill">{{ j.article_count || j.count }}</span>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && topJournalists.length === 0">
                                        <td colspan="2" class="empty-state-cell" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0;">
                                            No data available yet
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
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
                                    All Formats
                                </button>
                                <button
                                    type="button"
                                    class="mpc-modal-pill"
                                    :class="{ active: coverModalFilter === 'photo' }"
                                    @click="coverModalFilter = 'photo'"
                                >
                                    <i class="fa-solid fa-camera"></i> PHOTOS
                                </button>
                                <button
                                    type="button"
                                    class="mpc-modal-pill"
                                    :class="{ active: coverModalFilter === 'cartoon' }"
                                    @click="coverModalFilter = 'cartoon'"
                                >
                                    <i class="fa-solid fa-palette"></i> CARTOON
                                </button>
                            </div>
                            <span style="font-size: 0.76rem; color: #667085;">Click an artwork to select</span>
                        </div>

                        <div class="mpc-gallery-grid" style="max-height: 380px; overflow-y: auto; padding: 10px 0;">
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
                                <div class="mpc-gallery-thumb-wrap" style="position: relative; overflow: hidden; aspect-ratio: 16 / 10; background-color: #f8fafc; border-radius: 8px 8px 0 0;">
                                    <img :src="resolveCoverUrl(c.file_url || c.image)" :alt="c.caption || 'Cover'" class="mpc-gallery-thumb-img" style="width: 100%; height: 100%; object-fit: cover;">
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
                                    <div class="mpc-gallery-artist" style="font-size: 0.8rem; color: #344054; display: inline-flex; align-items: center; gap: 6px;">
                                        <i :class="resolveCoverType(c) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: var(--sidebar-maroon, #5c0a18); font-size: 0.75rem;"></i>
                                        <span>{{ resolveCoverType(c) === 'cartoon' ? 'Cartoonist' : 'Photojournalist' }}: <strong style="color: #101828;">{{ cleanArtistName(c.artist_name || c.artist) }}</strong></span>
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
                            <span>{{ isSubmitting ? 'Attaching…' : 'Confirm & Attach Cover' }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal 3: In-Place Manuscript Reader Modal -->
            <div
                v-if="isViewerOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeArticleViewer"
            >
                <div class="modal-card viewer-modal-card">
                    <div class="viewer-modal-header">
                        <div class="viewer-meta-row">
                            <span class="viewer-category-tag">{{ activeArticle?.category || 'General' }}</span>
                            <span class="viewer-dot">&bull;</span>
                            <span class="viewer-date">{{ activeArticle?.date || activeArticle?.dateApproved || 'Recent' }}</span>
                        </div>
                        <div class="viewer-header-right">
                            <span class="viewer-reading-time">
                                <i class="fa-regular fa-clock"></i> {{ calculateReadingTime(activeArticle?.content) }}
                            </span>
                            <button type="button" class="viewer-close-btn" aria-label="Close reader" @click="closeArticleViewer">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="viewer-modal-body">
                        <h1 class="viewer-title">{{ activeArticle?.title }}</h1>

                        <div class="viewer-byline-row">
                            <div class="viewer-author-avatar">
                                <img :src="resolveAvatarUrl(activeArticle?.author_avatar)" alt="Author avatar">
                            </div>
                            <div class="viewer-byline-text">
                                <span class="viewer-by">By <strong>{{ activeArticle?.author }}</strong></span>
                            </div>
                        </div>

                        <!-- Cover Preview if assigned -->
                        <div v-if="activeArticle?.coverImage" style="margin: 16px 0; border-radius: 8px; overflow: hidden; max-height: 360px;">
                            <img :src="resolveCoverUrl(activeArticle.coverImage)" alt="Article Cover" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>

                        <p v-if="activeArticle?.excerpt" class="viewer-excerpt">
                            {{ activeArticle.excerpt }}
                        </p>

                        <div class="manuscript-prose" v-html="formatCleanArticleContent(activeArticle?.content || activeArticle?.excerpt)"></div>
                    </div>

                    <div class="viewer-modal-footer" style="justify-content: flex-end; gap: 10px;">
                        <button type="button" class="btn-modal-cancel" @click="closeArticleViewer">
                            Close
                        </button>
                        <button
                            v-if="activeArticle?.status !== 'Published'"
                            type="button"
                            class="btn-table-action btn-table-cover"
                            style="padding: 8px 14px; font-size: 0.85rem;"
                            @click="openAssignCoverModal(activeArticle)"
                        >
                            <i class="fa-regular fa-image"></i>
                            <span>{{ activeArticle?.coverImage ? 'Change Cover' : 'Assign Cover' }}</span>
                        </button>
                        <button
                            v-if="activeArticle?.status !== 'Published'"
                            type="button"
                            class="btn-table-action btn-table-publish"
                            style="padding: 8px 18px; font-size: 0.85rem;"
                            @click="promptQuickPublish(activeArticle)"
                        >
                            <i class="fa-solid fa-globe"></i>
                            <span>Publish Article</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    </MpcLayout>
</template>

<style scoped>
/* Scoped adjustments ensuring 100% design parity and responsive behavior */
.pending-release-wrap {
    width: 100% !important;
    overflow-x: auto !important;
}

.pending-release-table {
    width: 100% !important;
    border-collapse: collapse !important;
}

.pending-release-table th.col-actions,
.pending-release-table td.col-actions {
    width: 40% !important;
    min-width: 200px !important;
    text-align: right !important;
    padding-right: 16px !important;
}

.table-actions-group {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    white-space: nowrap !important;
}

.table-article-btn {
    white-space: normal !important;
    word-break: break-word !important;
    overflow-wrap: break-word !important;
    -webkit-line-clamp: unset !important;
    text-overflow: unset !important;
    overflow: visible !important;
}

.table-author-subline {
    margin-top: 2px;
}

.btn-table-cover {
    background-color: #ffffff !important;
    color: #344054 !important;
    border: 1px solid #d0d5dd !important;
    padding: 4px 10px !important;
    border-radius: 6px !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    transition: all 0.2s ease !important;
    height: 28px !important;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05) !important;
}

.btn-table-cover:hover {
    background-color: #fdf2f2 !important;
    border-color: #7b1113 !important;
    color: #7b1113 !important;
    box-shadow: 0 2px 4px rgba(123, 17, 19, 0.1) !important;
}

.btn-table-publish {
    background-color: #7b1113 !important;
    color: #ffffff !important;
    border: 1px solid #7b1113 !important;
    padding: 4px 12px !important;
    border-radius: 6px !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    transition: all 0.15s ease !important;
    height: 28px !important;
}

.btn-table-publish:hover {
    background-color: #5c0a18 !important;
    border-color: #5c0a18 !important;
}

.btn-inspect-approve {
    background-color: #7b1113 !important;
    border: 1px solid #7b1113 !important;
    color: #ffffff !important;
}

.btn-inspect-approve:hover {
    background-color: #5c0a18 !important;
    border-color: #5c0a18 !important;
}

.viewer-modal-footer {
    display: flex !important;
}

.btn-table-publish:disabled,
.btn-table-cover:disabled,
.btn-inspect-approve:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.stat-metric {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.stat-sep {
    margin: 0 4px;
    color: #d0d5dd;
}

@media (max-width: 768px) {
    .pending-release-table {
        min-width: 480px !important;
    }

    .table-actions-group {
        flex-direction: column !important;
        align-items: flex-end !important;
        gap: 4px !important;
    }

    .btn-table-cover,
    .btn-table-publish {
        font-size: 0.72rem !important;
        padding: 3px 8px !important;
        height: 24px !important;
    }
}
</style>
