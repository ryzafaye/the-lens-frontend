<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import PendingApprovalTable from '../../components/PendingApprovalTable.vue';
import {
    getSectionHeadDashboard,
    getSectionHeadActivityLogs,
    approveSectionHeadArticle,
    updateSectionHeadReviewArticle,
    returnSectionHeadArticleForRevision,
    resubmitArticle,
} from '../../services/api.js';
import { formatCleanArticleContent, sanitizeRichArticleHtml, isRevisionStatus, isArticleBodyModified } from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import {
    formatActivityStatement,
    formatPhilippineDateTime,
    formatPhilippineRelativeTime,
} from '../../utils/activityGrammar.js';
import { formatCategoryDisplay } from '../../utils/categoryFormat.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
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
    const dateInput = item.isoDate || item.created_at || item.rawDate;
    if (dateInput) {
        return formatPhilippineRelativeTime(dateInput);
    }
    return item.timestampText || item.created_at_human || item.time || 'Recent';
}

function getFormattedDate(item) {
    if (!item) return '';
    const dateInput = item.isoDate || item.created_at || item.rawDate;
    if (dateInput) {
        return formatPhilippineDateTime(dateInput);
    }
    return item.formattedDate || item.date || '';
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

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Current month name
const currentMonth = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
});

// TOP 5 ARTICLES: Include all pending review articles for this section
const topPendingArticles = computed(() => {
    const list = pendingArticles.value || [];
    const pendingList = list.filter(art => {
        const st = (art.status || '').toLowerCase();
        return st.includes('pending');
    });
    return (pendingList.length > 0 ? pendingList : list).slice(0, 5);
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

// Remarks Modal state
const isRemarksModalOpen = ref(false);
const activeRemarksArticle = ref(null);

function openRemarksModal(article) {
    activeRemarksArticle.value = article;
    isRemarksModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeRemarksModal() {
    isRemarksModalOpen.value = false;
    activeRemarksArticle.value = null;
    document.body.classList.remove('modal-open');
}

function openManuscriptFromRemarks(article) {
    closeRemarksModal();
    openManuscriptModal(article);
}

// Resubmit directly from table row
async function handleTableResubmit(article) {
    if (isSubmitting.value) return;

    // Direct table row has not been edited yet
    showToast('You cannot submit an article returned for revision without editing the article body. Please revise the manuscript before submitting.', 'error');
    openManuscriptModal(article);
}

// Resubmit revised article from manuscript modal
async function handleManuscriptSubmit() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = dashHeadlineRef.value ? dashHeadlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none')
        ? dashExcerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = dashBodyRef.value ? dashBodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = sanitizeRichArticleHtml(rawBody);

    if (!isArticleBodyModified(activeManuscript.value.content, newContent)) {
        showToast('You cannot submit an article returned for revision without editing the article body. Please revise the manuscript before submitting.', 'error');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Submit Article',
        message: `Are you sure you want to submit the revised manuscript for "${newTitle || activeManuscript.value.title}"?`,
        confirmText: 'Submit',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const payload = {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        };
        const res = await resubmitArticle(activeManuscript.value.id, payload);
        pendingArticles.value = pendingArticles.value.filter(a => String(a.id) !== String(activeManuscript.value.id));
        metrics.value.pending = Math.max(0, (metrics.value.pending || 1) - 1);
        closeManuscriptModal();
        showToast(res.message || 'Article resubmitted successfully for review.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to submit revised article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Decoupled DOM Refs for Flawless Native In-Place Editing (Letters, Words & Spaces)
const dashHeadlineRef = ref(null);
const dashExcerptRef = ref(null);
const dashBodyRef = ref(null);



function openManuscriptModal(article) {
    activeManuscript.value = { ...article };
    revisionRemarks.value = '';
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
    revisionRemarks.value = '';
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
    revisionRemarks.value = '';
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

    const confirmed = await confirmAction({
        title: 'Approve Article',
        message: `Are you sure you want to approve "${article.title}" and forward it to the Editor-in-Chief?`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

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
    const newContent = sanitizeRichArticleHtml(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (dashHeadlineRef.value) dashHeadlineRef.value.focus();
        return;
    }

    const confirmed = await confirmAction({
        title: 'Save Manuscript Changes',
        message: 'Are you sure you want to save the changes made to this manuscript?',
        confirmText: 'Save Changes',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

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

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this article to the author with revision remarks?',
        confirmText: 'Return for Revision',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

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
    const newContent = sanitizeRichArticleHtml(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (dashHeadlineRef.value) dashHeadlineRef.value.focus();
        return;
    }

    const confirmed = await confirmAction({
        title: 'Approve & Forward to EIC',
        message: 'Are you sure you want to approve this article and forward it to the Editor-in-Chief?',
        confirmText: 'Approve Article',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

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

const openActionMenuId = ref(null);
function toggleActionMenu(id) {
    openActionMenuId.value = openActionMenuId.value === id ? null : id;
}
function closeActionMenu() {
    openActionMenuId.value = null;
}

onMounted(() => {
    loadDashboard(true);
    if (typeof document !== 'undefined') {
        document.addEventListener('click', closeActionMenu);
    }
});

onUnmounted(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener('click', closeActionMenu);
    }
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container">
            <!-- Page Title Section (Exact match to executive/dashboard.blade.php) -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 id="page-title-heading" class="page-title">
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
                                <h2 id="pending-approval-heading" class="panel-title">
                                    Pending Approval
                                </h2>
                                <span
                                    class="panel-count-badge"
                                    :title="`Total ${metrics.pending ?? pendingArticles.length} pending articles across this section`"
                                >
                                    {{ formatNumber(metrics.pending ?? pendingArticles.length) }}
                                </span>
                            </div>
                            <router-link to="/section-head/review-articles" class="panel-action-link">View all &rarr;</router-link>
                        </div>

                        <PendingApprovalTable
                            :articles="topPendingArticles"
                            :is-loading="isLoading"
                            :is-submitting="isSubmitting"
                            :default-category="sectionCategory"
                            empty-text="No pending submissions for this section."
                            @open-manuscript="openManuscriptModal"
                            @approve="handleQuickApprove"
                            @revision="openRevisionModal"
                            @resubmit="handleTableResubmit"
                            @remarks="openRemarksModal"
                        />
                    </section>

                    <!-- Activity Log Section (Synced with ActivityLogs.vue & Blade executive-activity-logs format) -->
                    <section class="card-panel animate-fade-in delay-3" aria-labelledby="activity-log-heading">
                        <div class="panel-header">
                            <h2 id="activity-log-heading" class="panel-title">
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
                                                <em>
                                                    "{{ getStatement(act).subjectName }}"
                                                </em>
                                            </template>
                                            <span v-if="getStatement(act).afterSubject" :style="{ marginLeft: getStatement(act).subjectName ? '0px' : '4px' }">
                                                {{ getStatement(act).afterSubject }}
                                            </span>
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
                                <h4>No activity logs recorded</h4>
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
                            <h2 id="most-viewed-heading" class="panel-title">
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
                                    <div class="ranked-category-tag">{{ formatCategoryDisplay(art.category || sectionCategory) }}</div>
                                    <button
                                        type="button"
                                        class="ranked-title-btn"
                                        :title="art.title"
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
                            <h2 id="top-journalists-heading" class="panel-title">
                                Top Journalists
                            </h2>
                            <span class="panel-badge">Leaderboard</span>
                        </div>
                        <div class="journalists-table-wrap">
                            <table class="journalists-table">
                                <thead>
                                    <tr>
                                        <th class="col-author text-left" style="text-align: left !important;">Author</th>
                                        <th class="col-article-count text-center" style="text-align: center !important;">Articles</th>
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
                    <h1 id="viewer-title" class="viewer-title">
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
                        @keydown="onDashHeadlineKeydown"
                    ></h2>

                    <div class="manuscript-byline-banner">
                        <div class="manuscript-byline-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By <strong id="modal-writer">{{ activeManuscript.author }}</strong></span>
                        </div>
                    </div>

                    <!-- Revision Remarks Container (Standard Writer Parity) -->
                    <div
                        v-if="activeManuscript.remarks"
                        id="modal-viewing-remarks"
                        class="viewer-remarks-container"
                        style="margin-bottom: 20px; padding: 12px 16px; background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 4px;"
                    >
                        <h4 style="margin: 0 0 4px; font-size: 0.85rem; font-weight: 700; color: #9f1239;">Revision Remarks:</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: #4c0519; line-height: 1.55; white-space: pre-wrap;">{{ activeManuscript.remarks }}</p>
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

                <!-- Modal Footer -->
                <div class="manuscript-footer">
                    <template v-if="isRevisionStatus(activeManuscript.status)">
                        <button
                            type="button"
                            id="modal-save-btn"
                            class="btn-box-save"
                            :disabled="isSubmitting"
                            @click="handleSaveChanges"
                            title="Save manuscript draft"
                        >
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Save</span>
                        </button>

                        <button
                            type="button"
                            id="modal-submit-revision-btn"
                            class="btn-box-approve btn-approve-maroon"
                            :disabled="isSubmitting"
                            @click="handleManuscriptSubmit"
                            title="Submit revised article"
                        >
                            <i class="fa-solid fa-paper-plane"></i>
                            <span>Submit</span>
                        </button>
                    </template>
                    <template v-else>
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
                    </template>
                </div>
            </div>
        </div>

        <!-- Remarks Modal -->
        <div
            v-if="isRemarksModalOpen && activeRemarksArticle"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeRemarksModal"
        >
            <div class="modal-card" style="max-width: 520px; width: 92%; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eaecf0; background: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment-dots" style="color: #5c0a18; font-size: 1.1rem;"></i>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #101828; ">
                            Revision Remarks
                        </h3>
                    </div>
                    <button type="button" class="viewer-close-btn" @click="closeRemarksModal" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px; background: #ffffff;">
                    <div style="margin-bottom: 14px;">
                        <h4 style="margin: 0 0 4px; font-size: 0.95rem; font-weight: 600; color: #101828; ">
                            {{ activeRemarksArticle.title }}
                        </h4>
                        <div style="font-size: 0.8rem; color: #475467;">
                            By <strong>{{ activeRemarksArticle.author || 'Author' }}</strong> &bull; {{ activeRemarksArticle.category || 'General' }}
                        </div>
                    </div>
                    <div style="padding: 14px 16px; background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 6px;">
                        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9f1239; margin-bottom: 6px;">
                            Feedback / Instructions:
                        </div>
                        <p style="margin: 0; font-size: 0.9rem; color: #4c0519; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
                            {{ activeRemarksArticle.remarks || 'No specific remarks were entered.' }}
                        </p>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eaecf0; background: #fcfcfd;">
                    <button
                        type="button"
                        class="btn-secondary"
                        @click="closeRemarksModal"
                        style="padding: 7px 16px; border-radius: 6px; border: 1px solid #d0d5dd; background: #fff; color: #344054; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        class="btn-primary"
                        @click="openManuscriptFromRemarks(activeRemarksArticle)"
                        style="padding: 7px 16px; border-radius: 6px; border: 1px solid #5c0a18; background: #5c0a18; color: #fff; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit Manuscript</span>
                    </button>
                </div>
            </div>
        </div>
    </SectionHeadLayout>
</template>
