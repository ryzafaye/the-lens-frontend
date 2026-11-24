<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import CartoonistLayout from '../../layouts/CartoonistLayout.vue';
import ResubmitMediaModal from '../../components/ResubmitMediaModal.vue';
import {
    getCartoonistDashboard,
    endorseCartoonIllustration,
    returnCartoonIllustrationForRevision,
} from '../../services/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/writer-dashboard.css';
import '../../assets/css/media-manage-media.css';
import '../../assets/css/cartoonist-manage-cartoons.css';

const router = useRouter();
const authStore = useAuthStore();

const isLoading = ref(true);
const metrics = ref({
    published: 0,
    pending: 0,
    revision: 0,
    published_articles: 0,
    library: 0,
});
const cartoons = ref([]);
const isSectionHead = ref(false);

const effectiveIsSectionHead = computed(() => {
    if (isSectionHead.value) return true;
    const roleName = String(authStore.user?.role || localStorage.getItem('userRole') || '').toLowerCase();
    return roleName.includes('head') || roleName.includes('chief');
});

// Display list (top 5 for head review queue, or full list)
const displayCartoons = computed(() => {
    if (effectiveIsSectionHead.value) {
        return cartoons.value.slice(0, 5);
    }
    return cartoons.value;
});

// Centered Modal Feedback
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

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
    loadDashboard();
}

// Revision Modal
const isRevisionModalOpen = ref(false);
const revisionRemarks = ref('');
const targetCartoon = ref(null);
const isSubmittingAction = ref(false);

const firstName = computed(() => {
    const fullName = authStore.user?.full_name || localStorage.getItem('userName') || 'Cartoonist';
    return fullName.split(' ')[0] || 'Cartoonist';
});

function resolveImageUrl(itemOrUrl) {
    return resolveMediaUrl(itemOrUrl, { width: 800, crop: 'limit' });
}

function cleanArtistName(name) {
    if (!name) return 'Staff Cartoonist';
    return String(name).replace(/^By\s+/i, '').trim();
}

function cleanTitle(item) {
    return getCustomTitle(item, 'Editorial Cartoon');
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

function openInspectModal(item) {
    activeInspectItem.value = item;
    isInspectOpen.value = true;
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectItem.value = null;
}

// Approval & Revision Quick Action Handlers
async function handleQuickApprove(item) {
    if (isSubmittingAction.value) return;

    const confirmed = await confirmAction({
        title: 'Endorse Cartoon',
        message: `Are you sure you want to endorse "${cleanTitle(item)}" to the Editor-in-Chief?`,
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
        await loadDashboardData();
    } catch (err) {
        console.error('Failed to endorse cartoon:', err);
        showToast(err.response?.data?.message || 'Failed to endorse cartoon.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

function openRevisionModal(item) {
    targetCartoon.value = item;
    revisionRemarks.value = '';
    isRevisionModalOpen.value = true;
}

function closeRevisionModal() {
    isRevisionModalOpen.value = false;
    targetCartoon.value = null;
    revisionRemarks.value = '';
}

async function submitRevision() {
    if (!revisionRemarks.value.trim()) {
        showToast('Please enter revision remarks for the cartoonist.', 'warning');
        return;
    }
    if (!targetCartoon.value || isSubmittingAction.value) return;

    const confirmed = await confirmAction({
        title: 'Return for Revision',
        message: `Are you sure you want to return "${cleanTitle(targetCartoon.value)}" to the cartoonist for revision?`,
        confirmText: 'Return Cartoon',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmittingAction.value = true;
    try {
        await returnCartoonIllustrationForRevision(targetCartoon.value.id, revisionRemarks.value.trim());
        showToast('Cartoon returned to cartoonist for revision.', 'success');
        closeRevisionModal();
        closeInspectModal();
        await loadDashboardData();
    } catch (err) {
        console.error('Failed to return cartoon for revision:', err);
        showToast(err.response?.data?.message || 'Failed to return cartoon.', 'error');
    } finally {
        isSubmittingAction.value = false;
    }
}

async function loadDashboardData() {
    isLoading.value = true;
    try {
        const data = await getCartoonistDashboard();
        if (data && data.metrics) {
            metrics.value = {
                published: data.metrics.published ?? 0,
                pending: data.metrics.pending ?? 0,
                revision: data.metrics.revision ?? 0,
                published_articles: data.metrics.published_articles ?? data.metrics.publishedStories ?? data.metrics.library ?? 0,
                library: data.metrics.library ?? 0,
            };
        }
        if (data && Array.isArray(data.cartoons)) {
            cartoons.value = data.cartoons;
        }
        if (data && typeof data.isSectionHead === 'boolean') {
            isSectionHead.value = data.isSectionHead;
        }
    } catch (err) {
        console.error('Failed to load cartoonist dashboard data:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboardData();
});
</script>

<template>
    <CartoonistLayout>
        <main class="content-container">
            <!-- Greeting Header with Quick Action CTAs -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="writer-greeting" id="cartoonist-greeting-heading">
                        Welcome back, <span id="cartoonist-name-display" class="writer-name-highlight">{{ firstName }}</span>
                    </h1>
                </div>

                <div class="writer-header-right" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <router-link to="/cartoonist/submit-cartoon" class="btn-maroon-action">
                        <i class="fa-solid fa-paintbrush"></i>
                        <span>Submit Cartoon</span>
                    </router-link>
                    <router-link to="/cartoonist/submit-article" class="btn-maroon-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- Metrics Row (Exact Copy of Executive Card Architecture - 4 Cards) -->
            <section class="metrics-grid animate-fade-in delay-2" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); margin-bottom: 28px;" aria-label="Operational metrics">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Total Cartoons Published</span>
                        <div class="metric-icon-box">
                            <i class="fa-solid fa-globe"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ metrics.published.toLocaleString() }}</div>
                    <div class="metric-subtitle">Live across campus &amp; digital portals</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Total Pending Approvals</span>
                        <div class="metric-icon-box">
                            <i class="fa-regular fa-clock"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ metrics.pending.toLocaleString() }}</div>
                    <div class="metric-subtitle">Awaiting editorial verification</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Returned for Revision</span>
                        <div class="metric-icon-box">
                            <i class="fa-solid fa-rotate-left"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ (metrics.revision ?? 0).toLocaleString() }}</div>
                    <div class="metric-subtitle">Awaiting illustrator adjustments</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Total Published Articles</span>
                        <div class="metric-icon-box">
                            <i class="fa-solid fa-newspaper"></i>
                        </div>
                    </div>
                    <div class="metric-value">{{ (metrics.published_articles ?? 0).toLocaleString() }}</div>
                    <div class="metric-subtitle">Live stories across publication</div>
                </div>
            </section>

            <!-- SECTION: RECENT CARTOONS / PENDING APPROVAL -->
            <div class="writer-section-header animate-fade-in delay-3" style="margin-top: 16px;">
                <div class="section-title-wrap" style="display: flex; align-items: center; gap: 8px;">
                    <h2 class="writer-section-title">{{ effectiveIsSectionHead ? 'Pending Approval' : 'My Recent Cartoons' }}</h2>
                    <span
                        v-if="effectiveIsSectionHead"
                        class="panel-count-badge"
                        style="background: #fdf2f4; color: #700f2b; font-size: 0.76rem; font-weight: 700; padding: 2px 9px; border-radius: 9999px;"
                        :title="`Total ${metrics.pending} pending cartoons across desk`"
                    >
                        {{ metrics.pending }}
                    </span>
                </div>

                <router-link :to="effectiveIsSectionHead ? '/cartoonist/cartoon-desk' : '/cartoonist/manage-cartoons'" class="view-all-link">
                    <span>{{ effectiveIsSectionHead ? 'View all in Desk' : 'Manage all cartoons' }}</span>
                    <i class="fa-solid fa-arrow-right"></i>
                </router-link>
            </div>

            <section class="manage-media-grid animate-fade-in delay-4" id="cartoon-recent-grid" aria-label="Recent cartoon submissions">
                <!-- Skeleton Loading -->
                <template v-if="isLoading">
                    <div v-for="n in 3" :key="n" class="manage-media-card skeleton-card">
                        <div class="media-card-preview-box skeleton-box" style="height: 190px;"></div>
                        <div class="media-card-content" style="padding: 16px;">
                            <div class="skeleton-line" style="width: 70%; height: 16px; margin-bottom: 8px;"></div>
                            <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                        </div>
                    </div>
                </template>

                <!-- Empty State without Submit Cartoon Button -->
                <div v-else-if="displayCartoons.length === 0" class="empty-state-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #fdf2f4; color: #700f2b; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 12px;">
                        <i class="fa-solid fa-palette"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; color: #1e293b; margin: 0 0 6px 0; font-family: 'DM Sans', sans-serif;">No cartoons found</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin: 0;">
                        {{ effectiveIsSectionHead ? 'No pending cartoon illustrations awaiting review.' : 'Start by submitting an editorial cartoon illustration to the desk.' }}
                    </p>
                </div>

                <!-- Cartoon Cards -->
                <div
                    v-else
                    v-for="item in displayCartoons"
                    :key="item.id"
                    class="manage-media-card"
                    @click="openInspectModal(item)"
                    style="cursor: pointer;"
                >
                    <div class="media-card-preview-box">
                        <img
                            :src="resolveImageUrl(item)"
                            :alt="getCustomTitle(item, 'Cartoon Artwork')"
                            class="media-card-img"
                            loading="lazy"
                        >
                        <div class="media-card-badge-layer">
                            <span class="cover-type-tag cartoon">
                                <i class="fa-solid fa-paintbrush"></i> CARTOON
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
                            <span style="white-space: nowrap;"><i class="fa-solid fa-paintbrush" style="color: #700f2b;"></i> <strong>{{ cleanArtistName(item.artist_name || item.uploader_name) }}</strong></span>
                        </div>

                        <!-- Card Actions: Shortcut for approval and revision -->
                        <div class="media-card-actions" style="margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
                            <button
                                type="button"
                                class="btn-media-inspect"
                                @click.stop="openInspectModal(item)"
                                style="width: auto; padding: 5px 10px; font-size: 0.78rem;"
                            >
                                <i class="fa-regular fa-eye"></i>
                                <span>Inspect</span>
                            </button>

                            <button
                                v-if="normalizeStatus(item.status) === 'returned'"
                                type="button"
                                class="btn-media-resubmit"
                                @click.stop="openResubmitModal(item)"
                                title="Resubmit cartoon for review"
                                style="width: auto; padding: 5px 12px; font-size: 0.78rem;"
                            >
                                <i class="fa-solid fa-paper-plane"></i>
                                <span>Resubmit</span>
                            </button>

                            <template v-if="effectiveIsSectionHead">
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-revision"
                                    @click.stop="openRevisionModal(item)"
                                    title="Return cartoon for revision"
                                >
                                    <i class="fa-solid fa-rotate-left"></i>
                                    <span>Revision</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-table-action btn-table-approve"
                                    @click.stop="handleQuickApprove(item)"
                                    :disabled="isSubmittingAction"
                                    title="Endorse to Editor-in-Chief"
                                >
                                    <i v-if="isSubmittingAction" class="fa-solid fa-spinner fa-spin"></i>
                                    <i v-else class="fa-solid fa-check"></i>
                                    <span>Approve</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <!-- MODAL 1: Full Cartoon Inspect Modal -->
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
                        <span class="cover-type-tag cartoon">
                            <i class="fa-solid fa-paintbrush"></i> CARTOON
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
                            :src="resolveImageUrl(activeInspectItem)"
                            :alt="cleanArtistName(activeInspectItem.artist_name || activeInspectItem.uploader_name)"
                            class="media-inspect-img cover-inspect-image-fullscreen"
                            style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);"
                        >
                    </div>

                    <div style="margin-top: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: #64748b;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> {{ activeInspectItem.date || activeInspectItem.formattedDate || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i class="fa-solid fa-paintbrush" style="margin-right: 6px; color: #700f2b;"></i> <span>Cartoonist: <strong>{{ cleanArtistName(activeInspectItem.artist_name || activeInspectItem.uploader_name) }}</strong></span></span>
                        </div>

                        <div v-if="activeInspectItem.remarks" class="media-review-note-box" style="margin-top: 14px;">
                            <strong><i class="fa-solid fa-comment-dots"></i> Desk Revision Feedback:</strong>
                            <p style="margin: 6px 0 0 0; color: #4c0519; font-size: 0.9rem; line-height: 1.5;">{{ activeInspectItem.remarks }}</p>
                        </div>
                    </div>
                </div>

                <!-- Inspect Modal Footer: Replaced Open in Cartoon Desk with Approval and Revision shortcuts -->
                <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
                    <template v-if="effectiveIsSectionHead">
                        <button
                            type="button"
                            class="btn-table-action btn-table-revision"
                            @click="openRevisionModal(activeInspectItem)"
                            style="padding: 8px 16px; font-size: 0.84rem;"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Return for Revision</span>
                        </button>
                        <button
                            type="button"
                            class="btn-table-action btn-table-approve"
                            :disabled="isSubmittingAction"
                            @click="handleQuickApprove(activeInspectItem)"
                            style="padding: 8px 18px; font-size: 0.84rem;"
                        >
                            <i v-if="isSubmittingAction" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-check"></i>
                            <span>Endorse to EIC</span>
                        </button>
                    </template>
                    <template v-else-if="normalizeStatus(activeInspectItem.status) === 'returned'">
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
                            style="font-size: 0.84rem; padding: 8px 18px;"
                        >
                            <i class="fa-solid fa-paper-plane"></i>
                            <span>Resubmit Cartoon</span>
                        </button>
                    </template>
                    <template v-else>
                        <router-link to="/cartoonist/manage-cartoons" class="btn-maroon-action" style="font-size: 0.84rem; padding: 8px 16px;">
                            <i class="fa-solid fa-palette"></i>
                            <span>Open in Manage My Cartoons</span>
                        </router-link>
                    </template>
                </div>
            </div>
        </div>

        <!-- Global Reusable Resubmit Modal -->
        <ResubmitMediaModal
            :is-open="isResubmitOpen"
            :item="activeResubmitItem"
            media-type="cartoon"
            @close="closeResubmitModal"
            @resubmitted="handleResubmitted"
        />

        <!-- MODAL 2: Revision Remarks Input -->
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
                            <span>Returning to: <strong>{{ cleanArtistName(targetCartoon?.artist_name || targetCartoon?.uploader_name) }}</strong></span>
                        </div>
                        <span class="cover-type-tag cartoon" style="font-size: 0.68rem; padding: 2px 7px;">
                            CARTOON
                        </span>
                    </div>

                    <div class="form-field" style="margin-bottom: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label for="dashboard-cartoon-revision-remarks" style="font-weight: 600; font-size: 0.86rem; color: #1e293b;">
                                Revision Feedback Remarks <span style="color: #dc2626;">*</span>
                            </label>
                            <span style="font-size: 0.72rem; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">Required</span>
                        </div>
                        <textarea
                            id="dashboard-cartoon-revision-remarks"
                            v-model="revisionRemarks"
                            rows="4"
                            placeholder="Specify detailed visual adjustments, linework, cropping, or changes needed..."
                            style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; outline: none; transition: border-color 0.15s ease; box-sizing: border-box; resize: vertical;"
                        ></textarea>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 14px 22px; border-top: 1px solid #eaecf0; background: #fafbfc; display: flex; justify-content: flex-end; gap: 10px;">
                    <button
                        type="button"
                        class="btn-modal-cancel"
                        @click="closeRevisionModal"
                        style="padding: 8px 18px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #ffffff; border: 1.5px solid #d0d5dd; color: #344054; cursor: pointer; transition: all 0.15s ease;"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-modal-confirm"
                        :disabled="!revisionRemarks.trim() || isSubmittingAction"
                        @click="submitRevision"
                        style="padding: 8px 20px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; background: #5c0a18; border: 1px solid #5c0a18; color: #ffffff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s ease; box-shadow: 0 1px 3px rgba(92, 10, 24, 0.25);"
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

/* Shortcut buttons standard styles */
.btn-table-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1;
    white-space: nowrap;
}
.btn-table-revision {
    background-color: #fffaf0;
    border: 1px solid #fedf89;
    color: #b54708;
}
.btn-table-revision:hover {
    background-color: #fef0c7 !important;
    border-color: #fdb022 !important;
    color: #93370d !important;
    transform: translateY(-1px);
}
.btn-table-approve {
    background-color: #5c0a18 !important;
    border: 1px solid #5c0a18 !important;
    color: #ffffff !important;
    box-shadow: 0 1px 2px rgba(92, 10, 24, 0.15);
}
.btn-table-approve:hover {
    background-color: #780c1a !important;
    border-color: #780c1a !important;
    box-shadow: 0 2px 6px rgba(92, 10, 24, 0.28);
    transform: translateY(-1px);
}
</style>
