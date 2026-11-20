<script setup>
import { ref, computed, onMounted } from 'vue';
import SectionHeadLayout from '../../layouts/SectionHeadLayout.vue';
import { getSectionHeadActivityLogs } from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatActivityStatement } from '../../utils/activityGrammar.js';
import '../../assets/css/executive-activity-logs.css';

// State
const isLoading = ref(true);
const isRefreshing = ref(false);
const activities = ref([]);
const searchQuery = ref('');
const dateFilter = ref('all');
const specificDate = ref('');

// Helper accessors supporting both flat (Blade format) and nested API representations
function getCauser(item) {
    if (!item) return 'System';
    if (typeof item.causer === 'string' && item.causer.trim()) return item.causer;
    if (item.causer?.name) return item.causer.name;
    if (item.user && typeof item.user === 'string') return item.user;
    return 'System';
}

function getCauserRole(item) {
    if (!item) return 'Member';
    if (item.causerRole) return item.causerRole;
    if (item.causer?.role) return item.causer.role;
    if (item.role) return item.role;
    return 'Member';
}

function getCauserAvatar(item) {
    if (!item) return '/images/member-placeholder.svg';
    const raw = item.causerAvatar || item.causer?.avatar || item.avatar;
    if (!raw) return '/images/member-placeholder.svg';
    return optimizeCloudinaryUrl(raw, { width: 100, crop: 'limit' });
}

function getAction(item) {
    return item?.action || 'performed an action';
}

function getSubjectType(item) {
    if (!item) return 'Article';
    if (item.subjectType) return item.subjectType;
    if (item.subject?.type) return item.subject.type;
    return 'Article';
}

function getSubjectName(item) {
    if (!item) return '';
    if (item.subjectName) return item.subjectName;
    if (item.subject?.title) return item.subject.title;
    if (item.target) return item.target;
    return '';
}

function getTimestampText(item) {
    if (!item) return 'Recent';
    return item.timestampText || item.created_at_human || item.time || 'Recent';
}

function getFormattedDate(item) {
    if (!item) return '';
    return item.formattedDate || item.date || item.created_at || '';
}

function getStatement(item) {
    return formatActivityStatement(item);
}

// Computed filtered list with flexible search across causers, actions, roles, and subject names
const filteredActivities = computed(() => {
    let list = activities.value.filter(act => {
        const action = getAction(act).toLowerCase();
        return !action.includes('login') && !action.includes('logged in') && !action.includes('logout') && !action.includes('logged out') && !action.includes('profile') && !action.includes('password');
    });

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(act => {
            const stmt = getStatement(act);
            const role = getCauserRole(act).toLowerCase();
            const action = getAction(act).toLowerCase();
            const fullStatement = stmt.fullStatement.toLowerCase();
            return fullStatement.includes(q) || role.includes(q) || action.includes(q);
        });
    }

    const now = Date.now();
    const oneDayMs = 24 * 3600 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    if (dateFilter.value === 'today') {
        list = list.filter(act => {
            if (act.dayGroup === 'Today') return true;
            const dateStr = act.isoDate || act.rawDate || act.created_at;
            if (!dateStr) return false;
            return (now - new Date(dateStr).getTime()) <= oneDayMs;
        });
    } else if (dateFilter.value === '7days') {
        list = list.filter(act => {
            const dateStr = act.isoDate || act.rawDate || act.created_at;
            if (!dateStr) return false;
            return (now - new Date(dateStr).getTime()) <= sevenDaysMs;
        });
    } else if (dateFilter.value === '30days') {
        list = list.filter(act => {
            const dateStr = act.isoDate || act.rawDate || act.created_at;
            if (!dateStr) return false;
            return (now - new Date(dateStr).getTime()) <= thirtyDaysMs;
        });
    } else if (dateFilter.value === 'specific' && specificDate.value) {
        list = list.filter(act => {
            const dateKey = act.dateKey;
            if (dateKey) return dateKey === specificDate.value;
            const dateStr = act.isoDate || act.rawDate || act.created_at || '';
            return dateStr.startsWith(specificDate.value);
        });
    }

    return list;
});

// Group filtered activities by dayGroup
const groupedActivities = computed(() => {
    const groups = {};
    filteredActivities.value.forEach(item => {
        let groupKey = item.dayGroup;
        if (!groupKey) {
            const dateVal = item.isoDate || item.rawDate || item.created_at;
            if (dateVal) {
                const itemDate = new Date(dateVal);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                if (itemDate.toDateString() === today.toDateString()) {
                    groupKey = 'Today';
                } else if (itemDate.toDateString() === yesterday.toDateString()) {
                    groupKey = 'Yesterday';
                } else {
                    groupKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            } else {
                groupKey = 'Earlier';
            }
        }
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
    });
    return groups;
});

const resultsCounterText = computed(() => {
    if (isLoading.value) return 'Fetching latest system activity...';
    if (searchQuery.value) {
        return `Showing ${filteredActivities.value.length} of ${activities.value.length} logged events matching "${searchQuery.value}"`;
    }
    return `Showing all ${filteredActivities.value.length} logged events`;
});

function clearSearch() {
    searchQuery.value = '';
}

function resetFilters() {
    searchQuery.value = '';
    dateFilter.value = 'all';
    specificDate.value = '';
}

async function loadActivities(forceFresh = false) {
    if (forceFresh) isRefreshing.value = true;
    else isLoading.value = true;

    try {
        const params = {
            search: searchQuery.value,
            date_filter: dateFilter.value,
            date: specificDate.value,
        };
        const data = await getSectionHeadActivityLogs(params, forceFresh);
        if (data?.activities) {
            activities.value = data.activities;
        }
    } catch (err) {
        console.error('Failed to load activity logs from database:', err);
    } finally {
        isLoading.value = false;
        isRefreshing.value = false;
    }
}

onMounted(() => {
    loadActivities();
});
</script>

<template>
    <SectionHeadLayout>
        <main class="content-container activity-page-content-container" style="max-width: 100% !important; width: 100% !important;">
            <div class="activity-logs-container" style="max-width: 100% !important; width: 100% !important;">
                
                <!-- 1. Page Header (Exact Blade executive/activity-logs format with Refresh) -->
                <div class="activity-page-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h1 class="activity-page-title" style="font-family: 'Playfair Display', Georgia, serif !important;">Activity Log</h1>
                        <p style="font-size: 0.85rem; color: #667085; margin: 4px 0 0 0;">
                            Real-time audit stream of all editorial actions, manuscript submissions, approvals, and system activities across The Lens.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="btn-empty-reset"
                        style="margin: 0; padding: 6px 14px; font-size: 0.78rem;"
                        :disabled="isRefreshing"
                        @click="loadActivities(true)"
                        title="Fetch latest system activities from database"
                    >
                        <i :class="['fa-solid', 'fa-rotate-right', isRefreshing ? 'fa-spin' : '']"></i>
                        <span>{{ isRefreshing ? 'Refreshing...' : 'Refresh Logs' }}</span>
                    </button>
                </div>

                <!-- 2. Filter Bar: Search + Date Range (Spanning Full Page Width) -->
                <div class="activity-filter-bar">
                    <div class="activity-search-box">
                        <i class="fa-solid fa-magnifying-glass activity-search-icon"></i>
                        <input
                            type="text"
                            id="activity-search-input"
                            v-model="searchQuery"
                            class="activity-search-input"
                            placeholder="Search activity logs by user, action, article headline, or role..."
                            aria-label="Search activity logs"
                        >
                        <button
                            v-if="searchQuery"
                            type="button"
                            id="activity-search-clear"
                            class="activity-search-clear"
                            style="display: block;"
                            @click="clearSearch"
                            aria-label="Clear search"
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
                        >
                            <option value="all">All Dates</option>
                            <option value="today">Today</option>
                            <option value="7days">Past 7 Days</option>
                            <option value="30days">Past 30 Days</option>
                            <option value="specific">Specific Date</option>
                        </select>

                        <div v-if="dateFilter === 'specific'" id="specific-date-wrapper" class="specific-date-wrapper">
                            <input
                                type="date"
                                id="specific-date-picker"
                                v-model="specificDate"
                                class="specific-date-input"
                                aria-label="Choose specific date"
                            >
                        </div>
                    </div>
                </div>

                <!-- 3. Status Results Counter -->
                <div id="activity-results-counter" class="activity-results-counter">
                    <span v-html="resultsCounterText"></span>
                </div>

                <!-- Loading State Skeleton -->
                <div v-if="isLoading" class="activity-stream-timeline" style="opacity: 0.7;">
                    <div class="activity-event-card" style="padding: 24px; text-align: center; color: #667085;">
                        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--sidebar-maroon, #5c0a18); margin-bottom: 8px;"></i>
                        <p style="margin: 0; font-size: 0.88rem;">Connecting to database & loading activity logs...</p>
                    </div>
                </div>

                <!-- 4. Clean Timeline Stream (Full-Width Responsive Architecture) -->
                <section
                    v-else
                    id="activity-stream-timeline"
                    class="activity-stream-timeline"
                    aria-label="Activity events timeline"
                >
                    <template v-for="(items, day) in groupedActivities" :key="day">
                        <div class="timeline-day-divider">
                            <span class="timeline-day-pill">{{ day }}</span>
                            <span class="timeline-day-line"></span>
                        </div>

                        <div
                            v-for="(item, idx) in items"
                            :key="item.id || idx"
                            class="activity-event-card"
                        >
                            <div class="activity-event-node"></div>

                            <div class="activity-card-inner">
                                <div class="activity-avatar-wrap">
                                    <img
                                        :src="getCauserAvatar(item)"
                                        :alt="getCauser(item)"
                                        class="activity-avatar-img"
                                        loading="lazy"
                                    >
                                </div>

                                <div class="activity-content-col">
                                    <!-- Natural Sentence Statement with Grammatical Flow -->
                                    <p class="activity-sentence-statement">
                                        <strong class="causer-name-token">{{ getStatement(item).causer }}</strong>
                                        <span> {{ getStatement(item).beforeSubject }}</span>
                                        <template v-if="getStatement(item).subjectName">
                                            <span class="subject-name-token" style="font-family: 'Playfair Display', Georgia, serif !important; margin: 0 4px;">
                                                "{{ getStatement(item).subjectName }}"
                                            </span>
                                        </template>
                                        <span v-if="getStatement(item).afterSubject" :style="{ marginLeft: getStatement(item).subjectName ? '0px' : '4px' }">
                                            {{ getStatement(item).afterSubject }}
                                        </span>
                                        <span class="timestamp-token" style="margin-left: 4px;">{{ getTimestampText(item) }}.</span>
                                    </p>

                                    <!-- Under it: Role and formatted timestamp only (Blade parity) -->
                                    <div class="activity-subrow">
                                        <span class="activity-role-text">{{ getCauserRole(item) }}</span>
                                        <span class="activity-subrow-dot">•</span>
                                        <span class="activity-exact-time">{{ getFormattedDate(item) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- 5. Empty State Message (When No Logs Exist or Search Yields 0 Results) -->
                    <div
                        v-if="!isLoading && filteredActivities.length === 0"
                        class="activity-empty-state"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <h4 class="empty-state-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                            {{ searchQuery || dateFilter !== 'all' ? 'No activity logs found' : 'No activity logs yet' }}
                        </h4>
                        <p class="empty-state-desc">
                            {{ searchQuery || dateFilter !== 'all'
                                ? 'No activity events match your current search or date range filters. Try resetting the filters to view all logged system events.'
                                : 'All editorial activities, manuscript submissions, approvals, and revisions occurring across the publication system will be logged and presented here in real time.'
                            }}
                        </p>
                        <button
                            v-if="searchQuery || dateFilter !== 'all'"
                            type="button"
                            class="btn-empty-reset"
                            @click="resetFilters"
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>Reset Filters</span>
                        </button>
                    </div>
                </section>
            </div>
        </main>
    </SectionHeadLayout>
</template>
