import { reactive, onMounted, onUnmounted, watch } from 'vue';
import {
    getEicReviewArticles,
    getEicMediaDesk,
    getExecutiveReviewArticles,
    getSectionHeadReviewArticles,
    getCartoonistDesk,
    getMpcMediaDesk,
} from '../services/api.js';

const countsState = reactive({
    reviewArticles: null,
    mediaDesk: null,
    cartoonDesk: null,
    lastRole: null,
});

const inFlightByRole = new Map();

function isPendingMediaItem(item) {
    if (!item) return false;
    const status = String(item.status || '').toLowerCase();
    if (
        status.includes('approved') ||
        status.includes('published') ||
        status.includes('revision') ||
        status.includes('returned') ||
        status.includes('archived')
    ) {
        return false;
    }
    return true;
}

export async function refreshRolePendingCounts(roleKey, forceFresh = false) {
    if (!roleKey) return;

    if (countsState.lastRole && countsState.lastRole !== roleKey) {
        countsState.reviewArticles = null;
        countsState.mediaDesk = null;
        countsState.cartoonDesk = null;
    }

    const dedupKey = `${roleKey}:${forceFresh ? '1' : '0'}`;
    if (inFlightByRole.has(dedupKey)) {
        return inFlightByRole.get(dedupKey);
    }

    const task = (async () => {
        try {
            if (roleKey === 'eic') {
                const [reviewData, mediaData] = await Promise.allSettled([
                    getEicReviewArticles({}, forceFresh),
                    getEicMediaDesk(forceFresh),
                ]);
                if (reviewData.status === 'fulfilled' && reviewData.value) {
                    countsState.reviewArticles = Array.isArray(reviewData.value.pendingArticles)
                        ? reviewData.value.pendingArticles.length
                        : 0;
                }
                if (mediaData.status === 'fulfilled' && mediaData.value) {
                    const list = Array.isArray(mediaData.value.coverList) ? mediaData.value.coverList : [];
                    countsState.mediaDesk = list.filter(isPendingMediaItem).length;
                }
            } else if (roleKey === 'executive') {
                const data = await getExecutiveReviewArticles({}, forceFresh);
                countsState.reviewArticles = Array.isArray(data?.pendingArticles)
                    ? data.pendingArticles.length
                    : 0;
            } else if (roleKey === 'section-head') {
                const data = await getSectionHeadReviewArticles({}, forceFresh);
                countsState.reviewArticles = Array.isArray(data?.pendingArticles)
                    ? data.pendingArticles.length
                    : 0;
            } else if (roleKey === 'cartoonist') {
                const data = await getCartoonistDesk(forceFresh);
                countsState.cartoonDesk = Array.isArray(data?.pendingCartoons)
                    ? data.pendingCartoons.length
                    : 0;
            } else if (roleKey === 'mpc') {
                const data = await getMpcMediaDesk(forceFresh);
                const list = Array.isArray(data?.coverList) ? data.coverList : [];
                countsState.mediaDesk = list.filter(isPendingMediaItem).length;
            }
            countsState.lastRole = roleKey;
        } catch {
            // Keep existing counts silently if network fails
        } finally {
            inFlightByRole.delete(dedupKey);
        }
    })();

    inFlightByRole.set(dedupKey, task);
    return task;
}

/**
 * Provides reactive sidebar pending-approval badge counts for editorial/media desk roles,
 * auto-refreshing on mount, role eligibility changes, and successful API mutations.
 */
export function useSidebarPendingCounts(roleKey, enabledRef = null) {
    const isEnabled = () => {
        if (!enabledRef) return true;
        return typeof enabledRef === 'function' ? Boolean(enabledRef()) : Boolean(enabledRef.value);
    };

    const syncCounts = (forceFresh = false) => {
        if (!isEnabled()) return;
        refreshRolePendingCounts(roleKey, forceFresh);
    };

    const handleRefreshEvent = () => {
        syncCounts(true);
    };

    if (enabledRef && typeof enabledRef !== 'function') {
        watch(enabledRef, (val) => {
            if (val) syncCounts(false);
        });
    }

    onMounted(() => {
        syncCounts(false);
        if (typeof window !== 'undefined') {
            window.addEventListener('sidebar-counts-refresh', handleRefreshEvent);
        }
    });

    onUnmounted(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('sidebar-counts-refresh', handleRefreshEvent);
        }
    });

    return {
        pendingCounts: countsState,
        refreshCounts: () => syncCounts(true),
    };
}
