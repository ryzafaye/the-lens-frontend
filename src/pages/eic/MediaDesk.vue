<script setup>
import { ref, computed, onMounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicMediaDesk,
    approveEicMedia,
    returnEicMediaForRevision,
} from '../../services/api.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-cover-review.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/executive-manage-articles.css';
import '../../assets/css/mpc-media-desk.css';

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const coverList = ref([]);
const currentTab = ref('photo'); // 'photo' or 'cartoon'
const currentSort = ref('newest');

// Modals State
const isInspectOpen = ref(false);
const activeInspectItem = ref(null);

const isReturnOpen = ref(false);
const activeReturnItem = ref(null);
const returnRemarks = ref('');
const returnError = ref('');

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Item helper
function getItemType(item) {
    if (!item) return 'photo';
    const type = (item.type || item.mediaType || item.category || '').toLowerCase();
    if (type.includes('cartoon') || type.includes('illustration') || type.includes('drawing')) return 'cartoon';
    return 'photo';
}

function isItemPending(item) {
    if (!item) return false;
    const s = (item.status || '').toLowerCase();
    if (s.includes('approved') || s.includes('published') || s.includes('revision') || s.includes('returned') || s.includes('archived')) {
        return false;
    }
    return true;
}

function cleanArtistName(name) {
    if (!name) return 'Media Team Member';
    return String(name).replace(/\s*\([^)]*\)/g, '').trim();
}

function cleanTitle(item) {
    if (!item) return '';
    return getCustomTitle(item, getItemType(item) === 'cartoon' ? 'Editorial Cartoon' : 'Editorial Photo');
}

// Badges
const badgePhoto = computed(() => {
    return coverList.value.filter(item => getItemType(item) === 'photo' && isItemPending(item)).length;
});

const badgeCartoon = computed(() => {
    return coverList.value.filter(item => getItemType(item) === 'cartoon' && isItemPending(item)).length;
});

// Filtered and Sorted list
const filteredList = computed(() => {
    return coverList.value
        .filter(item => getItemType(item) === currentTab.value && isItemPending(item))
        .sort((a, b) => {
            const timeA = new Date(a.rawDate || a.date || a.created_at || 0).getTime();
            const timeB = new Date(b.rawDate || b.date || b.created_at || 0).getTime();
            return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
        });
});

// Load Media Desk
async function loadMediaDesk() {
    isLoading.value = true;
    try {
        const res = await getEicMediaDesk(true);
        if (res && Array.isArray(res.coverList)) {
            coverList.value = res.coverList;
        } else if (res && Array.isArray(res)) {
            coverList.value = res;
        }
    } catch (err) {
        console.error('Failed to load media desk:', err);
        showToast('Failed to load media assets.', 'error');
    } finally {
        isLoading.value = false;
    }
}

// Modal Handlers
function openInspectModal(item) {
    activeInspectItem.value = item;
    isInspectOpen.value = true;
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectItem.value = null;
}

function openReturnModal(item) {
    activeReturnItem.value = item || activeInspectItem.value;
    returnRemarks.value = '';
    returnError.value = '';
    isInspectOpen.value = false;
    isReturnOpen.value = true;
}

function closeReturnModal() {
    isReturnOpen.value = false;
    activeReturnItem.value = null;
    returnRemarks.value = '';
    returnError.value = '';
}

// Actions
async function handleApprove(item = null) {
    const target = item || activeInspectItem.value;
    if (!target || isSubmitting.value) return;

    const typeLabel = getItemType(target) === 'cartoon' ? 'cartoon' : 'visual asset';
    const confirmed = await confirmAction({
        title: 'Approve Visual Asset',
        message: `Are you sure you want to approve this ${typeLabel} and forward it to the publication library?`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        await approveEicMedia(target.id);

        coverList.value = coverList.value.map(c => {
            if (c.id === target.id) {
                return { ...c, status: 'EIC Approved' };
            }
            return c;
        });

        if (isInspectOpen.value && activeInspectItem.value?.id === target.id) {
            closeInspectModal();
        }

        const successLabel = getItemType(target) === 'cartoon' ? 'Editorial cartoon' : 'Photojournalism capture';
        showToast(`${successLabel} approved and forwarded to publication library.`, 'success');
    } catch (err) {
        console.error('Failed to approve media:', err);
        showToast('Failed to approve visual asset.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

async function handleConfirmReturn() {
    if (!activeReturnItem.value || isSubmitting.value) return;

    if (!returnRemarks.value || !returnRemarks.value.trim()) {
        returnError.value = 'Revision feedback remarks are required.';
        return;
    }

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this visual asset for revision with feedback remarks?',
        confirmText: 'Return for Revision',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    returnError.value = '';

    try {
        const target = activeReturnItem.value;
        await returnEicMediaForRevision(target.id, returnRemarks.value.trim());

        coverList.value = coverList.value.map(c => {
            if (c.id === target.id) {
                return { ...c, status: 'Returned for Revision', remarks: returnRemarks.value.trim() };
            }
            return c;
        });

        if (isInspectOpen.value && activeInspectItem.value?.id === target.id) {
            closeInspectModal();
        }

        closeReturnModal();
        showToast('Artwork returned for revision with feedback.', 'warning');
    } catch (err) {
        console.error('Failed to return media for revision:', err);
        showToast('Failed to return artwork for revision.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

onMounted(() => {
    loadMediaDesk();
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
            <!-- Header & Tabs Section -->
            <div class="cover-page-header-section animate-fade-in">
                <div class="cover-header-row page-header-row">
                    <h1 class="cover-page-title page-title">Media Desk</h1>

                    <!-- Sort Dropdown -->
                    <div class="review-sort-container cover-sort-container">
                        <label for="cover-sort-select" class="review-sort-label cover-sort-label">
                            <i class="fa-solid fa-arrow-down-wide-short"></i>
                            <span>Sort:</span>
                        </label>
                        <div class="sort-select-wrapper">
                            <select
                                id="cover-sort-select"
                                v-model="currentSort"
                                class="review-sort-select cover-sort-select"
                                aria-label="Sort pending artwork by date"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                            </select>
                            <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                        </div>
                    </div>
                </div>

                <!-- Tabs: PHOTOS and CARTOON -->
                <div class="cover-tabs-container manage-tabs-container" role="tablist" aria-label="Media Desk Tabs">
                    <button
                        type="button"
                        class="review-tab-btn manage-tab-btn"
                        :class="{ active: currentTab === 'photo' }"
                        @click="currentTab = 'photo'"
                        role="tab"
                        :aria-selected="currentTab === 'photo'"
                    >
                        <i class="fa-solid fa-camera"></i>
                        <span>PHOTOS</span>
                        <span class="review-tab-badge tab-count-badge">{{ badgePhoto }}</span>
                    </button>
                    <button
                        type="button"
                        class="review-tab-btn manage-tab-btn"
                        :class="{ active: currentTab === 'cartoon' }"
                        @click="currentTab = 'cartoon'"
                        role="tab"
                        :aria-selected="currentTab === 'cartoon'"
                    >
                        <i class="fa-solid fa-palette"></i>
                        <span>CARTOON</span>
                        <span class="review-tab-badge tab-count-badge">{{ badgeCartoon }}</span>
                    </button>
                </div>
            </div>

            <!-- Loading Spinner -->
            <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading visual assets...</p>
            </div>

            <!-- Empty Queue State -->
            <div v-else-if="filteredList.length === 0" class="cover-empty-state mpc-tab-empty-state">
                <div class="empty-state-icon-circle">
                    <i :class="currentTab === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                </div>
                <h3>
                    {{ currentTab === 'cartoon' ? 'All Caught Up on Editorial Cartoons' : 'All Caught Up on Photojournalism Captures' }}
                </h3>
            </div>

            <!-- Responsive Artwork Cards Grid -->
            <div v-else class="cover-cards-grid">
                <div
                    v-for="item in filteredList"
                    :key="item.id"
                    class="cover-card"
                >
                    <!-- Clickable Artwork Thumbnail -->
                    <div
                        class="cover-thumb-container"
                        style="height: 190px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; padding: 10px; position: relative; overflow: hidden; cursor: pointer;"
                        @click="openInspectModal(item)"
                        title="Click to view artwork full size"
                    >
                        <img
                            :src="resolveMediaUrl(item, { width: 600 })"
                            alt="Artwork Preview"
                            class="cover-thumb-img"
                            style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 8px; display: block;"
                            loading="lazy"
                        >

                        <div class="cover-thumb-overlay">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                            <span>Inspect Artwork</span>
                        </div>

                        <!-- Type Tag on Top-Left -->
                        <div class="cover-thumb-badge-group" style="position: absolute; top: 10px; left: 10px; z-index: 2;">
                            <span class="cover-type-tag" :class="getItemType(item)">
                                <i :class="getItemType(item) === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                {{ getItemType(item).toUpperCase() }}
                            </span>
                        </div>

                        <!-- Status Badge on Top-Right -->
                        <div class="cover-thumb-status-badge" style="position: absolute; top: 10px; right: 10px; z-index: 2;">
                            <span class="media-status-pill pending-eic-review">
                                <i class="fa-regular fa-clock"></i>
                                <span>PENDING EIC REVIEW</span>
                            </span>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="cover-card-body" style="padding: 14px 16px;">
                        <div class="media-card-meta" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #475467;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar"></i> {{ item.date || 'Recent' }}</span>
                            <span style="white-space: nowrap;">
                                <i :class="getItemType(item) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-palette'" style="color: #700f2b;"></i>
                                <strong>{{ cleanArtistName(item.artist || item.uploader?.full_name) }}</strong>
                            </span>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="cover-card-footer" style="padding: 12px 16px; display: flex; align-items: center; gap: 8px; border-top: 1px solid #f1f5f9; background: #fafbfc;">
                        <button
                            type="button"
                            class="btn-cover-return"
                            @click="openReturnModal(item)"
                            title="Return for revisions"
                            style="flex: 1; padding: 7px 12px; font-size: 0.80rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; border: 1px solid #cbd5e1; background: #ffffff; color: #344054; cursor: pointer; transition: all 0.15s ease;"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Return for Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-cover-approve"
                            :disabled="isSubmitting"
                            @click="handleApprove(item)"
                            title="Approve Artwork"
                            style="flex: 1; padding: 7px 14px; font-size: 0.80rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; background: #5c0a18; border: 1px solid #5c0a18; color: #ffffff; cursor: pointer; transition: all 0.15s ease;"
                        >
                            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-check"></i>
                            <span>Approve {{ getItemType(item) === 'cartoon' ? 'Cartoon' : 'Photo' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>

        <!-- Modal 1: Full-Size Theater Inspection Modal -->
        <div
            v-if="isInspectOpen"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-artist"
            @click.self="closeInspectModal"
        >
            <div class="modal-card media-inspect-modal-card cover-inspect-modal-card">
                <div class="viewer-modal-header" style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-direction: row;">
                        <span class="cover-type-tag" :class="getItemType(activeInspectItem)">
                            <i :class="getItemType(activeInspectItem) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-paintbrush'" aria-hidden="true" style="margin-right: 4px;"></i>
                            {{ getItemType(activeInspectItem).toUpperCase() }}
                        </span>
                        <span class="media-status-pill pending-eic-review">
                            <i class="fa-regular fa-clock"></i>
                            <span>PENDING EIC REVIEW</span>
                        </span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <button
                            type="button"
                            class="modal-close-icon"
                            @click="closeInspectModal"
                            aria-label="Close artwork inspector"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="modal-body" style="padding: 16px 20px; overflow-y: auto;">
                    <div class="media-inspect-preview-container cover-inspect-theater">
                        <img
                            :src="resolveMediaUrl(activeInspectItem, { width: 1600, crop: 'limit' })"
                            alt="Publication Artwork Full View"
                            class="media-inspect-img cover-inspect-image-fullscreen"
                        >
                    </div>

                    <div style="margin-top: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: #64748b;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> {{ activeInspectItem?.date || activeInspectItem?.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;">
                                <i :class="getItemType(activeInspectItem) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-paintbrush'" style="margin-right: 6px; color: #700f2b;"></i>
                                <span>{{ getItemType(activeInspectItem) === 'photo' ? 'Photojournalist:' : 'Cartoonist:' }} <strong>{{ cleanArtistName(activeInspectItem?.artist || activeInspectItem?.artist_name || activeInspectItem?.uploader?.full_name || activeInspectItem?.uploader_name) }}</strong></span>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="modal-footer cover-inspect-footer-bar" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
                    <div class="inspect-footer-buttons" style="display: flex; align-items: center; gap: 10px;">
                        <button
                            type="button"
                            class="btn-inspect-return"
                            @click="openReturnModal(activeInspectItem)"
                            style="padding: 8px 18px; border: 1px solid #cbd5e1; background: #ffffff; color: #344054; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Return for Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-inspect-approve"
                            :disabled="isSubmitting"
                            @click="handleApprove(activeInspectItem)"
                            style="padding: 8px 20px; border: 1px solid #5c0a18; background: #5c0a18; color: #ffffff; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 2px 6px rgba(92, 10, 24, 0.25);"
                        >
                            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-check"></i>
                            <span>Approve {{ getItemType(activeInspectItem) === 'cartoon' ? 'Cartoon' : 'Photo' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 2: Return for Revision Remarks Modal -->
        <div
            v-if="isReturnOpen"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeReturnModal"
            style="z-index: 10000;"
        >
            <div class="modal-card cover-return-modal-card" style="max-width: 520px; width: 92%; border-radius: 12px; background: #ffffff; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
                <div class="modal-header-simple" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: #fef2f2; color: #991b1b; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
                            <i class="fa-solid fa-rotate-left"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b; font-family: 'DM Sans', sans-serif;">Return Artwork for Revision</h3>
                            <p style="margin: 0; font-size: 0.76rem; color: #64748b;">Feedback will be sent to the contributor</p>
                        </div>
                    </div>
                    <button type="button" class="modal-close-icon" @click="closeReturnModal" aria-label="Close modal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="modal-body" style="padding: 20px 22px;">
                    <!-- Recipient Banner -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; color: #334155;">
                            <i :class="getItemType(activeReturnItem) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-paintbrush'" style="color: #700f2b;"></i>
                            <span>Returning to: <strong>{{ cleanArtistName(activeReturnItem?.artist || activeReturnItem?.uploader?.full_name) }}</strong></span>
                        </div>
                        <span class="cover-type-tag" :class="getItemType(activeReturnItem)" style="font-size: 0.68rem; padding: 2px 7px;">
                            {{ getItemType(activeReturnItem).toUpperCase() }}
                        </span>
                    </div>

                    <div class="form-field" style="margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label for="return-remarks-input" style="font-weight: 600; font-size: 0.86rem; color: #1e293b;">
                                Revision Feedback Remarks <span style="color: #dc2626;">*</span>
                            </label>
                            <span style="font-size: 0.72rem; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">Required</span>
                        </div>
                        <textarea
                            id="return-remarks-input"
                            v-model="returnRemarks"
                            class="form-input"
                            rows="4"
                            placeholder="Specify the adjustments needed (composition, lighting, concept revisions, text modifications)..."
                            style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; outline: none; transition: border-color 0.15s ease; box-sizing: border-box; resize: vertical;"
                        ></textarea>
                        <p v-if="returnError" style="color: #dc2626; font-size: 0.80rem; margin: 6px 0 0 0; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ returnError }}</span>
                        </p>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 14px 22px; border-top: 1px solid #eaecf0; background: #fafbfc; display: flex; justify-content: flex-end; gap: 10px;">
                    <button
                        type="button"
                        class="btn-modal-cancel"
                        @click="closeReturnModal"
                        style="padding: 8px 18px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #ffffff; border: 1px solid #d0d5dd; color: #344054; cursor: pointer; transition: all 0.15s ease;"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-modal-submit-return"
                        :disabled="isSubmitting"
                        @click="handleConfirmReturn"
                        style="padding: 8px 20px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #991b1b; border: 1px solid #991b1b; color: #ffffff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 1px 3px rgba(153, 27, 27, 0.25);"
                    >
                        <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-paper-plane"></i>
                        <span>{{ isSubmitting ? 'Submitting...' : 'Send Revision Feedback' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </EicLayout>
</template>

<style scoped>
/* Semi-fullscreen responsive inspect theater */
.media-inspect-modal-card,
.cover-inspect-modal-card {
    max-width: min(92vw, 940px) !important;
    width: min(92vw, 920px) !important;
    max-height: 92vh !important;
    display: flex !important;
    flex-direction: column !important;
    margin: auto !important;
    background: #ffffff !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
}

.media-inspect-preview-container,
.cover-inspect-theater {
    width: 100% !important;
    height: 60vh !important;
    max-height: 65vh !important;
    min-height: 320px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    background-color: transparent !important;
    padding: 0 !important;
    overflow: hidden !important;
    border-radius: 8px !important;
}

.media-inspect-img,
.cover-inspect-image-fullscreen {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
    border-radius: 8px !important;
    display: block !important;
    margin: 0 auto !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
}

/* Button Styling */
.btn-inspect-return {
    background: #ffffff !important;
    background-color: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #344054 !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    padding: 8px 18px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.15s ease !important;
    white-space: nowrap !important;
}

.btn-inspect-return:hover {
    background: #f8fafc !important;
    background-color: #f8fafc !important;
    border-color: #94a3b8 !important;
    color: #1e293b !important;
    transform: translateY(-1px) !important;
}

.btn-inspect-approve {
    background-color: var(--sidebar-maroon, #5c0a18) !important;
    background: var(--sidebar-maroon, #5c0a18) !important;
    border: 1px solid var(--sidebar-maroon, #5c0a18) !important;
    border-color: var(--sidebar-maroon, #5c0a18) !important;
    color: #ffffff !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    padding: 8px 20px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    transition: all 0.18s ease !important;
    white-space: nowrap !important;
    box-shadow: 0 2px 6px rgba(92, 10, 24, 0.25) !important;
}

.btn-inspect-approve:hover:not(:disabled) {
    background-color: #780c1a !important;
    background: #780c1a !important;
    border-color: #780c1a !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 14px rgba(92, 10, 24, 0.35) !important;
}

.btn-inspect-approve:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-cover-approve {
    background-color: var(--sidebar-maroon, #5c0a18) !important;
    background: var(--sidebar-maroon, #5c0a18) !important;
    border: 1px solid var(--sidebar-maroon, #5c0a18) !important;
    color: #ffffff !important;
}

.btn-cover-approve:hover:not(:disabled) {
    background-color: #780c1a !important;
    background: #780c1a !important;
    border-color: #780c1a !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(92, 10, 24, 0.32) !important;
}

.modal-close-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
}

.modal-close-icon:hover {
    background: #fee2e2;
    color: #b91c1c;
    border-color: #fca5a5;
    transform: rotate(90deg);
}

.btn-modal-cancel:hover {
    background: #f8fafc !important;
    border-color: #98a2b3 !important;
}

.btn-modal-submit-return:hover:not(:disabled) {
    background: #7f1d1d !important;
    border-color: #7f1d1d !important;
    transform: translateY(-1px);
}
</style>
