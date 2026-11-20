<script setup>
import { ref, computed, onMounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import { getEicFeedback } from '../../services/api.js';
import '../../assets/css/shared-feedback-inbox.css';

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
        const res = await getEicFeedback(true);
        if (res && Array.isArray(res.feedbacks)) {
            feedbackList.value = res.feedbacks;
        } else if (Array.isArray(res)) {
            feedbackList.value = res;
        }

        if (feedbackList.value.length > 0 && !activeMessageId.value) {
            activeMessageId.value = feedbackList.value[0].id;
        }
    } catch (err) {
        console.error('Failed to load feedbacks:', err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadFeedbacks();
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
            <div class="feedback-inbox-container">
                <!-- Page Header -->
                <div class="feedback-header-row">
                    <h1 class="feedback-page-title">Feedback Inbox</h1>
                </div>

                <!-- Loading State -->
                <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                    <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading feedback messages...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="feedbackList.length === 0" class="feedback-empty-state">
                    <div class="feedback-empty-card">
                        <div class="feedback-empty-icon-wrap">
                            <i class="fa-regular fa-envelope-open"></i>
                        </div>
                        <h2 class="feedback-empty-heading">No feedback messages yet</h2>
                        <p class="feedback-empty-text" style="color: #667085; font-size: 0.9rem; margin-top: 6px;">Reader responses and contact form submissions will appear here.</p>
                    </div>
                </div>

                <!-- Inbox with Messages -->
                <div v-else>
                    <!-- Controls Bar -->
                    <div class="feedback-controls-bar">
                        <div class="feedback-search-box">
                            <i class="fa-solid fa-magnifying-glass feedback-search-icon"></i>
                            <input
                                v-model="searchQuery"
                                type="text"
                                class="feedback-search-input"
                                placeholder="Search by sender name, subject, or message content..."
                                aria-label="Search feedback messages"
                            >
                            <button
                                v-if="searchQuery"
                                type="button"
                                class="feedback-search-clear"
                                @click="searchQuery = ''"
                                aria-label="Clear search"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div class="feedback-filters-and-sort">
                            <!-- Read Status Tabs -->
                            <div class="feedback-filter-tabs" role="tablist">
                                <button
                                    type="button"
                                    class="tab-filter-btn"
                                    :class="{ active: currentTab === 'all' }"
                                    @click="currentTab = 'all'"
                                    role="tab"
                                    :aria-selected="currentTab === 'all'"
                                >
                                    <span>All</span>
                                    <span class="tab-pill-count">{{ countAll }}</span>
                                </button>
                                <button
                                    type="button"
                                    class="tab-filter-btn"
                                    :class="{ active: currentTab === 'unread' }"
                                    @click="currentTab = 'unread'"
                                    role="tab"
                                    :aria-selected="currentTab === 'unread'"
                                >
                                    <span>Unread</span>
                                    <span class="tab-pill-count">{{ countUnread }}</span>
                                </button>
                            </div>

                            <!-- Sort Dropdown -->
                            <div class="feedback-sort-wrap">
                                <label for="feedback-sort-select" class="feedback-sort-label">
                                    <i class="fa-solid fa-arrow-down-short-wide"></i>
                                    <span>Sort:</span>
                                </label>
                                <select
                                    id="feedback-sort-select"
                                    v-model="currentSort"
                                    class="feedback-sort-select"
                                    aria-label="Sort feedback messages"
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Master-Detail Split Grid -->
                    <div class="inbox-split-grid">
                        <!-- Left: Scrollable Message List -->
                        <div class="inbox-list-pane">
                            <div class="inbox-list-header">
                                <span>All Submissions</span>
                            </div>

                            <div v-if="filteredList.length === 0" class="inbox-empty-box">
                                <i class="fa-regular fa-folder-open"></i>
                                <p style="font-size: 0.85rem; font-weight: 600; color: #475467; margin: 0 0 4px 0;">No Messages Found</p>
                                <p style="font-size: 0.76rem; color: #98a2b3; margin: 0;">Try adjusting your search query or filter tab.</p>
                            </div>

                            <div v-else class="inbox-scroll-list" role="listbox" aria-label="Feedback message list">
                                <div
                                    v-for="item in filteredList"
                                    :key="item.id"
                                    class="inbox-item-card"
                                    :class="{ active: item.id === activeMessage?.id, unread: !item.isRead }"
                                    @click="selectMessage(item)"
                                >
                                    <div class="item-top-row">
                                        <div class="item-sender-wrap">
                                            <div class="item-sender-avatar" :class="{ anonymous: !item.name }">
                                                <i v-if="!item.name" class="fa-regular fa-user"></i>
                                                <span v-else>{{ item.name.split(' ').map(n => n[0]).join('').substring(0, 2) }}</span>
                                            </div>
                                            <span class="item-sender-name">{{ item.name || 'Anonymous Reader' }}</span>
                                            <span v-if="!item.name" class="item-anon-badge">Anon</span>
                                        </div>
                                        <span class="item-time">{{ item.date || 'Recent' }}</span>
                                    </div>
                                    <div class="item-subject-text">{{ item.subject || 'Reader Feedback' }}</div>
                                    <div class="item-preview-text">{{ item.message }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Reading Detail Pane -->
                        <div class="inbox-detail-pane" aria-live="polite">
                            <div v-if="!activeMessage" class="inbox-empty-box" style="padding-top: 80px;">
                                <i class="fa-regular fa-envelope"></i>
                                <p style="font-size: 0.9rem; font-weight: 600; color: #475467;">Select a message to view details</p>
                            </div>
                            <div v-else class="detail-reading-container">
                                <div class="detail-header-card">
                                    <div class="detail-header-top">
                                        <h2 class="detail-subject-title">{{ activeMessage.subject || 'Reader Feedback' }}</h2>
                                    </div>
                                    <div class="detail-meta-row">
                                        <div class="detail-sender-info">
                                            <strong>{{ activeMessage.name || 'Anonymous Reader' }}</strong>
                                            <span v-if="activeMessage.email" class="detail-sender-email">&lt;{{ activeMessage.email }}&gt;</span>
                                        </div>
                                        <div class="detail-date-badge">{{ activeMessage.fullDate || activeMessage.date }}</div>
                                    </div>
                                </div>

                                <div class="detail-body-card">
                                    <div class="detail-message-content">
                                        {{ activeMessage.message }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </EicLayout>
</template>
