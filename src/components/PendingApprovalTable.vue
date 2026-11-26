<script setup>
import { isRevisionStatus } from '../utils/articleContent.js';
import { formatCategoryDisplay } from '../utils/categoryFormat.js';

const props = defineProps({
    articles: {
        type: Array,
        default: () => [],
    },
    isLoading: {
        type: Boolean,
        default: false,
    },
    isSubmitting: {
        type: Boolean,
        default: false,
    },
    emptyText: {
        type: String,
        default: 'No pending submissions for review.',
    },
    defaultCategory: {
        type: String,
        default: '',
    },
    formatDate: {
        type: Function,
        default: (d) => {
            if (!d) return '';
            const str = String(d).trim();
            if (str.length > 12) {
                const parsed = new Date(str);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    });
                }
            }
            return str;
        },
    },
});

const emit = defineEmits(['open-manuscript', 'approve', 'revision', 'resubmit', 'remarks']);
</script>

<template>
    <div class="pending-approval-no-scroll">
        <table class="data-table unified-pending-table">
            <thead>
                <tr>
                    <th class="col-title">Article Title</th>
                    <th class="col-category">Category</th>
                    <th class="col-date">Date</th>
                    <th class="col-status">Status</th>
                    <th class="col-actions">Action</th>
                </tr>
            </thead>
            <tbody id="submissions-table-body">
                <tr v-for="art in articles" :key="art.id">
                    <td class="col-title">
                        <div class="table-article-stack">
                            <button
                                type="button"
                                class="table-article-btn"
                                :title="`Review & Edit: ${art.title}`"
                                @click="emit('open-manuscript', art)"
                            >
                                {{ art.title }}
                            </button>
                            <div class="table-article-author-row">
                                <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
                                <span>By <strong>{{ art.author || 'Author' }}</strong></span>
                            </div>
                        </div>
                    </td>
                    <td class="col-category">
                        <span class="table-section-tag" :title="art.category || defaultCategory || 'General'">
                            {{ formatCategoryDisplay(art.category || defaultCategory) }}
                        </span>
                    </td>
                    <td class="col-date">
                        <span class="table-date" :title="art.date || ''">
                            {{ formatDate(art.date) }}
                        </span>
                    </td>
                    <td class="col-status">
                        <span
                            class="status-badge-pill"
                            :class="isRevisionStatus(art.status) ? 'is-revision' : 'is-review'"
                            :title="isRevisionStatus(art.status) ? 'Click to view revision remarks' : 'For Review'"
                            :style="isRevisionStatus(art.status) ? 'cursor: pointer;' : ''"
                            @click="isRevisionStatus(art.status) && emit('remarks', art)"
                        >
                            {{ isRevisionStatus(art.status) ? 'For Revision' : 'For Review' }}
                        </span>
                    </td>
                    <td class="col-actions">
                        <div class="table-actions-group">
                            <template v-if="isRevisionStatus(art.status)">
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-edit"
                                    title="Edit manuscript"
                                    @click="emit('open-manuscript', art)"
                                >
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Edit</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-submit"
                                    title="Resubmit revised article"
                                    :disabled="isSubmitting"
                                    @click="emit('resubmit', art)"
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                    <span>Resubmit</span>
                                </button>
                            </template>
                            <template v-else>
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-revision"
                                    title="Return for revision"
                                    @click="emit('revision', art)"
                                >
                                    <i class="fa-solid fa-rotate-left"></i>
                                    <span>Revision</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-approve"
                                    title="Approve article"
                                    :disabled="isSubmitting"
                                    @click="emit('approve', art)"
                                >
                                    <i class="fa-solid fa-check"></i>
                                    <span>Approve</span>
                                </button>
                            </template>
                        </div>
                    </td>
                </tr>
                <tr v-if="!isLoading && articles.length === 0">
                    <td colspan="5" class="empty-state-cell">
                        {{ emptyText }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.pending-approval-no-scroll {
    width: 100%;
    overflow: visible;
}

table.data-table.unified-pending-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: auto !important;
    border-collapse: collapse !important;
}

table.data-table.unified-pending-table thead th {
    padding: 11px 10px !important;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #667085;
    background: #f9fafb;
    border-bottom: 1px solid #eaecf0;
    vertical-align: middle !important;
}

table.data-table.unified-pending-table tbody td {
    padding: 12px 10px !important;
    border-bottom: 1px solid #f2f4f7;
    vertical-align: middle !important;
}

table.data-table.unified-pending-table tbody tr:last-child td {
    border-bottom: none;
}

table.data-table.unified-pending-table tbody tr:hover td {
    background-color: #f9fafb;
}

/* Primary column: Article Title takes all remaining flexible width */
table.data-table.unified-pending-table th.col-title,
table.data-table.unified-pending-table td.col-title {
    width: auto !important;
    min-width: 150px !important;
    padding-left: 14px !important;
    padding-right: 12px !important;
    text-align: left !important;
    white-space: normal !important;
    word-break: break-word !important;
}

/* Content-hugging compact columns */
table.data-table.unified-pending-table th.col-category,
table.data-table.unified-pending-table td.col-category,
table.data-table.unified-pending-table th.col-date,
table.data-table.unified-pending-table td.col-date,
table.data-table.unified-pending-table th.col-status,
table.data-table.unified-pending-table td.col-status,
table.data-table.unified-pending-table th.col-actions,
table.data-table.unified-pending-table td.col-actions {
    width: 1% !important;
    min-width: 0 !important;
    white-space: nowrap !important;
}

table.data-table.unified-pending-table th.col-category,
table.data-table.unified-pending-table td.col-category,
table.data-table.unified-pending-table th.col-date,
table.data-table.unified-pending-table td.col-date,
table.data-table.unified-pending-table th.col-status,
table.data-table.unified-pending-table td.col-status {
    text-align: center !important;
}

table.data-table.unified-pending-table th.col-actions {
    text-align: center !important;
    padding-right: 14px !important;
}

table.data-table.unified-pending-table td.col-actions {
    text-align: right !important;
    padding-right: 14px !important;
}

.table-article-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    width: 100%;
}

.table-article-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left !important;
    font-family: var(--font-heading, 'Merriweather', Georgia, serif) !important;
    font-weight: 700 !important;
    font-size: 0.88rem !important;
    line-height: 1.35;
    color: var(--text-primary, #101828);
    white-space: normal !important;
    word-break: break-word;
    transition: color 0.15s ease;
}

.table-article-btn:hover {
    color: var(--sidebar-maroon, #5c0a18);
    text-decoration: underline;
}

.table-article-author-row {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.74rem;
    color: #667085;
    line-height: 1.3;
}

.table-article-author-row i {
    font-size: 0.68rem;
    color: #5c0a18;
}

.table-article-author-row strong {
    font-weight: 600;
    color: #344054;
}

.table-section-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    background-color: #f2f4f7;
    color: #344054;
    border: 1px solid #e4e7ec;
}

.table-date {
    display: inline-block;
    font-size: 0.76rem;
    color: #667085;
    white-space: nowrap;
}

.status-badge-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
}

.status-badge-pill.is-review {
    background-color: #fef7e0;
    color: #9a5b00;
    border: 1px solid #fde68a;
}

.status-badge-pill.is-revision {
    background-color: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
}

.table-actions-group {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 5px !important;
    flex-wrap: nowrap !important;
}

.btn-table-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 27px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.btn-table-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-table-edit {
    background-color: #f2f4f7;
    border-color: #d0d5dd;
    color: #344054;
}

.btn-table-edit:hover:not(:disabled) {
    background-color: #e4e7ec;
    color: #101828;
}

.btn-table-revision {
    background-color: #fffaf0;
    border-color: #fedf89;
    color: #b54708;
}

.btn-table-revision:hover:not(:disabled) {
    background-color: #fef0c7;
    border-color: #fdb022;
    color: #93370d;
}

.btn-table-approve,
.btn-table-submit {
    background-color: var(--sidebar-maroon, #5c0a18);
    border-color: var(--sidebar-maroon, #5c0a18);
    color: #ffffff;
}

.btn-table-approve:hover:not(:disabled),
.btn-table-submit:hover:not(:disabled) {
    background-color: #7a0d20;
    border-color: #7a0d20;
    transform: translateY(-1px);
}

.empty-state-cell {
    font-size: 0.86rem;
    color: #667085;
    text-align: center !important;
    padding: 32px 12px !important;
    border-bottom: none !important;
    background: transparent !important;
}

/* Compact medium viewports without horizontal scrollbar */
@media (max-width: 1120px) and (min-width: 641px) {
    table.data-table.unified-pending-table thead th,
    table.data-table.unified-pending-table tbody td {
        padding: 9px 7px !important;
    }

    table.data-table.unified-pending-table th.col-title,
    table.data-table.unified-pending-table td.col-title {
        min-width: 120px !important;
        padding-left: 12px !important;
        padding-right: 9px !important;
    }

    table.data-table.unified-pending-table th.col-actions,
    table.data-table.unified-pending-table td.col-actions {
        padding-right: 12px !important;
    }

    .btn-table-action {
        height: 25px;
        padding: 0 6px;
        font-size: 0.7rem;
    }
}

/* Mobile card-row responsiveness: zero horizontal scrollbar */
@media (max-width: 640px) {
    table.data-table.unified-pending-table,
    table.data-table.unified-pending-table tbody {
        display: block !important;
        width: 100% !important;
    }

    table.data-table.unified-pending-table thead {
        display: none !important;
    }

    table.data-table.unified-pending-table tbody tr {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px 6px !important;
        padding: 12px 10px !important;
        border-bottom: 1px solid #eaecf0 !important;
    }

    table.data-table.unified-pending-table tbody tr:last-child {
        border-bottom: none !important;
    }

    table.data-table.unified-pending-table tbody td {
        display: inline-flex !important;
        width: auto !important;
        min-width: 0 !important;
        padding: 0 !important;
        border-bottom: none !important;
        background: transparent !important;
    }

    table.data-table.unified-pending-table tbody td.col-title {
        display: block !important;
        flex: 1 0 100% !important;
        width: 100% !important;
        padding: 0 !important;
    }

    table.data-table.unified-pending-table tbody td.col-actions {
        flex: 1 0 100% !important;
        width: 100% !important;
        justify-content: flex-end !important;
        padding-top: 2px !important;
    }

    table.data-table.unified-pending-table tbody td.empty-state-cell {
        display: block !important;
        width: 100% !important;
        padding: 24px 10px !important;
    }
}
</style>
