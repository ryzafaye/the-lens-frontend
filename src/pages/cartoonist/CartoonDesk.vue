<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import CartoonistLayout from '../../layouts/CartoonistLayout.vue';
import {
    getCartoonistDesk,
    endorseCartoonIllustration,
    returnCartoonIllustrationForRevision,
} from '../../services/api.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-dashboard.css';
import '../../assets/css/executive-cover-review.css';
import '../../assets/css/executive-modals.css';
import '../../assets/css/mpc-media-desk.css';

const router = useRouter();

// State
const isLoading = ref(true);
const pendingCartoons = ref([]);
const currentSort = ref('newest'); // 'newest' | 'oldest' | 'az'
const searchQuery = ref('');

// Modals
const isInspectOpen = ref(false);
const activeCartoon = ref(null);
const isRevisionModalOpen = ref(false);
const revisionRemarks = ref('');
const isSubmittingAction = ref(false);

// Centered Modal Toast/Feedback replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

function resolveImageUrl(itemOrUrl, width = 800) {
    return resolveMediaUrl(itemOrUrl, { width, crop: 'limit' });
}

function cleanArtistName(name) {
    if (!name) return 'Staff Cartoonist';
    return String(name).replace(/^By\s+/i, '').trim();
}

function cleanTitle(item) {
    return getCustomTitle(item, 'Editorial Cartoon');
}

const filteredCartoons = computed(() => {
    let list = [...pendingCartoons.value];

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(c => {
            const title = cleanTitle(c).toLowerCase();
            const artist = (c.artist_name || c.uploader_name || '').toLowerCase();
            return title.includes(q) || artist.includes(q);
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
    activeCartoon.value = item;
    isInspectOpen.value = true;
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeCartoon.value = null;
}

function openReturnModal(item) {
    activeCartoon.value = item || activeCartoon.value;
    revisionRemarks.value = '';
    isInspectOpen.value = false;
    isRevisionModalOpen.value = true;
}

function openRevisionModal() {
    openReturnModal(activeCartoon.value);
}

function closeRevisionModal() {
    isRevisionModalOpen.value = false;
    revisionRemarks.value = '';
}

async function handleEndorse(item) {
    if (isSubmittingAction.value) return;

    const confirmed = await confirmAction({
        title: 'Endorse Cartoon',
        message: 'Are you sure you want to endorse this cartoon and submit it to the Editor-in-Chief?',
        confirmText: 'Endorse Cartoon',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmittingAction.value = true;
    try {
        await endorseCartoonIllustration(item.id);
        showToast('Cartoon endorsed to Editor-in-Chief successfully.', 'success');
        closeInspectModal();
        loadDesk();
    } catch (err) {
        console.error('Failed to endorse cartoon:', err);
        showToast(err.response?.data?.message || 'Failed to endorse cartoon.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

async function handleReturnForRevision() {
    if (!revisionRemarks.value.trim()) {
        showToast('Please enter revision remarks for the cartoonist.', 'warning');
        return;
    }
    if (isSubmittingAction.value || !activeCartoon.value) return;

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: 'Are you sure you want to return this cartoon to the cartoonist with revision remarks?',
        confirmText: 'Return Cartoon',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmittingAction.value = true;
    try {
        await returnCartoonIllustrationForRevision(activeCartoon.value.id, revisionRemarks.value.trim());
        showToast('Cartoon returned to cartoonist for revision.', 'success');
        closeRevisionModal();
        closeInspectModal();
        loadDesk();
    } catch (err) {
        console.error('Failed to return cartoon for revision:', err);
        showToast(err.response?.data?.message || 'Failed to return cartoon.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

async function loadDesk() {
    isLoading.value = true;
    try {
        const data = await getCartoonistDesk(true);
        if (data && Array.isArray(data.pendingCartoons)) {
            pendingCartoons.value = data.pendingCartoons;
        } else if (Array.isArray(data)) {
            pendingCartoons.value = data;
        }
    } catch (err) {
        console.error('Failed to load cartoon desk data:', err);
        showToast('Failed to load cartoon desk reviews.', 'error');
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDesk();
});
</script>

<template>
    <CartoonistLayout>
        <main class="content-container" style="padding-top: 18px; gap: 10px;">
            <!-- Top Header & Tabs Section -->
            <div class="cover-page-header-section animate-fade-in delay-1" style="margin-bottom: 0;">
                <div class="cover-header-row page-header-row" style="margin-bottom: 0;">
                    <h1 class="cover-page-title page-title">Cartoon Desk</h1>

                    <!-- Sort Dropdown -->
                    <div class="review-sort-container cover-sort-container">
                        <label for="cover-sort-select" class="review-sort-label cover-sort-label">
                            <i class="fa-solid fa-arrow-down-wide-short"></i>
                            <span>Sort:</span>
                        </label>
                        <div class="sort-select-wrapper">
                            <select id="cover-sort-select" v-model="currentSort" class="review-sort-select cover-sort-select" aria-label="Sort submissions">
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="az">Title (A–Z)</option>
                            </select>
                            <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pending Review Cartoons Grid (Moved Up directly under Title Row) -->
            <section class="cover-cards-grid animate-fade-in delay-2" style="margin-top: 6px;" aria-label="Pending cartoon illustrations">
                <!-- Loading Skeleton -->
                <template v-if="isLoading">
                    <div v-for="n in 4" :key="n" class="cover-card skeleton-card">
                        <div class="cover-thumb-container skeleton-box" style="height: 190px;"></div>
                        <div class="cover-card-body" style="padding: 16px;">
                            <div class="skeleton-line" style="width: 70%; height: 16px; margin-bottom: 8px;"></div>
                            <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                        </div>
                    </div>
                </template>

                <!-- Empty State -->
                <div v-else-if="filteredCartoons.length === 0" class="empty-state-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #fdf2f4; color: #700f2b; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 12px;">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; color: #1e293b; margin: 0 0 6px 0; font-family: 'DM Sans', sans-serif;">All caught up!</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin: 0;">No pending editorial cartoons awaiting review in the Cartoon Desk queue.</p>
                </div>

                <!-- Cards -->
                <div
                    v-else
                    v-for="item in filteredCartoons"
                    :key="item.id"
                    class="cover-card"
                    @click="openInspectModal(item)"
                    style="cursor: pointer;"
                >
                    <div class="cover-thumb-container" style="height: 190px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; padding: 10px; position: relative; overflow: hidden;">
                        <img
                            :src="resolveImageUrl(item)"
                            :alt="cleanTitle(item)"
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
                            <span class="cover-type-tag cartoon" style="font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; background: rgba(15, 23, 42, 0.90); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.3); display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-paintbrush"></i> CARTOON
                            </span>
                        </div>

                        <!-- Status Badge on Top-Right -->
                        <div class="cover-thumb-status-badge" style="position: absolute; top: 10px; right: 10px; z-index: 2;">
                            <span class="media-status-pill pending-with-head">
                                <i class="fa-regular fa-clock"></i>
                                <span>PENDING APPROVAL</span>
                            </span>
                        </div>
                    </div>

                    <div class="cover-card-body" style="padding: 14px 16px;">
                        <div class="media-card-meta" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #64748b; margin: 0;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar"></i> {{ item.date || item.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i class="fa-solid fa-paintbrush" style="color: #700f2b;"></i> <strong>{{ cleanArtistName(item.artist_name || item.uploader_name) }}</strong></span>
                        </div>
                    </div>

                    <div class="cover-card-footer" style="padding: 12px 16px; display: flex; align-items: center; gap: 8px; border-top: 1px solid #f1f5f9; background: #fafbfc;">
                        <button
                            type="button"
                            class="btn-cover-return"
                            @click.stop="openReturnModal(item)"
                            title="Return to cartoonist for revision"
                            style="flex: 1; padding: 7px 12px; font-size: 0.80rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; border: 1px solid #cbd5e1; background: #ffffff; color: #344054; cursor: pointer; transition: all 0.15s ease;"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Return for Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-cover-approve"
                            @click.stop="handleEndorse(item)"
                            :disabled="isSubmittingAction"
                            title="Endorse to Editor-in-Chief"
                            style="flex: 1; padding: 7px 14px; font-size: 0.80rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; background: var(--sidebar-maroon, #5c0a18); border: 1px solid var(--sidebar-maroon, #5c0a18); color: #ffffff; cursor: pointer; transition: all 0.15s ease;"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Endorse to EIC</span>
                        </button>
                    </div>
                </div>
            </section>
        </main>

        <!-- MODAL: Inspect Cartoon Modal -->
        <div
            v-if="isInspectOpen && activeCartoon"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeInspectModal"
        >
            <div class="modal-card media-inspect-modal-card">
                <div class="viewer-modal-header" style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="cover-type-tag cartoon">
                            <i class="fa-solid fa-paintbrush"></i> CARTOON
                        </span>
                        <span class="media-status-pill pending-with-head">
                            <i class="fa-regular fa-clock"></i>
                            <span>PENDING APPROVAL</span>
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
                            :src="resolveImageUrl(activeCartoon, 1600)"
                            :alt="cleanArtistName(activeCartoon.artist_name || activeCartoon.uploader_name)"
                            class="media-inspect-img cover-inspect-image-fullscreen"
                            style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);"
                        >
                    </div>

                    <div style="margin-top: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: #64748b;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> {{ activeCartoon.date || activeCartoon.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i class="fa-solid fa-paintbrush" style="margin-right: 6px; color: #700f2b;"></i> <span>Cartoonist: <strong>{{ cleanArtistName(activeCartoon.artist_name || activeCartoon.uploader_name) }}</strong></span></span>
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
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
                        @click="handleEndorse(activeCartoon)"
                        style="padding: 8px 20px; border: 1px solid var(--sidebar-maroon, #5c0a18); background: var(--sidebar-maroon, #5c0a18); color: #ffffff; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 2px 6px rgba(92, 10, 24, 0.25);"
                    >
                        <i v-if="isSubmittingAction" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-shield-halved"></i>
                        <span>Endorse to EIC</span>
                    </button>
                </div>
            </div>
        </div>

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
                            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b; font-family: 'DM Sans', sans-serif;">Return Cartoon for Revision</h3>
                            <p style="margin: 0; font-size: 0.76rem; color: #64748b;">Feedback will be sent to the cartoonist</p>
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
                            <i class="fa-solid fa-paintbrush" style="color: #700f2b;"></i>
                            <span>Returning to: <strong>{{ cleanArtistName(activeCartoon?.artist_name || activeCartoon?.uploader_name) }}</strong></span>
                        </div>
                        <span class="cover-type-tag cartoon" style="font-size: 0.68rem; padding: 2px 7px;">
                            CARTOON
                        </span>
                    </div>

                    <div class="form-field" style="margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label for="cartoon-revision-remarks" style="font-weight: 600; font-size: 0.86rem; color: #1e293b;">
                                Revision Feedback Remarks <span style="color: #dc2626;">*</span>
                            </label>
                            <span style="font-size: 0.72rem; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">Required</span>
                        </div>
                        <textarea
                            id="cartoon-revision-remarks"
                            v-model="revisionRemarks"
                            rows="4"
                            placeholder="Specify visual notes, concept revisions, or line adjustments needed..."
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
    </CartoonistLayout>
</template>

<style scoped>
.btn-cover-approve:hover:not(:disabled),
.btn-inspect-approve:hover:not(:disabled) {
    background-color: #780c1a !important;
    background: #780c1a !important;
    border-color: #780c1a !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(92, 10, 24, 0.35) !important;
}

.btn-cover-return:hover,
.btn-inspect-return:hover,
.btn-modal-cancel:hover {
    background: #f8fafc !important;
    border-color: #98a2b3 !important;
    color: #1e293b !important;
}

.btn-modal-submit-return:hover:not(:disabled) {
    background: #7f1d1d !important;
    border-color: #7f1d1d !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 3px 8px rgba(153, 27, 27, 0.35) !important;
}

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
