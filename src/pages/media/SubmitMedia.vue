<script setup>
import { ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import MediaLayout from '../../layouts/MediaLayout.vue';
import { submitMediaPhoto } from '../../services/api.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/mpc-submit-media.css';

const router = useRouter();

// State
const fileInputRef = ref(null);
const titleInputRef = ref(null);
const selectedFile = ref(null);
const previewUrl = ref('');
const fileName = ref('');
const picTitle = ref('');
const fileSize = ref('');
const mediaType = ref('photo');
const isEditingFileName = ref(false);
const isSubmitting = ref(false);

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

function toggleEditFileName() {
    isEditingFileName.value = !isEditingFileName.value;
    if (isEditingFileName.value) {
        nextTick(() => {
            if (titleInputRef.value) {
                titleInputRef.value.focus();
                titleInputRef.value.select();
            }
        });
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function triggerBrowse() {
    if (fileInputRef.value) {
        fileInputRef.value.click();
    }
}

function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) {
        processFile(file);
    }
}

function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file (PNG, JPG, WEBP, or SVG).', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image size exceeds 10MB limit.', 'error');
        return;
    }

    selectedFile.value = file;
    fileName.value = file.name;
    // Pre-fill editable file name / picture title without extension
    const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
    picTitle.value = baseName;
    fileSize.value = formatFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
        previewUrl.value = e.target?.result;
    };
    reader.readAsDataURL(file);
}

function removePreview() {
    selectedFile.value = null;
    previewUrl.value = '';
    fileName.value = '';
    picTitle.value = '';
    fileSize.value = '';
    isEditingFileName.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
}

async function handleSubmitMedia() {
    if (!selectedFile.value || isSubmitting.value) {
        showToast('Please select a photo file to submit.', 'warning');
        return;
    }

    const displayTitle = picTitle.value.trim() || fileName.value.replace(/\.[^/.]+$/, '').trim() || 'Editorial Photo';

    const confirmed = await confirmAction({
        title: 'Submit Media Photo',
        message: `Are you sure you want to submit "${displayTitle}" for review?`,
        confirmText: 'Submit Photo',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const formData = new FormData();
        formData.append('media_file', selectedFile.value);
        formData.append('type', 'photo');
        formData.append('title', displayTitle);

        await submitMediaPhoto(formData);
        showToast('Photo submitted successfully to the Media Desk!', 'success');
        setTimeout(() => {
            router.push('/media/manage-media');
        }, 1000);
    } catch (err) {
        console.error('Failed to submit photo:', err);
        showToast(err.response?.data?.message || 'Failed to submit photo. Please try again.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <MediaLayout>
        <main class="content-container">
            <!-- Page Title Section -->
            <div class="page-title-section animate-fade-in delay-1" style="margin-bottom: 24px;">
                <div class="page-header-row">
                    <h1 class="page-title">Submit Photo</h1>
                </div>
            </div>

            <div class="submit-media-container">
                <div id="view-upload-media" class="media-view-pane">
                    <form @submit.prevent="handleSubmitMedia" novalidate>
                        <div class="media-card">
                            <div class="media-card-header" style="margin-bottom: 24px;">
                                <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px;">
                                    <h2 class="media-card-title" style="margin-bottom: 0; display: inline-flex; align-items: center; gap: 12px;">
                                        <i class="fa-solid fa-camera" style="color: var(--sidebar-maroon, #700f2b); font-size: 1.15rem;"></i>
                                        <span>Submit Photo</span>
                                    </h2>
                                </div>
                            </div>

                            <!-- Upload Box Studio -->
                            <div class="media-section-group">
                                <!-- Dropzone -->
                                <div
                                    v-show="!previewUrl"
                                    id="media-dropzone"
                                    class="media-dropzone-box"
                                    role="button"
                                    tabindex="0"
                                    aria-label="Upload photo file"
                                    @click="triggerBrowse"
                                    @dragover.prevent
                                    @drop="handleDrop"
                                >
                                    <input
                                        ref="fileInputRef"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                        style="display: none;"
                                        @change="handleFileChange"
                                    >
                                    <div class="media-dropzone-icon">
                                        <i class="fa-solid fa-cloud-arrow-up"></i>
                                    </div>
                                    <div class="media-dropzone-primary-text">
                                        Drop your photo here, or <span class="media-browse-link">browse</span>
                                    </div>
                                    <div class="media-dropzone-subtext">
                                        Supports PNG, JPG, or WEBP &bull; Max file size 10MB
                                    </div>
                                </div>

                                <!-- Centered & Bounded Snug Preview Frame -->
                                <div v-show="previewUrl" class="media-preview-container" style="display: flex;">
                                    <div class="media-preview-wrapper">
                                        <img :src="previewUrl" alt="Selected Media Preview" class="media-preview-img">
                                        <button
                                            type="button"
                                            class="media-preview-remove-btn"
                                            title="Remove Photo"
                                            @click="removePreview"
                                        >
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- File Details Info Bar -->
                                <div v-show="previewUrl" class="media-file-info-bar" style="display: flex;">
                                    <div class="media-file-info-left">
                                        <i class="fa-solid fa-file-image media-file-icon"></i>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span class="media-file-name-text">{{ picTitle || fileName }}</span>
                                            <span class="media-file-size-text">&bull; {{ fileSize }}</span>
                                            <button
                                                v-if="!isEditingFileName"
                                                type="button"
                                                class="media-edit-filename-btn"
                                                title="Edit file name"
                                                @click="toggleEditFileName"
                                                style="border: 1px solid #e2e8f0; background: #ffffff; color: #5c0a18; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;"
                                            >
                                                <i class="fa-solid fa-pen-to-square"></i>
                                                <span>Edit</span>
                                            </button>
                                        </div>
                                    </div>
                                    <span class="media-file-ready-tag" style="background: #fdf2f4; color: var(--sidebar-maroon, #700f2b); border: 1px solid #fecdd3;">
                                        <i class="fa-solid fa-circle-check" style="color: var(--sidebar-maroon, #700f2b);"></i> Ready to submit
                                    </span>
                                </div>

                                <!-- Edit File Name Field (Shown only when Edit button is clicked) -->
                                <div v-show="previewUrl && isEditingFileName" class="media-section-group" style="margin-top: 14px;">
                                    <label class="media-field-label" style="display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 0.88rem; color: #1e293b; margin-bottom: 8px;">
                                        <span style="display: flex; align-items: center; gap: 8px;">
                                            <i class="fa-solid fa-pen-to-square" style="color: var(--sidebar-maroon, #700f2b);"></i>
                                            <span>Edit File Name</span>
                                        </span>
                                        <span style="font-size: 0.76rem; color: #64748b;">{{ (picTitle || '').length }} / 255</span>
                                    </label>
                                    <div style="position: relative; display: flex; align-items: center; gap: 8px;">
                                        <div style="position: relative; flex: 1; display: flex; align-items: center;">
                                            <i class="fa-solid fa-camera" style="position: absolute; left: 14px; color: #94a3b8; pointer-events: none; font-size: 0.9rem;"></i>
                                            <input
                                                ref="titleInputRef"
                                                type="text"
                                                v-model="picTitle"
                                                class="form-control"
                                                placeholder="Enter file name..."
                                                maxlength="255"
                                                style="width: 100%; padding: 10px 14px 10px 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; color: #1e293b; background: #ffffff; box-sizing: border-box; transition: all 0.2s ease;"
                                                @keydown.enter.prevent="isEditingFileName = false"
                                            >
                                        </div>
                                        <button
                                            type="button"
                                            class="media-done-btn"
                                            @click="isEditingFileName = false"
                                            style="padding: 10px 16px; background: #5c0a18; color: #fff; border: 1px solid #5c0a18; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;"
                                        >
                                            <i class="fa-solid fa-check"></i>
                                            <span>Done</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Bar: Submit Button -->
                            <div class="media-action-footer" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: flex-end;">
                                <button
                                    type="submit"
                                    class="btn-media-submit"
                                    :disabled="!selectedFile || isSubmitting"
                                    :style="!selectedFile ? 'opacity: 0.6; cursor: not-allowed;' : ''"
                                >
                                    <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                                    <i v-else class="fa-solid fa-paper-plane"></i>
                                    <span>{{ isSubmitting ? 'Uploading to Cloudinary...' : 'Submit Photo to Media Desk' }}</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    </MediaLayout>
</template>

<style scoped>
.btn-media-submit {
    background: #5c0a18 !important;
    background-color: #5c0a18 !important;
    border: 1px solid #5c0a18 !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    box-shadow: 0 2px 6px rgba(92, 10, 24, 0.28) !important;
}
.btn-media-submit:hover:not(:disabled) {
    background: #780c1a !important;
    background-color: #780c1a !important;
    border-color: #780c1a !important;
    color: #ffffff !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(92, 10, 24, 0.35) !important;
}
.media-done-btn {
    background: #5c0a18 !important;
    border: 1px solid #5c0a18 !important;
    color: #ffffff !important;
    transition: all 0.15s ease !important;
}
.media-done-btn:hover {
    background: #780c1a !important;
    border-color: #780c1a !important;
}
</style>
