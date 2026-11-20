<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveReviewArticles,
    updateExecutiveReviewArticle,
    approveExecutiveArticle,
    returnExecutiveArticleForRevision,
    clearApiCache,
} from '../../services/api.js';
import { formatCleanArticleContent, cleanContentForEditing } from '../../utils/articleContent.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/executive-review-articles.css';

const route = useRoute();
const user = currentUser;

// RBAC
const isPresOrVp = computed(() => {
    return ['President', 'Vice President', 'Executive Vice President'].includes(user?.role || '');
});

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const pendingArticles = ref([]);
const categoryHeads = ref({});
const currentSort = ref('newest'); // 'newest' | 'oldest'
const selectedCategory = ref('all');
const fadingBoxId = ref(null);

// Toast notification
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

// Live word count & reading time
const liveWordCount = ref(0);
const liveReadingTime = ref('1 min read');

function updateLiveMetrics() {
    if (!modalBodyRef.value) return;
    const plainText = (modalBodyRef.value.innerText || '').trim();
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    liveWordCount.value = words;
    const mins = Math.max(1, Math.ceil(words / 200));
    liveReadingTime.value = `${mins} min read`;
}

function calculateReadingTime(text) {
    if (!text) return '1 min read';
    const plain = text.replace(/<[^>]*>/g, ' ').trim();
    const words = plain.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

// Fetch articles
async function loadReviewArticles(forceFresh = false) {
    isLoading.value = true;
    try {
        const data = await getExecutiveReviewArticles({ sort: currentSort.value }, forceFresh);
        if (data) {
            if (Array.isArray(data.pendingArticles)) {
                pendingArticles.value = data.pendingArticles;
            } else if (Array.isArray(data)) {
                pendingArticles.value = data;
            }
            if (data.categoryHeads) {
                categoryHeads.value = data.categoryHeads;
            }
        }
    } catch (err) {
        console.error('Failed to load review articles:', err);
        showToast('Failed to load articles for review.', 'danger');
    } finally {
        isLoading.value = false;
    }
}

// Computed counts for category tabs
const countAll = computed(() => pendingArticles.value.length);

const countNews = computed(() => {
    return pendingArticles.value.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('news');
    }).length;
});

const countOpinions = computed(() => {
    return pendingArticles.value.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('opinion');
    }).length;
});

const countFeatures = computed(() => {
    return pendingArticles.value.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('feature');
    }).length;
});

const countScitech = computed(() => {
    return pendingArticles.value.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('science') || cat.includes('scitech');
    }).length;
});

const countLiterature = computed(() => {
    return pendingArticles.value.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('liter');
    }).length;
});

// Filtered list
const filteredArticles = computed(() => {
    let list = pendingArticles.value;

    if (selectedCategory.value !== 'all') {
        const target = selectedCategory.value.toLowerCase();
        list = list.filter(a => {
            const cat = (a.category || '').toLowerCase();
            if (target === 'news') return cat.includes('news');
            if (target === 'opinions' || target === 'opinion') return cat.includes('opinion');
            if (target === 'features' || target === 'feature') return cat.includes('feature');
            if (target === 'science and technology' || target === 'scitech') return cat.includes('science') || cat.includes('scitech');
            if (target === 'literature' || target === 'literary') return cat.includes('liter');
            return cat === target;
        });
    }

    return list.slice().sort((a, b) => {
        const timeA = new Date(a.rawDate || a.date).getTime() || 0;
        const timeB = new Date(b.rawDate || b.date).getTime() || 0;
        return currentSort.value === 'newest' ? timeB - timeA : timeA - timeB;
    });
});

function handleSortChange() {
    loadReviewArticles(true);
}

function selectCategory(cat) {
    selectedCategory.value = cat;
}

// Modal handling
function openModal(article) {
    activeManuscript.value = { ...article };
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    isModalOpen.value = true;
    document.body.classList.add('modal-open');

    nextTick(() => {
        if (headlineRef.value) {
            headlineRef.value.innerText = activeManuscript.value.title || '';
        }
        if (excerptRef.value) {
            excerptRef.value.innerText = activeManuscript.value.excerpt || '';
        }
        if (modalBodyRef.value) {
            modalBodyRef.value.innerHTML = cleanContentForEditing(activeManuscript.value.content || '');
            updateLiveMetrics();
        }
    });
}

function closeModal() {
    isModalOpen.value = false;
    activeManuscript.value = null;
    showRemarksSection.value = false;
    revisionRemarks.value = '';
    remarksError.value = '';
    document.body.classList.remove('modal-open');
}

// Format Actions
function formatDoc(cmd, val = null) {
    document.execCommand(cmd, false, val);
    if (modalBodyRef.value) {
        modalBodyRef.value.focus();
        updateLiveMetrics();
    }
}

// Save Changes
async function handleSaveEdits() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const updatedTitle = headlineRef.value?.innerText.trim();
    const updatedExcerpt = excerptRef.value?.innerText.trim();
    const updatedContent = cleanContentForEditing(modalBodyRef.value?.innerHTML || '');

    if (!updatedTitle) {
        showToast('Article headline cannot be empty.', 'danger');
        return;
    }
    if (!updatedContent) {
        showToast('Article content cannot be empty.', 'danger');
        return;
    }

    isSubmitting.value = true;
    try {
        await updateExecutiveReviewArticle(activeManuscript.value.id, {
            title: updatedTitle,
            excerpt: updatedExcerpt,
            content: updatedContent,
        });

        // Update local object
        activeManuscript.value.title = updatedTitle;
        activeManuscript.value.excerpt = updatedExcerpt;
        activeManuscript.value.content = updatedContent;

        const idx = pendingArticles.value.findIndex(a => a.id === activeManuscript.value.id);
        if (idx !== -1) {
            pendingArticles.value[idx].title = updatedTitle;
            pendingArticles.value[idx].excerpt = updatedExcerpt;
            pendingArticles.value[idx].content = updatedContent;
        }

        showToast('Article changes saved successfully.', 'success');
    } catch (err) {
        console.error('Failed to save article edits:', err);
        showToast('Failed to save article changes.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Approve Article
async function handleApprove() {
    if (!activeManuscript.value || isSubmitting.value) return;

    const id = activeManuscript.value.id;
    const updatedTitle = headlineRef.value?.innerText.trim();
    const updatedExcerpt = excerptRef.value?.innerText.trim();
    const updatedContent = cleanContentForEditing(modalBodyRef.value?.innerHTML || '');

    isSubmitting.value = true;
    try {
        await approveExecutiveArticle(id, {
            title: updatedTitle,
            excerpt: updatedExcerpt,
            content: updatedContent,
        });

        fadingBoxId.value = id;
        closeModal();

        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== id);
            fadingBoxId.value = null;
        }, 400);

        showToast('Article approved and forwarded to Media & Publication Committee.', 'success');
        clearApiCache('executive_');
    } catch (err) {
        console.error('Approval failed:', err);
        showToast('Failed to approve article. Please try again.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Return for Revision
async function handleReturnForRevision() {
    if (!activeManuscript.value || isSubmitting.value) return;

    if (!showRemarksSection.value) {
        showRemarksSection.value = true;
        return;
    }

    const remarks = revisionRemarks.value.trim();
    if (!remarks) {
        remarksError.value = 'Please provide revision remarks for the author.';
        return;
    }

    const id = activeManuscript.value.id;
    isSubmitting.value = true;
    try {
        const res = await returnExecutiveArticleForRevision(id, remarks);

        fadingBoxId.value = id;
        closeModal();

        setTimeout(() => {
            pendingArticles.value = pendingArticles.value.filter(a => a.id !== id);
            fadingBoxId.value = null;
        }, 400);

        const catName = activeManuscript.value?.category || 'Section';
        const isOpinion = catName.toLowerCase().includes('opinion');
        const defaultMsg = isOpinion
            ? 'Opinion article returned to author for writer revision.'
            : `Article returned to ${catName} Head for head revision.`;
        showToast(res?.message || defaultMsg, 'warning');
        clearApiCache('executive_');
    } catch (err) {
        console.error('Revision return failed:', err);
        showToast('Failed to return article for revision.', 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Check if deep linked to a specific article
function checkDeepLink() {
    const targetId = route.query.id;
    if (targetId) {
        const found = pendingArticles.value.find(a => String(a.id) === String(targetId));
        if (found) {
            openModal(found);
            if (window.location.hash === '#revision') {
                showRemarksSection.value = true;
            }
        }
    }
}

onMounted(async () => {
    await loadReviewArticles();
    checkDeepLink();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Access Check for Non-Pres/VP -->
            <div v-if="!isPresOrVp" class="card-panel text-center py-12">
                <i class="fa-solid fa-lock text-4xl text-[#700f2b] mb-4"></i>
                <h2 class="text-xl font-bold text-stone-800">Access Restricted</h2>
                <p class="text-stone-500 mt-2 max-w-md mx-auto text-sm">
                    This section is restricted to the President and Vice President of the executive board.
                </p>
                <router-link to="/executive/dashboard" class="btn-primary mt-6 inline-block">
                    Return to Dashboard
                </router-link>
            </div>

            <div v-else>
                <!-- Toast Notification Container -->
                <transition name="toast-fade">
                    <div v-if="toast.show" class="toast-container" :class="{ 'toast-hiding': toast.dismissing }">
                        <div class="toast-message" :class="toast.type">
                            <i v-if="toast.type === 'success'" class="fa-solid fa-circle-check"></i>
                            <i v-else-if="toast.type === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
                            <i v-else class="fa-solid fa-circle-xmark"></i>
                            <span>{{ toast.message }}</span>
                        </div>
                    </div>
                </transition>

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
                                    class="review-sort-select"
                                    aria-label="Sort pending articles by date"
                                    @change="handleSortChange"
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                </select>
                                <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Category Tabs for Review Queue -->
                    <div class="review-tabs-container" role="tablist" aria-label="Filter review queue by category">
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'all' }"
                            @click="selectCategory('all')"
                        >
                            <span>All Categories</span>
                            <span id="badge-review-all" class="review-tab-badge">{{ countAll }}</span>
                        </button>
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'news' }"
                            @click="selectCategory('news')"
                        >
                            <span>News</span>
                            <span id="badge-review-news" class="review-tab-badge">{{ countNews }}</span>
                        </button>
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'opinions' }"
                            @click="selectCategory('opinions')"
                        >
                            <span>Opinions</span>
                            <span id="badge-review-opinions" class="review-tab-badge">{{ countOpinions }}</span>
                        </button>
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'features' }"
                            @click="selectCategory('features')"
                        >
                            <span>Features</span>
                            <span id="badge-review-features" class="review-tab-badge">{{ countFeatures }}</span>
                        </button>
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'science and technology' }"
                            @click="selectCategory('science and technology')"
                        >
                            <span>SciTech</span>
                            <span id="badge-review-scitech" class="review-tab-badge">{{ countScitech }}</span>
                        </button>
                        <button
                            type="button"
                            class="review-tab-btn"
                            :class="{ 'active': selectedCategory === 'literature' }"
                            @click="selectCategory('literature')"
                        >
                            <span>Literature</span>
                            <span id="badge-review-literature" class="review-tab-badge">{{ countLiterature }}</span>
                        </button>
                    </div>
                </div>

                <!-- Responsive Horizontal List Card Container -->
                <div id="review-list-container" class="review-list-container">
                    <div
                        v-for="article in filteredArticles"
                        :key="article.id"
                        class="review-box"
                        :class="{ 'box-fade-out': fadingBoxId === article.id }"
                        @click="openModal(article)"
                    >
                        <div class="review-box-header">
                            <span class="review-box-category">{{ article.category }}</span>
                            <span class="review-box-dot">•</span>
                            <span class="review-box-date">{{ article.date }}</span>
                        </div>

                        <h3 class="review-box-title">{{ article.title }}</h3>

                        <div class="review-box-byline">
                            <div class="review-box-author">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By <strong>{{ article.author }}</strong></span>
                            </div>
                            <div class="review-box-endorser">
                                <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                                <span>{{ article.endorsedBy || 'Section Head' }}</span>
                            </div>
                        </div>

                        <p class="review-box-excerpt">{{ article.excerpt }}</p>

                        <div class="review-box-footer">
                            <span class="review-click-hint">Click card to review &amp; edit manuscript &rarr;</span>
                        </div>
                    </div>

                    <!-- Empty Queue State -->
                    <div v-if="!isLoading && filteredArticles.length === 0" class="review-empty-queue">
                        <i class="fa-regular fa-folder-open"></i>
                        <span>No articles yet</span>
                    </div>
                </div>
            </div>
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL: Minimalist Manuscript Reader Modal                              -->
        <!-- ====================================================================== -->
        <div v-if="isModalOpen" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
            <div class="modal-card manuscript-modal-card">
                <!-- Modal Header -->
                <div class="manuscript-header">
                    <div class="manuscript-header-left">
                        <span id="modal-section" class="review-box-category">{{ activeManuscript?.category || 'News' }}</span>
                        <span>•</span>
                        <span id="modal-date" class="review-box-date">{{ activeManuscript?.date }}</span>
                    </div>
                    <div class="manuscript-header-right">
                        <button type="button" id="close-manuscript-btn" class="viewer-close-btn" aria-label="Close manuscript reader" @click="closeModal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Modal Body -->
                <div class="manuscript-body">
                    <h2
                        id="modal-headline"
                        ref="headlineRef"
                        class="manuscript-headline"
                        contenteditable="true"
                        spellcheck="true"
                        role="textbox"
                        aria-multiline="true"
                        style="font-size: 1.15rem;"
                    ></h2>

                    <div class="manuscript-byline-banner">
                        <div class="manuscript-byline-author">
                            <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                            <span>By <strong id="modal-author">{{ activeManuscript?.author }}</strong></span>
                        </div>
                        <div class="manuscript-byline-endorser">
                            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                            <span id="modal-endorser">{{ activeManuscript?.endorsedBy || 'Section Head' }}</span>
                        </div>
                    </div>

                    <!-- Excerpt Edit Box -->
                    <div class="manuscript-excerpt-section">
                        <label class="manuscript-label">Excerpt / Teaser</label>
                        <p
                            ref="excerptRef"
                            class="manuscript-excerpt"
                            contenteditable="true"
                            spellcheck="true"
                            role="textbox"
                            aria-multiline="true"
                        ></p>
                    </div>

                    <!-- Clean Formatting Toolbar -->
                    <div class="manuscript-toolbar">
                        <button type="button" class="toolbar-btn" title="Bold" @click="formatDoc('bold')">
                            <i class="fa-solid fa-bold"></i>
                        </button>
                        <button type="button" class="toolbar-btn" title="Italic" @click="formatDoc('italic')">
                            <i class="fa-solid fa-italic"></i>
                        </button>
                        <button type="button" class="toolbar-btn" title="Underline" @click="formatDoc('underline')">
                            <i class="fa-solid fa-underline"></i>
                        </button>
                        <button type="button" class="toolbar-btn" title="Bullet List" @click="formatDoc('insertUnorderedList')">
                            <i class="fa-solid fa-list-ul"></i>
                        </button>
                        <button type="button" class="toolbar-btn" title="Numbered List" @click="formatDoc('insertOrderedList')">
                            <i class="fa-solid fa-list-ol"></i>
                        </button>
                        <button type="button" class="toolbar-btn" title="Remove Formatting" @click="formatDoc('removeFormat')">
                            <i class="fa-solid fa-eraser"></i>
                        </button>
                    </div>

                    <!-- Manuscript Content Body -->
                    <div class="manuscript-body-section">
                        <label class="manuscript-label">Manuscript Content</label>
                        <div
                            id="modal-content"
                            ref="modalBodyRef"
                            class="manuscript-text-body font-serif leading-relaxed"
                            contenteditable="true"
                            spellcheck="true"
                            role="textbox"
                            aria-multiline="true"
                            @input="updateLiveMetrics"
                        ></div>
                    </div>

                    <!-- Live Metrics Pill -->
                    <div class="manuscript-metrics-bar">
                        <span>{{ liveWordCount }} words</span>
                        <span>•</span>
                        <span>{{ liveReadingTime }}</span>
                    </div>

                    <!-- Revision Remarks Section (Expandable) -->
                    <div v-if="showRemarksSection" class="revision-remarks-box animate-fade-in">
                        <label class="revision-remarks-label" for="exec-revision-textarea">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Revision Remarks for Author *</span>
                        </label>
                        <textarea
                            id="exec-revision-textarea"
                            v-model="revisionRemarks"
                            class="revision-remarks-textarea"
                            rows="3"
                            placeholder="Specify requested improvements, factual corrections, or copyedits..."
                        ></textarea>
                        <p v-if="remarksError" class="remarks-error-text">{{ remarksError }}</p>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="manuscript-footer">
                    <div class="manuscript-footer-left">
                        <button
                            type="button"
                            class="btn-save-manuscript"
                            :disabled="isSubmitting"
                            @click="handleSaveEdits"
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
                            @click="handleApprove"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Approve &amp; Forward</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast Notifications Container -->
        <div v-if="toast.show" id="toast-container" class="toast-container" aria-live="polite">
            <div class="toast-message" :class="toast.type">
                <span class="toast-bullet-dot"></span>
                <span>{{ toast.message }}</span>
            </div>
        </div>
    </ExecutiveLayout>
</template>
