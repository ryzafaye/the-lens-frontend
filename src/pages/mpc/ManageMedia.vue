<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MpcLayout from '../../layouts/MpcLayout.vue';
import ResubmitMediaModal from '../../components/ResubmitMediaModal.vue';
import { getMpcManageMedia } from '../../services/api.js';
import { resolveMediaUrl, getCustomTitle } from '../../utils/image.js';
import '../../assets/css/writer-dashboard.css';
import '../../assets/css/media-manage-media.css';

const router = useRouter();

// State
const isLoading = ref(true);
const mediaItems = ref([]);
const currentFilter = ref('all'); // 'all' | 'pending' | 'returned' | 'eic_approved' | 'published'
const searchQuery = ref('');
const currentSort = ref('newest'); // 'newest' | 'oldest'

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

function resolveImageUrl(itemOrUrl, width = 800) {
    return resolveMediaUrl(itemOrUrl, { width, crop: 'limit' });
}

function cleanArtistName(name) {
    if (!name) return 'Media Team Member';
    return String(name).replace(/^By\s+/i, '').trim();
}

function cleanTitle(item) {
    return getCustomTitle(item, item?.type === 'cartoon' ? 'Editorial Cartoon' : 'Editorial Photo');
}

function isGenericTitle(t) {
    return t === 'Editorial Photo' || t === 'Editorial Cartoon';
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
    return { class: 'pending-eic-review', label: 'PENDING APPROVAL', icon: 'fa-regular fa-clock' };
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
            const artist = (m.artist_name || m.artist || '').toLowerCase();
            const article = (m.connectedArticleTitle || m.article_title || '').toLowerCase();
            return title.includes(q) || artist.includes(q) || article.includes(q);
        });
    }

    list.sort((a, b) => {
        const timeA = new Date(a.rawDate || a.date || a.created_at || 0).getTime();
        const timeB = new Date(b.rawDate || b.date || b.created_at || 0).getTime();
        return currentSort.value === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
});

function openInspectModal(item) {
    activeInspectItem.value = item;
    isInspectOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeInspectModal() {
    isInspectOpen.value = false;
    activeInspectItem.value = null;
    document.body.classList.remove('modal-open');
}

async function loadMedia() {
    isLoading.value = true;
    try {
        const res = await getMpcManageMedia();
        if (res && Array.isArray(res.mediaItems)) {
            mediaItems.value = res.mediaItems;
        } else if (res && Array.isArray(res)) {
            mediaItems.value = res;
        }
    } catch (err) {
        console.error('Failed to load MPC manage media:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadMedia();
});
</script>

<template>
    <MpcLayout>
        <main class="content-container">
            <!-- Page Title Section (Executive Parity Header) -->
            <div class="writer-header-row animate-fade-in delay-1" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 6px;">
                <div class="writer-header-left">
                    <h1 class="page-title">Manage My Media</h1>
                </div>

                <div class="writer-header-right">
                    <router-link to="/mpc/submit-media" class="btn-primary-action">
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
                    role="tab"
                    :aria-selected="currentFilter === 'all'"
                    @click="currentFilter = 'all'"
                >
                    <span>All Media</span>
                    <span class="tab-count-badge">{{ countAll }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'pending' }"
                    role="tab"
                    :aria-selected="currentFilter === 'pending'"
                    @click="currentFilter = 'pending'"
                >
                    <span><i class="fa-regular fa-clock"></i> Pending Approval</span>
                    <span class="tab-count-badge">{{ countPending }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'returned' }"
                    role="tab"
                    :aria-selected="currentFilter === 'returned'"
                    @click="currentFilter = 'returned'"
                >
                    <span><i class="fa-solid fa-triangle-exclamation"></i> Returned for Revision</span>
                    <span class="tab-count-badge">{{ countReturned }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'eic_approved' }"
                    role="tab"
                    :aria-selected="currentFilter === 'eic_approved'"
                    @click="currentFilter = 'eic_approved'"
                >
                    <span><i class="fa-solid fa-shield-halved"></i> EIC Approved</span>
                    <span class="tab-count-badge">{{ countEic }}</span>
                </button>
                <button
                    type="button"
                    class="manage-tab-btn"
                    :class="{ active: currentFilter === 'published' }"
                    role="tab"
                    :aria-selected="currentFilter === 'published'"
                    @click="currentFilter = 'published'"
                >
                    <span><i class="fa-solid fa-globe"></i> Published</span>
                    <span class="tab-count-badge">{{ countPublished }}</span>
                </button>
            </div>

            <!-- Search Bar & Sort Dropdown Toolbar -->
            <div class="manage-toolbar animate-fade-in delay-2">
                <div class="manage-search-shell">
                    <i class="fa-solid fa-magnifying-glass search-leading-icon" aria-hidden="true"></i>
                    <input
                        v-model="searchQuery"
                        type="search"
                        class="manage-search-input"
                        placeholder="Search media by title or connected article..."
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

                <div class="review-sort-container">
                    <label for="media-sort-select" class="review-sort-label">
                        <i class="fa-solid fa-arrow-down-short-wide"></i>
                        <span>Sort:</span>
                    </label>
                    <div class="sort-select-wrapper">
                        <select id="media-sort-select" v-model="currentSort" class="review-sort-select" aria-label="Sort media submissions">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                        </select>
                        <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
                    </div>
                </div>
            </div>

            <!-- Media Grid -->
            <section class="manage-media-grid animate-fade-in delay-3" aria-label="Media submissions grid">
                <div v-if="isLoading" style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #667085;">
                    Loading media submissions...
                </div>

                <div v-else-if="filteredMediaItems.length === 0" class="mpc-tab-empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 56px 20px; background: #ffffff; border: 1px dashed var(--border-subtle, #eaecf0); border-radius: 12px; margin-top: 10px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fdf2f4; color: var(--sidebar-maroon, #5c0a18); display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-bottom: 14px;">
                        <i class="fa-solid fa-images"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 700; color: #101828; margin: 0;">
                        No Media Items Found
                    </h3>
                    <p style="font-size: 0.85rem; color: #667085; margin-top: 6px;">There are no media submissions matching this view.</p>
                </div>

                <div
                    v-for="item in filteredMediaItems"
                    :key="item.id"
                    class="manage-media-card"
                    style="cursor: pointer;"
                    @click="openInspectModal(item)"
                >
                    <div class="media-card-preview-box">
                        <img :src="resolveImageUrl(item)" :alt="cleanTitle(item)" class="media-card-img">
                        <div class="media-card-badge-layer">
                            <span class="cover-type-tag" :class="item.type || 'photo'">
                                <i :class="item.type === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                <span>{{ (item.type || 'photo').toUpperCase() }}</span>
                            </span>
                            <span class="media-status-pill" :class="getStatusBadgeConfig(item.status).class">
                                <i :class="getStatusBadgeConfig(item.status).icon"></i>
                                <span>{{ getStatusBadgeConfig(item.status).label }}</span>
                            </span>
                        </div>
                    </div>

                    <div class="media-card-body">
                        <div class="media-card-meta" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #64748b; margin-bottom: 10px;">
                            <span style="white-space: nowrap;"><i class="fa-regular fa-calendar"></i> {{ item.date || 'Recent' }}</span>
                            <span style="white-space: nowrap;"><i :class="item.type === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="color: var(--sidebar-maroon, #5c0a18);"></i> <strong>{{ cleanArtistName(item.artist || item.artist_name || 'Media Team Member') }}</strong></span>
                        </div>

                        <h3 v-if="item.connectedArticleTitle" class="media-card-title" :title="item.connectedArticleTitle">
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 500; display: block; margin-bottom: 2px;">Connected Story:</span>
                            {{ item.connectedArticleTitle }}
                        </h3>

                        <div v-if="normalizeStatus(item.status) === 'returned' && item.remarks" class="media-review-note-box">
                            <strong><i class="fa-solid fa-rotate-left"></i> Revision Remarks:</strong>
                            <span>{{ item.remarks }}</span>
                        </div>

                        <div class="media-card-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto;">
                            <span style="font-size: 0.75rem; color: #64748b;"><i class="fa-solid fa-magnifying-glass"></i> Click to inspect</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button
                                    v-if="normalizeStatus(item.status) === 'returned'"
                                    type="button"
                                    class="btn-media-resubmit"
                                    @click.stop="openResubmitModal(item)"
                                    title="Resubmit media asset for review"
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                    <span>Resubmit</span>
                                </button>
                                <span style="color: var(--sidebar-maroon, #5c0a18); font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>Inspect</span> <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Inspect Modal -->
            <div
                v-if="isInspectOpen"
                class="modal-overlay"
                role="dialog"
                aria-modal="true"
                @click.self="closeInspectModal"
            >
                <div class="modal-card media-inspect-modal-card">
                    <div class="modal-header" style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="cover-type-tag" :class="activeInspectItem?.type || 'photo'">
                                <i :class="activeInspectItem?.type === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'"></i>
                                <span>{{ (activeInspectItem?.type || 'photo').toUpperCase() }}</span>
                            </span>
                            <span class="media-status-pill" :class="getStatusBadgeConfig(activeInspectItem?.status).class">
                                <i :class="getStatusBadgeConfig(activeInspectItem?.status).icon"></i>
                                <span>{{ getStatusBadgeConfig(activeInspectItem?.status).label }}</span>
                            </span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <button type="button" class="modal-close-icon" aria-label="Close modal" @click="closeInspectModal">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="modal-body" style="padding: 20px; overflow-y: auto;">
                        <!-- Returned for Revision Alert / Remarks Box -->
                        <div v-if="normalizeStatus(activeInspectItem?.status) === 'returned' && activeInspectItem?.remarks" class="modal-remarks-callout" style="background: #fdf2f4; border: 1px solid #fecdca; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
                            <strong style="display: block; color: #b42318; font-size: 0.85rem; margin-bottom: 4px;">
                                <i class="fa-solid fa-rotate-left"></i> Revision Remarks:
                            </strong>
                            <p style="margin: 0; font-size: 0.85rem; color: #7a1f2e;">{{ activeInspectItem.remarks }}</p>
                        </div>

                        <div class="media-inspect-preview-container" style="background: transparent; border-radius: 10px; padding: 0; display: flex; align-items: center; justify-content: center; height: auto; max-height: 68vh; overflow: hidden; width: 100%;">
                            <img :src="resolveImageUrl(activeInspectItem, 1600)" alt="Visual material inspect" class="media-inspect-img">
                        </div>

                        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #64748b;">
                                <span style="white-space: nowrap;"><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> {{ activeInspectItem?.date || 'Recent' }}</span>
                                <span style="white-space: nowrap;"><i :class="activeInspectItem?.type === 'cartoon' ? 'fa-solid fa-palette' : 'fa-solid fa-camera'" style="margin-right: 6px; color: var(--sidebar-maroon, #5c0a18);"></i> <span>{{ activeInspectItem?.type === 'cartoon' ? 'Cartoonist:' : 'Photojournalist:' }} <strong>{{ cleanArtistName(activeInspectItem?.artist || activeInspectItem?.artist_name || 'Media Team Member') }}</strong></span></span>
                            </div>

                            <div v-if="activeInspectItem?.connectedArticleTitle" style="font-size: 0.95rem; font-weight: 700; color: #101828; margin-top: 4px;">
                                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500; display: block; margin-bottom: 2px;">Connected Story:</span>
                                {{ activeInspectItem.connectedArticleTitle }}
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer: Resubmit button for returned media -->
                    <div v-if="normalizeStatus(activeInspectItem?.status) === 'returned'" class="modal-footer" style="padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; background: #fafbfc;">
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
                            <span>Resubmit Media</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>

        <!-- Global Reusable Resubmit Modal -->
        <ResubmitMediaModal
            :is-open="isResubmitOpen"
            :item="activeResubmitItem"
            media-type="mpc"
            @close="closeResubmitModal"
            @resubmitted="handleResubmitted"
        />
    </MpcLayout>
</template>
