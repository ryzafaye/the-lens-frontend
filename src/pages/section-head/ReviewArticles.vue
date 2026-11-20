<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import {
    getSectionHeadReviewArticles,
    updateSectionHeadReviewArticle,
    approveSectionHeadArticle,
    returnSectionHeadArticleForRevision,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import '../../assets/css/executive-review-articles.css';
import '../../assets/css/shared-manage-my-articles.css';

const route = useRoute();

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const pendingArticles = ref([]);
const revisionArticles = ref([]);
const currentSort = ref('newest');
const userAssignedCategory = ref(null);
const fadingBoxId = ref(null);
const activeTab = ref('desk'); // 'desk' or 'revision'

// Toast notification state (Blade Parity)
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

// Manuscript Modal State (Exact Old Manuscript Style)
const isModalOpen = ref(false);
const activeManuscript = ref(null);
const revisionRemarks = ref('');
const showRemarksSection = ref(false);
const remarksError = ref('');

// Decoupled DOM Refs for Flawless Native In-Place Editing (Letters, Words & Spaces)
const headlineRef = ref(null);
const excerptRef = ref(null);
const bodyRef = ref(null);



// Helper to check category matching
function matchesCategory(itemCat, targetCat) {
    if (!itemCat || !targetCat) return true;
    const cat = itemCat.toLowerCase().trim();
    const target = targetCat.toLowerCase().trim();
    if (target === 'news') return cat.includes('news');
    if (target === 'opinions' || target === 'opinion') return cat.includes('opinion');
    if (target === 'features' || target === 'feature') return cat.includes('feature');
    if (target.includes('sci') || target.includes('tech')) return cat.includes('sci') || cat.includes('tech');
    if (target.includes('lit')) return cat.includes('lit');
    return cat === target;
}

// Resolve user's section from stored role
function resolveSectionFromRole() {
    const role = (localStorage.getItem('userRole') || localStorage.getItem('sectionHeadRole') || '').toLowerCase();
    if (role.includes('news')) return 'News';
    if (role.includes('feature')) return 'Feature';
    if (role.includes('sci') || role.includes('tech')) return 'Science & Technology';
    if (role.includes('lit')) return 'Literature';
    return null;
}

// User-facing category label: for science&technology, shorten to 'Sci-Tech'
const categoryShortName = computed(() => {
    const raw = userAssignedCategory.value || resolveSectionFromRole() || '';
    const lower = raw.toLowerCase();
    if (lower.includes('sci') || lower.includes('tech')) {
        return 'Sci-Tech';
    }
    if (lower.includes('news')) {
        return 'News';
    }
    if (lower.includes('feature')) {
        return 'Feature';
    }
    if (lower.includes('lit')) {
        return 'Literary';
    }
    return raw || 'Section';
});

// Filtered articles list strictly under Section Head's category
const filteredArticles = computed(() => {
    let list = [...pendingArticles.value];

    // Exclude Opinion (Opinion has no Section Head and routes directly to EIC)
    list = list.filter(item => {
        const cat = (item.category || '').toLowerCase();
        return !cat.includes('opinion');
    });

    // STRICT SECTION CONFINEMENT: Only articles under this section head's assigned section
    const targetSection = userAssignedCategory.value || resolveSectionFromRole();
    if (targetSection) {
        list = list.filter(item => matchesCategory(item.category, targetSection));
    }

    if (currentSort.value === 'oldest') {
        list.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
    } else {
        list.sort((a, b) => new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date));
    }

    return list;
});

// Filtered articles list strictly under Section Head's category for revision
const filteredRevisionArticles = computed(() => {
    let list = [...revisionArticles.value];

    // Exclude Opinion (Opinion has no Section Head and routes directly to EIC)
    list = list.filter(item => {
        const cat = (item.category || '').toLowerCase();
        return !cat.includes('opinion');
    });

    // STRICT SECTION CONFINEMENT: Only articles under this section head's assigned section
    const targetSection = userAssignedCategory.value || resolveSectionFromRole();
    if (targetSection) {
        list = list.filter(item => matchesCategory(item.category, targetSection));
    }

    if (currentSort.value === 'oldest') {
        list.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
    } else {
        list.sort((a, b) => new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date));
    }

    return list;
});

// Modal open handlers
function openManuscriptModal(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = false;
    remarksError.value = '';
    revisionRemarks.value = article.remarks || '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) {
            headlineRef.value.innerText = article.title || '';
        }
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

function openRevisionDirectly(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = true;
    remarksError.value = '';
    revisionRemarks.value = article.remarks || '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) {
            headlineRef.value.innerText = article.title || '';
        }
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
        const textarea = document.getElementById('modal-remarks');
        if (textarea) textarea.focus();
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
    document.body.classList.remove('modal-open');
}

function toggleRevisionRemarks() {
    showRemarksSection.value = !showRemarksSection.value;
    remarksError.value = '';
    if (showRemarksSection.value) {
        nextTick(() => {
            const textarea = document.getElementById('modal-remarks');
            if (textarea) textarea.focus();
        });
    }
}

// Quick Approve directly from card
async function handleQuickApprove(article) {
    if (isSubmitting.value) return;

    // Verify category match
    const targetSection = userAssignedCategory.value || resolveSectionFromRole();
    if (targetSection && !matchesCategory(article.category, targetSection)) {
        showToast(`Unauthorized: You can only approve ${targetSection} articles.`, 'warning');
        return;
    }

    isSubmitting.value = true;
    fadingBoxId.value = article.id;

    try {
        await approveSectionHeadArticle(article.id);
        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== article.id);
            revisionArticles.value = revisionArticles.value.filter(a => a.id !== article.id);
            fadingBoxId.value = null;
            showToast('Article approved and forwarded to Editor-in-Chief (EIC).', 'success');
        }, 220);
    } catch (err) {
        fadingBoxId.value = null;
        showToast(err.response?.data?.message || 'Failed to approve article.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Save Changes in Modal (Direct Native In-Place Editing)
async function handleSaveChanges() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const newTitle = headlineRef.value ? headlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (excerptRef.value && excerptRef.value.style.display !== 'none')
        ? excerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (headlineRef.value) headlineRef.value.focus();
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

        // Update in pending list
        const idx = pendingArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].title = payload.title;
            pendingArticles.value[idx].excerpt = payload.excerpt;
            pendingArticles.value[idx].content = payload.content;
        }

        // Update in revision list
        const revIdx = revisionArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (revIdx !== -1) {
            revisionArticles.value[revIdx].title = payload.title;
            revisionArticles.value[revIdx].excerpt = payload.excerpt;
            revisionArticles.value[revIdx].content = payload.content;
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

// Approve for EIC from Modal (Saves In-Place Changes and Approves)
async function handleApproveForEic() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const targetSection = userAssignedCategory.value || resolveSectionFromRole();
    if (targetSection && !matchesCategory(activeManuscript.value.category, targetSection)) {
        showToast(`Unauthorized: You can only approve ${targetSection} articles.`, 'warning');
        return;
    }

    const newTitle = headlineRef.value ? headlineRef.value.innerText.trim() : (activeManuscript.value.title || '');
    const newExcerpt = (excerptRef.value && excerptRef.value.style.display !== 'none')
        ? excerptRef.value.innerText.trim()
        : (activeManuscript.value.excerpt || '');
    const rawBody = bodyRef.value ? bodyRef.value.innerHTML : (activeManuscript.value.content || '');
    const newContent = cleanContentForEditing(rawBody);

    if (!newTitle) {
        showToast('Please enter an article headline.', 'error');
        if (headlineRef.value) headlineRef.value.focus();
        return;
    }

    isSubmitting.value = true;
    try {
        const payload = {
            title: newTitle,
            excerpt: newExcerpt,
            content: newContent,
        };

        // Save latest edits first
        await updateSectionHeadReviewArticle(activeManuscript.value.id, payload);
        await approveSectionHeadArticle(activeManuscript.value.id);

        pendingArticles.value = pendingArticles.value.filter(a => a.id !== activeManuscript.value.id);
        revisionArticles.value = revisionArticles.value.filter(a => a.id !== activeManuscript.value.id);
        closeManuscriptModal();
        showToast('Article approved and forwarded to Editor-in-Chief (EIC).', 'success');
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

    const targetSection = userAssignedCategory.value || resolveSectionFromRole();
    if (targetSection && !matchesCategory(activeManuscript.value.category, targetSection)) {
        showToast(`Unauthorized: You can only review ${targetSection} articles.`, 'warning');
        return;
    }

    isSubmitting.value = true;
    remarksError.value = '';

    try {
        const res = await returnSectionHeadArticleForRevision(activeManuscript.value.id, revisionRemarks.value.trim());

        // Update list states
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
        showToast(res.message || 'Article returned to author with revision remarks.', 'success');
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
        const data = await getSectionHeadReviewArticles(params, forceFresh);

        if (data.pendingArticles) {
            pendingArticles.value = data.pendingArticles;
        }
        if (data.revisionArticles) {
            revisionArticles.value = data.revisionArticles;
        }
        if (data.category) {
            userAssignedCategory.value = data.category;
        } else {
            userAssignedCategory.value = resolveSectionFromRole();
        }

        // Check if query param `id` was passed from Dashboard "Manage" button
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
        console.error('Failed to load Section Head review queue:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    userAssignedCategory.value = resolveSectionFromRole();
    loadReviewQueue();
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container">
            <!-- Top Section: Header with Title and Sort Control (Blade Parity) -->
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

            <!-- Category Desk & Revision Tabs Navbar -->
            <div class="manage-tabs-container animate-fade-in delay-2" style="margin-top: 0 !important; margin-bottom: 20px !important;" role="tablist" aria-label="Review Article Tabs">
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
            </div>

            <!-- Responsive Horizontal List Card Container directly under header (Exact Blade review-box) -->
            <div v-if="activeTab === 'desk' && filteredArticles.length > 0" id="review-list-container" class="review-list-container">
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

                    <!-- Right Actions: 3 small buttons in a row (Edit, For Revision, Approve for EIC) -->
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
                            title="Approve manuscript and forward to Editor-in-Chief"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Approve for EIC</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty Queue State (Designed for HCI clarity & Actionability) -->
            <div
                v-if="activeTab === 'desk' && !isLoading && filteredArticles.length === 0"
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
                    No pending submissions for this section.
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

            <!-- Category Revision List: Displays articles returned for revision -->
            <div v-if="activeTab === 'revision' && filteredRevisionArticles.length > 0" id="revision-list-container" class="review-list-container">
                <div
                    v-for="item in filteredRevisionArticles"
                    :key="item.id"
                    :id="'box-rev-' + item.id"
                    class="review-box"
                    :class="{ 'box-fade-out': fadingBoxId === item.id }"
                >
                    <!-- Left Stack: Meta Line, Bold Article Title, Author with Pen Nib Icon -->
                    <div class="review-box-content">
                        <div class="review-box-meta">
                            <span class="review-box-category">{{ item.category }}</span>
                            <span class="badge-revision-pill" style="background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-rotate-left"></i>
                                <span>For Revision</span>
                            </span>
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

                    <!-- Right Actions: 3 small buttons in a row (Edit, For Revision, Approve for EIC) -->
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
                v-if="activeTab === 'revision' && !isLoading && filteredRevisionArticles.length === 0"
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
        </main>

        <!-- Minimalist Manuscript Reader Modal (Exact Blade Parity) -->
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

                <!-- Modal Body: Direct In-Place Editable Manuscript (Exact Blade Parity & Flawless Spacing) -->
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

                    <!-- Revision Remarks (Visible when viewing article with revision feedback) -->
                    <div
                        v-if="activeManuscript.remarks"
                        id="modal-viewing-remarks"
                        class="manuscript-remarks-callout animate-fade-in"
                        style="margin: 16px 0 20px 0; padding: 14px 18px; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 8px;"
                    >
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.82rem; color: #b45309; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Revision Remarks:</span>
                        </div>
                        <div style="font-size: 0.95rem; color: #78350f; line-height: 1.5; white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">{{ activeManuscript.remarks }}</div>
                    </div>

                    <!-- Story Excerpt -->
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

                    <!-- Story Body Content -->
                    <div
                        ref="bodyRef"
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
                            class="remarks-textarea"
                            :class="{ 'input-invalid': remarksError }"
                            placeholder="Enter mandatory revision feedback for the writer before returning this story..."
                            @input="remarksError = ''"
                        ></textarea>
                        <div v-if="remarksError" id="remarks-error-msg" class="remarks-error-msg">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ remarksError }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer (Blade Parity: Save, For Revision, Approve for EIC) -->
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

        <!-- Clean Success Notification Toast Container (Blade Parity) -->
        <div
            v-if="toast.show"
            id="toast-container"
            class="toast-container"
            aria-live="polite"
        >
            <div
                class="toast-message"
                :class="toast.type"
            >
                <span class="toast-bullet-dot"></span>
                <span>{{ toast.message }}</span>
            </div>
        </div>
    </SectionHeadLayout>
</template>
