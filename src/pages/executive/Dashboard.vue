<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveDashboard,
    updateExecutiveReviewArticle,
    approveExecutiveArticle,
    returnExecutiveArticleForRevision,
    resubmitArticle,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing, isRevisionStatus, isArticleBodyModified } from '../../utils/articleContent.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import {
    formatActivityStatement,
    formatPhilippineDateTime,
    formatPhilippineRelativeTime,
} from '../../utils/activityGrammar.js';
import { currentUser } from '../../stores/auth.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-review-articles.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/executive-transparency.css';
import '../../assets/css/writer-dashboard.css';

const router = useRouter();
const user = currentUser;

// Role detection
const currentRoleName = computed(() => {
    return user?.role?.role_name || user?.role?.name || user?.role || localStorage.getItem('userRole') || localStorage.getItem('execRole') || '';
});

const isPresOrVp = computed(() => {
    const norm = String(currentRoleName.value).toLowerCase().trim();
    return norm.includes('president') || norm.includes('vp');
});

const isTreasurerOrAuditor = computed(() => {
    const norm = String(currentRoleName.value).toLowerCase().trim();
    return norm === 'treasurer' || norm === 'auditor';
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
const myRecentArticles = ref([]);
const financialRecords = ref([]);
const publishedArticles = ref([]);
const recentActivities = ref([]);
const topJournalists = ref([]);

// Financial records upload modal state for Treasurer & Auditor
const showUploadModal = ref(false);
const showRecordPreview = ref(false);
const activeRecord = ref(null);
const uploadTitle = ref('');
const selectedFile = ref(null);
const fileInputRef = ref(null);
const isDragging = ref(false);
const isUploading = ref(false);
const uploadError = ref('');

const myPendingCount = computed(() => {
    return myRecentArticles.value.filter(a => String(a.status || '').toLowerCase().includes('pending')).length;
});

const displayedPendingArticles = computed(() => {
    return (pendingArticles.value || []).slice(0, 5);
});

const top3PublishedArticles = computed(() => {
    const list = [...(publishedArticles.value || [])];
    return list.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 3);
});

const currentMonthName = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
});

function showToast(message, type = 'success') {
    globalShowToast(message, type);
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

function resolveCoverUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    return `/storage/${trimmed.replace(/^\/+/, '')}`;
}

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
            if (Array.isArray(data.myRecentArticles)) {
                myRecentArticles.value = data.myRecentArticles;
            }
            if (Array.isArray(data.financialRecords)) {
                financialRecords.value = data.financialRecords;
            } else if (isTreasurerOrAuditor.value && financialRecords.value.length === 0) {
                financialRecords.value = [
                    {
                        id: 'rec-1',
                        title: 'FY 2026-2027 1st Semester Financial Statement & Audit',
                        file_name: 'financial_statement_1st_sem_2026.pdf',
                        file_url: 'https://res.cloudinary.com/the-lens/raw/upload/v1/fin/financial_statement_1st_sem_2026.pdf',
                        resource_type: 'raw',
                        uploader: { name: 'Auditor User', role: 'Auditor' },
                        formatted_date: 'Nov 18, 2026 10:30 AM',
                    },
                    {
                        id: 'rec-2',
                        title: 'Editorial Office Supplies & Equipment Liquidation Report',
                        file_name: 'liquidation_supplies_q1.xlsx',
                        file_url: 'https://res.cloudinary.com/the-lens/raw/upload/v1/fin/liquidation_supplies_q1.xlsx',
                        resource_type: 'raw',
                        uploader: { name: 'Treasurer Officer', role: 'Treasurer' },
                        formatted_date: 'Nov 12, 2026 02:15 PM',
                    },
                    {
                        id: 'rec-3',
                        title: 'Print Issue No. 1 Press & Publishing Official Receipt',
                        file_name: 'receipt_printing_issue_1.png',
                        file_url: 'https://res.cloudinary.com/the-lens/image/upload/v1/fin/receipt_printing_issue_1.png',
                        resource_type: 'image',
                        uploader: { name: 'Treasurer Officer', role: 'Treasurer' },
                        formatted_date: 'Oct 30, 2026 09:40 AM',
                    },
                ];
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
    openManuscriptModal(article, false);
}

// Resubmit directly from table row
async function handleTableResubmit(article) {
    if (isSubmitting.value) return;

    showToast('You cannot submit an article returned for revision without editing the article body. Please revise the manuscript before submitting.', 'error');
    openManuscriptModal(article, false);
}

// Resubmit revised article from manuscript modal
async function handleManuscriptSubmit() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = dashHeadlineRef.value ? dashHeadlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none')
        ? dashExcerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = dashBodyRef.value ? dashBodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

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
            if (activeManuscript.value.excerpt && activeManuscript.value.excerpt.trim()) {
                dashExcerptRef.value.innerText = activeManuscript.value.excerpt.trim();
                dashExcerptRef.value.style.display = 'block';
            } else {
                dashExcerptRef.value.innerText = '';
                dashExcerptRef.value.style.display = 'none';
            }
        }
        if (dashBodyRef.value) {
            dashBodyRef.value.innerHTML = formatCleanArticleContent(activeManuscript.value.content || activeManuscript.value.excerpt || '<p>No content available.</p>');
        }
        if (openWithRevision) {
            nextTick(() => {
                const textarea = document.getElementById('dash-modal-remarks');
                if (textarea) {
                    textarea.focus();
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    });
}

// Open Manuscript Modal directly focused on Revision Remarks
function openRevisionModal(article) {
    openManuscriptModal(article, true);
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

    const confirmed = await confirmAction({
        title: 'Approve Article',
        message: 'Are you sure you want to approve this article and forward it to M&PC?',
        confirmText: 'Approve',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const payload = {};
        if (isManuscriptModalOpen.value) {
            if (dashHeadlineRef.value) {
                payload.title = dashHeadlineRef.value.innerText.trim();
            }
            if (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none') {
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
        toggleRevisionRemarks();
        return;
    }

    const remarks = revisionRemarks.value.trim();
    if (!remarks) {
        remarksError.value = 'Please provide revision remarks for the author.';
        nextTick(() => {
            const textarea = document.getElementById('dash-modal-remarks');
            if (textarea) textarea.focus();
        });
        return;
    }

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this article for revision with the remarks?',
        confirmText: 'Return for Revision',
        type: 'warning',
    });
    if (!confirmed) return;

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

    const confirmed = await confirmAction({
        title: 'Save Edits',
        message: 'Are you sure you want to save your manuscript edits?',
        confirmText: 'Save Edits',
    });
    if (!confirmed) return;

    const title = dashHeadlineRef.value?.innerText.trim() || activeManuscript.value.title;
    const excerpt = (dashExcerptRef.value && dashExcerptRef.value.style.display !== 'none')
        ? dashExcerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
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

// Financial Record Helpers for Treasurer & Auditor
function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const b = parseInt(bytes, 10);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getFileCategory(filename, resourceType) {
    const ext = getFileExtension(filename);
    if (ext === 'pdf') return 'pdf';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'sheet';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || resourceType === 'image') return 'image';
    return 'raw';
}

function getFileIconClass(category) {
    if (category === 'pdf') return 'fa-solid fa-file-pdf';
    if (category === 'sheet') return 'fa-solid fa-file-excel';
    if (category === 'image') return 'fa-solid fa-file-image';
    return 'fa-solid fa-file-lines';
}

function openRecordPreview(record) {
    activeRecord.value = record;
    showRecordPreview.value = true;
    document.body.classList.add('modal-open');
}

function closeRecordPreview() {
    showRecordPreview.value = false;
    activeRecord.value = null;
    document.body.classList.remove('modal-open');
}

function openUploadModal() {
    uploadTitle.value = '';
    selectedFile.value = null;
    uploadError.value = '';
    showUploadModal.value = true;
    document.body.classList.add('modal-open');
}

function closeUploadModal() {
    showUploadModal.value = false;
    uploadTitle.value = '';
    selectedFile.value = null;
    uploadError.value = '';
    document.body.classList.remove('modal-open');
}

function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
}

function handleDrop(e) {
    isDragging.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) processSelectedFile(file);
}

function processSelectedFile(file) {
    uploadError.value = '';
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        uploadError.value = 'File size exceeds maximum limit of 25MB.';
        return;
    }
    selectedFile.value = file;
    if (!uploadTitle.value) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        uploadTitle.value = nameWithoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}

function removeSelectedFile() {
    selectedFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
}

async function submitUpload() {
    if (!uploadTitle.value.trim()) {
        uploadError.value = 'Please provide a descriptive title for this financial record.';
        return;
    }
    if (!selectedFile.value) {
        uploadError.value = 'Please select a document or file to upload.';
        return;
    }

    const confirmed = await confirmAction({
        title: 'Upload Financial Record',
        message: 'Are you sure you want to upload and record this financial document?',
        confirmText: 'Save & Record',
    });
    if (!confirmed) return;

    isUploading.value = true;
    uploadError.value = '';
    try {
        const file = selectedFile.value;
        const ext = getFileExtension(file.name);
        const isImg = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
        const newRecord = {
            id: `rec-${Date.now()}`,
            title: uploadTitle.value.trim(),
            file_name: file.name,
            file_url: URL.createObjectURL(file),
            public_id: `the-lens/financial_records/${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
            resource_type: isImg ? 'image' : 'raw',
            file_size: file.size,
            uploader: {
                name: user?.name || user?.full_name || 'Auditor User',
                role: currentRoleName.value || 'Auditor',
            },
            formatted_date: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            created_at: new Date().toISOString()
        };
        financialRecords.value.unshift(newRecord);
        closeUploadModal();
        showToast(`Financial record "${newRecord.title}" successfully recorded.`, 'success');
    } catch (err) {
        console.error('Upload error:', err);
        uploadError.value = 'Failed to upload financial record. Please try again.';
    } finally {
        isUploading.value = false;
    }
}

// Article Helpers for Other Executive Roles / Writers
function getBadgeClass(status) {
    if (!status) return 'status-draft';
    const s = String(status).toLowerCase();
    if (s.includes('publish') || s.includes('approve')) return 'status-published';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    return 'status-draft';
}

function editMyArticle(articleId, event) {
    if (event) event.stopPropagation();
    router.push({ path: '/executive/submit-article', query: { draft_id: articleId } });
}

onMounted(() => {
    loadDashboardData();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Page Title Section -->
            <div class="page-title-section animate-fade-in delay-1">
                <h1 class="page-title">Dashboard</h1>
            </div>

            <!-- Metrics Row (4 Cards in One Single Line on Desktop) -->
            <section id="metrics-grid" class="metrics-grid metrics-grid-4" aria-label="Operational metrics">
                <div class="metric-card animate-fade-in delay-1">
                    <div class="metric-header">
                        <span class="metric-label">
                            <template v-if="isPresOrVp">Pending Approvals</template>
                            <template v-else-if="isTreasurerOrAuditor">Financial Records</template>
                            <template v-else>Pending Articles</template>
                        </span>
                        <div class="metric-icon-box">
                            <i v-if="isTreasurerOrAuditor" class="fa-solid fa-file-invoice-dollar"></i>
                            <i v-else class="fa-regular fa-clock"></i>
                        </div>
                    </div>
                    <div class="metric-value">
                        <template v-if="isPresOrVp">{{ metrics.pending }}</template>
                        <template v-else-if="isTreasurerOrAuditor">{{ financialRecords.length || metrics.financial_records_count || 0 }}</template>
                        <template v-else>{{ myPendingCount || metrics.pending || 0 }}</template>
                    </div>
                    <div class="metric-subtitle">
                        <template v-if="isPresOrVp">Awaiting executive review</template>
                        <template v-else-if="isTreasurerOrAuditor">Official transparency repository</template>
                        <template v-else>Awaiting editorial review</template>
                    </div>
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
                    <!-- CASE A: President / VP ONLY -> Pending Approval Table -->
                    <section v-if="isPresOrVp" class="card-panel animate-fade-in delay-2" aria-labelledby="pending-approval-heading">
                        <div class="panel-header">
                            <div class="panel-title-group">
                                <h2 id="pending-approval-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Pending Approval</h2>
                                <span class="panel-count-badge" :title="`Total ${metrics.pending ?? pendingArticles.length} pending submissions across section`">{{ formatNumber(metrics.pending ?? pendingArticles.length) }}</span>
                            </div>
                            <router-link
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
                                        <th class="col-title" style="text-align: left !important;">Article Title</th>
                                        <th class="col-category" style="text-align: center !important;">Category</th>
                                        <th class="col-date" style="text-align: center !important;">Date</th>
                                        <th class="col-actions text-center" style="text-align: center !important;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="art in displayedPendingArticles" :key="art.id">
                                        <td class="col-title">
                                            <div class="table-article-info" style="display: flex !important; flex-direction: column !important; align-items: flex-start !important; text-align: left !important; width: 100% !important;">
                                                <button
                                                    type="button"
                                                    class="table-article-btn"
                                                    :title="art.title"
                                                    style="font-family: 'Playfair Display', Georgia, serif !important; text-align: left !important; display: block !important; width: 100% !important; padding: 0 !important; margin: 0 0 3px 0 !important; white-space: normal !important; word-break: break-word !important; overflow-wrap: break-word !important;"
                                                    @click="openManuscriptModal(art, false)"
                                                >
                                                    {{ art.title }}
                                                </button>
                                                <div class="table-author-subline" style="display: inline-flex !important; align-items: center !important; justify-content: flex-start !important; gap: 5px !important; text-align: left !important;">
                                                    <i class="fa-solid fa-pen-nib"></i>
                                                    <span>By <strong>{{ art.author || 'Author' }}</strong></span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="col-category">
                                            <span class="table-section-tag" :title="art.category">{{ art.category || 'General' }}</span>
                                        </td>
                                        <td class="col-date">
                                            <span class="table-date">{{ art.date }}</span>
                                        </td>
                                        <td class="col-actions text-right">
                                            <div class="table-actions-group" style="display: inline-flex !important; align-items: center !important; justify-content: flex-end !important; gap: 3px !important; flex-wrap: wrap !important;">
                                                <template v-if="isRevisionStatus(art.status)">
                                                    <span class="badge-revision-pill" title="For Revision" style="display: inline-flex; align-items: center; justify-content: center; background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: 4px 6px; border-radius: 4px; font-size: 0.74rem; line-height: 1;">
                                                        <i class="fa-solid fa-rotate-left"></i>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-remarks"
                                                        title="View Revision Remarks"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="openRemarksModal(art)"
                                                    >
                                                        <i class="fa-solid fa-comment-dots"></i>
                                                        <span>Remarks</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-edit"
                                                        title="Edit Article"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="openManuscriptModal(art, false)"
                                                    >
                                                        <i class="fa-solid fa-pen-to-square"></i>
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-submit"
                                                        title="Submit Revised Article"
                                                        :disabled="isSubmitting"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="handleTableResubmit(art)"
                                                    >
                                                        <i class="fa-solid fa-paper-plane"></i>
                                                        <span>Submit</span>
                                                    </button>
                                                </template>
                                                <template v-else>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-edit"
                                                        title="Edit Article"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="openManuscriptModal(art, false)"
                                                    >
                                                        <i class="fa-solid fa-pen-to-square"></i>
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-revision"
                                                        title="Return for Revision"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="openRevisionModal(art)"
                                                    >
                                                        <i class="fa-solid fa-rotate-left"></i>
                                                        <span>Revision</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn-table-action btn-table-approve"
                                                        title="Approve Article"
                                                        :disabled="isSubmitting"
                                                        style="padding: 3px 6px !important; font-size: 0.69rem !important; height: 25px !important; white-space: nowrap !important; flex-shrink: 0 !important;"
                                                        @click="handleApprove(art.id)"
                                                    >
                                                        <i class="fa-solid fa-check"></i>
                                                        <span>Approve</span>
                                                    </button>
                                                </template>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="!isLoading && pendingArticles.length === 0">
                                        <td colspan="4" class="empty-state-cell" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0; border-bottom: none; pointer-events: none; background: transparent;">
                                            No pending submissions yet.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <!-- CASE B: Treasurer & Auditor -> Financial Transparency Table + Upload Shortcut -->
                    <template v-else-if="isTreasurerOrAuditor">
                        <section class="card-panel animate-fade-in delay-2" aria-labelledby="transparency-table-heading">
                            <div class="panel-header">
                                <div class="panel-title-group">
                                    <h2 id="transparency-table-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Financial Transparency</h2>
                                    <span class="panel-count-badge" title="Total financial records">{{ financialRecords.length }}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button
                                        type="button"
                                        class="btn-panel-upload"
                                        style="background: linear-gradient(135deg, #700f2b 0%, #5c0a18 100%) !important; background-color: #700f2b !important; color: #ffffff !important; border: 1px solid #5c0a18 !important;"
                                        @click="openUploadModal"
                                        title="Upload new financial record"
                                    >
                                        <i class="fa-solid fa-cloud-arrow-up"></i>
                                        <span>Upload Record</span>
                                    </button>
                                    <router-link
                                        to="/executive/transparency"
                                        class="panel-action-link"
                                    >
                                        View all &rarr;
                                    </router-link>
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="data-table transparency-table" style="width: 100% !important; min-width: 520px !important; table-layout: fixed !important;">
                                    <thead>
                                        <tr>
                                            <th class="col-record-title text-left" style="width: 42% !important; text-align: left !important;">Document Title</th>
                                            <th class="col-type text-center" style="width: 14% !important; text-align: center !important;">Type</th>
                                            <th class="col-uploader text-center" style="width: 24% !important; text-align: center !important;">Uploaded By</th>
                                            <th class="col-date text-center" style="width: 20% !important; text-align: center !important;">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="rec in financialRecords" :key="rec.id">
                                            <td class="col-record-title">
                                                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; width: 100%;">
                                                    <i :class="getFileIconClass(getFileCategory(rec.file_name, rec.resource_type))" style="color: var(--sidebar-maroon, #700f2b); font-size: 0.95rem; flex-shrink: 0;"></i>
                                                    <button
                                                        type="button"
                                                        class="table-article-btn"
                                                        :title="rec.title"
                                                        style="font-family: 'Playfair Display', Georgia, serif !important; text-align: left !important; font-size: 0.85rem !important; padding: 0 !important; margin: 0 !important; color: #101828 !important; border: none; background: none; cursor: pointer; text-decoration: none; white-space: normal !important; word-break: break-word !important; overflow-wrap: break-word !important; flex: 1; min-width: 0;"
                                                        @click="openRecordPreview(rec)"
                                                    >
                                                        {{ rec.title }}
                                                    </button>
                                                </div>
                                            </td>
                                            <td class="col-type">
                                                <span
                                                    class="doc-type-tag"
                                                    :class="{
                                                        'tag-pdf': getFileCategory(rec.file_name, rec.resource_type) === 'pdf',
                                                        'tag-sheet': getFileCategory(rec.file_name, rec.resource_type) === 'sheet',
                                                        'tag-image': getFileCategory(rec.file_name, rec.resource_type) === 'image'
                                                    }"
                                                >
                                                    {{ getFileCategory(rec.file_name, rec.resource_type).toUpperCase() }}
                                                </span>
                                            </td>
                                            <td class="col-uploader">
                                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                                                    <span style="font-size: 0.82rem; font-weight: 600; color: #101828;">{{ rec.uploader?.name || 'Officer' }}</span>
                                                    <span class="uploader-role-badge">{{ rec.uploader?.role || 'Auditor' }}</span>
                                                </div>
                                            </td>
                                            <td class="col-date text-right" style="text-align: right !important;">
                                                <div class="table-actions-group" style="display: inline-flex !important; align-items: center !important; justify-content: flex-end !important; gap: 4px !important;">
                                                    <button
                                                        type="button"
                                                        class="btn-table-action"
                                                        title="Preview document"
                                                        style="padding: 4px 8px !important; font-size: 0.72rem !important; height: 26px !important; background: #f2f4f7; color: #344054; border: 1px solid #eaecf0; border-radius: 5px; cursor: pointer;"
                                                        @click="openRecordPreview(rec)"
                                                    >
                                                        <i class="fa-regular fa-eye"></i>
                                                    </button>
                                                    <a
                                                        :href="rec.file_url"
                                                        :download="rec.file_name"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="btn-table-action"
                                                        title="Download file"
                                                        style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px !important; font-size: 0.72rem !important; height: 26px !important; background: #fdf2f4; color: var(--sidebar-maroon, #700f2b); border: 1px solid #f9d8de; border-radius: 5px; text-decoration: none;"
                                                    >
                                                        <i class="fa-solid fa-download"></i>
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr v-if="!isLoading && financialRecords.length === 0">
                                            <td colspan="4" class="empty-state-cell" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0; border-bottom: none; pointer-events: none; background: transparent;">
                                                No financial records uploaded yet. Click "Upload Record" above to add one.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <!-- My Recent Articles for Treasurer / Auditor -->
                        <section class="card-panel animate-fade-in delay-2" aria-labelledby="my-articles-heading">
                            <div class="panel-header">
                                <div class="panel-title-group">
                                    <h2 id="my-articles-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">My Recent Articles</h2>
                                    <span class="panel-count-badge" title="Total articles submitted">{{ myRecentArticles.length }}</span>
                                </div>
                                <router-link
                                    to="/executive/manage-my-articles"
                                    class="panel-action-link"
                                >
                                    View all &rarr;
                                </router-link>
                            </div>

                            <div class="writer-articles-list" style="margin-bottom: 0;">
                                <article
                                    v-for="art in myRecentArticles"
                                    :key="art.id"
                                    class="writer-article-card cursor-pointer"
                                    @click="openArticleViewer(art)"
                                >
                                    <div class="article-card-header">
                                        <div class="article-card-meta">
                                            <span class="article-card-category">{{ art.category }}</span>
                                            <span class="meta-dot">&bull;</span>
                                            <span class="article-card-date">
                                                <i class="fa-regular fa-calendar"></i> {{ art.date }}
                                            </span>
                                        </div>
                                        <div class="article-card-status-top">
                                            <span class="status-badge" :class="getBadgeClass(art.status)">{{ art.status }}</span>
                                        </div>
                                    </div>

                                    <div class="article-card-body">
                                        <div class="article-card-body-content">
                                            <h3 class="article-card-title">{{ art.title }}</h3>
                                            <p v-if="art.excerpt" class="article-card-excerpt">{{ art.excerpt }}</p>
                                        </div>

                                        <div v-if="art.canEdit" class="article-card-actions">
                                            <button
                                                type="button"
                                                class="btn-box-edit"
                                                title="Edit article"
                                                @click.stop="editMyArticle(art.id, $event)"
                                            >
                                                <i class="fa-solid fa-pen-to-square"></i>
                                                <span>Edit</span>
                                            </button>
                                        </div>
                                    </div>
                                </article>

                                <div v-if="!isLoading && myRecentArticles.length === 0" class="activity-empty-state-mini" style="padding: 24px 0;">
                                    <i class="fa-regular fa-folder-open"></i>
                                    <h4 style="font-family: 'Playfair Display', Georgia, serif !important;">No articles yet</h4>
                                    <p>Articles you author and submit will appear here with their review status.</p>
                                </div>
                            </div>
                        </section>
                    </template>

                    <!-- CASE C: Other Executive Roles (Secretary, PRO, etc.) -> My Recent Articles (just like writer role) -->
                    <template v-else>
                        <section class="card-panel animate-fade-in delay-2" aria-labelledby="my-articles-heading">
                            <div class="panel-header">
                                <div class="panel-title-group">
                                    <h2 id="my-articles-heading" class="panel-title" style="font-family: 'Playfair Display', Georgia, serif !important;">My Recent Articles</h2>
                                    <span class="panel-count-badge" title="Total articles submitted">{{ myRecentArticles.length }}</span>
                                </div>
                                <router-link
                                    to="/executive/manage-my-articles"
                                    class="panel-action-link"
                                >
                                    View all &rarr;
                                </router-link>
                            </div>

                            <div class="writer-articles-list" style="margin-bottom: 0;">
                                <article
                                    v-for="art in myRecentArticles"
                                    :key="art.id"
                                    class="writer-article-card cursor-pointer"
                                    @click="openArticleViewer(art)"
                                >
                                    <div class="article-card-header">
                                        <div class="article-card-meta">
                                            <span class="article-card-category">{{ art.category }}</span>
                                            <span class="meta-dot">&bull;</span>
                                            <span class="article-card-date">
                                                <i class="fa-regular fa-calendar"></i> {{ art.date }}
                                            </span>
                                        </div>
                                        <div class="article-card-status-top">
                                            <span class="status-badge" :class="getBadgeClass(art.status)">{{ art.status }}</span>
                                        </div>
                                    </div>

                                    <div class="article-card-body">
                                        <div class="article-card-body-content">
                                            <h3 class="article-card-title">{{ art.title }}</h3>
                                            <p v-if="art.excerpt" class="article-card-excerpt">{{ art.excerpt }}</p>
                                        </div>

                                        <div v-if="art.canEdit" class="article-card-actions">
                                            <button
                                                type="button"
                                                class="btn-box-edit"
                                                title="Edit article"
                                                @click.stop="editMyArticle(art.id, $event)"
                                            >
                                                <i class="fa-solid fa-pen-to-square"></i>
                                                <span>Edit</span>
                                            </button>
                                        </div>
                                    </div>
                                </article>

                                <div v-if="!isLoading && myRecentArticles.length === 0" class="activity-empty-state-mini" style="padding: 24px 0;">
                                    <i class="fa-regular fa-folder-open"></i>
                                    <h4 style="font-family: 'Playfair Display', Georgia, serif !important;">No articles yet</h4>
                                    <p>Articles you author and submit will appear here with their review status.</p>
                                </div>
                            </div>
                        </section>
                    </template>

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
                            <table class="data-table journalists-table" style="width: 100% !important; table-layout: fixed !important;">
                                <thead>
                                    <tr>
                                        <th class="col-author text-left" style="width: 58% !important; text-align: left !important; white-space: normal !important; word-break: break-word !important;">Author</th>
                                        <th class="col-article-count text-center" style="width: 42% !important; min-width: 80px !important; text-align: center !important; white-space: normal !important; word-break: break-word !important; line-height: 1.2 !important;">Article Count</th>
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
        <!-- MODAL 1: Clean Article Viewer Modal (Standard System-wide Parity)     -->
        <!-- ====================================================================== -->
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
                            <img
                                :src="resolveAvatarUrl(activeArticle.author_avatar || activeArticle.authorAvatar || activeArticle.avatar)"
                                :alt="(activeArticle.author || 'Author') + ' avatar'"
                                loading="lazy"
                            >
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author || 'Staff Writer' }}</strong></span>
                        </div>
                    </div>

                    <p v-if="activeArticle.excerpt" id="viewer-excerpt" class="viewer-excerpt">
                        {{ activeArticle.excerpt }}
                    </p>

                    <div v-if="activeArticle.image" id="viewer-banner-wrap" class="viewer-banner">
                        <img id="viewer-banner-img" :src="resolveCoverUrl(activeArticle.image)" :alt="activeArticle.title" loading="lazy">
                    </div>

                    <div id="viewer-content" class="viewer-content-text" v-html="sanitizeContent(activeArticle.content, activeArticle.excerpt)"></div>

                    <div v-if="activeArticle.views !== undefined" class="viewer-stats-bar">
                        <span class="stat-pill"><i class="fa-regular fa-eye"></i> <span>{{ formatNumber(activeArticle.views) }} views</span></span>
                        <span v-if="activeArticle.shares !== undefined" class="stat-pill"><i class="fa-solid fa-share-nodes"></i> <span>{{ formatNumber(activeArticle.shares) }} shares</span></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: In-place Manuscript Review / Edit Modal                       -->
        <!-- ====================================================================== -->
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
                <!-- Header -->
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
                            aria-label="Close manuscript reader" 
                            @click="closeManuscriptModal"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Body -->
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
                            <i class="fa-solid fa-pen-nib"></i>
                            <span>By <strong id="modal-writer">{{ activeManuscript.author || 'Author' }}</strong></span>
                        </div>
                    </div>

                    <!-- Revision Remarks Container (if story has prior remarks) -->
                    <div
                        v-if="activeManuscript.remarks"
                        id="modal-viewing-remarks"
                        class="viewer-remarks-container"
                        style="margin-bottom: 20px; padding: 12px 16px; background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 6px;"
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

                    <!-- Mandatory Revision Remarks Box (Standard Design) -->
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
                    <template v-if="isRevisionStatus(activeManuscript.status)">
                        <button
                            type="button"
                            id="modal-save-btn"
                            class="btn-box-save"
                            :disabled="isSubmitting"
                            @click="handleSaveManuscriptChanges"
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
                            @click="handleSaveManuscriptChanges"
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
                            @click="showRemarksSection ? handleReturnForRevision() : toggleRevisionRemarks()"
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
                            @click="handleApprove(null)"
                            title="Approve manuscript and forward to Media &amp; Publication Committee"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Approve for M&amp;PC</span>
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
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #101828; font-family: 'Playfair Display', Georgia, serif;">
                            Revision Remarks
                        </h3>
                    </div>
                    <button type="button" class="viewer-close-btn" @click="closeRemarksModal" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px; background: #ffffff;">
                    <div style="margin-bottom: 14px;">
                        <h4 style="margin: 0 0 4px; font-size: 0.95rem; font-weight: 600; color: #101828; font-family: 'Playfair Display', Georgia, serif;">
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

        <!-- ====================================================================== -->
        <!-- MODAL 3: Upload Financial Record Modal (Treasurer & Auditor)           -->
        <!-- ====================================================================== -->
        <div v-if="showUploadModal" class="modal-overlay" @click.self="closeUploadModal">
            <div class="modal-card upload-modal-card">
                <div class="upload-modal-header">
                    <h3 class="upload-modal-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Upload Financial Record</h3>
                    <button type="button" class="viewer-close-btn" @click="closeUploadModal" aria-label="Close modal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="upload-modal-body">
                    <div v-if="uploadError" class="login-feedback error" style="margin-bottom: 16px; padding: 10px 14px; background: #fef3f2; border: 1px solid #fee4e2; border-radius: 8px; color: #b42318; font-size: 0.84rem;">
                        <i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i>
                        {{ uploadError }}
                    </div>

                    <div class="form-field-group">
                        <label class="field-label" for="dash-record-title-input">
                            Record Title <span class="required-dot">*</span>
                        </label>
                        <input 
                            id="dash-record-title-input"
                            v-model="uploadTitle" 
                            type="text" 
                            class="field-input" 
                            placeholder="e.g. FY 2026-2027 1st Sem Liquidation Report" 
                            maxlength="255"
                        />
                    </div>

                    <div class="form-field-group">
                        <label class="field-label">
                            Financial Document / Receipt <span class="required-dot">*</span>
                        </label>

                        <div 
                            v-if="!selectedFile"
                            class="file-dropzone" 
                            :class="{ 'drag-active': isDragging }"
                            @dragover.prevent="isDragging = true"
                            @dragleave.prevent="isDragging = false"
                            @drop.prevent="handleDrop"
                            @click="fileInputRef && fileInputRef.click()"
                        >
                            <input 
                                ref="fileInputRef"
                                type="file" 
                                class="hidden-file-input" 
                                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
                                @change="handleFileInput"
                            />
                            <div class="dropzone-icon-circle">
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                            </div>
                            <div class="dropzone-prompt">
                                <strong>Click to choose file</strong> or drag &amp; drop here
                            </div>
                            <div class="dropzone-hint">
                                Supports PDF, Excel (.xlsx, .xls), CSV, or Images (JPG, PNG) up to 25MB
                            </div>
                        </div>

                        <div v-else class="selected-file-card">
                            <div class="selected-file-left">
                                <div 
                                    class="doc-icon-badge"
                                    :class="{
                                        'doc-icon-pdf': getFileCategory(selectedFile.name) === 'pdf',
                                        'doc-icon-sheet': getFileCategory(selectedFile.name) === 'sheet',
                                        'doc-icon-image': getFileCategory(selectedFile.name) === 'image',
                                        'doc-icon-raw': getFileCategory(selectedFile.name) === 'raw'
                                    }"
                                >
                                    <i :class="getFileIconClass(getFileCategory(selectedFile.name))"></i>
                                </div>
                                <div class="selected-file-details">
                                    <span class="selected-file-name">{{ selectedFile.name }}</span>
                                    <span class="selected-file-size">{{ formatBytes(selectedFile.size) }}</span>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                class="btn-remove-selected-file" 
                                title="Remove file"
                                @click="removeSelectedFile"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <button type="button" class="btn-secondary-white" @click="closeUploadModal" :disabled="isUploading">
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-upload-record"
                        style="background: linear-gradient(135deg, #700f2b 0%, #5c0a18 100%) !important; background-color: #700f2b !important; color: #ffffff !important; border: 1px solid #5c0a18 !important;"
                        @click="submitUpload"
                        :disabled="isUploading"
                    >
                        <i v-if="isUploading" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-check"></i>
                        <span>{{ isUploading ? 'Uploading...' : 'Save & Record' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 4: Document Preview Modal (Treasurer & Auditor)                  -->
        <!-- ====================================================================== -->
        <div v-if="showRecordPreview && activeRecord" class="modal-overlay" @click.self="closeRecordPreview">
            <div class="modal-card preview-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span class="viewer-category-tag">
                            {{ getFileCategory(activeRecord.file_name, activeRecord.resource_type).toUpperCase() }}
                        </span>
                        <span class="viewer-dot">•</span>
                        <span class="viewer-date">{{ activeRecord.formatted_date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <a 
                            :href="activeRecord.file_url" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="btn-secondary-white" 
                            style="padding: 6px 12px; font-size: 0.82rem;"
                        >
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            <span>Open in New Tab</span>
                        </a>
                        <button type="button" class="viewer-close-btn" @click="closeRecordPreview" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="preview-modal-body">
                    <div class="preview-info-strip">
                        <h2 class="preview-title" style="font-family: 'Playfair Display', Georgia, serif !important;">{{ activeRecord.title }}</h2>
                        <div class="preview-uploader-subline">
                            <span>Uploaded by <strong>{{ activeRecord.uploader?.name || 'Officer' }}</strong></span>
                            <span class="uploader-role-badge">{{ activeRecord.uploader?.role || 'Auditor' }}</span>
                        </div>
                    </div>

                    <div class="preview-content-area">
                        <div v-if="getFileCategory(activeRecord.file_name, activeRecord.resource_type) === 'image'" class="image-preview-wrapper">
                            <img :src="activeRecord.file_url" :alt="activeRecord.title" class="preview-image" />
                        </div>
                        <div v-else-if="getFileCategory(activeRecord.file_name, activeRecord.resource_type) === 'pdf'" class="pdf-preview-wrapper">
                            <iframe :src="activeRecord.file_url" class="pdf-iframe" title="PDF Document Viewer"></iframe>
                        </div>
                        <div v-else class="generic-file-preview">
                            <div class="generic-icon-box">
                                <i :class="getFileIconClass(getFileCategory(activeRecord.file_name, activeRecord.resource_type))"></i>
                            </div>
                            <h3>{{ activeRecord.file_name }}</h3>
                            <p>Direct browser preview is not supported for this file type. Please download or open it with your local software.</p>
                            <a :href="activeRecord.file_url" :download="activeRecord.file_name" class="btn-upload-record" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-download"></i>
                                <span>Download Document</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
</template>
