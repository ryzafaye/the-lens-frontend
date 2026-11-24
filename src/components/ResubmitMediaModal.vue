<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { resolveMediaUrl, getCustomTitle } from '../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../utils/modal.js';
import {
    resubmitCartoonIllustration,
    resubmitMediaPhoto,
    resubmitMpcMedia,
} from '../services/api.js';

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
    item: {
        type: Object,
        default: null,
    },
    mediaType: {
        type: String,
        default: '', // 'cartoon' | 'photo' | 'media'
    },
});

const emit = defineEmits(['close', 'resubmitted']);

// Local state
const fileInputRef = ref(null);
const titleInputRef = ref(null);
const selectedFile = ref(null);
const newPreviewUrl = ref('');
const displayTitle = ref('');
const fileSize = ref('');
const isSubmitting = ref(false);

const effectiveType = computed(() => {
    if (props.mediaType) return props.mediaType;
    if (props.item?.image_type === 'cartoon' || props.item?.type === 'cartoon') return 'cartoon';
    if (props.item?.image_type === 'graphic' || props.item?.type === 'graphic') return 'graphic';
    return 'photo';
});

const typeLabel = computed(() => {
    if (effectiveType.value === 'cartoon') return 'Cartoon';
    if (effectiveType.value === 'graphic') return 'Graphic';
    return 'Photo';
});

function resolveImageUrl(itemOrUrl, width = 800) {
    return resolveMediaUrl(itemOrUrl, { width, crop: 'limit' });
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

watch(
    () => props.isOpen,
    (open) => {
        if (open && props.item) {
            displayTitle.value = getCustomTitle(props.item, `Editorial ${typeLabel.value}`);
            selectedFile.value = null;
            newPreviewUrl.value = '';
            fileSize.value = '';
            isSubmitting.value = false;
        }
    },
    { immediate: true }
);

function triggerBrowse() {
    if (fileInputRef.value) {
        fileInputRef.value.click();
    }
}

function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) processFile(file);
}

function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) processFile(file);
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        globalShowToast('Please upload an image file (PNG, JPG, WEBP, or SVG).', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        globalShowToast('Image size exceeds 10MB limit.', 'error');
        return;
    }

    selectedFile.value = file;
    fileSize.value = formatFileSize(file.size);

    // If title was still default, update it with base filename
    const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
    if (!displayTitle.value || displayTitle.value.startsWith('Editorial ')) {
        displayTitle.value = baseName;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        newPreviewUrl.value = e.target?.result;
    };
    reader.readAsDataURL(file);
}

function removeNewFile() {
    selectedFile.value = null;
    newPreviewUrl.value = '';
    fileSize.value = '';
    if (fileInputRef.value) fileInputRef.value.value = '';
}

function handleClose() {
    if (isSubmitting.value) return;
    removeNewFile();
    emit('close');
}

async function handleConfirmResubmit() {
    if (!props.item || isSubmitting.value) return;

    const title = displayTitle.value.trim() || `Editorial ${typeLabel.value}`;

    const confirmed = await confirmAction({
        title: `Resubmit ${typeLabel.value}`,
        message: `Are you sure you want to resubmit "${title}" for review?`,
        confirmText: `Resubmit ${typeLabel.value}`,
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const formData = new FormData();
        if (selectedFile.value) {
            if (effectiveType.value === 'cartoon') {
                formData.append('cartoon_file', selectedFile.value);
            } else {
                formData.append('media_file', selectedFile.value);
            }
        }
        formData.append('title', title);

        let res;
        if (effectiveType.value === 'cartoon') {
            res = await resubmitCartoonIllustration(props.item.id, formData);
        } else if (props.mediaType === 'mpc') {
            res = await resubmitMpcMedia(props.item.id, formData);
        } else {
            res = await resubmitMediaPhoto(props.item.id, formData);
        }

        globalShowToast(res?.message || `${typeLabel.value} resubmitted for review successfully!`, 'success');
        emit('resubmitted', res?.cartoon || res?.media || props.item);
        handleClose();
    } catch (err) {
        console.error('Failed to resubmit artwork:', err);
        globalShowToast(err.response?.data?.message || `Failed to resubmit ${typeLabel.value.toLowerCase()}. Please try again.`, 'error');
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <div
        v-if="isOpen && item"
        class="modal-overlay resubmit-media-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resubmit-media-title"
        @click.self="handleClose"
    >
        <div class="modal-card resubmit-media-modal-card">
            <!-- Modal Header -->
            <div class="viewer-modal-header" style="padding: 16px 22px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #ffffff;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="cover-type-tag" :class="effectiveType === 'cartoon' ? 'cartoon' : 'photo'" style="font-size: 0.72rem; padding: 3px 8px; font-weight: 700; border-radius: 4px;">
                        <i :class="effectiveType === 'cartoon' ? 'fa-solid fa-paintbrush' : (effectiveType === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera')"></i>
                        {{ typeLabel.toUpperCase() }}
                    </span>
                    <h3 id="resubmit-media-title" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #101828; font-family: 'DM Sans', sans-serif;">
                        Resubmit {{ typeLabel }} for Review
                    </h3>
                </div>
                <button
                    type="button"
                    class="modal-close-icon"
                    aria-label="Close modal"
                    :disabled="isSubmitting"
                    @click="handleClose"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="modal-body" style="padding: 20px 22px; max-height: 72vh; overflow-y: auto;">
                <!-- Revision Feedback Remarks Box -->
                <div v-if="item.remarks" class="media-review-note-box" style="margin-bottom: 18px; background: #fdf2f2; border: 1px solid #fecdca; border-radius: 8px; padding: 12px 14px;">
                    <div style="display: flex; align-items: center; gap: 6px; color: #7a0d20; font-weight: 700; font-size: 0.86rem; margin-bottom: 4px;">
                        <i class="fa-solid fa-comment-dots"></i>
                        <span>Desk Revision Feedback:</span>
                    </div>
                    <p style="margin: 0; color: #5c0a18; font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap;">{{ item.remarks }}</p>
                </div>

                <!-- Comparison / Image Preview Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px;">
                    <!-- Left: Current Uploaded Artwork -->
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                            <i class="fa-regular fa-image"></i>
                            <span>Current Submission</span>
                        </div>
                        <div style="width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
                            <img
                                :src="resolveImageUrl(item)"
                                :alt="displayTitle"
                                style="max-width: 100%; max-height: 100%; object-fit: contain;"
                            >
                        </div>
                    </div>

                    <!-- Right: New Revised Replacement (or upload prompt) -->
                    <div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; background: #ffffff; display: flex; flex-direction: column;">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #101828; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: inline-flex; align-items: center; gap: 5px;">
                                <i class="fa-solid fa-arrow-up-from-bracket" style="color: #5c0a18;"></i>
                                <span>{{ selectedFile ? 'Revised Artwork' : 'Upload Revised File' }}</span>
                            </span>
                            <button
                                v-if="selectedFile"
                                type="button"
                                @click="removeNewFile"
                                style="border: none; background: transparent; color: #b42318; font-size: 0.75rem; font-weight: 600; cursor: pointer;"
                            >
                                Remove
                            </button>
                        </div>

                        <!-- If replacement file selected -->
                        <div v-if="newPreviewUrl" style="width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; background: #fafafa; border-radius: 6px; overflow: hidden; border: 1px solid #bbf7d0;">
                            <img
                                :src="newPreviewUrl"
                                alt="Revised Replacement Preview"
                                style="max-width: 100%; max-height: 100%; object-fit: contain;"
                            >
                        </div>

                        <!-- Dropzone upload trigger if no new file selected -->
                        <div
                            v-else
                            class="resubmit-dropzone"
                            style="flex: 1; min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px; border: 2px dashed #d0d5dd; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; background: #fcfcfd;"
                            @click="triggerBrowse"
                            @dragover.prevent
                            @drop="handleDrop"
                        >
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.8rem; color: #5c0a18; margin-bottom: 8px;"></i>
                            <span style="font-size: 0.84rem; font-weight: 600; color: #344054;">Click to browse or drop file</span>
                            <span style="font-size: 0.74rem; color: #667085; margin-top: 2px;">SVG, PNG, JPG, or WEBP up to 10MB</span>
                        </div>
                    </div>
                </div>

                <!-- Hidden Native File Input -->
                <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style="display: none;"
                    @change="handleFileChange"
                >

                <!-- Selected File Status Badge -->
                <div v-if="selectedFile" style="display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #166534; font-weight: 500;">
                        <i class="fa-solid fa-check-circle" style="color: #16a34a;"></i>
                        <span>Ready to upload: <strong>{{ selectedFile.name }}</strong> ({{ fileSize }})</span>
                    </div>
                    <button
                        type="button"
                        @click="triggerBrowse"
                        style="border: none; background: transparent; color: #15803d; font-size: 0.78rem; font-weight: 600; cursor: pointer; text-decoration: underline;"
                    >
                        Change file
                    </button>
                </div>

                <!-- Display Title / Picture Title Input -->
                <div class="form-group" style="margin-bottom: 6px;">
                    <label for="resubmit-artwork-title" style="display: block; font-weight: 600; font-size: 0.86rem; color: #344054; margin-bottom: 6px;">
                        File Name (Picture Title)
                    </label>
                    <input
                        id="resubmit-artwork-title"
                        ref="titleInputRef"
                        v-model="displayTitle"
                        type="text"
                        class="form-control"
                        placeholder="Enter display title..."
                        style="width: 100%; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 6px; font-size: 0.9rem; color: #101828; outline: none; transition: border-color 0.15s ease;"
                        :disabled="isSubmitting"
                    >
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="modal-footer" style="padding: 14px 22px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
                <button
                    type="button"
                    class="btn-modal-cancel"
                    :disabled="isSubmitting"
                    @click="handleClose"
                    style="padding: 8px 18px; border: 1px solid #d0d5dd; background: #ffffff; color: #344054; border-radius: 6px; font-weight: 600; font-size: 0.84rem; cursor: pointer; transition: all 0.15s ease;"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-table-action btn-table-submit"
                    :disabled="isSubmitting"
                    @click="handleConfirmResubmit"
                    style="padding: 8px 20px; font-size: 0.84rem; font-weight: 600; background: #5c0a18; color: #ffffff; border: 1px solid #5c0a18; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 2px 6px rgba(92, 10, 24, 0.25);"
                >
                    <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                    <i v-else class="fa-solid fa-paper-plane"></i>
                    <span>{{ isSubmitting ? 'Resubmitting…' : `Resubmit ${typeLabel}` }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.resubmit-media-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.resubmit-media-modal-card {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.resubmit-dropzone:hover {
    border-color: #5c0a18 !important;
    background: #fff7f7 !important;
}

.btn-modal-cancel:hover:not(:disabled) {
    background: #f8fafc !important;
    border-color: #98a2b3 !important;
    color: #101828 !important;
}

.btn-table-submit:hover:not(:disabled) {
    background: #7a0d20 !important;
    border-color: #7a0d20 !important;
    transform: translateY(-1px);
}

@keyframes modalScaleIn {
    from {
        opacity: 0;
        transform: scale(0.96) translateY(4px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
</style>
