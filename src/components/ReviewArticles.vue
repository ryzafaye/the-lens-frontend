<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EicLayout from '../layouts/EicLayout.vue';
import ExecutiveLayout from '../layouts/ExecutiveLayout.vue';
import SectionHeadLayout from '../layouts/SectionHeadLayout.vue';
import {
    getSectionHeadReviewArticles,
    updateSectionHeadReviewArticle,
    approveSectionHeadArticle,
    returnSectionHeadArticleForRevision,
    getEicReviewArticles,
    updateEicReviewArticle,
    approveEicArticle,
    returnEicArticleForRevision,
    getExecutiveReviewArticles,
    updateExecutiveReviewArticle,
    approveExecutiveArticle,
    returnExecutiveArticleForRevision,
} from '../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing, sanitizeRichArticleHtml } from '../utils/articleContent.js';
import { currentUser, useAuthStore } from '../stores/auth.js';
import { confirmAction, showToast as globalShowToast } from '../utils/modal.js';
import '../assets/css/executive-review-articles.css';
import '../assets/css/shared-manage-my-articles.css';

const props = defineProps({
    role: {
        type: String,
        default: '', // 'section-head' | 'eic' | 'executive'
    },
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Detect active role
const activeRole = computed(() => {
    if (props.role) return props.role.toLowerCase();
    const path = route.path.toLowerCase();
    if (path.includes('/section-head')) return 'section-head';
    if (path.includes('/eic')) return 'eic';
    if (path.includes('/executive')) return 'executive';
    const storeRole = (authStore.user?.role?.name || '').toLowerCase();
    if (storeRole.includes('editor') || storeRole.includes('eic')) return 'eic';
    if (storeRole.includes('head')) return 'section-head';
    if (storeRole.includes('exec')) return 'executive';
    return 'section-head';
});

// Dynamic Layout Selection
const CurrentLayout = computed(() => {
    switch (activeRole.value) {
        case 'eic':
            return EicLayout;
        case 'executive':
            return ExecutiveLayout;
        case 'section-head':
        default:
            return SectionHeadLayout;
    }
});

// Executive Access Control: Only President, Vice President, Executive Vice President
const isExecutive = computed(() => activeRole.value === 'executive');
const isPresOrVp = computed(() => {
    if (!isExecutive.value) return true;
    const userRole = (authStore.user?.role?.name || localStorage.getItem('userRole') || '').toLowerCase();
    return (
        userRole.includes('president') ||
        userRole.includes('vice president') ||
        userRole.includes('vp') ||
        userRole.includes('executive vice president')
    );
});

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const pendingArticles = ref([]);
const revisionArticles = ref([]);
const currentSort = ref('newest');
const userAssignedCategory = ref(null);
const fadingBoxId = ref(null);

// Section Head Tab: 'desk' or 'revision'
const activeTab = ref('desk');

// EIC & Executive Category Tab: 'all' or specific category
const activeCategoryTab = ref('all');

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Manuscript Modal State
const isModalOpen = ref(false);
const activeManuscript = ref(null);
const revisionRemarks = ref('');
const showRemarksSection = ref(false);
const remarksError = ref('');

// Remarks Modal State (Exact Writer Role Parity)
const isRemarksModalOpen = ref(false);
const remarksArticle = ref(null);

function openRemarksModal(art, event) {
    if (event) event.stopPropagation();
    remarksArticle.value = art;
    isRemarksModalOpen.value = true;
}

function closeRemarksModal() {
    isRemarksModalOpen.value = false;
    remarksArticle.value = null;
}

function editFromRemarks() {
    const art = remarksArticle.value;
    closeRemarksModal();
    if (art) {
        openManuscriptModal(art);
    }
}

// In-Place Editing DOM Refs
const headlineRef = ref(null);
const excerptRef = ref(null);
const bodyRef = ref(null);

// Helper to check category matching
function matchesCategory(itemCat, targetCat) {
    if (!itemCat || !targetCat) return true;
    const cat = itemCat.toLowerCase().trim();
    const target = targetCat.toLowerCase().trim();
    if (target === 'all') return true;
    if (target === 'news') return cat.includes('news');
    if (target === 'opinions' || target === 'opinion') return cat.includes('opinion');
    if (target === 'features' || target === 'feature') return cat.includes('feature');
    if (target.includes('sci') || target.includes('tech')) return cat.includes('sci') || cat.includes('tech');
    if (target.includes('lit')) return cat.includes('lit');
    return cat === target;
}

// Resolve user's section from stored role (for Section Head)
function resolveSectionFromRole() {
    const role = (authStore.user?.role?.name || localStorage.getItem('userRole') || localStorage.getItem('sectionHeadRole') || '').toLowerCase();
    if (role.includes('news')) return 'News';
    if (role.includes('feature')) return 'Feature';
    if (role.includes('sci') || role.includes('tech')) return 'Science & Technology';
    if (role.includes('lit')) return 'Literature';
    return null;
}

// Category Short Name (Section Head Tab Label)
const categoryShortName = computed(() => {
    const raw = userAssignedCategory.value || resolveSectionFromRole() || '';
    const lower = raw.toLowerCase();
    if (lower.includes('sci') || lower.includes('tech')) return 'Sci-Tech';
    if (lower.includes('news')) return 'News';
    if (lower.includes('feature')) return 'Feature';
    if (lower.includes('lit')) return 'Literary';
    return raw || 'Section';
});

// Category definition for EIC and Executive tabs
const availableCategories = [
    { key: 'News', label: 'News', icon: 'fa-solid fa-newspaper' },
    { key: 'Opinions', label: 'Opinions', icon: 'fa-solid fa-comment-dots' },
    { key: 'Features', label: 'Features', icon: 'fa-solid fa-feather' },
    { key: 'Science and Technology', label: 'Sci-Tech', icon: 'fa-solid fa-flask' },
    { key: 'Literature', label: 'Literature', icon: 'fa-solid fa-book-open' },
];

// Live counts per category for EIC and Executive tabs
const categoryCounts = computed(() => {
    const list = pendingArticles.value;
    const counts = { all: list.length };
    availableCategories.forEach(cat => {
        counts[cat.key] = list.filter(item => matchesCategory(item.category, cat.key)).length;
    });
    return counts;
});

// Filtered articles list
const filteredArticles = computed(() => {
    let list = [...pendingArticles.value];

    if (activeRole.value === 'section-head') {
        // Exclude Opinion (Opinion routes directly to EIC)
        list = list.filter(item => {
            const cat = (item.category || '').toLowerCase();
            return !cat.includes('opinion');
        });

        // Strictly confine to section head's section
        const targetSection = userAssignedCategory.value || resolveSectionFromRole();
        if (targetSection) {
            list = list.filter(item => matchesCategory(item.category, targetSection));
        }
    } else {
        // EIC / Executive Category Tab Filter
        if (activeCategoryTab.value !== 'all') {
            list = list.filter(item => matchesCategory(item.category, activeCategoryTab.value));
        }

        // EIC safeguard: Never show user's own articles in EIC review queue
        if (activeRole.value === 'eic') {
            const currentUserId = authStore.user?.id || currentUser.id;
            if (currentUserId) {
                list = list.filter(item => String(item.user_id || item.userId || '') !== String(currentUserId));
            }
        }
    }

    if (currentSort.value === 'oldest') {
        list.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
    } else {
        list.sort((a, b) => new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date));
    }

    return list;
});

// Filtered revision articles list (Section Head)
const filteredRevisionArticles = computed(() => {
    let list = [...revisionArticles.value];

    if (activeRole.value === 'section-head') {
        list = list.filter(item => {
            const cat = (item.category || '').toLowerCase();
            return !cat.includes('opinion');
        });

        const targetSection = userAssignedCategory.value || resolveSectionFromRole();
        if (targetSection) {
            list = list.filter(item => matchesCategory(item.category, targetSection));
        }
    }

    if (currentSort.value === 'oldest') {
        list.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
    } else {
        list.sort((a, b) => new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date));
    }

    return list;
});

// Empty Queue description text
const emptyQueueDescription = computed(() => {
    if (activeRole.value === 'section-head') {
        return activeTab.value === 'desk'
            ? `No pending submissions for the ${categoryShortName.value} section.`
            : `There are currently no manuscripts under revision in the ${categoryShortName.value} section.`;
    }
    return activeCategoryTab.value === 'all'
        ? 'All caught up. No articles currently pending editorial review.'
        : `No pending submissions in the ${activeCategoryTab.value} category.`;
});

// Open Manuscript Modal
function openManuscriptModal(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = false;
    remarksError.value = '';
    revisionRemarks.value = '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) headlineRef.value.innerText = article.title || '';
        if (excerptRef.value) {
            if (article.excerpt && article.excerpt.trim()) {
                excerptRef.value.innerText = article.excerpt.trim();
                excerptRef.value.style.display = 'block';
            } else {
                excerptRef.value.innerText = '';
                excerptRef.value.style.display = 'none';
            }
        }
        if (bodyRef.value) {
            bodyRef.value.innerHTML = formatCleanArticleContent(article.content || article.excerpt);
        }
    });
}

// Open Revision Drawer Directly
function openRevisionDirectly(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = true;
    remarksError.value = '';
    revisionRemarks.value = '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) headlineRef.value.innerText = article.title || '';
        if (excerptRef.value) {
            if (article.excerpt && article.excerpt.trim()) {
                excerptRef.value.innerText = article.excerpt.trim();
                excerptRef.value.style.display = 'block';
            } else {
                excerptRef.value.innerText = '';
                excerptRef.value.style.display = 'none';
            }
        }
        if (bodyRef.value) {
            bodyRef.value.innerHTML = formatCleanArticleContent(article.content || article.excerpt);
        }
        nextTick(() => {
            const bodyEl = document.querySelector('.manuscript-body');
            const remarksSection = document.getElementById('manuscript-remarks-section');
            if (bodyEl && remarksSection) {
                bodyEl.scrollTo({ top: remarksSection.offsetTop - 30, behavior: 'smooth' });
            }
            const textarea = document.getElementById('modal-remarks');
            if (textarea) {
                textarea.focus();
                textarea.classList.add('pulse-focus');
                setTimeout(() => textarea.classList.remove('pulse-focus'), 1200);
            }
        });
    });
}

function onHeadlineKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (excerptRef.value && excerptRef.value.style.display !== 'none') {
            excerptRef.value.focus();
        } else if (bodyRef.value) {
            bodyRef.value.focus();
        }
    }
}

function closeManuscriptModal() {
    isModalOpen.value = false;
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
            const bodyEl = document.querySelector('.manuscript-body');
            const remarksSection = document.getElementById('manuscript-remarks-section');
            if (bodyEl && remarksSection) {
                bodyEl.scrollTo({ top: remarksSection.offsetTop - 30, behavior: 'smooth' });
            }
            const textarea = document.getElementById('modal-remarks');
            if (textarea) {
                textarea.focus();
                textarea.classList.add('pulse-focus');
                setTimeout(() => textarea.classList.remove('pulse-focus'), 1200);
            }
        });
    }
}

// Quick Approve directly from card
async function handleQuickApprove(article) {
    if (isSubmitting.value) return;

    if (activeRole.value === 'eic') {
        const authorId = article?.user_id || article?.userId;
        const currentUserId = authStore.user?.id || currentUser.id;
        if (authorId && currentUserId && String(authorId) === String(currentUserId)) {
            showToast('Unauthorized: You cannot review or approve your own manuscript.', 'warning');
            return;
        }
    }

    if (activeRole.value === 'section-head') {
        const targetSection = userAssignedCategory.value || resolveSectionFromRole();
        if (targetSection && !matchesCategory(article.category, targetSection)) {
            showToast(`Unauthorized: You can only approve ${targetSection} articles.`, 'warning');
            return;
        }
    }

    const actionPrompt = activeRole.value === 'section-head'
        ? `Are you sure you want to approve "${article.title}" and forward it to the Editor-in-Chief?`
        : `Are you sure you want to approve "${article.title}"?`;

    const confirmed = await confirmAction({
        title: 'Approve Article',
        message: actionPrompt,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    fadingBoxId.value = article.id;

    try {
        switch (activeRole.value) {
            case 'eic':
                await approveEicArticle(article.id);
                break;
            case 'executive':
                await approveExecutiveArticle(article.id);
                break;
            case 'section-head':
            default:
                await approveSectionHeadArticle(article.id);
                break;
        }

        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);
            revisionArticles.value = revisionArticles.value.filter(a => a.id !== article.id);
            fadingBoxId.value = null;
            const successMsg = activeRole.value === 'section-head'
                ? 'Article approved and forwarded to Editor-in-Chief (EIC).'
                : 'Article approved and published successfully.';
            showToast(successMsg, 'success');
        }, 220);
    } catch (err) {
        fadingBoxId.value = null;
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Save Changes in Modal
async function handleSaveChanges() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = headlineRef.value ? headlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (excerptRef.value && excerptRef.value.style.display !== 'none')
        ? excerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = sanitizeRichArticleHtml(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (headlineRef.value) headlineRef.value.focus();
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

        let res = null;
        switch (activeRole.value) {
            case 'eic':
                res = await updateEicReviewArticle(activeManuscript.value.id, payload);
                break;
            case 'executive':
                res = await updateExecutiveReviewArticle(activeManuscript.value.id, payload);
                break;
            case 'section-head':
            default:
                res = await updateSectionHeadReviewArticle(activeManuscript.value.id, payload);
                break;
        }

        const idx = pendingArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].title = payload.title;
            pendingArticles.value[idx].excerpt = payload.excerpt;
            pendingArticles.value[idx].content = payload.content;
        }

        const revIdx = revisionArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (revIdx !== -1) {
            revisionArticles.value[revIdx].title = payload.title;
            revisionArticles.value[revIdx].excerpt = payload.excerpt;
            revisionArticles.value[revIdx].content = payload.content;
        }

        activeManuscript.value.title = payload.title;
        activeManuscript.value.excerpt = payload.excerpt;
        activeManuscript.value.content = payload.content;

        showToast(res?.message || 'Article changes saved successfully.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to save changes.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Approve from Modal
async function handleApproveFromModal() {
    if (!activeManuscript.value || isSubmitting.value) return;

    if (activeRole.value === 'eic') {
        const authorId = activeManuscript.value?.user_id || activeManuscript.value?.userId;
        const currentUserId = authStore.user?.id || currentUser.id;
        if (authorId && currentUserId && String(authorId) === String(currentUserId)) {
            showToast('Unauthorized: You cannot review or approve your own manuscript.', 'warning');
            return;
        }
    }

    if (activeRole.value === 'section-head') {
        const targetSection = userAssignedCategory.value || resolveSectionFromRole();
        if (targetSection && !matchesCategory(activeManuscript.value.category, targetSection)) {
            showToast(`Unauthorized: You can only approve ${targetSection} articles.`, 'warning');
            return;
        }
    }

    const newTitle = headlineRef.value ? headlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (excerptRef.value && excerptRef.value.style.display !== 'none')
        ? excerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = sanitizeRichArticleHtml(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (headlineRef.value) headlineRef.value.focus();
        return;
    }

    const actionPrompt = activeRole.value === 'section-head'
        ? 'Are you sure you want to approve this article and forward it to the Editor-in-Chief?'
        : 'Are you sure you want to approve this article?';

    const confirmed = await confirmAction({
        title: 'Approve Article',
        message: actionPrompt,
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

        switch (activeRole.value) {
            case 'eic':
                await updateEicReviewArticle(activeManuscript.value.id, payload);
                await approveEicArticle(activeManuscript.value.id);
                break;
            case 'executive':
                await updateExecutiveReviewArticle(activeManuscript.value.id, payload);
                await approveExecutiveArticle(activeManuscript.value.id);
                break;
            case 'section-head':
            default:
                await updateSectionHeadReviewArticle(activeManuscript.value.id, payload);
                await approveSectionHeadArticle(activeManuscript.value.id);
                break;
        }

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== activeManuscript.value.id);
        revisionArticles.value = revisionArticles.value.filter(a => a.id !== activeManuscript.value.id);
        closeManuscriptModal();
        const successMsg = activeRole.value === 'section-head'
            ? 'Article approved and forwarded to Editor-in-Chief (EIC).'
            : 'Article approved and published successfully.';
        showToast(successMsg, 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Submit Revision Remarks from Modal
async function handleSubmitRevision() {
    if (!activeManuscript.value || isSubmitting.value) return;

    if (!showRemarksSection.value) {
        showRemarksSection.value = true;
        remarksError.value = '';
        nextTick(() => {
            const textarea = document.getElementById('modal-remarks');
            if (textarea) textarea.focus();
        });
        return;
    }

    if (!revisionRemarks.value.trim()) {
        remarksError.value = 'Revision remarks are required. You cannot return for revision without remarks.';
        nextTick(() => {
            const textarea = document.getElementById('modal-remarks');
            if (textarea) textarea.focus();
        });
        return;
    }

    if (activeRole.value === 'eic') {
        const authorId = activeManuscript.value?.user_id || activeManuscript.value?.userId;
        const currentUserId = authStore.user?.id || currentUser.id;
        if (authorId && currentUserId && String(authorId) === String(currentUserId)) {
            showToast('Unauthorized: You cannot return your own manuscript for revision.', 'warning');
            return;
        }
    }

    if (activeRole.value === 'section-head') {
        const targetSection = userAssignedCategory.value || resolveSectionFromRole();
        if (targetSection && !matchesCategory(activeManuscript.value.category, targetSection)) {
            showToast(`Unauthorized: You can only review ${targetSection} articles.`, 'warning');
            return;
        }
    }

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this article with revision remarks?',
        confirmText: 'Return for Revision',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    remarksError.value = '';

    try {
        let res = null;
        switch (activeRole.value) {
            case 'eic':
                res = await returnEicArticleForRevision(activeManuscript.value.id, revisionRemarks.value.trim());
                break;
            case 'executive':
                res = await returnExecutiveArticleForRevision(activeManuscript.value.id, revisionRemarks.value.trim());
                break;
            case 'section-head':
            default:
                res = await returnSectionHeadArticleForRevision(activeManuscript.value.id, revisionRemarks.value.trim());
                break;
        }

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== activeManuscript.value.id);
        const existingRevIdx = revisionArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        const updatedArticle = {
            ...activeManuscript.value,
            status: 'For Revision',
            remarks: revisionRemarks.value.trim(),
        };
        if (existingRevIdx !== -1) {
            revisionArticles.value[existingRevIdx] = updatedArticle;
        } else {
            revisionArticles.value.unshift(updatedArticle);
        }

        closeManuscriptModal();
        const returnMsg = activeRole.value === 'eic' || activeRole.value === 'executive'
            ? 'Article returned for revision.'
            : 'Article returned to author with revision remarks.';
        showToast(res?.message || returnMsg, 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Failed to return article for revision.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Load queue from backend
async function loadReviewQueue(forceFresh = false) {
    isLoading.value = true;
    try {
        const params = {
            sort: currentSort.value,
        };

        let data = null;
        switch (activeRole.value) {
            case 'eic':
                data = await getEicReviewArticles(params, forceFresh);
                break;
            case 'executive':
                data = await getExecutiveReviewArticles(params, forceFresh);
                break;
            case 'section-head':
            default:
                data = await getSectionHeadReviewArticles(params, forceFresh);
                break;
        }

        if (Array.isArray(data)) {
            pendingArticles.value = data;
        } else if (data) {
            if (data.pendingArticles && Array.isArray(data.pendingArticles)) {
                pendingArticles.value = data.pendingArticles;
            } else if (Array.isArray(data.articles)) {
                pendingArticles.value = data.articles;
            }
            if (data.revisionArticles && Array.isArray(data.revisionArticles)) {
                revisionArticles.value = data.revisionArticles;
            }
            if (data.category) {
                userAssignedCategory.value = data.category;
            }
        }

        if (route.query.id) {
            const match = [...pendingArticles.value, ...revisionArticles.value].find(a => String(a.id) === String(route.query.id));
            if (match) {
                if (revisionArticles.value.some(a => String(a.id) === String(match.id))) {
                    activeTab.value = 'revision';
                }
                openManuscriptModal(match);
            }
        }
    } catch (err) {
        console.error(`Failed to load ${activeRole.value} review queue:`, err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    if (activeRole.value === 'section-head') {
        userAssignedCategory.value = resolveSectionFromRole();
    }
    loadReviewQueue();
});
</script>

<template>
    <component :is="CurrentLayout">
        <main class="content-container review-articles-page">

            <!-- Restricted View for Non-Pres/VP Executives -->
            <div v-if="isExecutive && !isPresOrVp" class="card-panel" style="text-align: center; padding: 48px 24px; max-width: 680px; margin: 40px auto; border-radius: 12px; background: #ffffff;">
                <div style="width: 54px; height: 54px; border-radius: 50%; background: #fef3f2; color: #b42318; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.4rem;">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 1.5rem; font-weight: 700; color: #101828; margin: 0 0 10px;">
                    Restricted Review Access
                </h2>
                <p style="font-size: 0.95rem; color: #667085; line-height: 1.6; margin: 0 0 24px;">
                    Editorial manuscript review is reserved for the Executive President and Vice Presidents. Executive officers may review publication performance and transparent operations on the Executive Dashboard.
                </p>
                <router-link to="/executive/dashboard" class="btn-primary-action" style="display: inline-flex; text-decoration: none; margin: 0 auto;">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Back to Dashboard</span>
                </router-link>
            </div>

            <template v-else>
                <!-- Top Section: Header with Title and Sort Control -->
                <div class="page-title-section" style="margin-bottom: 4px !important;">
                    <div class="page-header-row">
                        <h1 class="page-title">Review Articles</h1>

                        <div class="review-sort-container">
                            <label for="review-sort-select" class="review-sort-label">
                                <i class="fa-solid fa-arrow-down-wide-short"></i>
                                <span>Sort:</span>
                            </label>
                            <div class="sort-select-wrapper">
                                <select
                                    id="review-sort-select"
                                    v-model="currentSort"
                                    @change="loadReviewQueue(false)"
                                    class="review-sort-select"
                                    aria-label="Sort pending articles by date"
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                </select>
                                <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabs Navbar (Section Head Standard Format) -->
                <div class="manage-tabs-container animate-fade-in delay-2" style="margin-top: 0 !important; margin-bottom: 20px !important;" role="tablist" aria-label="Review Article Tabs">
                    <!-- Section Head: Desk & Revision Tabs -->
                    <template v-if="activeRole === 'section-head'">
                        <button
                            type="button"
                            class="manage-tab-btn"
                            :class="{ active: activeTab === 'desk' }"
                            @click="activeTab = 'desk'"
                            role="tab"
                            :aria-selected="activeTab === 'desk'"
                        >
                            <i class="fa-solid fa-inbox"></i>
                            <span>{{ categoryShortName }} Desk</span>
                            <span id="badge-count-desk" class="tab-count-badge">{{ filteredArticles.length }}</span>
                        </button>
                        <button
                            type="button"
                            class="manage-tab-btn"
                            :class="{ active: activeTab === 'revision' }"
                            @click="activeTab = 'revision'"
                            role="tab"
                            :aria-selected="activeTab === 'revision'"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>{{ categoryShortName }} Revision</span>
                            <span id="badge-count-revision" class="tab-count-badge">{{ filteredRevisionArticles.length }}</span>
                        </button>
                    </template>

                    <!-- EIC & Executive: Category Review Tabs -->
                    <template v-else>
                        <button
                            type="button"
                            class="manage-tab-btn"
                            :class="{ active: activeCategoryTab === 'all' }"
                            @click="activeCategoryTab = 'all'"
                            role="tab"
                            :aria-selected="activeCategoryTab === 'all'"
                        >
                            <i class="fa-solid fa-layer-group"></i>
                            <span>All Queue</span>
                            <span class="tab-count-badge">{{ categoryCounts.all }}</span>
                        </button>
                        <button
                            v-for="cat in availableCategories"
                            :key="cat.key"
                            type="button"
                            class="manage-tab-btn"
                            :class="{ active: activeCategoryTab === cat.key }"
                            @click="activeCategoryTab = cat.key"
                            role="tab"
                            :aria-selected="activeCategoryTab === cat.key"
                        >
                            <i :class="cat.icon"></i>
                            <span>{{ cat.label }}</span>
                            <span class="tab-count-badge">{{ categoryCounts[cat.key] || 0 }}</span>
                        </button>
                    </template>
                </div>

                <!-- Section Head Pending Queue OR EIC/Executive Category Queue -->
                <div
                    v-if="(activeRole !== 'section-head' || activeTab === 'desk') && filteredArticles.length > 0"
                    id="review-list-container"
                    class="review-list-container"
                >
                    <div
                        v-for="item in filteredArticles"
                        :key="item.id"
                        :id="'box-' + item.id"
                        class="review-box"
                        :class="{ 'box-fade-out': fadingBoxId === item.id }"
                    >
                        <!-- Left Stack: Meta Line, Bold Article Title, Author with Pen Nib Icon -->
                        <div class="review-box-content">
                            <div class="review-box-meta">
                                <span class="review-box-category">{{ item.category }}</span>
                                <span class="review-box-date">
                                    <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                                    {{ item.date }}
                                </span>
                            </div>

                            <button
                                type="button"
                                class="review-box-title"
                                style="font-family: 'Playfair Display', Georgia, serif !important;"
                                @click="openManuscriptModal(item)"
                                :title="item.title"
                            >
                                {{ item.title }}
                            </button>

                            <p class="review-box-author">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By <strong>{{ item.author }}</strong></span>
                            </p>
                        </div>

                        <!-- Right Actions: 3 small buttons in a row (Edit, For Revision, Approve) -->
                        <div class="review-box-actions">
                            <button
                                type="button"
                                class="btn-box-read btn-box-edit"
                                @click="openManuscriptModal(item)"
                                title="Edit writer's manuscript"
                            >
                                <i class="fa-solid fa-pen-to-square"></i>
                                <span>Edit</span>
                            </button>
                            <button
                                type="button"
                                class="btn-box-revision"
                                @click="openRevisionDirectly(item)"
                                title="Direct to revision remarks"
                            >
                                <i class="fa-solid fa-rotate-left"></i>
                                <span>For Revision</span>
                            </button>
                            <button
                                type="button"
                                class="btn-box-approve"
                                @click="handleQuickApprove(item)"
                                :title="activeRole === 'section-head' ? 'Approve manuscript and forward to Editor-in-Chief' : 'Approve and publish article'"
                            >
                                <i class="fa-solid fa-check"></i>
                                <span>{{ activeRole === 'section-head' ? 'Approve for EIC' : 'Approve Article' }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Empty Desk / Queue State -->
                <div
                    v-if="(activeRole !== 'section-head' || activeTab === 'desk') && !isLoading && filteredArticles.length === 0"
                    id="empty-queue-state"
                    class="review-empty-queue"
                >
                    <div class="empty-queue-icon-wrapper">
                        <i class="fa-solid fa-file-circle-check"></i>
                    </div>
                    <h3 class="empty-queue-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                        Review Queue is Clear
                    </h3>
                    <p class="empty-queue-description" style="text-align: center !important;">
                        {{ emptyQueueDescription }}
                    </p>
                    <div class="empty-queue-actions">
                        <button
                            type="button"
                            class="btn-empty-refresh btn-refresh-maroon"
                            @click="loadReviewQueue(true)"
                            :disabled="isLoading"
                            title="Check database for latest submissions"
                        >
                            <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
                            <span>Refresh Queue</span>
                        </button>
                    </div>
                </div>

                <!-- Section Head Revision List: Displays articles returned for revision -->
                <template v-if="activeRole === 'section-head' && activeTab === 'revision'">
                    <div v-if="filteredRevisionArticles.length > 0" id="revision-list-container" class="review-list-container">
                        <div
                            v-for="item in filteredRevisionArticles"
                            :key="item.id"
                            :id="'box-rev-' + item.id"
                            class="review-box"
                            :class="{ 'box-fade-out': fadingBoxId === item.id }"
                        >
                            <div class="review-box-content">
                                <div class="review-box-meta">
                                    <span class="review-box-category">{{ item.category }}</span>
                                    <span class="meta-dot">&bull;</span>
                                    <span
                                        class="btn-show-remarks"
                                        @click.stop="openRemarksModal(item, $event)"
                                        style="color: #700f2b; font-size: 0.74rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"
                                        title="View feedback"
                                    >
                                        <i class="fa-solid fa-comment-dots"></i> Feedback
                                    </span>
                                    <span class="meta-dot">&bull;</span>
                                    <span class="review-box-date">
                                        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                                        {{ item.date }}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    class="review-box-title"
                                    style="font-family: 'Playfair Display', Georgia, serif !important;"
                                    @click="openManuscriptModal(item)"
                                    :title="item.title"
                                >
                                    {{ item.title }}
                                </button>

                                <p class="review-box-author">
                                    <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                    <span>By <strong>{{ item.author }}</strong></span>
                                </p>
                            </div>

                            <div class="review-box-actions">
                                <button
                                    type="button"
                                    class="btn-box-read btn-box-edit"
                                    @click="openManuscriptModal(item)"
                                    title="Edit writer's manuscript"
                                >
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Edit</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-box-revision"
                                    @click="openRevisionDirectly(item)"
                                    title="Direct to revision remarks"
                                >
                                    <i class="fa-solid fa-rotate-left"></i>
                                    <span>For Revision</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-box-approve"
                                    @click="handleQuickApprove(item)"
                                    title="Approve revised manuscript and forward to Editor-in-Chief"
                                >
                                    <i class="fa-solid fa-check"></i>
                                    <span>Approve for EIC</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Category Revision Empty Message -->
                    <div
                        v-if="!isLoading && filteredRevisionArticles.length === 0"
                        id="revision-empty-state"
                        class="review-empty-queue animate-fade-in"
                    >
                        <div class="empty-queue-icon-wrapper">
                            <i class="fa-solid fa-rotate-left"></i>
                        </div>
                        <h3 class="empty-queue-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                            No Articles For Revision
                        </h3>
                        <p class="empty-queue-description">
                            There are currently no manuscripts under revision in the <strong>{{ categoryShortName }}</strong> section.
                        </p>
                        <div class="empty-queue-actions">
                            <button
                                type="button"
                                class="btn-empty-refresh btn-refresh-maroon"
                                @click="loadReviewQueue(true)"
                                :disabled="isLoading"
                                title="Check database for latest submissions"
                            >
                                <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
                                <span>Refresh Queue</span>
                            </button>
                        </div>
                    </div>
                </template>
            </template>
        </main>

        <!-- Minimalist Manuscript Reader Modal -->
        <div
            v-if="isModalOpen && activeManuscript"
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
                        <span id="modal-section" class="review-box-category">{{ activeManuscript.category }}</span>
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

                <!-- Modal Body: Direct In-Place Editable Manuscript -->
                <div class="manuscript-body">
                    <h2
                        ref="headlineRef"
                        id="modal-headline"
                        class="manuscript-headline"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                        @keydown="onHeadlineKeydown"
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

                    <!-- Story Excerpt (Standard Lead Style) -->
                    <p
                        ref="excerptRef"
                        id="modal-excerpt"
                        class="viewer-excerpt"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="display: none;"
                    ></p>

                    <!-- Clean In-Place Body Content -->
                    <div
                        ref="bodyRef"
                        id="modal-body"
                        class="manuscript-body-text article-body-streamlined"
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
                        <label for="modal-remarks" class="remarks-label">
                            <span class="remarks-label-text">
                                <i class="fa-solid fa-comment-dots"></i>
                                <span>{{ activeRole === 'section-head' ? 'Revision Remarks for Writer:' : 'Revision Remarks for Section Head:' }}</span>
                            </span>
                            <span class="required-badge">Required for Revision</span>
                        </label>
                        <textarea
                            id="modal-remarks"
                            v-model="revisionRemarks"
                            class="remarks-textarea"
                            :class="{ 'input-invalid': remarksError }"
                            :placeholder="activeRole === 'section-head' ? 'Enter mandatory revision feedback for the writer before returning this story...' : 'Enter mandatory revision feedback for the section head before returning this story...'"
                            rows="4"
                            @input="remarksError = ''"
                        ></textarea>
                        <div v-if="remarksError" id="remarks-error-msg" class="remarks-error-msg">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ remarksError }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer (Clean Standard Layout: Save Changes, Return for Revision, Approve for EIC) -->
                <div class="manuscript-footer">
                    <button
                        type="button"
                        id="modal-save-btn"
                        class="btn-box-save"
                        @click="handleSaveChanges"
                        :disabled="isSubmitting"
                        title="Save headline, excerpt, and body edits"
                    >
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>Save Changes</span>
                    </button>

                    <button
                        type="button"
                        id="modal-revision-btn"
                        class="btn-box-revision"
                        @click="showRemarksSection ? handleSubmitRevision() : toggleRevisionRemarks()"
                        :disabled="isSubmitting"
                        title="Return manuscript for revision"
                    >
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>{{ showRemarksSection ? 'Submit Revision' : 'Return for Revision' }}</span>
                    </button>

                    <button
                        type="button"
                        id="modal-approve-btn"
                        class="btn-box-approve"
                        @click="handleApproveFromModal"
                        :disabled="isSubmitting"
                        :title="activeRole === 'section-head' ? 'Approve manuscript and forward to EIC' : 'Approve and publish article'"
                    >
                        <i class="fa-solid fa-check"></i>
                        <span>{{ activeRole === 'section-head' ? 'Approve for EIC' : 'Approve Article' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Revision Remarks Modal (Exact Writer Role Parity) -->
        <div
            v-if="isRemarksModalOpen && remarksArticle"
            id="remarks-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remarks-modal-title"
            @click.self="closeRemarksModal"
        >
            <div class="modal-card remarks-modal-card" style="max-width: 560px; width: 100%; border-radius: 14px; background: #ffffff; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18); overflow: hidden;">
                <div class="remarks-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment-dots" style="color: #700f2b; font-size: 1.1rem;"></i>
                        <h2 id="remarks-modal-title" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #111827;">Revision Remarks</h2>
                    </div>
                    <button
                        type="button"
                        class="viewer-close-btn"
                        @click="closeRemarksModal"
                        aria-label="Close modal"
                        style="background: transparent !important; border: none !important; width: 32px !important; height: 32px !important; border-radius: 8px !important; color: #667085 !important; font-size: 1.1rem !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 0 0 auto !important; flex-shrink: 0 !important; transition: all 0.2s ease !important;"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="remarks-modal-body" style="padding: 24px;">
                    <p style="font-size: 1.05rem; font-weight: 700; color: #101828; margin: 0 0 14px 0; line-height: 1.4;">
                        {{ remarksArticle.title }}
                    </p>
                    <div class="remarks-content-box" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.85rem; color: #9f1239; margin-bottom: 6px;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>Feedback:</span>
                        </div>
                        <p style="margin: 0; color: #4c0519; font-size: 0.92rem; line-height: 1.55; white-space: pre-wrap;">
                            {{ remarksArticle.remarks || 'No remarks provided.' }}
                        </p>
                    </div>
                    <div class="remarks-modal-footer" style="margin-top: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
                        <button
                            type="button"
                            class="btn-cancel"
                            @click="closeRemarksModal"
                            style="height: 38px; padding: 0 16px; border: 1px solid #d0d5dd; background: #ffffff; color: #344054; border-radius: 8px; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            class="btn-primary-action btn-edit-revise-now"
                            style="height: 38px; padding: 0 18px; background-color: #700f2b !important; color: #ffffff !important; border: 1px solid #700f2b !important; border-radius: 8px; font-weight: 600; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.15s ease;"
                            @click="editFromRemarks"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Edit and Revise Now</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </component>
</template>

<style scoped>
/* Standard Excerpt / Lead Style (Identical across all viewer pages) */
.viewer-excerpt {
    font-size: 1.05rem !important;
    line-height: 1.65 !important;
    color: #475467 !important;
    font-weight: 500 !important;
    margin: 16px 0 22px 0 !important;
    font-style: italic !important;
    border-left: 3.5px solid #700f2b !important;
    padding: 10px 18px !important;
    background: #faf8f9 !important;
    border-radius: 0 8px 8px 0 !important;
    box-sizing: border-box !important;
}

.viewer-excerpt[contenteditable="true"] {
    cursor: text !important;
    transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
}

.viewer-excerpt[contenteditable="true"]:hover {
    background-color: #f7f1f3 !important;
}

.viewer-excerpt[contenteditable="true"]:focus {
    outline: none !important;
    background-color: #ffffff !important;
    box-shadow: 0 0 0 2px rgba(112, 15, 43, 0.18) !important;
}

/* ==========================================================================
   REVISION REMARKS CALLOUT (Revision Tab / Manuscript Modal)
   ========================================================================== */
.remarks-alert-box {
    margin: 18px 0 24px 0 !important;
    padding: 16px 18px !important;
    background-color: #fff1f2 !important;
    border: 1px solid #fecdd3 !important;
    border-left: 4px solid #700f2b !important;
    border-radius: 8px !important;
    box-shadow: 0 1px 3px rgba(112, 15, 43, 0.06) !important;
    box-sizing: border-box !important;
}

.remarks-alert-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 12px !important;
    margin-bottom: 10px !important;
    flex-wrap: wrap !important;
}

.remarks-alert-title {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
}

.remarks-alert-icon {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 26px !important;
    height: 26px !important;
    border-radius: 50% !important;
    background-color: rgba(112, 15, 43, 0.12) !important;
    color: #700f2b !important;
    font-size: 0.78rem !important;
    flex-shrink: 0 !important;
}

.remarks-alert-heading {
    font-size: 0.84rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    color: #700f2b !important;
    line-height: 1.2 !important;
}

.remarks-status-pill {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    padding: 3px 10px !important;
    background-color: #ffe4e6 !important;
    border: 1px solid #fecdd3 !important;
    border-radius: 9999px !important;
    color: #9f1239 !important;
    font-size: 0.70rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    line-height: 1.2 !important;
}

.remarks-alert-content {
    background-color: #ffffff !important;
    border: 1px solid #fecdd3 !important;
    border-radius: 6px !important;
    padding: 12px 16px !important;
    color: #374151 !important;
    font-size: 0.92rem !important;
    line-height: 1.6 !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
    box-shadow: inset 0 1px 2px rgba(112, 15, 43, 0.03) !important;
    font-family: inherit !important;
}

/* Mandatory Revision Remarks Section */
.manuscript-remarks-section {
    margin-top: 24px !important;
    padding-top: 18px !important;
    border-top: 1px solid #eaecf0 !important;
}

.remarks-label {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    font-size: 0.84rem !important;
    font-weight: 700 !important;
    color: #344054 !important;
    margin-bottom: 8px !important;
}

.remarks-label-text {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
}

.remarks-label-text i {
    color: #700f2b !important;
}

.required-badge {
    font-size: 0.68rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    color: #b42318 !important;
    background-color: #fef3f2 !important;
    border: 1px solid #fee4e2 !important;
    padding: 2px 7px !important;
    border-radius: 4px !important;
}

.remarks-textarea {
    width: 100% !important;
    min-height: 90px !important;
    padding: 12px 14px !important;
    border: 1.5px solid #d0d5dd !important;
    border-radius: 8px !important;
    font-family: inherit !important;
    font-size: 0.88rem !important;
    color: #101828 !important;
    background-color: #ffffff !important;
    resize: vertical !important;
    box-sizing: border-box !important;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
}

.remarks-textarea:focus {
    outline: none !important;
    border-color: #700f2b !important;
    box-shadow: 0 0 0 3px rgba(112, 15, 43, 0.12) !important;
}

.remarks-textarea.pulse-focus {
    border-color: #f59e0b !important;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.28) !important;
    animation: pulseBorder 0.9s ease-in-out !important;
}

@keyframes pulseBorder {
    0% { transform: scale(1); }
    50% { transform: scale(1.01); }
    100% { transform: scale(1); }
}

.remarks-textarea.input-invalid {
    border-color: #d92d20 !important;
    background-color: #fffbfa !important;
    box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.15) !important;
    animation: shakeError 0.3s ease !important;
}

@keyframes shakeError {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
}

.remarks-error-msg {
    margin-top: 6px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    color: #d92d20 !important;
}

/* Modal Footer & Button Spacing */
.manuscript-footer {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    padding: 16px 24px !important;
    background-color: #fafbfc !important;
    border-top: 1px solid #eaecf0 !important;
    gap: 12px !important;
    flex-wrap: wrap !important;
}

.manuscript-footer .btn-box-save,
.manuscript-footer .btn-box-revision,
.manuscript-footer .btn-box-approve {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 7px !important;
    height: 38px !important;
    padding: 0 16px !important;
    border-radius: 8px !important;
    font-size: 0.88rem !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
    transition: all 0.18s ease !important;
    margin: 0 !important;
}

.manuscript-footer .btn-box-save {
    background: #700f2b !important;
    color: #ffffff !important;
    border: 1px solid #700f2b !important;
}

.manuscript-footer .btn-box-save:hover {
    background: #580c22 !important;
    border-color: #580c22 !important;
    transform: translateY(-1px) !important;
}

.manuscript-footer .btn-box-revision {
    background-color: #ffffff !important;
    border: 1.5px solid #d97706 !important;
    color: #d97706 !important;
}

.manuscript-footer .btn-box-revision:hover {
    background-color: #fffbeb !important;
    border-color: #b45309 !important;
    color: #b45309 !important;
    transform: translateY(-1px) !important;
}

.manuscript-footer .btn-box-approve {
    background: #700f2b !important;
    color: #ffffff !important;
    border: 1px solid #700f2b !important;
}

.manuscript-footer .btn-box-approve:hover {
    background: #580c22 !important;
    border-color: #580c22 !important;
    transform: translateY(-1px) !important;
}

.manuscript-footer .btn-box-save:disabled,
.manuscript-footer .btn-box-revision:disabled,
.manuscript-footer .btn-box-approve:disabled {
    opacity: 0.6 !important;
    cursor: not-allowed !important;
    transform: none !important;
}

.btn-edit-revise-now {
    background-color: #700f2b !important;
    border-color: #700f2b !important;
    color: #ffffff !important;
    transition: background-color 0.18s ease, transform 0.12s ease !important;
}

.btn-edit-revise-now:hover {
    background-color: #580c22 !important;
    border-color: #580c22 !important;
    color: #ffffff !important;
}

.meta-dot {
    color: #d0d5dd !important;
    font-size: 0.75rem !important;
    margin: 0 2px !important;
}
</style>
