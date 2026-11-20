<script setup>
import { ref, computed, onMounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import { getExecutiveFeedback } from '../../services/api.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/shared-feedback-inbox.css';

const user = currentUser;

// RBAC
const isPresOrVp = computed(() => {
    return ['President', 'Vice President', 'Executive Vice President'].includes(user?.role || '');
});

// State
const isLoading = ref(true);
const feedbackList = ref([]);
const currentTab = ref('all'); // 'all' or 'unread'
const currentSort = ref('newest'); // 'newest' or 'oldest'
const searchQuery = ref('');
const activeMessageId = ref(null);

// Badges
const countAll = computed(() => feedbackList.value.length);
const countUnread = computed(() => feedbackList.value.filter(f => !f.isRead).length);

// Filtered List
const filteredList = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();

    let list = feedbackList.value.filter(item => {
        if (currentTab.value === 'unread' && item.isRead) return false;

        if (q) {
            const nameStr = (item.name || 'Anonymous Reader').toLowerCase();
            const subjStr = (item.subject || '').toLowerCase();
            const msgStr = (item.message || '').toLowerCase();
            return nameStr.includes(q) || subjStr.includes(q) || msgStr.includes(q);
        }

        return true;
    });

    return list.slice().sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date || 0).getTime() || 0;
        const timeB = b.timestamp || new Date(b.date || 0).getTime() || 0;
        return currentSort.value === 'newest' ? timeB - timeA : timeA - timeB;
    });
});

// Active Message
const activeMessage = computed(() => {
    if (!filteredList.value.length) return null;
    return filteredList.value.find(f => f.id === activeMessageId.value) || filteredList.value[0];
});

function selectMessage(item) {
    activeMessageId.value = item.id;
    item.isRead = true;
}

// Load Feedback
async function loadFeedbacks() {
    isLoading.value = true;
    try {
        const res = await getExecutiveFeedback(true);
        if (res && Array.isArray(res.feedbacks)) {
            feedbackList.value = res.feedbacks;
        } else if (Array.isArray(res)) {
            feedbackList.value = res;
        }
    } catch (err) {
        console.error('Failed to load feedback messages:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadFeedbacks();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Access Check for Non-Pres/VP -->
            <div v-if="!isPresOrVp" class="card-panel text-center py-12">
                <i class="fa-solid fa-lock text-4xl text-[#700f2b] mb-4"></i>
                <h2 class="text-xl font-bold text-stone-800">Access Restricted</h2>
                <p class="text-stone-500 mt-2 max-w-md mx-auto text-sm">
                    This section is restricted to the President and Vice President of the executive board.
                </p>
                <router-link to="/executive/dashboard" class="btn-primary mt-6 inline-block">
                    Return to Dashboard
                </router-link>
            </div>

            <div v-else class="feedback-inbox-container">
                <!-- Page Header: Clean Title -->
                <div class="feedback-header-row">
                    <h1 class="feedback-page-title">Feedback Inbox</h1>
                </div>

                <!-- Clean Empty State when Inbox has no submissions -->
                <div v-if="!isLoading && feedbackList.length === 0" class="feedback-empty-state" id="feedback-empty-state">
                    <div class="feedback-empty-card">
                        <div class="feedback-empty-icon-wrap">
                            <i class="fa-regular fa-envelope-open"></i>
                        </div>
                        <h2 class="feedback-empty-heading">No feedback messages yet</h2>
                    </div>
                </div>

                <!-- Search, Filter, and Sort Controls Bar (Directly under Title) -->
                <div v-if="feedbackList.length > 0" class="feedback-controls-bar" id="feedback-controls-bar">
                    <div class="feedback-search-box">
                        <i class="fa-solid fa-magnifying-glass feedback-search-icon"></i>
                        <input
                            v-model="searchQuery"
                            type="text"
                            id="feedback-search-input"
                            class="feedback-search-input"
                            placeholder="Search by sender name, subject, or message content..."
                            aria-label="Search feedback messages"
                        >
                        <button
                            v-if="searchQuery"
                            type="button"
                            id="feedback-search-clear"
                            class="feedback-search-clear"
                            aria-label="Clear search"
                            @click="searchQuery = ''"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="feedback-filters-and-sort">
                        <!-- Read Status Tabs -->
                        <div class="feedback-filter-tabs" id="feedback-filter-tabs" role="tablist">
                            <button
                                type="button"
                                class="tab-filter-btn"
                                :class="{ 'active': currentTab === 'all' }"
                                role="tab"
                                @click="currentTab = 'all'"
                            >
                                <span>All</span>
                                <span class="tab-pill-count" id="count-tab-all">{{ countAll }}</span>
                            </button>
                            <button
                                type="button"
                                class="tab-filter-btn"
                                :class="{ 'active': currentTab === 'unread' }"
                                role="tab"
                                @click="currentTab = 'unread'"
                            >
                                <span>Unread</span>
                                <span class="tab-pill-count" id="count-tab-unread">{{ countUnread }}</span>
                            </button>
                        </div>

                        <!-- Sort Dropdown (Newest / Oldest) -->
                        <div class="feedback-sort-wrap">
                            <label for="feedback-sort-select" class="feedback-sort-label">
                                <i class="fa-solid fa-arrow-down-short-wide"></i>
                                <span>Sort:</span>
                            </label>
                            <select id="feedback-sort-select" v-model="currentSort" class="feedback-sort-select" aria-label="Sort feedback messages">
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Master-Detail Split Inbox Layout -->
                <div v-if="feedbackList.length > 0" class="inbox-split-grid" id="inbox-split-grid">
                    <!-- Left: Scrollable Message List -->
                    <div class="inbox-list-pane">
                        <div class="inbox-list-header">
                            <span>All Submissions</span>
                        </div>
                        <div class="inbox-scroll-list" id="inbox-scroll-list" role="listbox" aria-label="Feedback message list">
                            <div
                                v-for="item in filteredList"
                                :key="item.id"
                                class="inbox-item-row"
                                :class="{ 'active': activeMessage?.id === item.id, 'unread': !item.isRead }"
                                @click="selectMessage(item)"
                            >
                                <div class="inbox-item-top">
                                    <span class="inbox-item-sender">{{ item.name || 'Anonymous Reader' }}</span>
                                    <span class="inbox-item-date">{{ item.date || 'Recent' }}</span>
                                </div>
                                <div class="inbox-item-subject">{{ item.subject || 'Publication Feedback' }}</div>
                                <div class="inbox-item-snippet">{{ item.message }}</div>
                            </div>

                            <div v-if="filteredList.length === 0" style="padding: 24px; text-align: center; color: #667085; font-size: 0.85rem;">
                                No feedback matching your search.
                            </div>
                        </div>
                    </div>

                    <!-- Right: Reading Detail Pane -->
                    <div class="inbox-detail-pane" id="inbox-detail-pane" aria-live="polite">
                        <template v-if="activeMessage">
                            <div class="detail-header-card">
                                <div class="detail-subject-line">{{ activeMessage.subject || 'Publication Feedback' }}</div>
                                <div class="detail-meta-row">
                                    <div class="detail-sender-info">
                                        <div class="detail-sender-name">{{ activeMessage.name || 'Anonymous Reader' }}</div>
                                        <div class="detail-sender-email">{{ activeMessage.email || 'No email provided' }}</div>
                                    </div>
                                    <div class="detail-timestamp">{{ activeMessage.date || 'Recent' }}</div>
                                </div>
                            </div>

                            <div class="detail-message-body">
                                <p style="white-space: pre-wrap; font-family: inherit;">{{ activeMessage.message }}</p>
                            </div>
                        </template>
                        <div v-else class="detail-empty-placeholder">
                            <p>Select a message to view details</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
