<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    target: {
        type: Object,
        default: null,
    },
    stickyTop: {
        type: String,
        default: '0px',
    },
});

const emit = defineEmits(['change']);

const toolbarActive = ref({
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

function isSelectionInsideTarget() {
    if (!props.target || typeof window === 'undefined') return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        return document.activeElement === props.target;
    }
    const anchor = sel.anchorNode;
    return Boolean(anchor && (props.target === anchor || props.target.contains(anchor)));
}

function updateToolbarStates() {
    if (!isSelectionInsideTarget()) return;
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
        // Ignore selection state errors when selection is outside
    }
}

function execFormat(command, value = null) {
    const targetEl = props.target;
    if (!targetEl) return;

    if (document.activeElement !== targetEl) {
        targetEl.focus();
    }

    if (command === 'createLink') {
        const url = prompt('Enter link URL (e.g., https://thelens.example.com):', 'https://');
        if (url && url.trim().length > 0) {
            const trimmed = url.trim();
            const formattedUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
                ? trimmed
                : `https://${trimmed}`;
            document.execCommand('createLink', false, formattedUrl);
        }
    } else if (command === 'formatBlock') {
        const currentTag = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/<|>/g, '');
        const targetTag = String(value || '').replace(/<|>/g, '').toLowerCase();

        if (currentTag === targetTag) {
            document.execCommand('formatBlock', false, '<div>');
        } else {
            document.execCommand('formatBlock', false, value);
        }
    } else {
        document.execCommand(command, false, value);
    }

    updateToolbarStates();
    emit('change');
}

function handleSelectionChange() {
    updateToolbarStates();
}

onMounted(() => {
    if (typeof document !== 'undefined') {
        document.addEventListener('selectionchange', handleSelectionChange);
    }
});

onUnmounted(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener('selectionchange', handleSelectionChange);
    }
});

defineExpose({
    execFormat,
    updateToolbarStates,
});
</script>

<template>
    <div
        class="article-rich-toolbar"
        :style="{ top: stickyTop }"
        role="toolbar"
        aria-label="Article formatting controls"
    >
        <!-- History -->
        <button
            type="button"
            class="tool-btn"
            @mousedown.prevent
            @click="execFormat('undo')"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
        >
            <i class="fa-solid fa-rotate-left"></i>
        </button>
        <button
            type="button"
            class="tool-btn"
            @mousedown.prevent
            @click="execFormat('redo')"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
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
            aria-label="Bold"
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
            aria-label="Italic"
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
            aria-label="Underline"
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
            aria-label="Strikethrough"
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
            aria-label="Subscript"
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
            aria-label="Superscript"
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
            aria-label="Heading 2"
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
            aria-label="Heading 3"
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
            aria-label="Blockquote"
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
            aria-label="Bullet List"
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
            aria-label="Numbered List"
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
            aria-label="Align Left"
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
            aria-label="Align Center"
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
            aria-label="Align Right"
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
            aria-label="Justify"
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
            aria-label="Insert Link"
        >
            <i class="fa-solid fa-link"></i>
        </button>
        <button
            type="button"
            class="tool-btn"
            @mousedown.prevent
            @click="execFormat('unlink')"
            title="Remove Link"
            aria-label="Remove Link"
        >
            <i class="fa-solid fa-link-slash"></i>
        </button>
        <button
            type="button"
            class="tool-btn"
            @mousedown.prevent
            @click="execFormat('insertHorizontalRule')"
            title="Horizontal Divider Line"
            aria-label="Horizontal Divider Line"
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
            aria-label="Clear Formatting"
        >
            <i class="fa-solid fa-eraser"></i>
        </button>
    </div>
</template>

<style scoped>
.article-rich-toolbar {
    background-color: #fafbfc;
    border: 1px solid #eaecf0;
    border-radius: 8px;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    gap: 3px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    position: sticky;
    z-index: 10;
    box-shadow: 0 2px 6px rgba(16, 24, 40, 0.04);
}

.tool-btn {
    background: transparent;
    border: none;
    padding: 5px 7px;
    border-radius: 6px;
    color: #475467;
    font-size: 0.82rem;
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif);
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 30px;
    height: 30px;
    transition: all 0.12s ease;
    user-select: none;
}

.tool-btn:hover {
    background-color: #eaecf0;
    color: #101828;
}

.tool-btn.active {
    background-color: #fbf2f4;
    color: var(--sidebar-maroon, #700f2b);
    font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(112, 15, 43, 0.25);
}

.tool-btn:focus-visible {
    outline: 2px solid var(--sidebar-maroon, #700f2b);
    outline-offset: 1px;
}

.toolbar-divider {
    width: 1px;
    height: 18px;
    background-color: #e4e7ec;
    margin: 0 3px;
    flex-shrink: 0;
}
</style>
