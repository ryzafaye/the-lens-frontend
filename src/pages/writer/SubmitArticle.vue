<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import WriterLayout from '../../layouts/WriterLayout.vue';
import { getWriterSubmitData, storeWriterArticle, deleteWriterDraft, getUser } from '../../services/api.js';
import { cleanContentForEditing, formatCleanArticleContent, sanitizeRichArticleHtml, isRevisionStatus, isArticleBodyModified } from '../../utils/articleContent.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/shared-submit-article.css';

const router = useRouter();
const route = useRoute();

// User state
const authorName = ref(localStorage.getItem('userName') || localStorage.getItem('writerName') || 'Writer');

// Tabs & Views
const activeTab = ref('write');
const categories = ref([]);
const drafts = ref([]);

// Form field states
const articleId = ref(null);
const title = ref('');
const categoryId = ref('');
const excerpt = ref('');
const editorContent = ref('');
const initialBodyContent = ref('');
const loadedArticleStatus = ref('');

// Element references
const headlineInput = ref(null);
const excerptInput = ref(null);
const editorRef = ref(null);

// Validation states
const headlineInvalid = ref(false);
const categoryInvalid = ref(false);
const excerptInvalid = ref(false);
const editorInvalid = ref(false);
const errorMessage = ref('');

// Button loading states
const isSavingDraft = ref(false);
const isSubmitting = ref(false);

// Centered Modal Toast/Feedback replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Live metrics
const wordCount = computed(() => {
    const text = (editorContent.value || '').replace(/<[^>]+>/g, ' ').trim();
    if (!text) return 0;
    const words = text.match(/\b[\w'-]+\b/g);
    return words ? words.length : 0;
});

const charCount = computed(() => {
    return (editorContent.value || '').replace(/<[^>]+>/g, '').length;
});

const wordsCountText = computed(() => {
    return `${wordCount.value} ${wordCount.value === 1 ? 'word' : 'words'}`;
});

const charsCountText = computed(() => {
    return `${charCount.value} characters`;
});

// Toolbar active states
const toolbarActive = ref({
    undo: false,
    redo: false,
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    subscript: false,
    superscript: false,
    h2: false,
    h3: false,
    blockquote: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
});

function updateToolbarStates() {
    try {
        toolbarActive.value.bold = document.queryCommandState('bold');
        toolbarActive.value.italic = document.queryCommandState('italic');
        toolbarActive.value.underline = document.queryCommandState('underline');
        toolbarActive.value.strikeThrough = document.queryCommandState('strikeThrough');
        toolbarActive.value.subscript = document.queryCommandState('subscript');
        toolbarActive.value.superscript = document.queryCommandState('superscript');
        toolbarActive.value.insertUnorderedList = document.queryCommandState('insertUnorderedList');
        toolbarActive.value.insertOrderedList = document.queryCommandState('insertOrderedList');
        toolbarActive.value.justifyLeft = document.queryCommandState('justifyLeft');
        toolbarActive.value.justifyCenter = document.queryCommandState('justifyCenter');
        toolbarActive.value.justifyRight = document.queryCommandState('justifyRight');
        toolbarActive.value.justifyFull = document.queryCommandState('justifyFull');

        const blockValue = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/<|>/g, '');
        toolbarActive.value.h2 = blockValue === 'h2';
        toolbarActive.value.h3 = blockValue === 'h3';
        toolbarActive.value.blockquote = blockValue === 'blockquote';
    } catch (e) {
        // queryCommand may throw if selection is outside
    }
}

// Rich Text Formatting Commands
function execFormat(command, value = null) {
    if (!editorRef.value) return;
    editorRef.value.focus();

    if (command === 'createLink') {
        const url = prompt('Enter link URL (e.g., https://thelens.example.com):', 'https://');
        if (url && url.trim().length > 0) {
            const formattedUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://')
                ? url.trim()
                : `https://${url.trim()}`;
            document.execCommand('createLink', false, formattedUrl);
        }
    } else if (command === 'formatBlock') {
        const currentTag = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/<|>/g, '');
        const targetTag = value.replace(/<|>/g, '').toLowerCase();

        if (currentTag === targetTag) {
            document.execCommand('formatBlock', false, '<div>');
        } else {
            document.execCommand('formatBlock', false, value);
        }
    } else {
        document.execCommand(command, false, value);
    }

    syncEditorContent();
    updateToolbarStates();
}

function syncEditorContent() {
    if (editorRef.value) {
        editorContent.value = editorRef.value.innerHTML;
        if (editorRef.value.innerText.trim().length > 0) {
            editorInvalid.value = false;
        }
    }
}

function onEditorInput() {
    syncEditorContent();
    updateToolbarStates();
}

function onEditorKeyup() {
    syncEditorContent();
    updateToolbarStates();
}

function onEditorKeydown(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            document.execCommand('outdent', false, null);
        } else {
            document.execCommand('indent', false, null);
        }
        syncEditorContent();
        updateToolbarStates();
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            execFormat('bold');
        } else if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            execFormat('italic');
        } else if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            execFormat('underline');
        } else if (e.key === 'z' || e.key === 'Z') {
            if (e.shiftKey) {
                e.preventDefault();
                execFormat('redo');
            } else {
                e.preventDefault();
                execFormat('undo');
            }
        } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            execFormat('redo');
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            submitForm('Draft');
        }
    }
}

// Auto-Resize Headline
function autoResizeHeadline() {
    if (!headlineInput.value) return;
    headlineInput.value.style.height = 'auto';
    const scrollH = headlineInput.value.scrollHeight;

    const width = window.innerWidth;
    const minH = width <= 480 ? 34 : (width <= 768 ? 38 : 44);
    const maxH = width <= 480 ? 100 : (width <= 768 ? 115 : 160);

    const calculatedHeight = Math.max(minH, scrollH);
    const clampedHeight = Math.min(maxH, calculatedHeight);
    headlineInput.value.style.height = `${clampedHeight}px`;

    if (scrollH > maxH) {
        headlineInput.value.style.overflowY = 'auto';
    } else {
        headlineInput.value.style.overflowY = 'hidden';
    }

    if (title.value.trim().length > 0) {
        headlineInvalid.value = false;
    }
}

function onHeadlineEnter() {
    if (excerptInput.value) {
        excerptInput.value.focus();
    } else if (editorRef.value) {
        editorRef.value.focus();
    }
}

function onHeadlineInput() {
    if (/[\r\n]/.test(title.value)) {
        title.value = title.value.replace(/[\r\n]+/g, ' ');
    }
    autoResizeHeadline();
}

function handleExcerptInput() {
    if (excerpt.value.trim().length > 0) {
        excerptInvalid.value = false;
    }
}

// Tab Switching
function switchTab(targetTab) {
    activeTab.value = targetTab;
    if (targetTab === 'write') {
        nextTick(() => {
            autoResizeHeadline();
        });
    }
}

// Clean Paste & Sanitization
function onEditorPaste(e) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    let text = clipboardData.getData('text/plain') || '';
    let html = clipboardData.getData('text/html') || '';

    if (e.shiftKey || !html.trim()) {
        if (text) {
            document.execCommand('insertText', false, text);
            syncEditorContent();
            updateToolbarStates();
        }
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        doc.body.querySelectorAll('script, style, meta, link, object, embed, iframe, xml, title, noscript, applet').forEach(el => el.remove());

        let tagToUnwrap;
        while ((tagToUnwrap = doc.body.querySelector('span, font, o\\:p, meta'))) {
            const parent = tagToUnwrap.parentNode;
            if (parent) {
                while (tagToUnwrap.firstChild) {
                    parent.insertBefore(tagToUnwrap.firstChild, tagToUnwrap);
                }
                parent.removeChild(tagToUnwrap);
            } else {
                tagToUnwrap.remove();
            }
        }

        const forbiddenAttrs = ['style', 'class', 'id', 'face', 'size', 'color', 'dir', 'lang', 'align', 'valign', 'bgcolor', 'border'];
        doc.body.querySelectorAll('*').forEach(el => {
            forbiddenAttrs.forEach(attr => el.removeAttribute(attr));
        });

        doc.body.querySelectorAll('p').forEach(p => {
            const div = doc.createElement('div');
            while (p.firstChild) div.appendChild(p.firstChild);
            if (p.parentNode) p.parentNode.replaceChild(div, p);
        });

        const cleanHtml = doc.body.innerHTML.trim();
        if (cleanHtml) {
            document.execCommand('insertHTML', false, cleanHtml);
        } else if (text) {
            document.execCommand('insertText', false, text);
        }
    } catch (err) {
        if (text) {
            document.execCommand('insertText', false, text);
        }
    }

    syncEditorContent();
    updateToolbarStates();
}

// Load draft into editor
function loadDraft(draft) {
    if (!draft) return;

    articleId.value = draft.id;
    title.value = draft.title || '';
    categoryId.value = draft.category_id || '';
    excerpt.value = draft.excerpt || '';
    editorContent.value = draft.content || '';
    initialBodyContent.value = draft.content || '';
    loadedArticleStatus.value = draft.status || '';

    if (editorRef.value) {
        editorRef.value.innerHTML = draft.content ? formatCleanArticleContent(draft.content) : '';
    }

    headlineInvalid.value = false;
    categoryInvalid.value = false;
    excerptInvalid.value = false;
    editorInvalid.value = false;

    switchTab('write');
    nextTick(() => {
        autoResizeHeadline();
        updateToolbarStates();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Draft loaded into editor.', 'success');
}

// Clear form to start new
function startNewArticle() {
    articleId.value = null;
    title.value = '';
    categoryId.value = '';
    excerpt.value = '';
    editorContent.value = '';
    initialBodyContent.value = '';
    loadedArticleStatus.value = '';
    if (editorRef.value) {
        editorRef.value.innerHTML = '';
    }
    nextTick(() => {
        autoResizeHeadline();
        updateToolbarStates();
    });
}

// Delete draft
async function handleDeleteDraft(draft, event) {
    if (event) event.stopPropagation();

    const confirmed = await confirmAction({
        title: 'Delete Draft',
        message: `Are you sure you want to delete "${draft.title}"?`,
        confirmText: 'Delete Draft',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;

    try {
        await deleteWriterDraft(draft.id);
        drafts.value = drafts.value.filter(d => d.id !== draft.id);
        if (articleId.value === draft.id) {
            startNewArticle();
        }
        showToast('Draft deleted successfully.', 'success');
    } catch (err) {
        showToast(err.response?.data?.message || 'Could not delete draft.', 'danger');
    }
}

// Submit Form (Draft vs Pending Review)
async function submitForm(targetStatus) {
    errorMessage.value = '';
    headlineInvalid.value = false;
    categoryInvalid.value = false;
    excerptInvalid.value = false;
    editorInvalid.value = false;

    syncEditorContent();

    const headline = title.value.trim();
    const catId = categoryId.value;
    const exc = excerpt.value.trim();
    const contentText = (editorRef.value ? editorRef.value.innerText : '').trim();

    if (targetStatus === 'Pending Review' || targetStatus === 'Pending EIC Review') {
        let hasError = false;
        if (!headline) {
            headlineInvalid.value = true;
            hasError = true;
        }
        if (!catId) {
            categoryInvalid.value = true;
            hasError = true;
        }
        if (!exc) {
            excerptInvalid.value = true;
            hasError = true;
        }
        if (!contentText) {
            editorInvalid.value = true;
            hasError = true;
        }

        if (hasError) {
            showToast('Please fill in all required fields before submitting.', 'danger');
            return;
        }

        if (isRevisionStatus(loadedArticleStatus.value)) {
            const rawCurrent = editorRef.value ? editorRef.value.innerHTML : editorContent.value;
            if (!isArticleBodyModified(initialBodyContent.value, rawCurrent)) {
                showToast('You cannot submit an article returned for revision without editing the article body. Please revise the manuscript before submitting.', 'danger');
                return;
            }
        }
    } else {
        // Saving as Draft
        if (!headline && !contentText) {
            headlineInvalid.value = true;
            showToast('Please enter at least a headline or some content to save as draft.', 'danger');
            return;
        }
        if (!catId) {
            categoryInvalid.value = true;
            showToast('Please select a section category before saving.', 'danger');
            return;
        }
    }

    const isDraft = targetStatus === 'Draft';
    const confirmed = await confirmAction({
        title: isDraft ? 'Save Draft' : 'Submit Article',
        message: isDraft
            ? 'Are you sure you want to save this article as a draft?'
            : 'Are you sure you want to submit this article for review?',
        confirmText: isDraft ? 'Save Draft' : 'Submit Article',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    const payload = {
        title: headline,
        category_id: catId,
        excerpt: exc,
        content: sanitizeRichArticleHtml(editorRef.value ? editorRef.value.innerHTML : editorContent.value),
        status: targetStatus,
    };
    if (articleId.value) {
        payload.article_id = articleId.value;
    }

    if (targetStatus === 'Draft') {
        isSavingDraft.value = true;
    } else {
        isSubmitting.value = true;
    }

    try {
        const res = await storeWriterArticle(payload);
        showToast(res.message || (targetStatus === 'Draft' ? 'Draft saved successfully.' : 'Article submitted successfully.'), 'success');

        if (targetStatus === 'Draft') {
            // Refresh drafts list
            const refreshed = await getWriterSubmitData();
            if (refreshed?.drafts) drafts.value = refreshed.drafts;
            if (res.article?.id) articleId.value = res.article.id;
            switchTab('drafts');
        } else {
            // Submitted for review -> redirect to dashboard
            setTimeout(() => {
                router.push('/writer/dashboard');
            }, 800);
        }
    } catch (err) {
        if (err.response?.data?.errors) {
            const firstErr = Object.values(err.response.data.errors)[0];
            errorMessage.value = Array.isArray(firstErr) ? firstErr[0] : firstErr;
        } else if (err.response?.data?.message) {
            errorMessage.value = err.response.data.message;
        } else {
            errorMessage.value = 'An error occurred while saving the manuscript.';
        }
        showToast(errorMessage.value, 'danger');
    } finally {
        isSavingDraft.value = false;
        isSubmitting.value = false;
    }
}

onMounted(async () => {
    // 1. Hydrate user info for Byline display
    const storedName = localStorage.getItem('userName') || localStorage.getItem('writerName');
    if (storedName) authorName.value = storedName;

    try {
        const u = await getUser();
        if (u?.user?.full_name) {
            authorName.value = u.user.full_name;
            localStorage.setItem('userName', u.user.full_name);
            localStorage.setItem('writerName', u.user.full_name);
        }
    } catch (e) {}

    window.addEventListener('resize', autoResizeHeadline);
    document.addEventListener('selectionchange', updateToolbarStates);

    const draftIdFromUrl = route.query.draft_id;

    try {
        const data = await getWriterSubmitData(draftIdFromUrl);
        if (data?.user?.full_name) {
            authorName.value = data.user.full_name;
            localStorage.setItem('userName', data.user.full_name);
            localStorage.setItem('writerName', data.user.full_name);
        }
        if (data?.categories) categories.value = data.categories;
        if (data?.drafts) drafts.value = data.drafts;

        if (data?.editingDraft) {
            loadDraft(data.editingDraft);
        } else if (draftIdFromUrl && data?.drafts) {
            const match = data.drafts.find(d => String(d.id) === String(draftIdFromUrl));
            if (match) loadDraft(match);
        } else if (route.query.tab === 'drafts') {
            switchTab('drafts');
        }
    } catch (err) {
        console.warn('Error loading submit data:', err);
    }

    nextTick(() => {
        autoResizeHeadline();
        updateToolbarStates();
    });
});

onUnmounted(() => {
    window.removeEventListener('resize', autoResizeHeadline);
    document.removeEventListener('selectionchange', updateToolbarStates);
    if (toastTimer) clearTimeout(toastTimer);
});
</script>

<template>
    <WriterLayout>
        <main class="content-container">
            <div class="submit-article-container">
                <div class="page-title-section">
                    <div class="page-header-row">
                        <h1 class="page-title">Submit Article</h1>
                    </div>
                </div>

                <!-- Tabs: Write Article vs Drafts -->
                <div class="manage-tabs-container submit-tabs-nav animate-fade-in delay-2" role="tablist" aria-label="Article Views">
                    <button
                        type="button"
                        class="manage-tab-btn submit-tab-btn"
                        :class="{ active: activeTab === 'write' }"
                        @click="switchTab('write')"
                        id="tab-write-btn"
                        role="tab"
                        :aria-selected="activeTab === 'write'"
                        aria-controls="write-view"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Write Article</span>
                    </button>
                    <button
                        type="button"
                        class="manage-tab-btn submit-tab-btn"
                        :class="{ active: activeTab === 'drafts' }"
                        @click="switchTab('drafts')"
                        id="tab-drafts-btn"
                        role="tab"
                        :aria-selected="activeTab === 'drafts'"
                        aria-controls="drafts-view"
                    >
                        <i class="fa-regular fa-folder-open"></i>
                        <span>Drafts</span>
                        <span class="tab-count-badge drafts-tab-badge" id="drafts-count-badge">{{ drafts.length }}</span>
                    </button>
                </div>

                <!-- Validation Error Message Box -->
                <div
                    v-if="errorMessage"
                    style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 16px; border-radius: 8px; margin-bottom: 24px;"
                >
                    <strong style="display: block; margin-bottom: 8px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Action Failed:
                    </strong>
                    <p style="margin: 0; font-size: 0.9rem;">{{ errorMessage }}</p>
                </div>

                <!-- WRITE VIEW -->
                <div
                    class="write-view view-container"
                    :class="{ hidden: activeTab === 'drafts' }"
                    id="write-view"
                    role="tabpanel"
                    aria-labelledby="tab-write-btn"
                >
                    <div class="writing-canvas-container">
                        <!-- Headline Box -->
                        <div
                            class="headline-box-wrapper"
                            id="headline-box-wrapper"
                            :class="{ 'input-invalid': headlineInvalid }"
                        >
                            <textarea
                                id="article-headline"
                                ref="headlineInput"
                                v-model="title"
                                class="headline-input"
                                rows="1"
                                placeholder="Write your headline here..."
                                maxlength="255"
                                @input="onHeadlineInput"
                                @keydown.enter.prevent="onHeadlineEnter"
                                required
                            ></textarea>
                            <div class="headline-helper-row">
                                <span></span>
                                <span
                                    id="headline-char-count"
                                    class="headline-char-count"
                                    :style="{ color: title.length > 230 ? '#d92d20' : '#667085' }"
                                >
                                    {{ title.length }} / 255
                                </span>
                            </div>
                        </div>

                        <!-- Meta Controls: Category & Author Byline -->
                        <div class="meta-controls-row">
                            <div class="category-select-wrapper">
                                <label for="article-category" class="category-label">
                                    <i class="fa-solid fa-tag"></i>
                                    <span>Section:</span>
                                </label>
                                <div class="select-styled-container" id="category-select-container">
                                    <select
                                        id="article-category"
                                        v-model="categoryId"
                                        class="category-dropdown-select"
                                        :class="{ 'input-invalid': categoryInvalid }"
                                        @change="categoryInvalid = false"
                                        required
                                    >
                                        <option value="" disabled>Select category...</option>
                                        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                                            {{ cat.name }}
                                        </option>
                                    </select>
                                    <i class="fa-solid fa-chevron-down select-chevron"></i>
                                </div>
                            </div>
                            <div class="author-byline-display">
                                <i class="fa-solid fa-pen-nib"></i>
                                <span>By <strong>{{ authorName }}</strong></span>
                            </div>
                        </div>

                        <!-- Excerpt Box -->
                        <div
                            class="excerpt-box-wrapper"
                            id="excerpt-box-wrapper"
                            :class="{ 'input-invalid': excerptInvalid }"
                        >
                            <label for="article-excerpt" class="excerpt-label">
                                <i class="fa-solid fa-align-left"></i>
                                <span>Excerpt</span>
                            </label>
                            <textarea
                                id="article-excerpt"
                                ref="excerptInput"
                                v-model="excerpt"
                                class="excerpt-input"
                                rows="2"
                                maxlength="255"
                                placeholder="Write a brief excerpt or teaser..."
                                @input="handleExcerptInput"
                                required
                            ></textarea>
                            <div class="excerpt-helper-row">
                                <span></span>
                                <span
                                    id="excerpt-char-count"
                                    class="excerpt-char-count"
                                    :style="{ color: excerpt.length > 230 ? '#d92d20' : '#667085' }"
                                >
                                    {{ excerpt.length }} / 255
                                </span>
                            </div>
                        </div>

                        <!-- Notion / Medium Style Formatting Toolbar -->
                        <div class="editor-toolbar" id="editor-toolbar" role="toolbar" aria-label="Editor controls">
                            <!-- History -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('undo')"
                                title="Undo (Ctrl+Z)"
                            >
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('redo')"
                                title="Redo (Ctrl+Y)"
                            >
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Typography & Styling -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.bold }"
                                @mousedown.prevent
                                @click="execFormat('bold')"
                                title="Bold (Ctrl+B)"
                            >
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.italic }"
                                @mousedown.prevent
                                @click="execFormat('italic')"
                                title="Italic (Ctrl+I)"
                            >
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.underline }"
                                @mousedown.prevent
                                @click="execFormat('underline')"
                                title="Underline (Ctrl+U)"
                            >
                                <i class="fa-solid fa-underline"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.strikeThrough }"
                                @mousedown.prevent
                                @click="execFormat('strikeThrough')"
                                title="Strikethrough"
                            >
                                <i class="fa-solid fa-strikethrough"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.subscript }"
                                @mousedown.prevent
                                @click="execFormat('subscript')"
                                title="Subscript"
                            >
                                <i class="fa-solid fa-subscript"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.superscript }"
                                @mousedown.prevent
                                @click="execFormat('superscript')"
                                title="Superscript"
                            >
                                <i class="fa-solid fa-superscript"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Structural Blocks -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.h2 }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<h2>')"
                                title="Heading 2"
                            >
                                <span>H2</span>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.h3 }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<h3>')"
                                title="Heading 3"
                            >
                                <span>H3</span>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.blockquote }"
                                @mousedown.prevent
                                @click="execFormat('formatBlock', '<blockquote>')"
                                title="Blockquote / Pull Quote"
                            >
                                <i class="fa-solid fa-quote-left"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Lists -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.insertUnorderedList }"
                                @mousedown.prevent
                                @click="execFormat('insertUnorderedList')"
                                title="Bullet List"
                            >
                                <i class="fa-solid fa-list-ul"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.insertOrderedList }"
                                @mousedown.prevent
                                @click="execFormat('insertOrderedList')"
                                title="Numbered List"
                            >
                                <i class="fa-solid fa-list-ol"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Alignment -->
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyLeft }"
                                @mousedown.prevent
                                @click="execFormat('justifyLeft')"
                                title="Align Left"
                            >
                                <i class="fa-solid fa-align-left"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyCenter }"
                                @mousedown.prevent
                                @click="execFormat('justifyCenter')"
                                title="Align Center"
                            >
                                <i class="fa-solid fa-align-center"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyRight }"
                                @mousedown.prevent
                                @click="execFormat('justifyRight')"
                                title="Align Right"
                            >
                                <i class="fa-solid fa-align-right"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                :class="{ active: toolbarActive.justifyFull }"
                                @mousedown.prevent
                                @click="execFormat('justifyFull')"
                                title="Justify"
                            >
                                <i class="fa-solid fa-align-justify"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Links & Elements -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('createLink')"
                                title="Insert Link"
                            >
                                <i class="fa-solid fa-link"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('unlink')"
                                title="Remove Link"
                            >
                                <i class="fa-solid fa-link-slash"></i>
                            </button>
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('insertHorizontalRule')"
                                title="Horizontal Divider Line"
                            >
                                <i class="fa-solid fa-minus"></i>
                            </button>

                            <div class="toolbar-divider"></div>

                            <!-- Clear Formatting -->
                            <button
                                type="button"
                                class="tool-btn"
                                @mousedown.prevent
                                @click="execFormat('removeFormat')"
                                title="Clear Formatting"
                            >
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                        </div>

                        <!-- Rich Text Editor Body -->
                        <div
                            class="editor-body-wrapper"
                            id="editor-body-wrapper"
                            :class="{ 'input-invalid': editorInvalid }"
                        >
                            <div
                                id="editor-content"
                                ref="editorRef"
                                class="rich-editor-content"
                                contenteditable="true"
                                spellcheck="true"
                                data-placeholder="Write your article here..."
                                @input="onEditorInput"
                                @keyup="onEditorKeyup"
                                @mouseup="updateToolbarStates"
                                @keydown="onEditorKeydown"
                                @paste="onEditorPaste"
                            ></div>
                        </div>

                        <!-- Footer Action Bar & Live Metrics -->
                        <div class="editor-footer-bar">
                            <div class="editor-metrics-left">
                                <span class="metric-pill">
                                    <i class="fa-solid fa-font"></i>
                                    <span id="words-count">{{ wordsCountText }}</span>
                                </span>
                                <span class="metric-pill">
                                    <i class="fa-regular fa-keyboard"></i>
                                    <span id="chars-count">{{ charsCountText }}</span>
                                </span>
                            </div>

                            <div class="editor-actions-right">
                                <button
                                    type="button"
                                    id="btn-save-draft"
                                    class="btn-secondary-action"
                                    :disabled="isSavingDraft"
                                    @click="submitForm('Draft')"
                                >
                                    <i class="fa-regular fa-floppy-disk"></i>
                                    <span>{{ isSavingDraft ? 'Saving…' : 'Save Draft' }}</span>
                                </button>
                                <button
                                    type="button"
                                    id="btn-submit-article"
                                    class="btn-submit-primary btn-submit-article"
                                    :disabled="isSubmitting"
                                    @click="submitForm('Pending Review')"
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                    <span>{{ isSubmitting ? 'Submitting…' : 'Submit Article' }}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- DRAFTS VIEW -->
                <div
                    class="drafts-view view-container"
                    :class="{ hidden: activeTab === 'write' }"
                    id="drafts-view"
                    role="tabpanel"
                    aria-labelledby="tab-drafts-btn"
                >
                    <div class="drafts-view-container">
                        <div class="drafts-list-container" id="drafts-list-container">
                            <div
                                v-for="draft in drafts"
                                :key="draft.id"
                                class="draft-box"
                                :id="'draft-box-' + draft.id"
                                @click="loadDraft(draft)"
                            >
                                <div class="draft-box-content">
                                    <div class="draft-box-meta">
                                        <span class="draft-box-category">{{ draft.category?.name || draft.category || 'Uncategorized' }}</span>
                                        <span class="draft-box-date">
                                            <i class="fa-regular fa-calendar" aria-hidden="true"></i> Saved {{ draft.date || 'Recently' }}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        class="draft-box-title"
                                        style="font-family: 'Playfair Display', Georgia, serif !important;"
                                        :title="draft.title"
                                        @click.stop="loadDraft(draft)"
                                    >
                                        {{ draft.title }}
                                    </button>
                                    <p v-if="draft.excerpt" class="draft-box-excerpt">{{ draft.excerpt }}</p>
                                </div>
                                <div class="draft-box-actions">
                                    <button
                                        type="button"
                                        class="btn-draft-edit"
                                        title="Edit this draft"
                                        @click.stop="loadDraft(draft)"
                                    >
                                        <i class="fa-solid fa-pen"></i>
                                        <span>Edit Draft</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-draft-delete"
                                        title="Delete draft"
                                        @click.stop="handleDeleteDraft(draft, $event)"
                                    >
                                        <i class="fa-regular fa-trash-can"></i>
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>

                            <div v-if="drafts.length === 0" id="empty-drafts-state" class="empty-drafts-box">
                                <i class="fa-regular fa-folder-open"></i>
                                <h3 class="empty-drafts-title">No Drafts Saved</h3>
                                <p class="empty-drafts-subtitle">Any articles you save as drafts will appear here for easy editing.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    </WriterLayout>
</template>
