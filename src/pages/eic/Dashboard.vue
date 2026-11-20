<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicDashboard,
    updateEicReviewArticle,
    approveEicArticle,
    returnEicArticleForRevision,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatActivityStatement } from '../../utils/activityGrammar.js';
import '../../assets/css/section-head-dashboard.css';
import '../../assets/css/executive-review-articles.css';
import '../../assets/css/executive-modals.css';

const router = useRouter();

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const metrics = ref({
    pending: 0,
    total_views: 0,
    published_stories: 0,
    active_members: 0,
});
const pendingArticles = ref([]);
const publishedArticles = ref([]);
const recentActivities = ref([]);
const topJournalists = ref([]);

// Toast Notification
const toast = ref({
    show: false,
    message: '',
    type: 'success',
});
let toastTimer = null;

function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toast.value = { show: true, message, type };
    toastTimer = setTimeout(() => {
        toast.value.show = false;
    }, 3500);
}

// Manuscript Review & Edit Modal State
const isManuscriptModalOpen = ref(false);
const activeManuscript = ref(null);
const showRemarksSection = ref(false);
const revisionRemarks = ref('');
const remarksError = ref('');

// In-place editable refs
const dashHeadlineRef = ref(null);
const dashExcerptRef = ref(null);
const dashBodyRef = ref(null);

// Article Viewer Modal state (Reading mode for Top Performing Articles)
const isViewerOpen = ref(false);
const activeArticle = ref(null);

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

function sanitizeContent(html, excerpt = null) {
    return formatCleanArticleContent(html || excerpt);
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

function getStatement(act) {
    return formatActivityStatement(act);
}

function getTimestampText(act) {
    return act?.timestampText || act?.time || act?.created_at || 'Recently';
}

function getFormattedDate(act) {
    return act?.formattedDate || act?.date || '';
}

function getCauserRole(act) {
    return act?.causerRole || act?.role || 'Editorial Board';
}

function formatShortCategory(cat) {
    if (!cat) return 'General';
    const lower = String(cat).toLowerCase().trim();
    if (lower.includes('science') || lower.includes('tech')) return 'SciTech';
    if (lower.includes('development') || lower.includes('devcomm')) return 'DevComm';
    if (lower.includes('opinion')) return 'Opinion';
    if (lower.includes('feature')) return 'Features';
    if (lower.includes('news')) return 'News';
    if (lower.includes('lit')) return 'Literature';
    if (lower.includes('sport')) return 'Sports';
    return cat.length > 10 ? cat.substring(0, 9) + '…' : cat;
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (str.length > 12) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    return str;
}

const currentMonthName = computed(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long' });
});

// Open Manuscript Modal for Editing & Reading
function openManuscriptModal(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    isManuscriptModalOpen.value = true;
    document.body.style.overflow = 'hidden';

    nextTick(() => {
        if (dashHeadlineRef.value) {
            dashHeadlineRef.value.innerText = article.title || '';
        }
        if (dashExcerptRef.value) {
            if (article.excerpt) {
                dashExcerptRef.value.innerText = article.excerpt;
                dashExcerptRef.value.style.display = 'block';
            } else {
                dashExcerptRef.value.style.display = 'none';
            }
        }
        if (dashBodyRef.value) {
            dashBodyRef.value.innerHTML = formatCleanArticleContent(article.content || '<p>No content available.</p>');
        }
    });
}

// Open Manuscript Modal directly focused on Revision Remarks
function openRevisionModal(article) {
    openManuscriptModal(article);
    nextTick(() => {
        showRemarksSection.value = true;
        remarksError.value = '';
        nextTick(() => {
            const textarea = document.getElementById('dash-modal-remarks');
            if (textarea) textarea.focus();
        });
    });
}

function closeManuscriptModal() {
    isManuscriptModalOpen.value = false;
    activeManuscript.value = null;
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    document.body.style.overflow = '';
}

function onDashHeadlineKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        dashBodyRef.value?.focus();
    }
}

function toggleRevisionRemarks() {
    showRemarksSection.value = !showRemarksSection.value;
    remarksError.value = '';
    if (showRemarksSection.value) {
        nextTick(() => {
            const textarea = document.getElementById('dash-modal-remarks');
            if (textarea) textarea.focus();
        });
    }
}

// Save Changes in Manuscript Modal
async function handleSaveChanges() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = dashHeadlineRef.value ? dashHeadlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none')
        ? dashExcerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = dashBodyRef.value ? dashBodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (dashHeadlineRef.value) dashHeadlineRef.value.focus();
        return;
    }

    isSubmitting.value = true;

    try {
        const payload = {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        };

        const res = await updateEicReviewArticle(activeManuscript.value.id, payload);

        // Update in local lists
        const idx = pendingArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].title = payload.title;
            pendingArticles.value[idx].excerpt = payload.excerpt;
            pendingArticles.value[idx].content = payload.content;
        }

        activeManuscript.value.title = payload.title;
        activeManuscript.value.excerpt = payload.excerpt;
        activeManuscript.value.content = payload.content;

        showToast(res.message || 'Article changes saved successfully.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to save changes.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Return for Revision from Manuscript Modal
async function handleSubmitRevision() {
    if (!activeManuscript.value || isSubmitting.value) return;

    if (!showRemarksSection.value) {
        showRemarksSection.value = true;
        remarksError.value = '';
        nextTick(() => {
            const textarea = document.getElementById('dash-modal-remarks');
            if (textarea) textarea.focus();
        });
        return;
    }

    if (!revisionRemarks.value.trim()) {
        remarksError.value = 'Revision remarks are required. You cannot return for revision without remarks.';
        nextTick(() => {
            const textarea = document.getElementById('dash-modal-remarks');
            if (textarea) textarea.focus();
        });
        return;
    }

    isSubmitting.value = true;
    remarksError.value = '';

    try {
        const targetId = activeManuscript.value.id;
        const targetTitle = activeManuscript.value.title;
        const res = await returnEicArticleForRevision(targetId, revisionRemarks.value.trim());

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== targetId);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        closeManuscriptModal();
        const catName = activeManuscript.value?.category || 'Section';
        const isOpinion = catName.toLowerCase().includes('opinion');
        const defaultMsg = isOpinion
            ? 'Opinion article returned to author with revision remarks.'
            : `Article returned to ${catName} Head for section revision.`;
        showToast(res?.message || defaultMsg, 'warning');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to return article for revision.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Approve for M&PC from Manuscript Modal (Saves in-place changes then approves)
async function handleApproveForMpc() {
    if (!activeManuscript.value || isSubmitting.value) return;

    isSubmitting.value = true;

    try {
        const targetId = activeManuscript.value.id;
        const targetTitle = activeManuscript.value.title;
        const newTitle = dashHeadlineRef.value ? dashHeadlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
        const newExcerpt = (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none')
            ? dashExcerptRef.value.innerText.trim()
            : (activeManuscript.value.excerpt || '');
        const rawBody = dashBodyRef.value ? dashBodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

        const payload = {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        };

        const res = await approveEicArticle(targetId, payload);

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== targetId);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        closeManuscriptModal();
        showToast(res.message || `"${targetTitle}" approved and forwarded to M&PC for publishing.`, 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Quick Approve directly from Pending Approvals Table Row
async function handleQuickApprove(article) {
    if (!article || isSubmitting.value) return;

    isSubmitting.value = true;
    try {
        const res = await approveEicArticle(article.id, {
            title: article.title,
            excerpt: article.excerpt,
            content: article.content,
        });

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        showToast(res.message || `"${article.title}" approved and forwarded to M&PC.`, 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function loadDashboardData(forceFresh = true) {
    isLoading.value = true;
    try {
        const data = await getEicDashboard(forceFresh);
        if (data) {
            metrics.value = data.metrics || metrics.value;
            pendingArticles.value = data.pendingArticles || [];
            publishedArticles.value = data.publishedArticles || [];
            recentActivities.value = data.recentActivities || [];
            topJournalists.value = data.topJournalists || [];
        }
    } catch (err) {
        console.warn('Could not load EIC dashboard data:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboardData(true);
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
            <!-- Global Toast Notification -->
            <div v-if="toast.show" id="toast-container" class="toast-container" aria-live="polite">
                <div class="toast-message" :class="toast.type">
                    <span class="toast-bullet-dot"></span>
                    <span>{{ toast.message }}</span>
                </div>
            </div>

            <!-- Page Title Section -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 class="page-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Dashboard</h1>
            </div>

            <!-- Metrics Row (3-Column Layout in One Line) -->
            <section id="metrics-grid" class="metrics-grid metrics-grid-3" aria-label="Operational metrics">
                <div class="metric-card animate-fade-in delay-1">
                    <div class="metric-header">
                        <span class="metric-label">Pending Approvals</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-clock"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ metrics.pending ?? 0 }}</div>
                    <div class="metric-subtitle">Awaiting editorial review</div>
                </div>

                <div class="metric-card animate-fade-in delay-2">
                    <div class="metric-header">
                        <span class="metric-label">Monthly Readership</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-eye"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ (metrics.total_views ?? 0).toLocaleString() }}</div>
                    <div class="metric-subtitle">Views across all desks for {{ currentMonthName }}</div>
                </div>

                <div class="metric-card animate-fade-in delay-3">
                    <div class="metric-header">
                        <span class="metric-label">Published Stories</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-newspaper"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ metrics.published_stories ?? 0 }}</div>
                    <div class="metric-subtitle">Active across The Lens portal</div>
                </div>
            </section>

            <!-- Main Grid Layout -->
            <div class="main-grid">
                <!-- Left Column (Pending Approvals & Activity Log) -->
                <div class="left-column-stack">
                    <!-- Section 1: Pending Approval Table (4 Columns: Title, Category, Date, Action) -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="pending-approval-heading">
                        <div class="panel-header">
                            <div class="panel-title-group">
                                <h2 id="pending-approval-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                    Pending Approval
                                </h2>
                                <span
                                    class="panel-count-badge"
                                    :title="`Total ${metrics.pending || 0} pending articles awaiting review`"
                                >
                                    {{ metrics.pending ?? 0 }}
                                </span>
                            </div>
                            <router-link to="/eic/review-articles" class="panel-action-link">View all &rarr;</router-link>
                        </div>

                        <div class="table-responsive table-no-scroll">
                            <table class="data-table eic-pending-approvals-table">
                                <thead>
                                    <tr>
                                        <th>Article Title</th>
                                        <th>Category</th>
                                        <th class="text-center" style="text-align: center !important;">Date</th>
                                        <th class="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="submissions-table-body">
                                    <tr v-for="art in pendingArticles" :key="art.id">
                                        <td>
                                            <div class="table-article-stack" style="min-width: 0; overflow: hidden;">
                                                <button
                                                    type="button"
                                                    class="table-article-btn"
                                                    @click="openManuscriptModal(art)"
                                                    :title="`Review & Edit: ${art.title}`"
                                                    style="font-family: 'Playfair Display', Georgia, serif !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; max-width: 100%; text-align: left;"
                                                >
                                                    {{ art.title }}
                                                </button>
                                                <div class="table-article-author-row">
                                                    <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                                    <span>By <strong>{{ art.author || 'Author' }}</strong></span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="table-section-tag" :title="art.category || 'General'">
                                                {{ formatShortCategory(art.category) }}
                                            </span>
                                        </td>
                                        <td class="text-center" style="text-align: center !important;">
                                            <span class="table-date" :title="art.date || ''">
                                                {{ formatShortDate(art.date) }}
                                            </span>
                                        </td>
                                        <td class="text-right">
                                            <div class="table-actions-group">
                                                <button
                                                    type="button"
                                                    class="btn-table-action btn-table-edit"
                                                    @click="openManuscriptModal(art)"
                                                    title="Edit writer's manuscript"
                                                >
                                                    <i class="fa-solid fa-pen-to-square"></i>
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn-table-action btn-table-revision"
                                                    @click="openRevisionModal(art)"
                                                    title="Direct to revision remarks"
                                                >
                                                    <i class="fa-solid fa-rotate-left"></i>
                                                    <span>Revision</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn-table-action btn-table-approve"
                                                    @click="handleQuickApprove(art)"
                                                    :disabled="isSubmitting"
                                                    title="Approve manuscript for M&PC"
                                                >
                                                    <i class="fa-solid fa-check"></i>
                                                    <span>Approve</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && pendingArticles.length === 0">
                                        <td colspan="4" class="empty-state-cell" style="font-size: 0.88rem; color: #667085; text-align: center !important; padding: 36px 16px !important; border-bottom: none; background: transparent; width: 100% !important;">
                                            No pending submissions for review.
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
                            <router-link to="/eic/activity-logs" class="panel-action-link">View all &rarr;</router-link>
                        </div>
                        <div id="recent-activity-list" class="activity-timeline">
                            <div
                                v-for="(act, idx) in recentActivities"
                                :key="act.id || idx"
                                class="activity-item"
                                @click="router.push('/eic/activity-logs')"
                                style="cursor: pointer;"
                                title="Open Activity Log"
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
                            <div v-if="!isLoading && recentActivities.length === 0" class="activity-empty-state-mini">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                                <h4 style="font-family: 'Playfair Display', Georgia, serif !important;">No activity logs recorded</h4>
                                <p>Editorial and system activities will appear here as they occur.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <!-- Right Column (Top Performing Articles & Top Journalists) -->
                <div class="right-column-stack">
                    <!-- Section 3: Top Performing Articles (Ranked List - Exact Match with Section Head) -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="top-performing-articles-heading">
                        <div class="panel-header">
                            <h2 id="top-performing-articles-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Top Performing Articles
                            </h2>
                            <span id="top-performing-month-badge" class="panel-badge">{{ currentMonthName }}</span>
                        </div>
                        <div id="top-performing-list" class="ranked-list">
                            <div
                                v-for="(art, idx) in publishedArticles"
                                :key="art.id"
                                class="ranked-item"
                                @click="openArticleViewer(art)"
                                style="cursor: pointer;"
                            >
                                <span class="rank-number" :class="{ 'top-rank': idx === 0 }">{{ idx + 1 }}</span>
                                <div class="ranked-content">
                                    <div class="ranked-category-tag">{{ art.category || 'General' }}</div>
                                    <button
                                        type="button"
                                        class="ranked-title-btn"
                                        :title="art.title"
                                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                                    >
                                        {{ art.title }}
                                    </button>
                                    <div class="ranked-meta-row">
                                        <span class="ranked-author">
                                            <i class="fa-solid fa-pen-nib" aria-hidden="true" style="font-size: 0.70rem; margin-right: 4px; color: var(--sidebar-maroon, #5c0a18);"></i>
                                            {{ art.author || 'Author' }}
                                        </span>
                                        <span class="ranked-stats">
                                            <span class="stat-metric" title="Views"><i class="fa-regular fa-eye"></i> {{ formatNumber(art.views) }}</span>
                                            <span class="stat-sep">&bull;</span>
                                            <span class="stat-metric" title="Shares"><i class="fa-solid fa-share-nodes"></i> {{ formatNumber(art.shares || 0) }}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div v-if="!isLoading && publishedArticles.length === 0" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0;">
                                No top performing articles yet.
                            </div>
                        </div>
                    </section>

                    <!-- Section 4: Top Performing Journalists (Exact same style as Section Head) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="top-journalists-heading">
                        <div class="panel-header">
                            <h2 id="top-journalists-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Top Performing Journalists
                            </h2>
                            <span class="panel-badge">Leaderboard</span>
                        </div>
                        <div class="journalists-table-wrap">
                            <table class="data-table journalists-table">
                                <thead>
                                    <tr>
                                        <th class="col-author">Author</th>
                                        <th class="col-article-count">Published Articles</th>
                                    </tr>
                                </thead>
                                <tbody id="top-journalists-table-body">
                                    <tr v-for="j in topJournalists" :key="j.id || j.name">
                                        <td class="col-author">
                                            <span class="author-name">{{ j.name }}</span>
                                        </td>
                                        <td class="col-article-count">
                                            <span class="article-count-pill">{{ j.article_count }}</span>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && topJournalists.length === 0">
                                        <td colspan="2" class="empty-state-cell" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0; border-bottom: none; pointer-events: none; background: transparent;">
                                            No journalists yet.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </main>

        <!-- Article Viewer Modal (Published Article Reading Experience) -->
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
                        <span id="viewer-date" class="viewer-date">{{ activeArticle.date || 'Published' }}</span>
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
                    <h1 id="viewer-title" class="viewer-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                        {{ activeArticle.title }}
                    </h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img :src="resolveAvatarUrl(activeArticle.author_avatar || activeArticle.avatar)" alt="Author avatar" loading="lazy">
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author || 'Author' }}</strong></span>
                        </div>
                    </div>
                    <div id="viewer-content" class="viewer-content-text" v-html="sanitizeContent(activeArticle.content, activeArticle.excerpt)"></div>
                </div>
            </div>
        </div>

        <!-- Minimalist Manuscript Reader Modal (In-Place Edit, Save, Return for Revision, Approve for M&PC) -->
        <div
            v-if="isManuscriptModalOpen && activeManuscript"
            id="manuscript-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
            @click.self="closeManuscriptModal"
        >
            <div class="modal-card manuscript-modal-card">
                <!-- Modal Header -->
                <div class="manuscript-header">
                    <div class="manuscript-header-left">
                        <span id="modal-section" class="review-box-category">{{ activeManuscript.category || 'General' }}</span>
                        <span>&bull;</span>
                        <span id="modal-date" class="review-box-date">{{ activeManuscript.date || 'Today' }}</span>
                    </div>
                    <div class="manuscript-header-right">
                        <button
                            type="button"
                            id="close-manuscript-btn"
                            class="viewer-close-btn"
                            @click="closeManuscriptModal"
                            aria-label="Close manuscript reader"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Modal Body: Direct In-Place Editable Manuscript -->
                <div class="manuscript-body">
                    <h2
                        ref="dashHeadlineRef"
                        id="modal-headline"
                        class="manuscript-headline"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                        @keydown="onDashHeadlineKeydown"
                    ></h2>

                    <div class="manuscript-byline-banner">
                        <div class="manuscript-byline-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By <strong id="modal-writer">{{ activeManuscript.author || 'Author' }}</strong></span>
                        </div>
                    </div>

                    <!-- Story Excerpt -->
                    <p
                        ref="dashExcerptRef"
                        id="modal-excerpt"
                        class="viewer-excerpt"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="display: none;"
                    ></p>

                    <!-- Story Body Content -->
                    <div
                        ref="dashBodyRef"
                        id="modal-body"
                        class="manuscript-text-content"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                    ></div>

                    <!-- Mandatory Revision Remarks Box -->
                    <div
                        v-if="showRemarksSection"
                        id="manuscript-remarks-section"
                        class="manuscript-remarks-section"
                    >
                        <label for="dash-modal-remarks" class="remarks-label">
                            <span class="remarks-label-text">
                                <i class="fa-solid fa-comment-dots"></i>
                                <span>Revision Remarks for Writer:</span>
                            </span>
                            <span class="required-badge">Required for Revision</span>
                        </label>
                        <textarea
                            id="dash-modal-remarks"
                            v-model="revisionRemarks"
                            class="remarks-textarea"
                            :class="{ 'input-invalid': remarksError }"
                            placeholder="Enter mandatory revision feedback for the writer before returning this story..."
                            rows="4"
                            @input="remarksError = ''"
                        ></textarea>
                        <div v-if="remarksError" id="remarks-error-msg" class="remarks-error-msg">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ remarksError }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer: Save, For Revision / Submit Revision, Approve for M&PC -->
                <div class="manuscript-footer">
                    <button
                        type="button"
                        id="modal-save-btn"
                        class="btn-box-save btn-save-maroon"
                        :disabled="isSubmitting"
                        @click="handleSaveChanges"
                        title="Save changes"
                    >
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>Save</span>
                    </button>

                    <button
                        type="button"
                        id="modal-revision-btn"
                        class="btn-box-revision"
                        :disabled="isSubmitting"
                        @click="showRemarksSection ? handleSubmitRevision() : toggleRevisionRemarks()"
                        title="Return to writer for revision"
                    >
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>{{ showRemarksSection ? 'Submit Revision' : 'For Revision' }}</span>
                    </button>

                    <button
                        type="button"
                        id="modal-approve-btn"
                        class="btn-box-approve btn-approve-maroon"
                        :disabled="isSubmitting"
                        @click="handleApproveForMpc"
                        title="Approve manuscript and forward to M&PC"
                    >
                        <i class="fa-solid fa-check"></i>
                        <span>Approve for M&amp;PC</span>
                    </button>
                </div>
            </div>
        </div>
    </EicLayout>
</template>

<style scoped>
.table-no-scroll {
    overflow-x: hidden !important;
}

.eic-pending-approvals-table {
    table-layout: fixed !important;
    width: 100% !important;
    border-collapse: collapse !important;
}

.eic-pending-approvals-table th,
.eic-pending-approvals-table td {
    vertical-align: middle !important;
    box-sizing: border-box !important;
}

/* 1. Article Title: 40% */
.eic-pending-approvals-table th:first-child,
.eic-pending-approvals-table td:first-child {
    width: 40% !important;
    padding-left: 14px !important;
    padding-right: 8px !important;
    text-align: left !important;
    overflow: hidden;
}

/* 2. Category: 15% (Lesser length so table fits with no scrollbar) */
.eic-pending-approvals-table th:nth-child(2),
.eic-pending-approvals-table td:nth-child(2) {
    width: 15% !important;
    text-align: left !important;
    white-space: nowrap !important;
    padding-left: 4px !important;
    padding-right: 6px !important;
    overflow: hidden;
}

/* 3. Date: 13% (Lesser length so table fits with no scrollbar) */
.eic-pending-approvals-table th:nth-child(3),
.eic-pending-approvals-table td:nth-child(3) {
    width: 13% !important;
    text-align: center !important;
    white-space: nowrap !important;
    padding-left: 4px !important;
    padding-right: 4px !important;
    overflow: hidden;
}

/* 4. Action: 32% */
.eic-pending-approvals-table th:nth-child(4),
.eic-pending-approvals-table td:nth-child(4) {
    width: 32% !important;
    padding-right: 14px !important;
    padding-left: 4px !important;
    text-align: right !important;
    white-space: nowrap !important;
}

.eic-pending-approvals-table .table-section-tag {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 7px !important;
    font-size: 0.70rem !important;
    font-weight: 600;
    line-height: 1.25;
    border-radius: 4px;
}

.eic-pending-approvals-table .table-date {
    font-size: 0.73rem !important;
    color: var(--text-muted, #667085);
    white-space: nowrap !important;
    display: inline-block;
    text-align: center;
}

.eic-pending-approvals-table .table-actions-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-end;
}

.eic-pending-approvals-table .btn-table-action {
    padding: 4px 7px !important;
    font-size: 0.71rem !important;
    gap: 3px !important;
}

/* Ranked List item touch interaction */
.ranked-item {
    padding: 8px 6px;
    border-radius: 8px;
    transition: background-color 0.15s ease, transform 0.15s ease;
}

.ranked-item:hover,
.ranked-item:active {
    background-color: #fdf8f8;
}

.ranked-title-btn {
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 0.92rem;
    line-height: 1.35;
    font-weight: 700;
    color: var(--text-primary, #101828);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.15s ease;
    width: 100%;
}

.ranked-title-btn:hover {
    color: var(--sidebar-maroon, #5c0a18);
    text-decoration: underline;
}

/* HCI & Small Screen Standards */
@media (max-width: 768px) {
    .table-no-scroll {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
    }
    .eic-pending-approvals-table {
        min-width: 480px !important;
    }
    .eic-pending-approvals-table th:first-child,
    .eic-pending-approvals-table td:first-child {
        width: 44% !important;
    }
    .eic-pending-approvals-table th:nth-child(2),
    .eic-pending-approvals-table td:nth-child(2) {
        width: 18% !important;
    }
    .eic-pending-approvals-table th:nth-child(3),
    .eic-pending-approvals-table td:nth-child(3) {
        width: 16% !important;
        text-align: center !important;
    }
    .eic-pending-approvals-table th:nth-child(4),
    .eic-pending-approvals-table td:nth-child(4) {
        width: 22% !important;
    }
    .eic-pending-approvals-table .btn-table-action {
        min-width: 32px !important;
        height: 32px !important;
        padding: 0 6px !important;
        font-size: 0.80rem !important;
        justify-content: center !important;
    }
    .eic-pending-approvals-table .btn-table-action span {
        display: none !important;
    }

    /* Modal Responsive HCI Sizing */
    .viewer-modal-card,
    .manuscript-modal-card {
        width: 95vw !important;
        max-width: 95vw !important;
        max-height: 90vh !important;
        margin: 10px auto !important;
        border-radius: 12px !important;
    }
    .viewer-modal-header,
    .manuscript-header {
        padding: 12px 14px !important;
    }
    .viewer-close-btn {
        width: 36px !important;
        height: 36px !important;
        font-size: 1rem !important;
    }
    .viewer-modal-body,
    .manuscript-body {
        padding: 16px 14px !important;
    }
    .viewer-title {
        font-size: 1.30rem !important;
        line-height: 1.3 !important;
    }
}
</style>
