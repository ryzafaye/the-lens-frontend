<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import SectionHeadLayout from '../layouts/SectionHeadLayout.vue';
import EicLayout from '../layouts/EicLayout.vue';
import ExecutiveLayout from '../layouts/ExecutiveLayout.vue';
import MpcLayout from '../layouts/MpcLayout.vue';
import {
    getSectionHeadActivityLogs,
    getEicActivityLogs,
    getExecutiveActivityLogs,
    getMpcActivityLogs,
} from '../services/api.js';
import { optimizeCloudinaryUrl } from '../utils/image.js';
import {
    formatActivityStatement,
    formatPhilippineDateTime,
    formatPhilippineRelativeTime,
    getPhilippineDayGroup,
} from '../utils/activityGrammar.js';
import { useAuthStore } from '../stores/auth.js';
import '../assets/css/executive-activity-logs.css';

const props = defineProps({
    role: {
        type: String,
        default: '', // 'section-head' | 'eic' | 'executive'
    },
    pageTitle: {
        type: String,
        default: 'Activity Log',
    },
    pageSubtitle: {
        type: String,
        default: 'Real-time audit stream of all editorial actions, manuscript submissions, approvals, and system activities across The Lens.',
    },
});

const route = useRoute();
const authStore = useAuthStore();

// Detect active role
const activeRole = computed(() => {
    if (props.role) return props.role.toLowerCase();
    const path = route.path.toLowerCase();
    if (path.includes('/section-head')) return 'section-head';
    if (path.includes('/eic')) return 'eic';
    if (path.includes('/executive')) return 'executive';
    if (path.includes('/mpc')) return 'mpc';
    const storeRole = (authStore.user?.role?.name || authStore.user?.role?.role_name || authStore.currentRole || '').toLowerCase();
    if (storeRole.includes('mpc') || storeRole.includes('m&pc') || storeRole.includes('media and public')) return 'mpc';
    if (storeRole.includes('editor') || storeRole.includes('eic')) return 'eic';
    if (storeRole.includes('exec')) return 'executive';
    if (storeRole.includes('head')) return 'section-head';
    return 'section-head';
});

// Dynamic Layout Selection
const CurrentLayout = computed(() => {
    switch (activeRole.value) {
        case 'eic':
            return EicLayout;
        case 'executive':
            return ExecutiveLayout;
        case 'mpc':
            return MpcLayout;
        case 'section-head':
        default:
            return SectionHeadLayout;
    }
});

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

function getTimestampText(item) {
    if (!item) return 'Recent';
    const dateInput = item.isoDate || item.created_at || item.rawDate;
    if (dateInput) {
        return formatPhilippineRelativeTime(dateInput);
    }
    return item.timestampText || item.created_at_human || item.time || 'Recent';
}

function getFormattedDate(item) {
    if (!item) return '';
    const dateInput = item.isoDate || item.created_at || item.rawDate;
    if (dateInput) {
        return formatPhilippineDateTime(dateInput);
    }
    return item.formattedDate || item.date || '';
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

// Group filtered activities by dayGroup in Philippine Standard Time
const groupedActivities = computed(() => {
    const groups = {};
    filteredActivities.value.forEach(item => {
        const dateVal = item.isoDate || item.rawDate || item.created_at;
        const groupKey = getPhilippineDayGroup(dateVal) || item.dayGroup || 'Earlier';
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
            search: searchQuery.value || undefined,
            date_filter: dateFilter.value !== 'all' ? dateFilter.value : undefined,
            date: dateFilter.value === 'specific' ? specificDate.value : undefined,
        };

        let data = null;
        switch (activeRole.value) {
            case 'eic':
                data = await getEicActivityLogs(params, forceFresh);
                break;
            case 'executive':
                data = await getExecutiveActivityLogs(params, forceFresh);
                break;
            case 'mpc':
                data = await getMpcActivityLogs(params, forceFresh);
                break;
            case 'section-head':
            default:
                data = await getSectionHeadActivityLogs(params, forceFresh);
                break;
        }

        if (data?.activities && Array.isArray(data.activities)) {
            activities.value = data.activities;
        } else if (Array.isArray(data)) {
            activities.value = data;
        } else {
            activities.value = [];
        }
    } catch (err) {
        console.error(`Failed to load ${activeRole.value} activity logs:`, err);
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
    <component :is="CurrentLayout">
        <main class="content-container activity-page-content-container" style="max-width: 100% !important; width: 100% !important;">
            <div class="activity-logs-container" style="max-width: 100% !important; width: 100% !important;">

                <!-- 1. Page Header (Exact Section Head format with Refresh button) -->
                <div class="activity-page-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h1 class="activity-page-title" style="font-family: 'Playfair Display', Georgia, serif !important;">
                            {{ pageTitle }}
                        </h1>
                        <p style="font-size: 0.85rem; color: #667085; margin: 4px 0 0 0;">
                            {{ pageSubtitle }}
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

                                    <!-- Under it: Role and formatted timestamp only -->
                                    <div class="activity-subrow">
                                        <span class="activity-role-text">{{ getCauserRole(item) }}</span>
                                        <span class="activity-subrow-dot">&bull;</span>
                                        <span class="activity-exact-time">{{ getFormattedDate(item) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- 5. Empty State Message -->
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
                                ? 'No logged actions match your current search and filter criteria. Try resetting your search or choosing a different date range.'
                                : 'There are currently no recorded editorial or system activities. Future operations will appear here in chronological order.' }}
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
    </component>
</template>
