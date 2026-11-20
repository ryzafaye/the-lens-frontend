<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import { getExecutiveActivityLogs } from '../../services/api.js';
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

        const res = await getExecutiveActivityLogs(params, true);
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
            const itemDate = new Date(item.isoDate || item.created_at || 0).toISOString().split('T')[0];
            return itemDate === specificDate.value;
        });
    }

    return list;
});

// Group activities by date group
const groupedActivities = computed(() => {
    const groups = {};
    filteredActivities.value.forEach(item => {
        const key = item.dayGroup || item.relativeGroup || 'Past Events';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
});

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 80, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
}

function handleDateFilterChange() {
    if (dateFilter.value !== 'specific') {
        specificDate.value = '';
    }
    loadLogs();
}

function clearSearch() {
    searchQuery.value = '';
}

function toggleFullscreen() {
    isFullscreen.value = !isFullscreen.value;
}

onMounted(() => {
    loadLogs();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <div class="activity-logs-container" :class="{ 'fullscreen-view': isFullscreen }">
                <!-- 1. Page Header -->
                <div class="activity-page-header">
                    <h1 class="activity-page-title">Activity Log</h1>
                    <div class="activity-header-actions">
                        <button
                            type="button"
                            class="btn-refresh-logs"
                            title="Refresh activity logs"
                            @click="loadLogs"
                        >
                            <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                <!-- 2. Filter Bar: Search + Date Range -->
                <div class="activity-filter-bar">
                    <div class="activity-search-box">
                        <i class="fa-solid fa-magnifying-glass activity-search-icon"></i>
                        <input
                            v-model="searchQuery"
                            type="text"
                            id="activity-search-input"
                            class="activity-search-input"
                            placeholder="Search activity logs..."
                            aria-label="Search activity logs"
                        >
                        <button
                            v-if="searchQuery"
                            type="button"
                            id="activity-search-clear"
                            class="activity-search-clear"
                            aria-label="Clear search"
                            @click="clearSearch"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="activity-date-controls">
                        <select
                            id="date-filter-select"
                            v-model="dateFilter"
                            class="activity-date-select"
                            aria-label="Filter by time range"
                            @change="handleDateFilterChange"
                        >
                            <option value="all">All Dates</option>
                            <option value="today">Today</option>
                            <option value="7days">Past 7 Days</option>
                            <option value="30days">Past 30 Days</option>
                            <option value="specific">Specific Date</option>
                        </select>

                        <div v-if="dateFilter === 'specific'" id="specific-date-wrapper" class="specific-date-wrapper">
                            <input
                                v-model="specificDate"
                                type="date"
                                id="specific-date-picker"
                                class="specific-date-input"
                                aria-label="Choose specific date"
                                @change="loadLogs"
                            >
                        </div>
                    </div>
                </div>

                <!-- 3. Status Results Counter -->
                <div id="activity-results-counter" class="activity-results-counter">
                    Showing {{ filteredActivities.length }} logged events
                </div>

                <!-- 4. Clean Timeline Stream -->
                <section
                    id="activity-stream-timeline"
                    class="activity-stream-timeline"
                    role="feed"
                    aria-label="System activity history"
                >
                    <div
                        v-for="(items, groupName) in groupedActivities"
                        :key="groupName"
                        class="timeline-group"
                    >
                        <div class="timeline-date-label">
                            <span>{{ groupName }}</span>
                        </div>

                        <div
                            v-for="item in items"
                            :key="item.id || item.rawDate"
                            class="timeline-entry"
                        >
                            <div class="timeline-avatar">
                                <img
                                    :src="resolveAvatarUrl(item.causerAvatar)"
                                    :alt="item.causerName || 'User'"
                                    loading="lazy"
                                >
                            </div>

                            <div class="timeline-card">
                                <div class="timeline-card-header">
                                    <div class="timeline-user-meta">
                                        <span class="timeline-user-name">{{ item.causerName || 'User' }}</span>
                                        <span v-if="item.causerRole" class="timeline-role-pill">{{ item.causerRole }}</span>
                                    </div>
                                    <span class="timeline-timestamp">{{ item.timeString || item.timeAgo || 'Recently' }}</span>
                                </div>

                                <div class="timeline-card-body">
                                    <p class="timeline-statement">
                                        {{ formatActivityStatement(item).fullStatement }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div v-if="!isLoading && filteredActivities.length === 0" class="activity-empty-state">
                        <i class="fa-regular fa-clock empty-icon"></i>
                        <h3 class="empty-title">No activity logs recorded</h3>
                        <p class="empty-desc">System events and user actions will be recorded here as they occur.</p>
                    </div>
                </section>
            </div>
        </main>
    </ExecutiveLayout>
</template>
