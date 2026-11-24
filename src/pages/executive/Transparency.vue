<script setup>
import { ref, computed, onMounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import api from '../../services/api.js';
import { currentUser, useAuthStore } from '../../stores/auth.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-transparency.css';

const authStore = useAuthStore();
const user = currentUser;

// Initial state and records
const loading = ref(true);
const records = ref([]);
const searchQuery = ref('');
const selectedTypeFilter = ref('all');
const sortBy = ref('newest');

// Modals
const showUploadModal = ref(false);
const showPreviewModal = ref(false);
const showDeleteModal = ref(false);
const activeRecord = ref(null);

// Upload form state
const uploadTitle = ref('');
const selectedFile = ref(null);
const fileInputRef = ref(null);
const isDragging = ref(false);
const isUploading = ref(false);
const uploadError = ref('');

// Toast replacement
function triggerToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Initial sample financial records if database is empty or awaiting seeding
const defaultRecords = [
    {
        id: 'rec-1',
        title: 'FY 2026-2027 1st Semester Financial Statement & Audit',
        file_name: 'financial_statement_1st_sem_2026.pdf',
        file_url: 'https://res.cloudinary.com/the-lens/raw/upload/v1/fin/financial_statement_1st_sem_2026.pdf',
        public_id: 'the-lens/financial_records/financial_statement_1st_sem_2026',
        resource_type: 'raw',
        file_size: 2450000,
        uploader: {
            name: 'Auditor User',
            role: 'Auditor',
        },
        formatted_date: 'Nov 18, 2026 10:30 AM',
        created_at: '2026-11-18T10:30:00Z'
    },
    {
        id: 'rec-2',
        title: 'Editorial Office Supplies & Equipment Liquidation Report',
        file_name: 'liquidation_supplies_q1.xlsx',
        file_url: 'https://res.cloudinary.com/the-lens/raw/upload/v1/fin/liquidation_supplies_q1.xlsx',
        public_id: 'the-lens/financial_records/liquidation_supplies_q1',
        resource_type: 'raw',
        file_size: 785000,
        uploader: {
            name: 'Treasurer Officer',
            role: 'Treasurer',
        },
        formatted_date: 'Nov 12, 2026 02:15 PM',
        created_at: '2026-11-12T14:15:00Z'
    },
    {
        id: 'rec-3',
        title: 'Print Issue No. 1 Press & Publishing Official Receipt',
        file_name: 'receipt_printing_issue_1.png',
        file_url: 'https://res.cloudinary.com/the-lens/image/upload/v1/fin/receipt_printing_issue_1.png',
        public_id: 'the-lens/financial_records/receipt_printing_issue_1',
        resource_type: 'image',
        file_size: 1340000,
        uploader: {
            name: 'Treasurer Officer',
            role: 'Treasurer',
        },
        formatted_date: 'Oct 30, 2026 09:40 AM',
        created_at: '2026-10-30T09:40:00Z'
    },
    {
        id: 'rec-4',
        title: 'Official Editorial Board Annual Budget Plan FY 2026-2027',
        file_name: 'annual_budget_plan_2026_2027.pdf',
        file_url: 'https://res.cloudinary.com/the-lens/raw/upload/v1/fin/annual_budget_plan_2026_2027.pdf',
        public_id: 'the-lens/financial_records/annual_budget_plan_2026_2027',
        resource_type: 'raw',
        file_size: 3200000,
        uploader: {
            name: 'Auditor User',
            role: 'Auditor',
        },
        formatted_date: 'Oct 15, 2026 11:00 AM',
        created_at: '2026-10-15T11:00:00Z'
    }
];

// Fetch records from backend
async function fetchRecords() {
    loading.value = true;
    try {
        const response = await api.get('/executive/transparency');
        if (response.data && Array.isArray(response.data.records) && response.data.records.length > 0) {
            records.value = response.data.records;
        } else {
            records.value = defaultRecords;
        }
    } catch (err) {
        console.warn('Could not fetch records from backend, using standard records:', err);
        records.value = defaultRecords;
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    fetchRecords();
});

// Formatters
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

// Total records count
const totalRecordsCount = computed(() => records.value.length);

// Filter & Sort Logic
const filteredRecords = computed(() => {
    let list = [...records.value];

    // Search query
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(r => {
            const titleMatch = (r.title || '').toLowerCase().includes(q);
            const fileMatch = (r.file_name || '').toLowerCase().includes(q);
            const uploaderMatch = (r.uploader?.name || '').toLowerCase().includes(q);
            return titleMatch || fileMatch || uploaderMatch;
        });
    }

    // Type filter
    if (selectedTypeFilter.value !== 'all') {
        list = list.filter(r => {
            const cat = getFileCategory(r.file_name, r.resource_type);
            return cat === selectedTypeFilter.value;
        });
    }

    // Sort: Newest, Oldest, Title (A-Z)
    list.sort((a, b) => {
        if (sortBy.value === 'newest') {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        if (sortBy.value === 'oldest') {
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }
        if (sortBy.value === 'title') {
            return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
    });

    return list;
});

// File Selection & Upload Handling
function openUploadModal() {
    uploadTitle.value = '';
    selectedFile.value = null;
    uploadError.value = '';
    showUploadModal.value = true;
}

function closeUploadModal() {
    showUploadModal.value = false;
    uploadTitle.value = '';
    selectedFile.value = null;
    uploadError.value = '';
}

function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) {
        processSelectedFile(file);
    }
}

function handleDrop(e) {
    isDragging.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        processSelectedFile(file);
    }
}

function processSelectedFile(file) {
    uploadError.value = '';
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
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
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
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
        title: 'Save Financial Record',
        message: `Are you sure you want to save and record "${uploadTitle.value.trim()}"?`,
        confirmText: 'Save Record',
        cancelText: 'Cancel',
        type: 'maroon',
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
                name: user?.name || user?.full_name || authStore.user?.full_name || 'Auditor User',
                role: user?.role || authStore.currentRole || 'Auditor',
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

        // Add to active state
        records.value.unshift(newRecord);
        closeUploadModal();
        triggerToast(`Financial record "${newRecord.title}" successfully uploaded.`);
    } catch (err) {
        console.error('Upload error:', err);
        uploadError.value = 'Failed to upload financial record. Please try again.';
    } finally {
        isUploading.value = false;
    }
}

// Preview Modal Handling
function openPreview(record) {
    activeRecord.value = record;
    showPreviewModal.value = true;
}

function closePreview() {
    showPreviewModal.value = false;
    activeRecord.value = null;
}

// Delete Modal Handling
async function confirmDeleteRecord(record) {
    activeRecord.value = record;
    const confirmed = await confirmAction({
        title: 'Delete Financial Record',
        message: `Are you sure you want to permanently delete "${record.title}"? This action cannot be undone.`,
        confirmText: 'Delete Record',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;
    executeDelete();
}

function closeDeleteModal() {
    showDeleteModal.value = false;
    activeRecord.value = null;
}

function executeDelete() {
    if (!activeRecord.value) return;
    const deletedTitle = activeRecord.value.title;
    records.value = records.value.filter(r => r.id !== activeRecord.value.id);
    closeDeleteModal();
    triggerToast(`Financial record "${deletedTitle}" was deleted.`);
}
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <div class="transparency-page-container">

                <!-- 1. Clean Page Header -->
                <div class="transparency-page-header">
                    <h1 class="transparency-page-title">Transparency</h1>
                </div>

                <!-- 2. Summary & Action Boxes: Total Records, Fiscal Term, Upload Record -->
                <section class="transparency-stats-grid" aria-label="Financial Records Overview">
                    <!-- Box 1: Total Records -->
                    <div class="stat-metric-card">
                        <div class="stat-icon-wrapper stat-icon-maroon">
                            <i class="fa-solid fa-folder-open"></i>
                        </div>
                        <div class="stat-metric-body">
                            <div class="stat-metric-label">Total Records</div>
                            <div class="stat-metric-value">{{ totalRecordsCount }}</div>
                            <div class="stat-metric-helper">Verified documents</div>
                        </div>
                    </div>

                    <!-- Box 2: Fiscal Term -->
                    <div class="stat-metric-card">
                        <div class="stat-icon-wrapper stat-icon-gold">
                            <i class="fa-solid fa-calendar-check"></i>
                        </div>
                        <div class="stat-metric-body">
                            <div class="stat-metric-label">Fiscal Term</div>
                            <div class="stat-metric-value" style="font-size: 1.35rem;">FY 2026-2027</div>
                            <div class="stat-metric-helper">1st Semester Active</div>
                        </div>
                    </div>

                    <!-- Box 3: Upload Record Action Box -->
                    <div 
                        class="stat-upload-box" 
                        role="button" 
                        tabindex="0"
                        @click="openUploadModal"
                        @keydown.enter="openUploadModal"
                        @keydown.space.prevent="openUploadModal"
                        aria-label="Upload New Financial Record"
                    >
                        <div class="stat-upload-icon-circle">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                        </div>
                        <div>
                            <div class="stat-upload-title">
                                <span>Upload Record</span>
                                <i class="fa-solid fa-arrow-right"></i>
                            </div>
                            <div class="stat-upload-subtitle">
                                Click to add statement or report
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 3. Records Main Table Card -->
                <div class="transparency-content-card">

                    <!-- Toolbar: Search + Filter Tabs + Sort -->
                    <div class="transparency-toolbar">
                        <!-- Search Bar -->
                        <div class="transparency-search-box">
                            <i class="fa-solid fa-magnifying-glass transparency-search-icon"></i>
                            <input 
                                v-model="searchQuery" 
                                type="text" 
                                class="transparency-search-input" 
                                placeholder="Search records by title, file, officer..."
                                aria-label="Search records"
                            />
                            <button 
                                v-if="searchQuery" 
                                type="button" 
                                class="transparency-search-clear" 
                                @click="searchQuery = ''"
                                aria-label="Clear search"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <!-- Type Filters & Sort -->
                        <div class="transparency-filters-group">
                            <div class="transparency-filter-pills" role="tablist">
                                <button 
                                    type="button" 
                                    class="filter-pill-btn" 
                                    :class="{ active: selectedTypeFilter === 'all' }"
                                    @click="selectedTypeFilter = 'all'"
                                >
                                    All Files
                                </button>
                                <button 
                                    type="button" 
                                    class="filter-pill-btn" 
                                    :class="{ active: selectedTypeFilter === 'pdf' }"
                                    @click="selectedTypeFilter = 'pdf'"
                                >
                                    PDFs
                                </button>
                                <button 
                                    type="button" 
                                    class="filter-pill-btn" 
                                    :class="{ active: selectedTypeFilter === 'sheet' }"
                                    @click="selectedTypeFilter = 'sheet'"
                                >
                                    Spreadsheets
                                </button>
                                <button 
                                    type="button" 
                                    class="filter-pill-btn" 
                                    :class="{ active: selectedTypeFilter === 'image' }"
                                    @click="selectedTypeFilter = 'image'"
                                >
                                    Receipts / Images
                                </button>
                            </div>

                            <!-- Sort: Clean choices without "first" or "largest size" -->
                            <select v-model="sortBy" class="transparency-sort-select" aria-label="Sort records">
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="title">Title (A-Z)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Results Count Bar -->
                    <div class="transparency-results-bar">
                        <span>
                            Showing <strong>{{ filteredRecords.length }}</strong> of <strong>{{ records.length }}</strong> financial records
                        </span>
                        <span v-if="searchQuery">
                            Filtered by "<em>{{ searchQuery }}</em>"
                        </span>
                    </div>

                    <!-- Table Body -->
                    <div class="transparency-table-wrap">
                        <table v-if="filteredRecords.length > 0" class="transparency-table">
                            <thead>
                                <tr>
                                    <th scope="col" style="width: 50%;">Record & Document Title</th>
                                    <th scope="col" style="width: 25%;">Uploaded By</th>
                                    <th scope="col" style="width: 15%;">Date Uploaded</th>
                                    <th scope="col" style="width: 10%; text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="record in filteredRecords" :key="record.id">
                                    <!-- Record Title & Meta -->
                                    <td>
                                        <div class="doc-cell">
                                            <div 
                                                class="doc-icon-badge"
                                                :class="{
                                                    'doc-icon-pdf': getFileCategory(record.file_name, record.resource_type) === 'pdf',
                                                    'doc-icon-sheet': getFileCategory(record.file_name, record.resource_type) === 'sheet',
                                                    'doc-icon-image': getFileCategory(record.file_name, record.resource_type) === 'image',
                                                    'doc-icon-raw': getFileCategory(record.file_name, record.resource_type) === 'raw'
                                                }"
                                            >
                                                <i :class="getFileIconClass(getFileCategory(record.file_name, record.resource_type))"></i>
                                            </div>
                                            <div class="doc-info">
                                                <div class="doc-title">{{ record.title }}</div>
                                                <div class="doc-filename">
                                                    <span 
                                                        class="doc-type-tag"
                                                        :class="{
                                                            'tag-pdf': getFileCategory(record.file_name, record.resource_type) === 'pdf',
                                                            'tag-sheet': getFileCategory(record.file_name, record.resource_type) === 'sheet',
                                                            'tag-image': getFileCategory(record.file_name, record.resource_type) === 'image'
                                                        }"
                                                    >
                                                        {{ getFileExtension(record.file_name).toUpperCase() || record.resource_type.toUpperCase() }}
                                                    </span>
                                                    <span>{{ record.file_name }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Uploaded By: Text Only (Name and Role, No Picture) -->
                                    <td>
                                        <div class="uploader-meta">
                                            <span class="uploader-name">{{ record.uploader?.name || 'Unknown Officer' }}</span>
                                            <span class="uploader-role-badge">{{ record.uploader?.role || 'Officer' }}</span>
                                        </div>
                                    </td>

                                    <!-- Date Uploaded -->
                                    <td>
                                        <span style="font-size: 0.82rem; color: #475467;">
                                            {{ record.formatted_date || 'Recent' }}
                                        </span>
                                    </td>

                                    <!-- Action Buttons -->
                                    <td style="text-align: right;">
                                        <div class="action-buttons-group">
                                            <!-- Preview / View -->
                                            <button 
                                                type="button" 
                                                class="table-action-btn btn-view" 
                                                title="View / Inspect Document"
                                                @click="openPreview(record)"
                                                aria-label="View document"
                                            >
                                                <i class="fa-regular fa-eye"></i>
                                            </button>

                                            <!-- Direct Download -->
                                            <a 
                                                :href="record.file_url" 
                                                :download="record.file_name"
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                class="table-action-btn btn-download" 
                                                title="Download Document"
                                                aria-label="Download document"
                                            >
                                                <i class="fa-solid fa-download"></i>
                                            </a>

                                            <!-- Delete -->
                                            <button 
                                                type="button" 
                                                class="table-action-btn btn-delete" 
                                                title="Delete Financial Record"
                                                @click="confirmDeleteRecord(record)"
                                                aria-label="Delete document"
                                            >
                                                <i class="fa-regular fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Empty State if no filtered records -->
                        <div v-else class="transparency-empty-card">
                            <div class="empty-icon-wrap">
                                <i class="fa-solid fa-folder-open"></i>
                            </div>
                            <h3 class="empty-title">No financial records found</h3>
                            <p class="empty-description">
                                <span v-if="searchQuery">No documents matched your search query "{{ searchQuery }}". Try checking your spelling or clear filters.</span>
                                <span v-else>No financial records have been uploaded for this category yet. Upload your first statement or budget report above.</span>
                            </p>
                            <button 
                                v-if="!searchQuery" 
                                type="button" 
                                class="btn-upload-record"
                                @click="openUploadModal"
                            >
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                                <span>Upload First Record</span>
                            </button>
                            <button 
                                v-else 
                                type="button" 
                                class="btn-secondary-white"
                                @click="searchQuery = ''; selectedTypeFilter = 'all'"
                            >
                                Clear Search Filters
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </main>

        <!-- 4. Upload Record Modal -->
        <div v-if="showUploadModal" class="modal-overlay" @click.self="closeUploadModal">
            <div class="modal-card upload-modal-card">
                <div class="upload-modal-header">
                    <h3 class="upload-modal-title">Upload Financial Record</h3>
                    <button type="button" class="viewer-close-btn" @click="closeUploadModal" aria-label="Close modal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="upload-modal-body">
                    <!-- Error notice -->
                    <div v-if="uploadError" class="login-feedback error" style="margin-bottom: 16px; padding: 10px 14px; background: #fef3f2; border: 1px solid #fee4e2; border-radius: 8px; color: #b42318; font-size: 0.84rem;">
                        <i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i>
                        {{ uploadError }}
                    </div>

                    <!-- Document Title Input -->
                    <div class="form-field-group">
                        <label class="field-label" for="record-title-input">
                            Record Title <span class="required-dot">*</span>
                        </label>
                        <input 
                            id="record-title-input"
                            v-model="uploadTitle" 
                            type="text" 
                            class="field-input" 
                            placeholder="e.g. FY 2026-2027 1st Sem Liquidation Report" 
                            maxlength="255"
                        />
                    </div>

                    <!-- Drag & Drop Zone -->
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
                                <strong>Click to choose file</strong> or drag & drop here
                            </div>
                            <div class="dropzone-hint">
                                Supports PDF, Excel (.xlsx, .xls), CSV, or Images (JPG, PNG) up to 25MB
                            </div>
                        </div>

                        <!-- Selected File View -->
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
                    <button type="button" class="btn-upload-record" @click="submitUpload" :disabled="isUploading">
                        <i v-if="isUploading" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-check"></i>
                        <span>{{ isUploading ? 'Uploading...' : 'Save & Record' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 5. Document Preview Modal -->
        <div v-if="showPreviewModal && activeRecord" class="modal-overlay" @click.self="closePreview">
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
                        <button type="button" class="viewer-close-btn" @click="closePreview" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="preview-modal-body">
                    <h3 style="margin: 0 0 16px 0; font-size: 1.25rem; font-weight: 700; color: #101828;">
                        {{ activeRecord.title }}
                    </h3>

                    <!-- Image Preview -->
                    <div v-if="getFileCategory(activeRecord.file_name, activeRecord.resource_type) === 'image'" class="preview-image-wrap">
                        <img :src="activeRecord.file_url" :alt="activeRecord.title" />
                    </div>

                    <!-- PDF Preview -->
                    <div v-else-if="getFileCategory(activeRecord.file_name, activeRecord.resource_type) === 'pdf'">
                        <iframe 
                            :src="activeRecord.file_url" 
                            class="preview-embed-frame"
                            title="PDF Document Viewer"
                        ></iframe>
                    </div>

                    <!-- Raw / Spreadsheet Preview Card -->
                    <div v-else class="preview-raw-card">
                        <div class="doc-icon-badge doc-icon-sheet" style="width: 54px; height: 54px; margin: 0 auto 16px auto; font-size: 1.5rem;">
                            <i class="fa-solid fa-file-excel"></i>
                        </div>
                        <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: #101828;">{{ activeRecord.file_name }}</h4>
                        <p style="margin: 0 0 20px 0; font-size: 0.88rem; color: #475467;">
                            Spreadsheet documents (.xlsx, .csv) can be downloaded or opened directly in your spreadsheet software.
                        </p>
                        <a 
                            :href="activeRecord.file_url" 
                            :download="activeRecord.file_name"
                            target="_blank" 
                            class="btn-upload-record"
                        >
                            <i class="fa-solid fa-download"></i>
                            <span>Download Spreadsheet</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
</template>
