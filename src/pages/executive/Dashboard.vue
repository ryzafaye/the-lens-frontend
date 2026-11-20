<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveDashboard,
    updateExecutiveReviewArticle,
    approveExecutiveArticle,
    returnExecutiveArticleForRevision,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatActivityStatement } from '../../utils/activityGrammar.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-review-articles.css';
import '../../assets/css/executive-modals.css';

const router = useRouter();
const user = currentUser;

// RBAC
const isPresOrVp = computed(() => {
    return ['President', 'Vice President', 'Executive Vice President'].includes(user?.role || '');
});

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

const top3PublishedArticles = computed(() => {
    const list = [...(publishedArticles.value || [])];
    return list.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 3);
});

const currentMonthName = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
});

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
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
}

function getStatement(act) {
    return formatActivityStatement(act);
}

function getTimestampText(act) {
    return act?.timestampText || act?.timeAgo || act?.time || act?.created_at || 'Recently';
}

function getFormattedDate(act) {
    return act?.formattedDate || act?.date || '';
}

function getCauserRole(act) {
    return act?.causerRole || act?.role || 'Editorial Board';
}

async function loadDashboardData() {
    isLoading.value = true;
    try {
        const data = await getExecutiveDashboard(true);
        if (data) {
            if (data.metrics) {
                metrics.value = {
                    pending: data.metrics.pending ?? 0,
                    total_views: data.metrics.monthly_views ?? data.metrics.total_views ?? 0,
                    published_stories: data.metrics.published_stories ?? 0,
                    active_members: data.metrics.active_members ?? 0,
                };
            }
            if (Array.isArray(data.pendingArticles)) {
                pendingArticles.value = data.pendingArticles;
            }
            if (Array.isArray(data.publishedArticles)) {
                publishedArticles.value = data.publishedArticles;
            }
            if (Array.isArray(data.topJournalists) && data.topJournalists.length > 0) {
                topJournalists.value = data.topJournalists;
            } else if (Array.isArray(data.publishedArticles)) {
                computeTopJournalists(data.publishedArticles);
            }
            if (Array.isArray(data.recentActivities)) {
                recentActivities.value = data.recentActivities;
            }
        }
    } catch (err) {
        console.error('Failed to load executive dashboard data:', err);
    } finally {
        isLoading.value = false;
    }
}

function computeTopJournalists(articles) {
    const counts = {};
    articles.forEach(art => {
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

// Open In-Place Manuscript Review / Edit Modal
function openManuscriptModal(article, openWithRevision = false) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = openWithRevision;
    revisionRemarks.value = '';
    remarksError.value = '';
    isManuscriptModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (dashHeadlineRef.value) {
            dashHeadlineRef.value.innerText = activeManuscript.value.title || '';
        }
        if (dashExcerptRef.value) {
            dashExcerptRef.value.innerText = activeManuscript.value.excerpt || '';
        }
        if (dashBodyRef.value) {
            dashBodyRef.value.innerHTML = cleanContentForEditing(activeManuscript.value.content || '');
        }
    });
}

function closeManuscriptModal() {
    isManuscriptModalOpen.value = false;
    activeManuscript.value = null;
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    document.body.classList.remove('modal-open');
}

// Quick Approve directly from table or modal
async function handleApprove(articleId = null) {
    const id = articleId || activeManuscript.value?.id;
    if (!id || isSubmitting.value) return;

    isSubmitting.value = true;
    try {
        const payload = {};
        if (isManuscriptModalOpen.value) {
            if (dashHeadlineRef.value) {
                payload.title = dashHeadlineRef.value.innerText.trim();
            }
            if (dashExcerptRef.value) {
                payload.excerpt = dashExcerptRef.value.innerText.trim();
            }
            if (dashBodyRef.value) {
                payload.content = cleanContentForEditing(dashBodyRef.value.innerHTML);
            }
        }

        await approveExecutiveArticle(id, payload);
        showToast('Article approved and forwarded to Media & Publication Committee.', 'success');
        closeManuscriptModal();
        await loadDashboardData();
    } catch (err) {
        console.error('Approval failed:', err);
        showToast('Failed to approve article. Please try again.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Return for Revision from modal
async function handleReturnForRevision() {
    if (!activeManuscript.value?.id || isSubmitting.value) return;

    if (!showRemarksSection.value) {
        showRemarksSection.value = true;
        return;
    }

    const remarks = revisionRemarks.value.trim();
    if (!remarks) {
        remarksError.value = 'Please provide revision remarks for the author.';
        return;
    }

    isSubmitting.value = true;
    try {
        const res = await returnExecutiveArticleForRevision(activeManuscript.value.id, remarks);
        const catName = activeManuscript.value?.category || 'Section';
        const isOpinion = catName.toLowerCase().includes('opinion');
        const defaultMsg = isOpinion
            ? 'Opinion article returned to author with revision remarks.'
            : `Article returned to ${catName} Head for section revision.`;
        showToast(res?.message || defaultMsg, 'warning');
        closeManuscriptModal();
        await loadDashboardData();
    } catch (err) {
        console.error('Revision return failed:', err);
        showToast('Failed to return article. Please try again.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Save in-place edits without approving
async function handleSaveManuscriptChanges() {
    if (!activeManuscript.value?.id || isSubmitting.value) return;

    const title = dashHeadlineRef.value?.innerText.trim() || activeManuscript.value.title;
    const excerpt = dashExcerptRef.value?.innerText.trim() || activeManuscript.value.excerpt;
    const content = cleanContentForEditing(dashBodyRef.value?.innerHTML || activeManuscript.value.content);

    isSubmitting.value = true;
    try {
        await updateExecutiveReviewArticle(activeManuscript.value.id, {
            title,
            excerpt,
            content,
        });

        activeManuscript.value.title = title;
        activeManuscript.value.excerpt = excerpt;
        activeManuscript.value.content = content;

        showToast('Manuscript edits saved successfully.', 'success');
        await loadDashboardData();
    } catch (err) {
        console.error('Failed to save manuscript edits:', err);
        showToast('Failed to save manuscript edits.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

onMounted(() => {
    loadDashboardData();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Toast Feedback -->
            <transition name="fade">
                <div v-if="toast.show" class="toast-container">
                    <div class="toast-message" :class="toast.type">
                        <span class="toast-bullet-dot"></span>
                        <span>{{ toast.message }}</span>
                    </div>
                </div>
            </transition>

            <!-- Page Title Section -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 class="page-title">Dashboard</h1>
            </div>

            <!-- Metrics Row (4 Cards in One Single Line on Desktop) -->
            <section id="metrics-grid" class="metrics-grid metrics-grid-4" aria-label="Operational metrics">
                <div class="metric-card animate-fade-in delay-1">
                    <div class="metric-header">
                        <span class="metric-label">Pending Approvals</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-clock"></i></div>
                    </div>
                    <div class="metric-value">{{ metrics.pending }}</div>
                    <div class="metric-subtitle">Awaiting editorial review</div>
                </div>

                <div class="metric-card animate-fade-in delay-2">
                    <div class="metric-header">
                        <span class="metric-label">Monthly Readership</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-eye"></i></div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.total_views) }}</div>
                    <div class="metric-subtitle">Views across all desks</div>
                </div>

                <div class="metric-card animate-fade-in delay-3">
                    <div class="metric-header">
                        <span class="metric-label">Active Members</span>
                        <div class="metric-icon-box"><i class="fa-solid fa-users"></i></div>
                    </div>
                    <div class="metric-value">{{ metrics.active_members }}</div>
                    <div class="metric-subtitle">Staff &amp; editorial roster</div>
                </div>

                <div class="metric-card animate-fade-in delay-4">
                    <div class="metric-header">
                        <span class="metric-label">Published Stories</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-newspaper"></i></div>
                    </div>
                    <div class="metric-value">{{ metrics.published_stories }}</div>
                    <div class="metric-subtitle">Total overall published</div>
                </div>
            </section>

            <!-- Main Grid (Single Column on mobile) -->
            <div class="main-grid">
                <!-- Left Column (Larger - Editorial Operations Stack) -->
                <div class="left-column-stack">
                    <!-- Section 1: Pending Approval (5 Columns: Title, Category, Status, Date, Action) -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="pending-approval-heading">
                        <div class="panel-header">
                            <div class="panel-title-group">
                                <h2 id="pending-approval-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Pending Approval</h2>
                                <span class="panel-count-badge" title="Total pending submissions across section">{{ pendingArticles.length }}</span>
                            </div>
                            <router-link
                                v-if="isPresOrVp"
                                to="/executive/review-articles"
                                class="panel-action-link"
                            >
                                View all &rarr;
                            </router-link>
                        </div>

                        <div class="table-responsive">
                            <table class="data-table pending-approvals-table">
                                <thead>
                                    <tr>
                                        <th>Article Title</th>
                                        <th class="hide-on-mobile">Category</th>
                                        <th>Status</th>
                                        <th class="hide-on-mobile">Date</th>
                                        <th class="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="art in pendingArticles" :key="art.id">
                                        <td>
                                            <div class="table-article-info">
                                                <button
                                                    type="button"
                                                    class="table-article-btn"
                                                    :title="art.title"
                                                    style="font-family: 'Playfair Display', Georgia, serif !important;"
                                                    @click="openManuscriptModal(art, false)"
                                                >
                                                    {{ art.title }}
                                                </button>
                                                <div class="table-author-subline">
                                                    <i class="fa-solid fa-pen-nib"></i>
                                                    <span>By <strong>{{ art.author || 'Author' }}</strong></span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="hide-on-mobile">
                                            <span class="table-section-tag" :title="art.category">{{ art.category || 'General' }}</span>
                                        </td>
                                        <td>
                                            <span class="status-badge status-review">Pending</span>
                                        </td>
                                        <td class="hide-on-mobile">
                                            <span class="table-date">{{ art.date }}</span>
                                        </td>
                                        <td class="text-right">
                                            <router-link
                                                v-if="isPresOrVp"
                                                :to="'/executive/review-articles?id=' + art.id"
                                                class="table-manage-btn"
                                                title="Review Article"
                                            >
                                                Manage
                                            </router-link>
                                            <button
                                                v-else
                                                type="button"
                                                class="table-manage-btn"
                                                title="View Article"
                                                @click="openManuscriptModal(art, false)"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && pendingArticles.length === 0">
                                        <td colspan="5" class="empty-state-cell" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0; border-bottom: none; pointer-events: none; background: transparent;">
                                            No pending submissions yet.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <!-- Section 2: Activity Log (Top 5 Recent with View All) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="activity-log-heading">
                        <div class="panel-header">
                            <h2 id="activity-log-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Activity Log
                            </h2>
                            <router-link to="/executive/activity-logs" class="panel-action-link">View all &rarr;</router-link>
                        </div>
                        <div id="recent-activity-list" class="activity-timeline">
                            <div
                                v-for="(act, idx) in recentActivities"
                                :key="act.id || idx"
                                class="activity-item"
                                @click="router.push('/executive/activity-logs')"
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

                <!-- Right Column (Widened Analytics & Leaderboard Stack) -->
                <div class="right-column-stack">
                    <!-- Section 1: Most Viewed Articles -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="most-viewed-heading">
                        <div class="panel-header">
                            <h2 id="most-viewed-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Most Viewed Articles</h2>
                            <span class="panel-badge">{{ currentMonthName }}</span>
                        </div>
                        <div class="ranked-list">
                            <div
                                v-for="(art, idx) in top3PublishedArticles"
                                :key="art.id"
                                class="ranked-item"
                                @click="openArticleViewer(art)"
                            >
                                <span class="rank-number" :class="{ 'top-rank': idx === 0 }">{{ idx + 1 }}</span>
                                <div class="ranked-content">
                                    <div class="ranked-category-tag">{{ art.category }}</div>
                                    <button
                                        type="button"
                                        class="ranked-title-btn"
                                        :title="art.title"
                                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                                        @click.stop="openArticleViewer(art)"
                                    >
                                        {{ art.title }}
                                    </button>
                                    <div class="ranked-meta-row">
                                        <span class="ranked-author">
                                            <i class="fa-solid fa-pen-nib" aria-hidden="true" style="font-size: 0.70rem; margin-right: 4px; color: var(--sidebar-maroon, #5c0a18);"></i>
                                            {{ art.author }}
                                        </span>
                                        <span class="ranked-stats">
                                            <span class="stat-metric" title="Views">
                                                <i class="fa-regular fa-eye"></i> {{ formatNumber(art.views) }}
                                            </span>
                                            <span class="stat-sep">•</span>
                                            <span class="stat-metric" title="Shares">
                                                <i class="fa-solid fa-share-nodes"></i> {{ formatNumber(art.shares) }}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div v-if="!isLoading && top3PublishedArticles.length === 0" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0;">
                                No published articles yet.
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
                                            <span class="article-count-pill">{{ j.article_count || j.count }}</span>
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

                    <div class="viewer-content font-serif leading-relaxed" v-html="sanitizeContent(activeArticle?.content, activeArticle?.excerpt)"></div>
                </div>

                <div class="viewer-footer">
                    <button type="button" class="btn-cancel" @click="closeArticleViewer">Close</button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: In-place Manuscript Review / Edit Modal                       -->
        <!-- ====================================================================== -->
        <div v-if="isManuscriptModalOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card manuscript-modal-card">
                <!-- Header -->
                <div class="manuscript-header">
                    <div class="manuscript-header-left">
                        <span class="review-box-category">{{ activeManuscript?.category || 'General' }}</span>
                        <span>•</span>
                        <span class="review-box-date">{{ activeManuscript?.date }}</span>
                    </div>
                    <div class="manuscript-header-right">
                        <button type="button" class="viewer-close-btn" aria-label="Close dialog" @click="closeManuscriptModal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Body -->
                <div class="manuscript-body">
                    <h2
                        ref="dashHeadlineRef"
                        class="manuscript-headline"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="font-size: 1.15rem;"
                    ></h2>

                    <div class="manuscript-byline-banner">
                        <div class="manuscript-byline-author">
                            <i class="fa-solid fa-pen-nib"></i>
                            <span>By <strong>{{ activeManuscript?.author || 'Author' }}</strong></span>
                        </div>
                    </div>

                    <div class="manuscript-excerpt-section">
                        <label class="manuscript-label">Excerpt / Teaser</label>
                        <p
                            ref="dashExcerptRef"
                            class="manuscript-excerpt"
                            contenteditable="true"
                            spellcheck="true"
                            role="textbox"
                            aria-multiline="true"
                        ></p>
                    </div>

                    <div class="manuscript-body-section">
                        <label class="manuscript-label">Full Manuscript Content</label>
                        <div
                            ref="dashBodyRef"
                            class="manuscript-text-body font-serif leading-relaxed"
                            contenteditable="true"
                            spellcheck="true"
                            role="textbox"
                            aria-multiline="true"
                        ></div>
                    </div>

                    <!-- Revision Remarks Section (Expandable) -->
                    <div v-if="showRemarksSection" class="revision-remarks-box animate-fade-in">
                        <label class="revision-remarks-label" for="dash-revision-textarea">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Revision Remarks for Author *</span>
                        </label>
                        <textarea
                            id="dash-revision-textarea"
                            v-model="revisionRemarks"
                            class="revision-remarks-textarea"
                            rows="3"
                            placeholder="Specify requested improvements, factual corrections, or copyedits..."
                        ></textarea>
                        <p v-if="remarksError" class="remarks-error-text">{{ remarksError }}</p>
                    </div>
                </div>

                <!-- Footer with Action Controls -->
                <div class="manuscript-footer">
                    <div class="manuscript-footer-left">
                        <button
                            type="button"
                            class="btn-save-manuscript"
                            :disabled="isSubmitting"
                            @click="handleSaveManuscriptChanges"
                        >
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Save Edits</span>
                        </button>
                    </div>
                    <div class="manuscript-footer-right">
                        <button
                            type="button"
                            class="btn-return-revision"
                            :disabled="isSubmitting"
                            @click="handleReturnForRevision"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>{{ showRemarksSection ? 'Confirm Return for Revision' : 'Return for Revision' }}</span>
                        </button>
                        <button
                            type="button"
                            class="btn-approve-article"
                            :disabled="isSubmitting"
                            @click="handleApprove(null)"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Approve &amp; Forward</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
</template>
