<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MediaLayout from '../../layouts/MediaLayout.vue';
import ResubmitMediaModal from '../../components/ResubmitMediaModal.vue';
import { getMediaDashboard } from '../../services/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import '../../assets/css/writer-dashboard.css';
import '../../assets/css/media-manage-media.css';

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
const mediaItems = ref([]);
const isSectionHead = ref(false);

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

const firstName = computed(() => {
    const fullName = authStore.user?.full_name || localStorage.getItem('userName') || 'Media Team';
    return fullName.split(' ')[0] || 'Media';
});

const sectionTitle = computed(() => {
    if (isSectionHead.value && (metrics.value.pending ?? 0) > 0) {
        return 'Pending Verification';
    }
    return 'My Recent Media';
});

function resolveImageUrl(itemOrUrl) {
    return resolveMediaUrl(itemOrUrl, { width: 800, crop: 'limit' });
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

function openInspectModal(item) {
    activeInspectItem.value = item;
    isInspectOpen.value = true;
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectItem.value = null;
}

async function loadDashboardData() {
    isLoading.value = true;
    try {
        const data = await getMediaDashboard(true);
        if (data && data.metrics) {
            metrics.value = {
                published: data.metrics.published ?? 0,
                pending: data.metrics.pending ?? 0,
                revision: data.metrics.revision ?? 0,
                published_articles: data.metrics.published_articles ?? 0,
                library: data.metrics.library ?? 0,
            };
        }
        if (data && Array.isArray(data.mediaItems)) {
            mediaItems.value = data.mediaItems;
        }
        if (data && typeof data.isSectionHead === 'boolean') {
            isSectionHead.value = data.isSectionHead;
        }
    } catch (err) {
        console.error('Failed to load media dashboard data:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboardData();
});
</script>

<template>
    <MediaLayout>
        <main class="content-container">
            <!-- Greeting Header with Dual Quick Action CTAs -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="writer-greeting" id="media-greeting-heading">
                        Welcome back, <span id="media-name-display" class="writer-name-highlight">{{ firstName }}</span>
                    </h1>
                </div>

                <div class="writer-header-right" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <router-link to="/media/submit-media" class="btn-maroon-action">
                        <i class="fa-solid fa-camera"></i>
                        <span>Submit Photo</span>
                    </router-link>
                    <router-link to="/media/submit-article" class="btn-maroon-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- Metrics Row (Exact Copy of Cartoonist Card Architecture - 4 Cards) -->
            <section class="metrics-grid animate-fade-in delay-2" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); margin-bottom: 28px;" aria-label="Operational metrics">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Total Photos Published</span>
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
                    <div class="metric-subtitle">Awaiting photographer adjustments</div>
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

            <!-- SECTION: MY RECENT MEDIA -->
            <div class="writer-section-header animate-fade-in delay-3" style="margin-top: 16px;">
                <div class="section-title-wrap" style="display: flex; align-items: center; gap: 8px;">
                    <h2 class="writer-section-title">{{ sectionTitle }}</h2>
                    <span
                        v-if="isSectionHead && (metrics.pending ?? 0) > 0"
                        class="panel-count-badge"
                        style="background: #fdf2f4; color: #700f2b; font-size: 0.76rem; font-weight: 700; padding: 2px 9px; border-radius: 9999px;"
                        :title="`Total ${metrics.pending} pending photos across desk`"
                    >
                        {{ metrics.pending }}
                    </span>
                </div>

                <router-link to="/media/manage-media" class="view-all-link">
                    <span>Manage all media</span>
                    <i class="fa-solid fa-arrow-right"></i>
                </router-link>
            </div>

            <section class="manage-media-grid animate-fade-in delay-4" aria-label="Recent media submissions">
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

                <!-- Empty State -->
                <div v-else-if="mediaItems.length === 0" class="empty-state-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #fdf2f4; color: #700f2b; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 12px;">
                        <i class="fa-regular fa-image"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; color: #1e293b; margin: 0 0 6px 0; font-family: 'DM Sans', sans-serif;">No media submissions found</h3>
                    <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 16px 0;">Start by submitting a photo or graphic asset to the desk.</p>
                    <router-link to="/media/submit-media" class="btn-maroon-action" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-camera"></i>
                        <span>Submit Photo</span>
                    </router-link>
                </div>

                <!-- Media Cards -->
                <div
                    v-else
                    v-for="item in mediaItems"
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
                        <h3 class="media-item-title" style="font-size: 0.95rem; font-weight: 700; color: #1e293b; margin: 0 0 6px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            {{ cleanTitle(item) }}
                        </h3>
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
                                style="width: auto; padding: 6px 14px; font-size: 0.82rem;"
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
                            :src="resolveImageUrl(activeInspectItem)"
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

                <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
                    <template v-if="normalizeStatus(activeInspectItem.status) === 'returned'">
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
                            <span>Resubmit Photo</span>
                        </button>
                    </template>
                    <template v-else>
                        <router-link to="/media/manage-media" class="btn-maroon-action" style="font-size: 0.84rem; padding: 8px 16px;">
                            <i class="fa-solid fa-images"></i>
                            <span>Open in Manage My Media</span>
                        </router-link>
                    </template>
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
