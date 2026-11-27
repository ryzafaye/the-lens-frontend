<script setup>
import { ref, computed, onMounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import { getExecutiveFeedback, markExecutiveFeedbackRead } from '../../services/api.js';
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
const mobileViewingMessage = ref(false);

// Badges
const countAll = computed(() => feedbackList.value.length);
const countUnread = computed(() => feedbackList.value.filter(f => !f.isRead).length);

// Helper for Initials
function getInitials(name) {
    if (!name) return '';
    return name
        .trim()
        .split(/\s+/)
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// Filtered List
const filteredList = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();

    let list = feedbackList.value.filter(item => {
        if (currentTab.value === 'unread' && item.isRead) return false;

        if (q) {
            const nameStr = (item.name || 'Anonymous Reader').toLowerCase();
            const emailStr = (item.email || '').toLowerCase();
            const subjStr = (item.subject || '').toLowerCase();
            const msgStr = (item.message || '').toLowerCase();
            return nameStr.includes(q) || emailStr.includes(q) || subjStr.includes(q) || msgStr.includes(q);
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

async function selectMessage(item) {
    activeMessageId.value = item.id;
    mobileViewingMessage.value = true;
    if (!item.isRead) {
        item.isRead = true;
        try {
            await markExecutiveFeedbackRead(item.id);
        } catch (err) {
            console.warn('Failed to mark feedback as read:', err);
        }
    }
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

        if (feedbackList.value.length > 0 && !activeMessageId.value) {
            activeMessageId.value = feedbackList.value[0].id;
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

                <!-- Loading State -->
                <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                    <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading feedback messages...</p>
                </div>

                <!-- Clean Empty State when Inbox has no submissions -->
                <div v-else-if="feedbackList.length === 0" class="feedback-empty-state" id="feedback-empty-state">
                    <div class="feedback-empty-card">
                        <div class="feedback-empty-icon-wrap">
                            <i class="fa-regular fa-envelope-open"></i>
                        </div>
                        <h2 class="feedback-empty-heading">No feedback messages yet</h2>
                        <p class="feedback-empty-description">Reader responses and contact form submissions will appear here.</p>
                    </div>
                </div>

                <!-- Inbox with Messages -->
                <div v-else>
                    <!-- Search, Filter, and Sort Controls Bar (Directly under Title) -->
                    <div class="feedback-controls-bar" id="feedback-controls-bar">
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
                                    :aria-selected="currentTab === 'all'"
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
                                    :aria-selected="currentTab === 'unread'"
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
                    <div class="inbox-split-grid" id="inbox-split-grid" :class="{ 'mobile-viewing-message': mobileViewingMessage }">
                        <!-- Left: Scrollable Message List -->
                        <div class="inbox-list-pane">
                            <div class="inbox-list-header">
                                <span>All Submissions</span>
                                <span class="inbox-list-count">{{ filteredList.length }} {{ filteredList.length === 1 ? 'message' : 'messages' }}</span>
                            </div>
                            <div v-if="filteredList.length === 0" class="inbox-empty-box">
                                <i class="fa-regular fa-folder-open"></i>
                                <p style="font-size: 0.85rem; font-weight: 600; color: #475467; margin: 0 0 4px 0;">No Messages Found</p>
                                <p style="font-size: 0.76rem; color: #98a2b3; margin: 0;">Try adjusting your search query or filter tab.</p>
                            </div>

                            <div v-else class="inbox-scroll-list" id="inbox-scroll-list" role="listbox" aria-label="Feedback message list">
                                <div
                                    v-for="item in filteredList"
                                    :key="item.id"
                                    class="inbox-item-card"
                                    :class="{ 'active': activeMessage?.id === item.id, 'unread': !item.isRead }"
                                    @click="selectMessage(item)"
                                >
                                    <div class="item-top-row">
                                        <div class="item-sender-wrap">
                                            <div class="item-sender-avatar" :class="{ anonymous: !item.name }">
                                                <i v-if="!item.name" class="fa-regular fa-user"></i>
                                                <span v-else>{{ getInitials(item.name) }}</span>
                                            </div>
                                            <span class="item-sender-name">{{ item.name || 'Anonymous Reader' }}</span>
                                            <span v-if="!item.name" class="item-anon-badge">Anon</span>
                                        </div>
                                        <span class="item-time">{{ item.date || 'Recent' }}</span>
                                    </div>
                                    <div class="item-subject">{{ item.subject || 'Publication Feedback' }}</div>
                                    <div class="item-snippet">{{ item.message }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Reading Detail Pane -->
                        <div class="inbox-detail-pane" id="inbox-detail-pane" aria-live="polite">
                            <button
                                type="button"
                                class="btn-back-to-list"
                                @click="mobileViewingMessage = false"
                            >
                                <i class="fa-solid fa-arrow-left"></i>
                                <span>Back to list</span>
                            </button>

                            <div v-if="!activeMessage" class="detail-placeholder">
                                <i class="fa-regular fa-envelope-open"></i>
                                <p style="font-size: 0.95rem; font-weight: 600; color: #475467; margin-bottom: 4px;">Select a message to view details</p>
                                <p style="font-size: 0.82rem; color: #98a2b3; margin: 0;">Choose any feedback submission from the left list.</p>
                            </div>
                            <template v-else>
                                <div class="detail-header">
                                    <h2 class="detail-subject-title">{{ activeMessage.subject || 'Publication Feedback' }}</h2>
                                    <div class="detail-sender-row">
                                        <div class="detail-sender-info">
                                            <div class="detail-avatar-large" :class="{ anonymous: !activeMessage.name }">
                                                <i v-if="!activeMessage.name" class="fa-regular fa-user"></i>
                                                <span v-else>{{ getInitials(activeMessage.name) }}</span>
                                            </div>
                                            <div class="detail-sender-names">
                                                <div class="detail-name-text">
                                                    {{ activeMessage.name || 'Anonymous Reader' }}
                                                    <span v-if="!activeMessage.name" class="item-anon-badge" style="margin-left: 6px;">Anon</span>
                                                </div>
                                                <div class="detail-meta-text">
                                                    <span v-if="activeMessage.email">{{ activeMessage.email }} &bull; </span>
                                                    <span>{{ activeMessage.fullDate || activeMessage.date || 'Recent' }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="detail-actions-group">
                                            <span class="detail-read-status" :class="activeMessage.isRead ? 'status-read' : 'status-unread'">
                                                <i :class="activeMessage.isRead ? 'fa-regular fa-envelope-open' : 'fa-solid fa-envelope'"></i>
                                                {{ activeMessage.isRead ? 'Read' : 'New' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="detail-message-body">
                                    <p style="white-space: pre-wrap; font-family: inherit; margin: 0;">{{ activeMessage.message }}</p>
                                </div>

                                <div class="detail-footer-note">
                                    <span>Official Publication Feedback &bull; The Lens Portal</span>
                                    <span v-if="activeMessage.email">Reply to: <a :href="'mailto:' + activeMessage.email" style="color: var(--sidebar-maroon, #5c0a18); text-decoration: underline;">{{ activeMessage.email }}</a></span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
