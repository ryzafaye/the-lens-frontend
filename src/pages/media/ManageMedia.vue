<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MediaLayout from '../../layouts/MediaLayout.vue';
import ResubmitMediaModal from '../../components/ResubmitMediaModal.vue';
import {
    getMediaManageMedia,
    endorseMediaPhoto,
    returnMediaPhotoForRevision,
} from '../../services/api.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/writer-dashboard.css';
import '../../assets/css/media-manage-media.css';

const router = useRouter();

// State
const isLoading = ref(true);
const mediaItems = ref([]);
const isSectionHead = ref(false);
const currentFilter = ref('all'); // 'all' | 'pending' | 'returned' | 'eic_approved' | 'published'
const searchQuery = ref('');
const currentSort = ref('newest'); // 'newest' | 'oldest' | 'az'

// Inspect Modal
const isInspectOpen = ref(false);
const activeInspectItem = ref(null);

// Resubmit Modal
const isResubmitOpen = ref(false);
const activeResubmitItem = ref(null);

function openResubmitModal(item) {
    activeResubmitItem.value = item;
    isResubmitOpen.value = true;
}

function closeResubmitModal() {
    isResubmitOpen.value = false;
    activeResubmitItem.value = null;
}

function handleResubmitted() {
    closeResubmitModal();
    closeInspectModal();
    loadMedia();
}

// Revision Modal
const isRevisionModalOpen = ref(false);
const revisionRemarks = ref('');
const isSubmittingAction = ref(false);

// Toast replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

function resolveImageUrl(itemOrUrl, width = 800) {
    return resolveMediaUrl(itemOrUrl, { width, crop: 'limit' });
}

function cleanArtistName(name) {
    if (!name) return 'Media Team Member';
    return String(name).replace(/^By\s+/i, '').trim();
}

function cleanTitle(item) {
    return getCustomTitle(item, item?.type === 'graphic' ? 'Editorial Graphic' : 'Editorial Photo');
}

function normalizeStatus(status) {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('published')) return 'published';
    if (s.includes('approved') || s.includes('approved_for_mpc')) return 'eic_approved';
    if (s.includes('revision') || s.includes('returned')) return 'returned';
    return 'pending';
}

function getStatusBadgeConfig(status) {
    const norm = normalizeStatus(status);
    if (norm === 'published') {
        return { class: 'published', label: 'PUBLISHED', icon: 'fa-solid fa-globe' };
    }
    if (norm === 'eic_approved') {
        return { class: 'eic-approved', label: 'EIC APPROVED', icon: 'fa-solid fa-shield-halved' };
    }
    if (norm === 'returned') {
        return { class: 'returned', label: 'RETURNED FOR REVISION', icon: 'fa-solid fa-rotate-left' };
    }
    return { class: 'pending-with-head', label: 'PENDING WITH HEAD', icon: 'fa-regular fa-clock' };
}

// Counts
const countAll = computed(() => mediaItems.value.length);
const countPending = computed(() => mediaItems.value.filter(m => normalizeStatus(m.status) === 'pending').length);
const countReturned = computed(() => mediaItems.value.filter(m => normalizeStatus(m.status) === 'returned').length);
const countEic = computed(() => mediaItems.value.filter(m => normalizeStatus(m.status) === 'eic_approved').length);
const countPublished = computed(() => mediaItems.value.filter(m => normalizeStatus(m.status) === 'published').length);

// Filtered and Sorted list
const filteredMediaItems = computed(() => {
    let list = [...mediaItems.value];

    if (currentFilter.value !== 'all') {
        list = list.filter(m => normalizeStatus(m.status) === currentFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(m => {
            const title = cleanTitle(m).toLowerCase();
            const artist = (m.artist_name || m.uploader_name || '').toLowerCase();
            const article = (m.connectedArticleTitle || m.article_title || '').toLowerCase();
            return title.includes(q) || artist.includes(q) || article.includes(q);
        });
    }

    list.sort((a, b) => {
        if (currentSort.value === 'az') {
            return cleanTitle(a).localeCompare(cleanTitle(b));
        }
        const timeA = new Date(a.rawDate || a.date || a.created_at || 0).getTime();
        const timeB = new Date(b.rawDate || b.date || b.created_at || 0).getTime();
        return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
});

function openInspectModal(item) {
    activeInspectItem.value = item;
    isInspectOpen.value = true;
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectItem.value = null;
}

function openRevisionModal() {
    revisionRemarks.value = '';
    isRevisionModalOpen.value = true;
}

function closeRevisionModal() {
    isRevisionModalOpen.value = false;
    revisionRemarks.value = '';
}

async function handleEndorse(item) {
    if (isSubmittingAction.value) return;

    const confirmed = await confirmAction({
        title: 'Endorse Photo',
        message: 'Are you sure you want to endorse this photo to the Editor-in-Chief?',
        confirmText: 'Endorse Photo',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmittingAction.value = true;
    try {
        await endorseMediaPhoto(item.id);
        showToast('Photo endorsed to Editor-in-Chief successfully.', 'success');
        item.status = 'Approved by Head';
        closeInspectModal();
        loadMedia();
    } catch (err) {
        console.error('Failed to endorse photo:', err);
        showToast(err.response?.data?.message || 'Failed to endorse photo.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

async function handleReturnForRevision() {
    if (!revisionRemarks.value.trim()) {
        showToast('Please enter revision remarks for the contributor.', 'warning');
        return;
    }
    if (isSubmittingAction.value || !activeInspectItem.value) return;

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this photo for revision?',
        confirmText: 'Return for Revision',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;

    isSubmittingAction.value = true;
    try {
        await returnMediaPhotoForRevision(activeInspectItem.value.id, revisionRemarks.value.trim());
        showToast('Photo returned for revision.', 'success');
        activeInspectItem.value.status = 'Returned for Revision';
        activeInspectItem.value.remarks = revisionRemarks.value.trim();
        closeRevisionModal();
        closeInspectModal();
        loadMedia();
    } catch (err) {
        console.error('Failed to return photo for revision:', err);
        showToast(err.response?.data?.message || 'Failed to return photo.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

async function loadMedia() {
    isLoading.value = true;
    try {
        const data = await getMediaManageMedia(true);
        if (data && Array.isArray(data.mediaItems)) {
            mediaItems.value = data.mediaItems;
        }
        if (data && typeof data.isSectionHead === 'boolean') {
            isSectionHead.value = data.isSectionHead;
        }
    } catch (err) {
        console.error('Failed to load media items:', err);
        showToast('Failed to load media assets.', 'error');
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadMedia();
});
</script>

<template>
    <MediaLayout>
        <main class="content-container">
            <!-- Page Title Section -->
            <div class="writer-header-row animate-fade-in delay-1" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 6px;">
                <div class="writer-header-left">
                    <h1 class="page-title">Manage My Media</h1>
                </div>

                <div class="writer-header-right">
                    <router-link to="/media/submit-media" class="btn-primary-action">
                        <i class="fa-solid fa-camera"></i>
                        <span>Submit Photo</span>
                    </router-link>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="manage-tabs-container animate-fade-in delay-2" role="tablist" aria-label="Filter media submissions">
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'all' }"
                    @click="currentFilter = 'all'"
                    role="tab"
                    :aria-selected="currentFilter === 'all'"
                >
                    <span>All Media</span>
                    <span class="tab-count-badge">{{ countAll }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'pending' }"
                    @click="currentFilter = 'pending'"
                    role="tab"
                    :aria-selected="currentFilter === 'pending'"
                >
                    <span><i class="fa-regular fa-clock"></i> Pending with Head</span>
                    <span class="tab-count-badge">{{ countPending }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'returned' }"
                    @click="currentFilter = 'returned'"
                    role="tab"
                    :aria-selected="currentFilter === 'returned'"
                >
                    <span><i class="fa-solid fa-triangle-exclamation"></i> Returned for Revision</span>
                    <span class="tab-count-badge">{{ countReturned }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'eic_approved' }"
                    @click="currentFilter = 'eic_approved'"
                    role="tab"
                    :aria-selected="currentFilter === 'eic_approved'"
                >
                    <span><i class="fa-solid fa-shield-halved"></i> EIC Approved</span>
                    <span class="tab-count-badge">{{ countEic }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'published' }"
                    @click="currentFilter = 'published'"
                    role="tab"
                    :aria-selected="currentFilter === 'published'"
                >
                    <span><i class="fa-solid fa-globe"></i> Published</span>
                    <span class="tab-count-badge">{{ countPublished }}</span>
                </button>
            </div>

            <!-- Search Bar & Sort Dropdown Toolbar -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <!-- Search Bar -->
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        v-model="searchQuery"
                        type="search"
                        class="manage-search-input"
                        placeholder="Search media by title or contributor..."
                        aria-label="Search media submissions"
                        autocomplete="off"
                    >
                    <button
                        v-if="searchQuery"
                        type="button"
                        class="clear-search-icon"
                        title="Clear search"
                        @click="searchQuery = ''"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Sort Control -->
                <div class="review-sort-container">
                    <label for="media-sort-select" class="review-sort-label">
                        <i class="fa-solid fa-arrow-down-short-wide"></i>
                        <span>Sort:</span>
                    </label>
                    <div class="sort-select-wrapper">
                        <select id="media-sort-select" v-model="currentSort" class="review-sort-select" aria-label="Sort media submissions">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="az">Title (A–Z)</option>
                        </select>
                        <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                    </div>
                </div>
            </div>

            <!-- Media Grid -->
            <section class="manage-media-grid animate-fade-in delay-3" aria-label="Media submissions grid">
                <!-- Loading Skeleton -->
                <template v-if="isLoading">
                    <div v-for="n in 6" :key="n" class="manage-media-card skeleton-card">
                        <div class="media-card-preview-box skeleton-box" style="height: 190px;"></div>
                        <div class="media-card-content" style="padding: 16px;">
                            <div class="skeleton-line" style="width: 70%; height: 16px; margin-bottom: 8px;"></div>
                            <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                        </div>
                    </div>
                </template>

                <!-- Empty State -->
                <div v-else-if="filteredMediaItems.length === 0" class="empty-state-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #fdf2f4; color: #700f2b; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 12px;">
                        <i class="fa-regular fa-image"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; color: #1e293b; margin: 0 0 6px 0; font-family: 'DM Sans', sans-serif;">No media found</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 16px 0;">
                        {{ searchQuery ? 'No media matching your search terms.' : 'No media items in this category.' }}
                    </p>
                    <router-link to="/media/submit-media" class="btn-primary-action" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-camera"></i>
                        <span>Submit Photo</span>
                    </router-link>
                </div>

                <!-- Media Cards -->
                <div
                    v-else
                    v-for="item in filteredMediaItems"
                    :key="item.id"
                    class="manage-media-card"
                    @click="openInspectModal(item)"
                    style="cursor: pointer;"
                >
                    <div class="media-card-preview-box">
                        <img
                            :src="resolveImageUrl(item)"
                            :alt="getCustomTitle(item, 'Photo Asset')"
                            class="media-card-img"
                            loading="lazy"
                        >
                        <div class="media-card-badge-layer">
                            <span class="cover-type-tag" :class="item.type === 'graphic' ? 'cartoon' : 'photo'">
                                <i :class="item.type === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                {{ item.type === 'graphic' ? 'GRAPHIC' : 'PHOTO' }}
                            </span>
                            <span :class="['media-status-pill', getStatusBadgeConfig(item.status).class]">
                                <i :class="getStatusBadgeConfig(item.status).icon"></i>
                                <span>{{ getStatusBadgeConfig(item.status).label }}</span>
                            </span>
                        </div>
                    </div>

                    <div class="media-card-body" style="padding: 14px 16px; display: flex; flex-direction: column; flex: 1;">
                        <div class="media-card-meta" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #64748b; margin-bottom: 12px;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar"></i> {{ item.date || item.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i :class="item.type === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: #700f2b;"></i> <strong>{{ cleanArtistName(item.artist_name || item.uploader_name) }}</strong></span>
                        </div>

                        <div class="media-card-actions" style="margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                            <button type="button" class="btn-media-inspect" @click.stop="openInspectModal(item)" style="width: auto; padding: 6px 14px;">
                                <i class="fa-regular fa-eye"></i>
                                <span>Inspect {{ item.type === 'graphic' ? 'Graphic' : 'Photo' }}</span>
                            </button>
                            <button
                                v-if="normalizeStatus(item.status) === 'returned'"
                                type="button"
                                class="btn-media-resubmit"
                                @click.stop="openResubmitModal(item)"
                                title="Resubmit photo for review"
                            >
                                <i class="fa-solid fa-paper-plane"></i>
                                <span>Resubmit</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <!-- MODAL: Full Media Inspect Modal -->
        <div
            v-if="isInspectOpen && activeInspectItem"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeInspectModal"
        >
            <div class="modal-card media-inspect-modal-card">
                <div class="viewer-modal-header" style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="cover-type-tag" :class="activeInspectItem.type === 'graphic' ? 'cartoon' : 'photo'">
                            <i :class="activeInspectItem.type === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                            <span>{{ (activeInspectItem.type === 'graphic' ? 'Graphic' : 'Photo').toUpperCase() }}</span>
                        </span>
                        <span :class="['media-status-pill', getStatusBadgeConfig(activeInspectItem.status).class]">
                            <i :class="getStatusBadgeConfig(activeInspectItem.status).icon"></i>
                            <span>{{ getStatusBadgeConfig(activeInspectItem.status).label }}</span>
                        </span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <button type="button" class="modal-close-icon" @click="closeInspectModal" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="modal-body" style="padding: 16px 20px; overflow-y: auto;">
                    <div class="media-inspect-preview-container cover-inspect-theater" style="background: transparent; border-radius: 10px; padding: 0; display: flex; align-items: center; justify-content: center; height: 60vh; max-height: 65vh; overflow: hidden; width: 100%;">
                        <img
                            :src="resolveImageUrl(activeInspectItem, 1600)"
                            :alt="cleanArtistName(activeInspectItem.artist_name || activeInspectItem.uploader_name)"
                            class="media-inspect-img cover-inspect-image-fullscreen"
                            style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);"
                        >
                    </div>

                    <div style="margin-top: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: #64748b;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> {{ activeInspectItem.date || activeInspectItem.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i :class="activeInspectItem.type === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="margin-right: 6px; color: #700f2b;"></i> <span>{{ activeInspectItem.type === 'graphic' ? 'Graphic Artist:' : 'Photojournalist:' }} <strong>{{ cleanArtistName(activeInspectItem.artist_name || activeInspectItem.uploader_name) }}</strong></span></span>
                        </div>

                        <div v-if="activeInspectItem.remarks" class="media-review-note-box" style="margin-top: 14px;">
                            <strong><i class="fa-solid fa-comment-dots"></i> Desk Revision Feedback:</strong>
                            <p style="margin: 6px 0 0 0; color: #4c0519; font-size: 0.9rem; line-height: 1.5;">{{ activeInspectItem.remarks }}</p>
                        </div>
                    </div>
                </div>

                <!-- Section Head Actions Footer -->
                <div v-if="isSectionHead && normalizeStatus(activeInspectItem.status) === 'pending'" class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
                    <button
                        type="button"
                        class="btn-inspect-return"
                        @click="openRevisionModal"
                        style="padding: 8px 18px; border: 1px solid #cbd5e1; background: #ffffff; color: #344054; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
                    >
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>Return for Revision</span>
                    </button>
                    <button
                        type="button"
                        class="btn-inspect-approve"
                        :disabled="isSubmittingAction"
                        @click="handleEndorse(activeInspectItem)"
                        style="padding: 8px 20px; border: 1px solid var(--sidebar-maroon, #5c0a18); background: var(--sidebar-maroon, #5c0a18); color: #ffffff; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 2px 6px rgba(92, 10, 24, 0.25);"
                    >
                        <i v-if="isSubmittingAction" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-shield-halved"></i>
                        <span>Endorse to EIC</span>
                    </button>
                </div>

                <!-- Resubmit Footer for Returned Photo -->
                <div v-else-if="normalizeStatus(activeInspectItem.status) === 'returned'" class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
                    <button
                        type="button"
                        class="btn-modal-cancel"
                        @click="closeInspectModal"
                        style="padding: 8px 16px; border: 1px solid #cbd5e1; background: #ffffff; color: #344054; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        class="btn-media-resubmit"
                        @click="openResubmitModal(activeInspectItem)"
                    >
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>Resubmit Photo</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Global Reusable Resubmit Modal -->
        <ResubmitMediaModal
            :is-open="isResubmitOpen"
            :item="activeResubmitItem"
            media-type="photo"
            @close="closeResubmitModal"
            @resubmitted="handleResubmitted"
        />

        <!-- MODAL: Revision Remarks Input -->
        <div
            v-if="isRevisionModalOpen"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeRevisionModal"
            style="z-index: 10000;"
        >
            <div class="modal-card cover-return-modal-card" style="max-width: 520px; width: 92%; border-radius: 12px; background: #ffffff; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
                <div class="modal-header-simple" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #eaecf0; background: #fafbfc;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: #fef2f2; color: #991b1b; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
                            <i class="fa-solid fa-rotate-left"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b; font-family: 'DM Sans', sans-serif;">Return {{ activeInspectItem?.type === 'graphic' ? 'Graphic' : 'Photo' }} for Revision</h3>
                            <p style="margin: 0; font-size: 0.76rem; color: #64748b;">Feedback will be sent to the contributor</p>
                        </div>
                    </div>
                    <button type="button" class="modal-close-icon" @click="closeRevisionModal" aria-label="Close modal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="modal-body" style="padding: 20px 22px;">
                    <!-- Recipient Banner -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; color: #334155;">
                            <i :class="activeInspectItem?.type === 'graphic' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: #700f2b;"></i>
                            <span>Returning to: <strong>{{ cleanArtistName(activeInspectItem?.artist_name || activeInspectItem?.uploader_name) }}</strong></span>
                        </div>
                        <span class="cover-type-tag" :class="activeInspectItem?.type === 'graphic' ? 'cartoon' : 'photo'" style="font-size: 0.68rem; padding: 2px 7px;">
                            {{ (activeInspectItem?.type === 'graphic' ? 'Graphic' : 'Photo').toUpperCase() }}
                        </span>
                    </div>

                    <div class="form-field" style="margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label for="media-revision-remarks" style="font-weight: 600; font-size: 0.86rem; color: #1e293b;">
                                Revision Feedback Remarks <span style="color: #dc2626;">*</span>
                            </label>
                            <span style="font-size: 0.72rem; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">Required</span>
                        </div>
                        <textarea
                            id="media-revision-remarks"
                            v-model="revisionRemarks"
                            rows="4"
                            placeholder="Specify detailed visual notes, adjustments, cropping, or resolution fixes needed..."
                            style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; outline: none; transition: border-color 0.15s ease; box-sizing: border-box; resize: vertical;"
                        ></textarea>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 14px 22px; border-top: 1px solid #eaecf0; background: #fafbfc; display: flex; justify-content: flex-end; gap: 10px;">
                    <button
                        type="button"
                        class="btn-modal-cancel"
                        @click="closeRevisionModal"
                        style="padding: 8px 18px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #ffffff; border: 1px solid #d0d5dd; color: #344054; cursor: pointer; transition: all 0.15s ease;"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-modal-submit-return"
                        :disabled="!revisionRemarks.trim() || isSubmittingAction"
                        @click="handleReturnForRevision"
                        style="padding: 8px 20px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #991b1b; border: 1px solid #991b1b; color: #ffffff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 1px 3px rgba(153, 27, 27, 0.25);"
                        :style="!revisionRemarks.trim() ? 'opacity: 0.6; cursor: not-allowed;' : ''"
                    >
                        <i v-if="isSubmittingAction" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-paper-plane"></i>
                        <span>Send Revision Feedback</span>
                    </button>
                </div>
            </div>
        </div>
    </MediaLayout>
</template>

<style scoped>
.skeleton-card {
    background: #ffffff;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
}
.skeleton-box {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
.skeleton-line {
    background: #e2e8f0;
    border-radius: 4px;
}
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
</style>
