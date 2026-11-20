<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import {
    getSectionHeadDashboard,
    getSectionHeadActivityLogs,
    approveSectionHeadArticle,
    updateSectionHeadReviewArticle,
    returnSectionHeadArticleForRevision,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatActivityStatement } from '../../utils/activityGrammar.js';
import '../../assets/css/executive-review-articles.css';

const router = useRouter();

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const metrics = ref({
    pending: 0,
    monthly_views: 0,
    total_views: 0,
    active_members: 0,
    published_stories: 0,
});
const pendingArticles = ref([]);
const publishedArticles = ref([]);
const recentActivities = ref([]);
const topJournalists = ref([]);
const sectionCategory = ref('');

// Activity Log Helper Accessors (Blade Parity with ActivityLogs.vue)
function getCauser(item) {
    if (!item) return 'System';
    if (typeof item.causer === 'string' && item.causer.trim()) return item.causer;
    if (item.causer?.name) return item.causer.name;
    if (item.user && typeof item.user === 'string') return item.user;
    return 'System';
}

function getCauserRole(item) {
    if (!item) return 'Member';
    if (item.causerRole) return item.causerRole;
    if (item.causer?.role) return item.causer.role;
    if (item.role) return item.role;
    return 'Member';
}

function getCauserAvatar(item) {
    if (!item) return '/images/member-placeholder.svg';
    const raw = item.causerAvatar || item.causer?.avatar || item.avatar;
    if (!raw) return '/images/member-placeholder.svg';
    return optimizeCloudinaryUrl(raw, { width: 100, crop: 'limit' });
}

function getAction(item) {
    return item?.action || 'performed an action';
}

function getSubjectType(item) {
    if (!item) return 'Article';
    if (item.subjectType) return item.subjectType;
    if (item.subject?.type) return item.subject.type;
    return 'Article';
}

function getSubjectName(item) {
    if (!item) return '';
    if (item.subjectName) return item.subjectName;
    if (item.subject?.title) return item.subject.title;
    if (item.target) return item.target;
    return '';
}

function getTimestampText(item) {
    if (!item) return 'Recent';
    return item.timestampText || item.created_at_human || item.time || 'Recent';
}

function getFormattedDate(item) {
    if (!item) return '';
    return item.formattedDate || item.date || item.created_at || '';
}

function getStatement(item) {
    return formatActivityStatement(item);
}

// Exactly Top 5 Recent Activities for Section Head Dashboard (excluding auth & profile events)
const top5Activities = computed(() => {
    return (recentActivities.value || [])
        .filter(act => {
            const a = (act.action || '').toLowerCase();
            return !a.includes('login') && !a.includes('logged in') && !a.includes('logout') && !a.includes('logged out') && !a.includes('profile') && !a.includes('password');
        })
        .slice(0, 5);
});
const user = ref({
    full_name: localStorage.getItem('userName') || localStorage.getItem('sectionHeadName') || 'Section Head',
    role: localStorage.getItem('userRole') || localStorage.getItem('sectionHeadRole') || 'Section Head',
});

// Toast notification state
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

// Current month name
const currentMonth = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
});

// TOP 5 ARTICLES: STRICTLY "PENDING REVIEW" ONLY
const topPendingArticles = computed(() => {
    return (pendingArticles.value || [])
        .filter(art => (art.status || '').toLowerCase() === 'pending review')
        .slice(0, 5);
});

// --------------------------------------------------------------------------
// Article Viewer Modal state (Reading mode)
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// Manuscript Modal state (Exact Old Manuscript Style with Native In-Place Editing)
// --------------------------------------------------------------------------
const isManuscriptModalOpen = ref(false);
const activeManuscript = ref(null);
const revisionRemarks = ref('');
const showRemarksSection = ref(false);
const remarksError = ref('');

// Decoupled DOM Refs for Flawless Native In-Place Editing (Letters, Words & Spaces)
const dashHeadlineRef = ref(null);
const dashExcerptRef = ref(null);
const dashBodyRef = ref(null);



function openManuscriptModal(article) {
    activeManuscript.value = { ...article };
    revisionRemarks.value = article.remarks || '';
    showRemarksSection.value = false;
    remarksError.value = '';
    isManuscriptModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (dashHeadlineRef.value) {
            dashHeadlineRef.value.innerText = article.title || '';
        }
        if (dashExcerptRef.value) {
            if (article.excerpt && article.excerpt.trim()) {
                dashExcerptRef.value.innerText = article.excerpt.trim();
                dashExcerptRef.value.style.display = 'block';
            } else {
                dashExcerptRef.value.innerText = '';
                dashExcerptRef.value.style.display = 'none';
            }
        }
        if (dashBodyRef.value) {
            dashBodyRef.value.innerHTML = formatCleanArticleContent(article.content || article.excerpt);
        }
    });
}

function openRevisionModal(article) {
    activeManuscript.value = { ...article };
    revisionRemarks.value = article.remarks || '';
    showRemarksSection.value = true;
    remarksError.value = '';
    isManuscriptModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (dashHeadlineRef.value) {
            dashHeadlineRef.value.innerText = article.title || '';
        }
        if (dashExcerptRef.value) {
            if (article.excerpt && article.excerpt.trim()) {
                dashExcerptRef.value.innerText = article.excerpt.trim();
                dashExcerptRef.value.style.display = 'block';
            } else {
                dashExcerptRef.value.innerText = '';
                dashExcerptRef.value.style.display = 'none';
            }
        }
        if (dashBodyRef.value) {
            dashBodyRef.value.innerHTML = formatCleanArticleContent(article.content || article.excerpt);
        }
        const textarea = document.getElementById('dash-modal-remarks');
        if (textarea) textarea.focus();
    });
}

function onDashHeadlineKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none') {
            dashExcerptRef.value.focus();
        } else if (dashBodyRef.value) {
            dashBodyRef.value.focus();
        }
    }
}

function closeManuscriptModal() {
    isManuscriptModalOpen.value = false;
    activeManuscript.value = null;
    showRemarksSection.value = false;
    remarksError.value = '';
    document.body.classList.remove('modal-open');
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

// Quick Approve directly from pending table action button
async function handleQuickApprove(article) {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
        await approveSectionHeadArticle(article.id);
        pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        showToast('Article approved and forwarded to Editor-in-Chief (EIC).', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Save Changes in Manuscript Modal (Direct Native In-Place Editing)
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

        const res = await updateSectionHeadReviewArticle(activeManuscript.value.id, payload);

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

// Submit Revision Remarks from Manuscript Modal
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
        const res = await returnSectionHeadArticleForRevision(activeManuscript.value.id, revisionRemarks.value.trim());
        pendingArticles.value = pendingArticles.value.filter(a => a.id !== activeManuscript.value.id);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        closeManuscriptModal();
        showToast(res.message || 'Article returned to author with revision remarks.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to return article for revision.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Approve for EIC from Manuscript Modal (Saves In-Place Changes and Approves)
async function handleApproveForEic() {
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

        await updateSectionHeadReviewArticle(activeManuscript.value.id, payload);
        await approveSectionHeadArticle(activeManuscript.value.id);

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== activeManuscript.value.id);
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        closeManuscriptModal();
        showToast('Article approved and forwarded to Editor-in-Chief (EIC).', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
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

async function loadDashboard(forceFresh = false) {
    try {
        const data = await getSectionHeadDashboard(forceFresh);
        if (data.user) {
            user.value = data.user;
        }
        if (data.metrics) {
            metrics.value = data.metrics;
        }
        if (data.pendingArticles) {
            pendingArticles.value = data.pendingArticles;
        }
        if (data.publishedArticles) {
            publishedArticles.value = data.publishedArticles;
        }
        if (data.recentActivities && data.recentActivities.length > 0) {
            recentActivities.value = data.recentActivities;
        } else {
            try {
                const logsData = await getSectionHeadActivityLogs({}, false);
                if (logsData && Array.isArray(logsData.data)) {
                    recentActivities.value = logsData.data;
                }
            } catch (e) {
                // Ignore fallback error
            }
        }
        if (data.topJournalists && data.topJournalists.length > 0) {
            topJournalists.value = data.topJournalists;
        } else {
            // STRICT RULE: Only count articles if status is 'Published'
            const publishedList = (data.publishedArticles || []).filter(a => (a.status || '').toLowerCase() === 'published');
            const authorCounts = {};
            publishedList.forEach(a => {
                if (a.author) {
                    authorCounts[a.author] = (authorCounts[a.author] || 0) + 1;
                }
            });
            topJournalists.value = Object.entries(authorCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count], id) => ({
                    id,
                    name,
                    article_count: count,
                }));
        }
        if (data.category) {
            sectionCategory.value = data.category;
        }
    } catch (err) {
        console.error('Failed to load Section Head dashboard:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboard();
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container">
            <!-- Toast Notification -->
            <div
                v-if="toast.show"
                :class="['toast', `toast-${toast.type}`, 'toast-show']"
                style="position: fixed; bottom: 24px; right: 24px; z-index: 99999;"
            >
                <i :class="['fa-solid', toast.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation']"></i>
                <span>{{ toast.message }}</span>
            </div>

            <!-- Page Title Section (Exact match to executive/dashboard.blade.php) -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 id="page-title-heading" class="page-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                    {{ user.role || 'Section Head' }} Dashboard
                </h1>
            </div>

            <!-- 3-Column Metrics Row for Section Heads (Exact match to section-head-dashboard.css .metrics-grid-3) -->
            <section id="metrics-grid" class="metrics-grid metrics-grid-3" aria-label="Operational metrics">
                <div class="metric-card animate-fade-in delay-1">
                    <div class="metric-header">
                        <span class="metric-label">Total Article Views</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-eye"></i></div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.monthly_views || metrics.total_views) }}</div>
                    <div class="metric-subtitle">Views across desk for {{ currentMonth }}</div>
                </div>

                <div class="metric-card animate-fade-in delay-2">
                    <div class="metric-header">
                        <span class="metric-label">{{ sectionCategory ? sectionCategory + ' Articles' : 'Desk Articles' }}</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-newspaper"></i></div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.published_stories) }}</div>
                    <div class="metric-subtitle">Published to site</div>
                </div>

                <div class="metric-card animate-fade-in delay-3">
                    <div class="metric-header">
                        <span class="metric-label">Pending Section Review</span>
                        <div class="metric-icon-box"><i class="fa-regular fa-clock"></i></div>
                    </div>
                    <div class="metric-value">{{ formatNumber(metrics.pending) }}</div>
                    <div class="metric-subtitle">Awaiting head decision</div>
                </div>
            </section>

            <!-- Main Grid Layout (Exact match to executive/dashboard.blade.php) -->
            <div class="main-grid">
                <!-- Left Column (Pending Approvals & Activity Log) -->
                <div class="left-column-stack">
                    <!-- Pending Approvals Table (Top 5 Pending Review Articles, 3 Columns: Title+Author, Date, Action) -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="pending-approval-heading">
                        <div class="panel-header">
                            <div class="panel-title-group">
                                <h2 id="pending-approval-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                    Pending Approval
                                </h2>
                                <span
                                    class="panel-count-badge"
                                    :title="`Total ${metrics.pending || 0} pending articles across this section`"
                                >
                                    {{ formatNumber(metrics.pending) }}
                                </span>
                            </div>
                            <router-link to="/section-head/review-articles" class="panel-action-link">View all &rarr;</router-link>
                        </div>

                        <div class="table-responsive">
                            <table class="data-table pending-approvals-table">
                                <thead>
                                    <tr>
                                        <th>Article Title</th>
                                        <th>Date</th>
                                        <th class="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="art in topPendingArticles" :key="art.id">
                                        <td>
                                            <div class="table-article-stack">
                                                <button
                                                    type="button"
                                                    class="table-article-btn"
                                                    @click="openManuscriptModal(art)"
                                                    :title="`Review & Edit: ${art.title}`"
                                                    style="font-family: 'Playfair Display', Georgia, serif !important;"
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
                                            <span class="table-date">{{ art.date }}</span>
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
                                                    title="Approve manuscript for EIC"
                                                >
                                                    <i class="fa-solid fa-check"></i>
                                                    <span>Approve</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && topPendingArticles.length === 0">
                                        <td colspan="3" class="empty-state-cell" style="font-size: 0.88rem; color: #667085; text-align: center !important; padding: 36px 16px !important; border-bottom: none; background: transparent; width: 100% !important;">
                                            No pending submissions for this section.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <!-- Activity Log Section (Synced with ActivityLogs.vue & Blade executive-activity-logs format) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="activity-log-heading">
                        <div class="panel-header">
                            <h2 id="activity-log-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Activity Log
                            </h2>
                            <router-link to="/section-head/activity-logs" class="panel-action-link">View all &rarr;</router-link>
                        </div>
                        <div id="recent-activity-list" class="activity-timeline">
                            <div
                                v-for="(act, idx) in top5Activities"
                                :key="act.id || idx"
                                class="activity-item"
                                @click="router.push('/section-head/activity-logs')"
                                style="cursor: pointer;"
                                title="Open Activity Log"
                            >
                                <div class="activity-avatar">
                                    <img :src="getCauserAvatar(act)" :alt="getCauser(act)" loading="lazy">
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
                            <div v-if="!isLoading && top5Activities.length === 0" class="activity-empty-state-mini">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                                <h4 style="font-family: 'Playfair Display', Georgia, serif !important;">No activity logs recorded</h4>
                                <p>Editorial and system activities will appear here as they occur.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <!-- Right Column (Most Viewed Articles & Top Performing Journalists) -->
                <div class="right-column-stack">
                    <!-- Most Viewed Articles -->
                    <section class="card-panel animate-fade-in delay-2" aria-labelledby="most-viewed-heading">
                        <div class="panel-header">
                            <h2 id="most-viewed-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Most Viewed Articles
                            </h2>
                            <span id="most-viewed-month-badge" class="panel-badge">{{ currentMonth }}</span>
                        </div>
                        <div id="most-viewed-list" class="ranked-list">
                            <div
                                v-for="(art, idx) in publishedArticles"
                                :key="art.id"
                                class="ranked-item"
                                @click="openArticleViewer(art)"
                                style="cursor: pointer;"
                            >
                                <span class="rank-number" :class="{ 'top-rank': idx === 0 }">{{ idx + 1 }}</span>
                                <div class="ranked-content">
                                    <div class="ranked-category-tag">{{ art.category || sectionCategory }}</div>
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
                                No published articles yet.
                            </div>
                        </div>
                    </section>

                    <!-- Top Performing Journalists Leaderboard (Strictly Published Articles Only) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="top-journalists-heading">
                        <div class="panel-header">
                            <h2 id="top-journalists-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                                Top Performing Journalists
                            </h2>
                            <span class="panel-badge">Leaderboard</span>
                        </div>
                        <div class="journalists-table-wrap">
                            <table class="journalists-table">
                                <thead>
                                    <tr>
                                        <th class="col-author">Author</th>
                                        <th class="col-article-count">Article Count</th>
                                    </tr>
                                </thead>
                                <tbody id="top-journalists-table-body">
                                    <tr v-for="j in topJournalists" :key="j.id">
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
                        <span id="viewer-category" class="viewer-category-tag">{{ activeArticle.category || sectionCategory }}</span>
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
                    <h1 id="viewer-title" class="viewer-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                        {{ activeArticle.title }}
                    </h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img :src="optimizeCloudinaryUrl(activeArticle.author_avatar, { width: 100, crop: 'limit' }) || '/images/member-placeholder.svg'" alt="Author avatar" loading="lazy">
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author }}</strong></span>
                        </div>
                    </div>
                    <div id="viewer-content" class="viewer-content-text" v-html="sanitizeContent(activeArticle.content, activeArticle.excerpt)"></div>
                </div>
            </div>
        </div>

        <!-- Minimalist Manuscript Reader Modal (Edit, Save, Return for Revision, Approve for EIC) -->
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
                        <span id="modal-section" class="review-box-category">{{ activeManuscript.category || sectionCategory }}</span>
                        <span>&bull;</span>
                        <span id="modal-date" class="review-box-date">{{ activeManuscript.date }}</span>
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

                <!-- Modal Body: Direct In-Place Editable Manuscript (Exact Blade Parity & Flawless Spacing) -->
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
                            <span>By <strong id="modal-writer">{{ activeManuscript.author }}</strong></span>
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

                    <!-- Mandatory Revision Remarks Box (Exact ReviewArticles parity) -->
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

                <!-- Modal Footer (Exact parity with ReviewArticles: Save, For Revision / Submit Revision, Approve for EIC) -->
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
                        @click="handleApproveForEic"
                        title="Approve manuscript and endorse to Editor-in-Chief"
                    >
                        <i class="fa-solid fa-check"></i>
                        <span>Approve for EIC</span>
                    </button>
                </div>
            </div>
        </div>
    </SectionHeadLayout>
</template>
