<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import { getEicActivityLogs } from '../../services/api.js';
import { formatActivityStatement } from '../../utils/activityGrammar.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import '../../assets/css/shared-activity-logs.css';

// State
const isLoading = ref(true);
const isFullscreen = ref(false);
const activities = ref([]);
const searchQuery = ref('');
const dateFilter = ref('all');
const specificDate = ref('');

// Load Activity Logs
async function loadLogs() {
    isLoading.value = true;
    try {
        const params = {
            search: searchQuery.value.trim() || undefined,
            date_filter: dateFilter.value !== 'all' ? dateFilter.value : undefined,
            date: dateFilter.value === 'specific' ? specificDate.value : undefined,
        };

        const res = await getEicActivityLogs(params, true);
        if (res && Array.isArray(res.activities)) {
            activities.value = res.activities;
        } else if (Array.isArray(res)) {
            activities.value = res;
        }
    } catch (err) {
        console.error('Failed to load activity logs:', err);
    } finally {
        isLoading.value = false;
    }
}

// Filtered activities on frontend
const filteredActivities = computed(() => {
    let list = activities.value;

    const query = searchQuery.value.toLowerCase().trim();
    if (query) {
        list = list.filter(item => {
            const stmt = formatActivityStatement(item);
            const full = `${stmt.fullStatement} ${item.causerRole || ''} ${item.formattedDate || ''}`.toLowerCase();
            return full.includes(query);
        });
    }

    if (dateFilter.value === 'today') {
        list = list.filter(item => item.dayGroup === 'Today');
    } else if (dateFilter.value === '7days') {
        const past7Days = new Date();
        past7Days.setDate(past7Days.getDate() - 7);
        list = list.filter(item => {
            const d = new Date(item.isoDate || item.created_at || 0);
            return d >= past7Days;
        });
    } else if (dateFilter.value === '30days') {
        const past30Days = new Date();
        past30Days.setDate(past30Days.getDate() - 30);
        list = list.filter(item => {
            const d = new Date(item.isoDate || item.created_at || 0);
            return d >= past30Days;
        });
    } else if (dateFilter.value === 'specific' && specificDate.value) {
        list = list.filter(item => {
            const dStr = (item.isoDate || item.created_at || '').substring(0, 10);
            return dStr === specificDate.value;
        });
    }

    return list;
});

// Group filtered activities by dayGroup
const groupedActivities = computed(() => {
    const groups = {};
    filteredActivities.value.forEach(item => {
        const groupKey = item.dayGroup || 'Earlier';
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
    });
    return groups;
});

function handleFilterChange() {
    loadLogs();
}

function clearSearch() {
    searchQuery.value = '';
    loadLogs();
}

function getStatement(item) {
    return formatActivityStatement(item);
}

function toggleFullscreen() {
    if (!isFullscreen.value) {
        isFullscreen.value = true;
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    } else {
        isFullscreen.value = false;
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }
}

function onFullscreenChange() {
    if (!document.fullscreenElement && isFullscreen.value) {
        isFullscreen.value = false;
    }
}

function onGlobalKeydown(e) {
    if (e.key === 'Escape' && isFullscreen.value) {
        toggleFullscreen();
    }
}

onMounted(() => {
    loadLogs();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
    <EicLayout>
        <main class="content-container activity-page-main" :class="{ 'fullscreen-active': isFullscreen }">
            <div class="activity-logs-container">
                <!-- Page Header with Fullscreen Maximize Action -->
                <div class="activity-page-header">
                    <div class="activity-header-left">
                        <h1 class="activity-page-title">Activity Log</h1>
                        <p class="activity-page-subtitle">Real-time audit stream of all editorial actions, manuscript submissions, approvals, and system activities across The Lens.</p>
                    </div>

                    <div class="activity-header-actions">
                        <button
                            type="button"
                            class="btn-activity-maximize"
                            @click="toggleFullscreen"
                            :title="isFullscreen ? 'Exit Full Screen' : 'Maximize Page / Full Screen'"
                            :aria-label="isFullscreen ? 'Exit Full Screen' : 'Maximize Page / Full Screen'"
                        >
                            <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
                            <span>{{ isFullscreen ? 'Restore View' : 'Maximize Page' }}</span>
                        </button>
                    </div>
                </div>

                <!-- Search Bar + Date Filter Controls -->
                <div class="activity-filter-bar">
                    <div class="activity-search-box">
                        <i class="fa-solid fa-magnifying-glass activity-search-icon"></i>
                        <input
                            v-model="searchQuery"
                            @keyup.enter="loadLogs"
                            type="text"
                            class="activity-search-input"
                            placeholder="Search activity logs by user, action, article headline, or role..."
                            aria-label="Search activity logs"
                        >
                        <button
                            v-if="searchQuery"
                            type="button"
                            class="activity-search-clear"
                            @click="clearSearch"
                            aria-label="Clear search"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="activity-date-controls">
                        <select
                            v-model="dateFilter"
                            @change="handleFilterChange"
                            class="activity-date-select"
                            aria-label="Filter by time range"
                        >
                            <option value="all">All Dates</option>
                            <option value="today">Today</option>
                            <option value="7days">Past 7 Days</option>
                            <option value="30days">Past 30 Days</option>
                            <option value="specific">Specific Date</option>
                        </select>

                        <div v-if="dateFilter === 'specific'" class="specific-date-wrapper">
                            <input
                                v-model="specificDate"
                                @change="handleFilterChange"
                                type="date"
                                class="specific-date-input"
                                aria-label="Choose specific date"
                            >
                        </div>
                    </div>
                </div>

                <!-- Status Results Counter -->
                <div class="activity-results-counter">
                    Showing all <em>{{ filteredActivities.length }}</em> logged events
                </div>

                <!-- Loading State -->
                <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                    <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading activity stream...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="filteredActivities.length === 0" class="empty-state-cell" style="text-align: center; color: #667085; padding: 48px 16px; font-size: 0.95rem;">
                    No activity logs recorded yet.
                </div>

                <!-- Timeline Stream -->
                <section v-else class="activity-stream-timeline" aria-label="Activity events timeline">
                    <div
                        v-for="(items, dayGroup) in groupedActivities"
                        :key="dayGroup"
                        class="timeline-group"
                    >
                        <!-- Day Divider -->
                        <div class="timeline-day-divider">
                            <span class="timeline-day-pill">{{ dayGroup }}</span>
                            <span class="timeline-day-line"></span>
                        </div>

                        <!-- Event Cards -->
                        <div
                            v-for="item in items"
                            :key="item.id"
                            class="activity-event-card"
                        >
                            <div class="activity-event-node"></div>

                            <div class="activity-card-inner">
                                <div class="activity-avatar-wrap">
                                    <img
                                        :src="optimizeCloudinaryUrl(item.causerAvatar || item.avatar || '/images/member-placeholder.svg', { width: 80 })"
                                        :alt="item.causer || 'User'"
                                        class="activity-avatar-img"
                                        loading="lazy"
                                    >
                                </div>

                                <div class="activity-content-col">
                                    <p class="activity-sentence-statement">
                                        <strong class="causer-name-token">{{ getStatement(item).causer }}</strong>
                                        <span> {{ getStatement(item).beforeSubject }}</span>
                                        <template v-if="getStatement(item).subjectName">
                                            <span
                                                class="subject-name-token"
                                                style="font-family: 'Playfair Display', Georgia, serif !important; margin: 0 4px;"
                                            >
                                                "{{ getStatement(item).subjectName }}"
                                            </span>
                                        </template>
                                        <span v-if="getStatement(item).afterSubject" style="margin-left: 4px;">
                                            {{ getStatement(item).afterSubject }}
                                        </span>
                                        <span class="timestamp-token" style="margin-left: 4px;">
                                            {{ item.timestampText || item.time }}.
                                        </span>
                                    </p>

                                    <div class="activity-subrow">
                                        <span class="activity-role-text">{{ item.causerRole || 'Member' }}</span>
                                        <span class="activity-subrow-dot">&bull;</span>
                                        <span class="activity-exact-time">{{ item.formattedDate || item.isoDate }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    </EicLayout>
</template>
