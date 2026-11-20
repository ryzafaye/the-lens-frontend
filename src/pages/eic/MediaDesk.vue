<script setup>
import { ref, computed, onMounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicMediaDesk,
    approveEicMedia,
    returnEicMediaForRevision,
} from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import '../../assets/css/executive-dashboard.css';
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

// Toast notification
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
    activeReturnItem.value = item;
    returnRemarks.value = '';
    returnError.value = '';
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

        const typeLabel = getItemType(target) === 'cartoon' ? 'Editorial cartoon' : 'Photojournalism capture';
        showToast(`${typeLabel} approved and forwarded to publication library.`, 'success');
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
                        @click="openInspectModal(item)"
                        title="Click to view artwork full size"
                    >
                        <img
                            :src="optimizeCloudinaryUrl(item.image, { width: 600 })"
                            alt="Artwork Preview"
                            class="cover-thumb-img"
                            loading="lazy"
                        >

                        <div class="cover-thumb-overlay">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                            <span>Inspect Artwork</span>
                        </div>

                        <div class="cover-thumb-badge-group">
                            <span class="cover-type-tag" :class="getItemType(item)">
                                {{ getItemType(item).toUpperCase() }}
                            </span>
                        </div>

                        <span class="cover-thumb-date">
                            <i class="fa-regular fa-calendar"></i>
                            <span>{{ item.date || 'Recent' }}</span>
                        </span>
                    </div>

                    <!-- Card Body -->
                    <div class="cover-card-body">
                        <div class="cover-provenance-box">
                            <div class="cover-artist-row">
                                <i :class="getItemType(item) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-palette'"></i>
                                <span>
                                    {{ getItemType(item) === 'photo' ? 'Photojournalist' : 'Cartoonist' }}:
                                    <strong>{{ cleanArtistName(item.artist || item.uploader?.full_name) }}</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="cover-card-footer">
                        <button
                            type="button"
                            class="btn-cover-return"
                            @click="openReturnModal(item)"
                            title="Return for revisions"
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
                        >
                            <i class="fa-solid fa-check"></i>
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
            <div class="modal-card cover-inspect-modal-card">
                <div class="cover-inspect-header">
                    <div class="cover-inspect-header-left">
                        <span class="cover-type-tag" :class="getItemType(activeInspectItem)">
                            {{ getItemType(activeInspectItem).toUpperCase() }}
                        </span>
                        <div class="cover-inspect-artist-row">
                            <i :class="getItemType(activeInspectItem) === 'photo' ? 'fa-solid fa-camera' : 'fa-solid fa-paintbrush'" aria-hidden="true"></i>
                            <span>Artist: <strong id="inspect-artist">{{ cleanArtistName(activeInspectItem?.artist || activeInspectItem?.uploader?.full_name) }}</strong></span>
                        </div>
                    </div>
                    <div class="cover-inspect-header-right">
                        <button
                            type="button"
                            class="cover-modal-close-btn"
                            @click="closeInspectModal"
                            aria-label="Close artwork inspector"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="cover-inspect-theater">
                    <img
                        :src="activeInspectItem?.image"
                        alt="Publication Artwork Full View"
                        class="cover-inspect-image-fullscreen"
                    >
                </div>

                <div class="cover-inspect-footer-bar" style="justify-content: flex-end;">
                    <div class="inspect-footer-buttons">
                        <button
                            type="button"
                            class="btn-inspect-return"
                            @click="openReturnModal(activeInspectItem)"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Return for Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-inspect-approve"
                            :disabled="isSubmitting"
                            @click="handleApprove(activeInspectItem)"
                        >
                            <i class="fa-solid fa-check"></i>
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
        >
            <div class="modal-card" style="max-width: 500px; padding: 24px;">
                <div class="modal-header-simple" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 class="modal-title font-semibold text-base" style="color: #991b1b; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>Return Artwork for Revision</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" @click="closeReturnModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="form-field" style="margin-bottom: 16px;">
                    <label for="return-remarks-input" style="display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px;">
                        Revision Feedback Remarks *
                    </label>
                    <textarea
                        id="return-remarks-input"
                        v-model="returnRemarks"
                        class="form-input"
                        rows="4"
                        placeholder="Provide clear notes on what requires adjustment..."
                        style="width: 100%; resize: vertical;"
                    ></textarea>
                    <p v-if="returnError" style="color: #dc2626; font-size: 0.8rem; margin-top: 4px;">
                        {{ returnError }}
                    </p>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button
                        type="button"
                        class="btn-box-save"
                        style="background: #e5e7eb; color: #374151;"
                        @click="closeReturnModal"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-modal-submit-deactivate"
                        :disabled="isSubmitting"
                        @click="handleConfirmReturn"
                    >
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>{{ isSubmitting ? 'Submitting...' : 'Send Revision Feedback' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Global Toast Notification -->
        <div v-if="toast.show" class="toast-container">
            <div class="custom-toast" :class="toast.type">
                <i v-if="toast.type === 'success'" class="fa-solid fa-circle-check"></i>
                <i v-else-if="toast.type === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
                <i v-else class="fa-solid fa-circle-exclamation"></i>
                <span>{{ toast.message }}</span>
            </div>
        </div>
    </EicLayout>
</template>
