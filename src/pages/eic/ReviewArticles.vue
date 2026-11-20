<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicReviewArticles,
    updateEicReviewArticle,
    approveEicArticle,
    returnEicArticleForRevision,
    clearApiCache,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import '../../assets/css/executive-review-articles.css';

const route = useRoute();

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const pendingArticles = ref([]);
const categoryHeads = ref({});
const currentSort = ref('newest'); // 'newest' | 'oldest'
const selectedCategory = ref('all');
const fadingBoxId = ref(null);

// Toast notification (Exact Blade match with .toast-container and .toast-message)
const toast = ref({
    show: false,
    dismissing: false,
    message: '',
    type: 'success', // 'success' | 'warning' | 'danger'
});
let toastTimer = null;
let toastDismissTimer = null;

function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    if (toastDismissTimer) clearTimeout(toastDismissTimer);

    toast.value = { show: true, dismissing: false, message, type };

    toastTimer = setTimeout(() => {
        toast.value.dismissing = true;
        toastDismissTimer = setTimeout(() => {
            toast.value.show = false;
            toast.value.dismissing = false;
        }, 260);
    }, 3200);
}

// Modal State
const isModalOpen = ref(false);
const activeManuscript = ref(null);
const revisionRemarks = ref('');
const showRemarksSection = ref(false);
const remarksError = ref('');

// In-place editable refs
const modalBodyRef = ref(null);
const headlineRef = ref(null);
const excerptRef = ref(null);
const bodyRef = ref(null);
const remarksTextareaRef = ref(null);

// Category filtering helper matching Blade logic
function matchesCategory(itemCat, targetCat) {
    if (!itemCat || !targetCat || targetCat === 'all') return true;
    const cat = itemCat.toLowerCase().trim();
    const target = targetCat.toLowerCase().trim();
    if (target === 'news') return cat.includes('news');
    if (target === 'opinions' || target === 'opinion') return cat.includes('opinion');
    if (target === 'features' || target === 'feature') return cat.includes('feature');
    if (target.includes('sci') || target.includes('tech')) return cat.includes('sci') || cat.includes('tech');
    if (target.includes('lit')) return cat.includes('lit');
    return cat === target;
}

// Dynamic Category Counts
const counts = computed(() => {
    const list = pendingArticles.value;
    return {
        all: list.length,
        news: list.filter(a => matchesCategory(a.category, 'News')).length,
        opinions: list.filter(a => matchesCategory(a.category, 'Opinions')).length,
        features: list.filter(a => matchesCategory(a.category, 'Features')).length,
        scitech: list.filter(a => matchesCategory(a.category, 'Science and Technology')).length,
        literature: list.filter(a => matchesCategory(a.category, 'Literature')).length,
    };
});

// Filtered and Sorted Articles (High-performance computed property)
const filteredArticles = computed(() => {
    const list = pendingArticles.value.filter(a => matchesCategory(a.category, selectedCategory.value));
    return list.slice().sort((a, b) => {
        const timeA = new Date(a.rawDate || a.date || 0).getTime();
        const timeB = new Date(b.rawDate || b.date || 0).getTime();
        return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
    });
});

// Helper to resolve the correct Section Head who approved the story based on category
function resolveEndorser(item) {
    if (!item) return 'Section Head';

    const cat = (item.category || '').trim();
    const catLower = cat.toLowerCase();

    // 1. For Opinion, there is no Opinion Head -> Direct Submission
    if (catLower.includes('opinion')) {
        return 'Direct Submission (Opinion)';
    }

    // 2. Prefer item.endorsedBy if set and not generic
    if (item.endorsedBy && item.endorsedBy !== 'Section Head' && !item.endorsedBy.toLowerCase().includes('section editorial')) {
        if (item.endorsedBy.toLowerCase().includes('opinion') || item.endorsedBy.toLowerCase().includes('direct')) {
            return 'Direct Submission (Opinion)';
        }
        return item.endorsedBy;
    }

    // 3. Resolve using category heads map
    const heads = categoryHeads.value || {};
    for (const [key, val] of Object.entries(heads)) {
        if (catLower.includes(key.toLowerCase()) || key.toLowerCase().includes(catLower)) {
            return val;
        }
    }

    const fallbackMap = {
        'news': 'Arquero (News Head)',
        'opinions': 'Direct Submission (Opinion)',
        'opinion': 'Direct Submission (Opinion)',
        'features': 'Dela Cruz (Feature Head)',
        'feature': 'Dela Cruz (Feature Head)',
        'science and technology': 'Apilado (SciTech Head)',
        'scitech': 'Apilado (SciTech Head)',
        'science & technology': 'Apilado (SciTech Head)',
        'literature': 'Llandelar (Literary Head)',
        'literary': 'Llandelar (Literary Head)'
    };

    for (const [fKey, fVal] of Object.entries(fallbackMap)) {
        if (catLower.includes(fKey) || fKey.includes(catLower)) {
            return fVal;
        }
    }

    return 'Section Head';
}

function isDirectOpinion(item) {
    const endorser = resolveEndorser(item).toLowerCase();
    return endorser.includes('opinion') || endorser.includes('direct');
}

// Load pending review articles
async function loadArticles(forceFresh = true) {
    isLoading.value = true;
    try {
        const res = await getEicReviewArticles({ sort: currentSort.value }, forceFresh);
        if (res && res.pendingArticles) {
            pendingArticles.value = res.pendingArticles;
            categoryHeads.value = res.categoryHeads || {};
        }

        // Direct article focus via ?id= query param
        if (route.query.id && !isModalOpen.value) {
            const target = pendingArticles.value.find(a => String(a.id) === String(route.query.id));
            if (target) {
                openManuscriptModal(target, false);
            }
        }
    } catch (err) {
        console.error('Failed to load review articles:', err);
        showToast('Failed to load pending articles. Please try again.', 'danger');
    } finally {
        isLoading.value = false;
    }
}

// Open manuscript modal
function openManuscriptModal(article, forRevision = false) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = forRevision;
    revisionRemarks.value = (article.remarks && !/^(?:Endorsed to|Approved by)/i.test(article.remarks)) ? article.remarks : '';
    remarksError.value = '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) {
            headlineRef.value.innerText = article.title || '';
        }
        if (excerptRef.value) {
            excerptRef.value.innerText = article.excerpt || '';
        }
        if (bodyRef.value) {
            bodyRef.value.innerHTML = formatCleanArticleContent(article.content || '<p>No content available.</p>');
        }

        if (forRevision) {
            setTimeout(() => {
                const remarksEl = document.getElementById('manuscript-remarks-section');
                if (modalBodyRef.value && remarksEl) {
                    modalBodyRef.value.scrollTo({ top: remarksEl.offsetTop - 30, behavior: 'smooth' });
                }
                if (remarksTextareaRef.value) {
                    remarksTextareaRef.value.focus();
                    remarksTextareaRef.value.classList.add('pulse-focus');
                    setTimeout(() => remarksTextareaRef.value?.classList.remove('pulse-focus'), 1200);
                }
            }, 180);
        } else {
            if (modalBodyRef.value) {
                modalBodyRef.value.scrollTop = 0;
            }
        }
    });
}

// Close manuscript modal
function closeModal() {
    isModalOpen.value = false;
    activeManuscript.value = null;
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    document.body.classList.remove('modal-open');
}

function onHeadlineKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (excerptRef.value && activeManuscript.value?.excerpt) {
            excerptRef.value.focus();
        } else if (bodyRef.value) {
            bodyRef.value.focus();
        }
    }
}

function onRemarksInput() {
    if (revisionRemarks.value.trim().length > 0) {
        remarksError.value = '';
    }
}

// Save Changes in Manuscript Modal
async function handleSaveManuscript() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = headlineRef.value ? (headlineRef.value.innerText || headlineRef.value.textContent).trim() : activeManuscript.value.title;
    const newExcerpt = excerptRef.value ? (excerptRef.value.innerText || excerptRef.value.textContent).trim() : (activeManuscript.value.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'danger');
        headlineRef.value?.focus();
        return;
    }

    isSubmitting.value = true;
    try {
        await updateEicReviewArticle(activeManuscript.value.id, {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        });

        // Update active manuscript & pending list in-place
        activeManuscript.value.title = newTitle;
        activeManuscript.value.excerpt = newExcerpt;
        activeManuscript.value.content = newContent;

        const idx = pendingArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].title = newTitle;
            pendingArticles.value[idx].excerpt = newExcerpt;
            pendingArticles.value[idx].content = newContent;
        }

        clearApiCache('eic_');
        clearApiCache('section_');
        showToast('Article changes saved successfully.', 'success');
    } catch (err) {
        console.error('Failed to save manuscript:', err);
        showToast(err.response?.data?.message || 'Failed to save changes.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Quick Approve directly from review card
async function handleQuickApprove(article) {
    if (!article || isSubmitting.value) return;

    isSubmitting.value = true;
    try {
        await approveEicArticle(article.id, {
            title: article.title,
            excerpt: article.excerpt,
            content: article.content,
        });

        // Optimistic UI removal with smooth fade-out
        fadingBoxId.value = article.id;
        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);
            fadingBoxId.value = null;
        }, 220);

        clearApiCache('eic_');
        clearApiCache('section_');
        showToast('Article approved and forwarded to the Media & Publication Committee (M&PC).', 'success');
    } catch (err) {
        console.error('Failed to approve article:', err);
        showToast(err.response?.data?.message || 'Failed to approve article. Please try again.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Approve article from modal
async function handleApprove(article = null) {
    const target = article || activeManuscript.value;
    if (!target || isSubmitting.value) return;

    const newTitle = headlineRef.value ? (headlineRef.value.innerText || headlineRef.value.textContent).trim() : target.title;
    const newExcerpt = excerptRef.value ? (excerptRef.value.innerText || excerptRef.value.textContent).trim() : (target.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (target.content || '');
    const newContent = cleanContentForEditing(rawBody);

    isSubmitting.value = true;
    try {
        await approveEicArticle(target.id, {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        });

        fadingBoxId.value = target.id;
        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== target.id);
            fadingBoxId.value = null;
        }, 220);

        closeModal();
        clearApiCache('eic_');
        clearApiCache('section_');
        showToast('Article approved and forwarded to the Media & Publication Committee (M&PC).', 'success');
    } catch (err) {
        console.error('Failed to approve article:', err);
        showToast(err.response?.data?.message || 'Failed to approve article. Please try again.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Submit Return for Revision
async function handleReturnForRevision() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const remarks = revisionRemarks.value?.trim();
    if (!remarks) {
        remarksError.value = 'Revision remarks are required. You cannot submit for revision without remarks.';
        remarksTextareaRef.value?.focus();
        return;
    }

    isSubmitting.value = true;
    remarksError.value = '';

    const target = activeManuscript.value;
    try {
        const res = await returnEicArticleForRevision(target.id, remarks);

        fadingBoxId.value = target.id;
        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== target.id);
            fadingBoxId.value = null;
        }, 220);

        closeModal();
        clearApiCache('eic_');
        clearApiCache('section_');

        const catName = target.category || 'Section';
        const isOpinion = catName.toLowerCase().includes('opinion');
        const defaultMsg = isOpinion
            ? 'Opinion article returned to author for writer revision.'
            : `Article returned to ${catName} Head for head revision.`;
        showToast(res?.message || defaultMsg, 'warning');
    } catch (err) {
        console.error('Failed to return article for revision:', err);
        showToast(err.response?.data?.message || 'Failed to return article for revision.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

function handleSortChange() {
    // Instant sort handled smoothly by filteredArticles computed property
}

function onWindowFocus() {
    // Re-sync queue in background when window or tab regains focus
    loadArticles(true);
}

function onGlobalKeydown(e) {
    if (e.key === 'Escape' && isModalOpen.value) {
        closeModal();
    }
}

onMounted(() => {
    loadArticles(true);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
    window.removeEventListener('focus', onWindowFocus);
    window.removeEventListener('keydown', onGlobalKeydown);
    document.body.classList.remove('modal-open');
    if (toastTimer) clearTimeout(toastTimer);
    if (toastDismissTimer) clearTimeout(toastDismissTimer);
});
</script>

<template>
    <EicLayout>
        <main class="content-container">

            <!-- Top Section: Header with Title and Sort Control -->
            <div class="page-title-section">
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
                                @change="handleSortChange"
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

            <!-- Category Tabs for Review Queue (Review by Category) -->
            <div class="review-tabs-container" role="tablist" aria-label="Filter review queue by category">
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'all' }"
                    @click="selectedCategory = 'all'"
                    role="tab"
                    :aria-selected="selectedCategory === 'all'"
                >
                    <span>All Categories</span>
                    <span id="badge-review-all" class="review-tab-badge">{{ counts.all }}</span>
                </button>
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'News' }"
                    @click="selectedCategory = 'News'"
                    role="tab"
                    :aria-selected="selectedCategory === 'News'"
                >
                    <span>News</span>
                    <span id="badge-review-news" class="review-tab-badge">{{ counts.news }}</span>
                </button>
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'Opinions' }"
                    @click="selectedCategory = 'Opinions'"
                    role="tab"
                    :aria-selected="selectedCategory === 'Opinions'"
                >
                    <span>Opinions</span>
                    <span id="badge-review-opinions" class="review-tab-badge">{{ counts.opinions }}</span>
                </button>
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'Features' }"
                    @click="selectedCategory = 'Features'"
                    role="tab"
                    :aria-selected="selectedCategory === 'Features'"
                >
                    <span>Features</span>
                    <span id="badge-review-features" class="review-tab-badge">{{ counts.features }}</span>
                </button>
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'Science and Technology' }"
                    @click="selectedCategory = 'Science and Technology'"
                    role="tab"
                    :aria-selected="selectedCategory === 'Science and Technology'"
                >
                    <span>SciTech</span>
                    <span id="badge-review-scitech" class="review-tab-badge">{{ counts.scitech }}</span>
                </button>
                <button
                    type="button"
                    class="review-tab-btn"
                    :class="{ active: selectedCategory === 'Literature' }"
                    @click="selectedCategory = 'Literature'"
                    role="tab"
                    :aria-selected="selectedCategory === 'Literature'"
                >
                    <span>Literature</span>
                    <span id="badge-review-literature" class="review-tab-badge">{{ counts.literature }}</span>
                </button>
            </div>

            <!-- Loading Spinner -->
            <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading pending articles...</p>
            </div>

            <!-- Empty Queue State -->
            <div v-else-if="filteredArticles.length === 0" id="empty-queue-state" class="review-empty-queue">
                <div class="empty-queue-icon-wrapper">
                    <i class="fa-regular fa-circle-check"></i>
                </div>
                <h3 class="empty-queue-title">All Caught Up</h3>
                <p class="empty-queue-description">
                    {{ selectedCategory === 'all' ? 'All caught up. No articles pending editorial review.' : `No pending articles in ${selectedCategory}.` }}
                </p>
            </div>

            <!-- Responsive Horizontal List Card Container directly under header -->
            <div v-else id="review-list-container" class="review-list-container">
                <div
                    v-for="article in filteredArticles"
                    :key="article.id"
                    :id="`box-${article.id}`"
                    class="review-box"
                    :class="{ 'box-fade-out': fadingBoxId === article.id }"
                    :data-id="article.id"
                >
                    <!-- Left Stack: Meta Line, Bold Article Title, Excerpt, Author with Pen Nib Icon -->
                    <div class="review-box-content">
                        <div class="review-box-meta">
                            <span class="review-box-category">{{ article.category || 'News' }}</span>
                            <span class="review-box-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> {{ article.date }}</span>
                            <span v-if="isDirectOpinion(article)" class="review-box-endorsed">
                                <i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> Direct Submission (Opinion)
                            </span>
                            <span v-else class="review-box-endorsed">
                                <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Approved by <strong>{{ resolveEndorser(article) }}</strong>
                            </span>
                        </div>

                        <button
                            type="button"
                            class="review-box-title"
                            @click="openManuscriptModal(article, false)"
                            :title="article.title"
                        >
                            {{ article.title }}
                        </button>

                        <p v-if="article.excerpt" class="review-box-excerpt">
                            {{ article.excerpt }}
                        </p>

                        <p class="review-box-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By <strong>{{ article.author }}</strong></span>
                        </p>
                    </div>

                    <!-- Right Actions: 3 small buttons in a row -->
                    <div class="review-box-actions">
                        <button
                            type="button"
                            class="btn-box-read btn-box-edit"
                            @click="openManuscriptModal(article, false)"
                            title="Edit writer's manuscript"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Edit</span>
                        </button>
                        <button
                            type="button"
                            class="btn-box-revision"
                            @click="openManuscriptModal(article, true)"
                            title="Direct to revision remarks"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>For Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-box-approve"
                            @click="handleQuickApprove(article)"
                            :disabled="isSubmitting"
                            title="Approve"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Approve</span>
                        </button>
                    </div>
                </div>
            </div>

        </main>

        <!-- ====================================================================== -->
        <!-- MODAL: Minimalist Manuscript Reader Modal                              -->
        <!-- ====================================================================== -->
        <div
            id="manuscript-modal"
            class="modal-overlay"
            :class="{ hidden: !isModalOpen }"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
            @click.self="closeModal"
        >
            <div class="modal-card manuscript-modal-card">

                <!-- Modal Header -->
                <div class="manuscript-header">
                    <div class="manuscript-header-left">
                        <span id="modal-section" class="review-box-category">{{ activeManuscript?.category || 'News' }}</span>
                        <span>&bull;</span>
                        <span id="modal-date" class="review-box-date">{{ activeManuscript?.date || 'Today' }}</span>
                    </div>
                    <div class="manuscript-header-right">
                        <button
                            type="button"
                            id="close-manuscript-btn"
                            class="viewer-close-btn"
                            @click="closeModal"
                            aria-label="Close manuscript reader"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Modal Body -->
                <div class="manuscript-body" ref="modalBodyRef">
                    <h2
                        id="modal-headline"
                        ref="headlineRef"
                        class="manuscript-headline"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        @keydown="onHeadlineKeydown"
                    >
                        {{ activeManuscript?.title }}
                    </h2>

                    <div class="manuscript-byline-banner">
                        <div class="manuscript-byline-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By <strong id="modal-writer">{{ activeManuscript?.author }}</strong></span>
                        </div>
                        <div class="manuscript-byline-endorser">
                            <i v-if="isDirectOpinion(activeManuscript)" class="fa-solid fa-feather-pointed" aria-hidden="true"></i>
                            <i v-else class="fa-solid fa-circle-check" aria-hidden="true"></i>
                            <span v-if="isDirectOpinion(activeManuscript)">Direct Submission (Opinion)</span>
                            <span v-else>Approved by <strong id="modal-endorser">{{ resolveEndorser(activeManuscript) }}</strong></span>
                        </div>
                    </div>

                    <!-- Story Excerpt -->
                    <p
                        v-if="activeManuscript?.excerpt"
                        id="modal-excerpt"
                        ref="excerptRef"
                        class="viewer-excerpt"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                    >
                        {{ activeManuscript?.excerpt }}
                    </p>

                    <!-- Story Body -->
                    <div
                        id="modal-body"
                        ref="bodyRef"
                        class="manuscript-text-content"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                    ></div>

                    <!-- Mandatory Revision Remarks Box -->
                    <div
                        v-show="showRemarksSection"
                        class="manuscript-remarks-section"
                        id="manuscript-remarks-section"
                    >
                        <label for="modal-remarks" class="remarks-label">
                            <span class="remarks-label-text">
                                <i class="fa-solid fa-comment-dots"></i>
                                <span>Revision Remarks for Writer:</span>
                            </span>
                            <span class="required-badge">Required for Revision</span>
                        </label>
                        <textarea
                            id="modal-remarks"
                            v-model="revisionRemarks"
                            ref="remarksTextareaRef"
                            class="remarks-textarea"
                            :class="{ 'input-invalid': !!remarksError }"
                            placeholder="Enter mandatory revision feedback for the writer before returning this story..."
                            @input="onRemarksInput"
                            rows="4"
                        ></textarea>
                        <div id="remarks-error-msg" class="remarks-error-msg" :class="{ hidden: !remarksError }">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ remarksError || 'Revision remarks are required. You cannot submit for revision without remarks.' }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="manuscript-footer">
                    <button
                        v-show="!showRemarksSection"
                        type="button"
                        id="modal-save-btn"
                        class="btn-box-save"
                        :disabled="isSubmitting"
                        @click="handleSaveManuscript"
                        title="Save changes"
                    >
                        <i class="fa-solid" :class="isSubmitting ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>
                        <span>{{ isSubmitting ? 'Saving...' : 'Save' }}</span>
                    </button>
                    <button
                        v-show="showRemarksSection"
                        type="button"
                        id="modal-revision-btn"
                        class="btn-box-revision"
                        :disabled="isSubmitting"
                        @click="handleReturnForRevision"
                        title="Direct to revision remarks"
                    >
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>For Revision</span>
                    </button>
                    <button
                        v-show="!showRemarksSection"
                        type="button"
                        id="modal-approve-btn"
                        class="btn-box-approve"
                        :disabled="isSubmitting"
                        @click="handleApprove(activeManuscript)"
                        title="Approve"
                    >
                        <i class="fa-solid fa-check"></i>
                        <span>Approve for M&amp;PC</span>
                    </button>
                </div>

            </div>
        </div>

        <!-- Toast Notifications (Exact Blade Style: Dark Pill with Glowing Bullet Dot) -->
        <div id="toast-container" class="toast-container">
            <div
                v-if="toast.show"
                class="toast-message"
                :class="[toast.type, { 'toast-dismissing': toast.dismissing }]"
            >
                <span class="toast-bullet-dot"></span>
                <span>{{ toast.message }}</span>
            </div>
        </div>

    </EicLayout>
</template>
