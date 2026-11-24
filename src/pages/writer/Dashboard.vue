<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import WriterLayout from '../../layouts/WriterLayout.vue';
import { getWriterDashboard } from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { formatCleanArticleContent } from '../../utils/articleContent.js';

const router = useRouter();

// State
const isLoading = ref(true);
const rawFullName = localStorage.getItem('userName') || localStorage.getItem('writerName') || '';
const firstName = ref(rawFullName ? rawFullName.split(' ')[0] : 'Writer');
const writerStats = ref({
    total_views: 0,
    published: 0,
    pending: 0,
    drafts: 0,
});
const recentArticles = ref([]);
const topArticles = ref([]);

// Article Viewer Modal state
const isViewerOpen = ref(false);
const activeArticle = ref(null);

function getAuthorAvatar(article) {
    const raw = article?.author_avatar || article?.authorAvatar || localStorage.getItem('userAvatar');
    if (!raw) return '/images/member-placeholder.svg';
    return optimizeCloudinaryUrl(raw, { width: 100, crop: 'limit' });
}

function formatNumber(num) {
    if (!num) return '0';
    return Number(num).toLocaleString('en-US');
}

function calculateReadingTime(text) {
    if (!text) return '1 min read';
    const plainText = text.replace(/<[^>]+>/g, '').trim();
    const words = plainText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

function openArticleViewer(article) {
    activeArticle.value = article;
    isViewerOpen.value = true;
}

function closeArticleViewer() {
    isViewerOpen.value = false;
    activeArticle.value = null;
}

function editArticle(id, event) {
    if (event) event.stopPropagation();
    router.push({ path: '/writer/submit-article', query: { draft_id: id } });
}

function navigateToTab(tab, sort = null) {
    const query = { tab };
    if (sort) query.sort = sort;
    router.push({ path: '/writer/manage-articles', query });
}

function getBadgeClass(status) {
    if (!status) return 'status-draft';
    const s = status.toLowerCase();
    if (s.includes('publish') || s.includes('approve')) return 'status-published';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('revision')) return 'status-revision';
    return 'status-draft';
}

onMounted(async () => {
    try {
        const data = await getWriterDashboard();
        if (data) {
            if (data.user?.first_name) {
                firstName.value = data.user.first_name;
            } else if (data.user?.full_name) {
                firstName.value = data.user.full_name.split(' ')[0];
                localStorage.setItem('userName', data.user.full_name);
            }
            if (data.writerStats) writerStats.value = data.writerStats;
            if (data.recentArticles) recentArticles.value = data.recentArticles;
            if (data.topArticles) topArticles.value = data.topArticles;
        }
    } catch (err) {
        console.warn('Error loading writer dashboard data:', err);
    } finally {
        isLoading.value = false;
    }
});
</script>

<template>
    <WriterLayout>
        <main class="content-container">
            <!-- Greeting & Quick Action Header -->
            <div class="writer-header-row animate-fade-in delay-1">
                <div class="writer-header-left">
                    <h1 class="writer-greeting" id="writer-greeting-heading">
                        Welcome back, <span class="writer-name-highlight">{{ firstName }}</span>
                    </h1>
                    <p class="writer-greeting-subtitle">Here is your publication overview and manuscript status.</p>
                </div>
                <div class="writer-header-right">
                    <router-link to="/writer/submit-article" class="btn-primary-action">
                        <i class="fa-solid fa-feather-pointed"></i>
                        <span>New Article</span>
                    </router-link>
                </div>
            </div>

            <!-- 4 Analytics Metric Cards -->
            <section class="writer-analytics-grid animate-fade-in delay-2" aria-label="Writer statistics">
                <div
                    class="writer-stat-card"
                    role="button"
                    tabindex="0"
                    title="View published articles sorted by views"
                    @click="navigateToTab('published', 'popular')"
                    @keydown.enter="navigateToTab('published', 'popular')"
                >
                    <div class="stat-number">{{ formatNumber(writerStats.total_views) }}</div>
                    <div class="stat-label">Total Views</div>
                </div>
                <div
                    class="writer-stat-card"
                    role="button"
                    tabindex="0"
                    title="View all published articles"
                    @click="navigateToTab('published')"
                    @keydown.enter="navigateToTab('published')"
                >
                    <div class="stat-number">{{ formatNumber(writerStats.published) }}</div>
                    <div class="stat-label">Published Articles</div>
                </div>
                <div
                    class="writer-stat-card"
                    role="button"
                    tabindex="0"
                    title="View articles pending review"
                    @click="navigateToTab('pending')"
                    @keydown.enter="navigateToTab('pending')"
                >
                    <div class="stat-number">{{ formatNumber(writerStats.pending_review || writerStats.pending) }}</div>
                    <div class="stat-label">Pending Review</div>
                </div>
                <div
                    class="writer-stat-card"
                    role="button"
                    tabindex="0"
                    title="View draft articles"
                    @click="navigateToTab('drafts')"
                    @keydown.enter="navigateToTab('drafts')"
                >
                    <div class="stat-number">{{ formatNumber(writerStats.drafts) }}</div>
                    <div class="stat-label">Drafts</div>
                </div>
            </section>

            <!-- Dashboard Content 2-Column Grid -->
            <div class="writer-dashboard-content-grid animate-fade-in delay-3">
                <!-- Left Column: Recent Articles -->
                <div class="writer-recent-column">
                    <div class="writer-section-header">
                        <div class="section-title-wrap">
                            <h2 class="writer-section-title">My Recent Articles</h2>
                        </div>
                        <router-link to="/writer/manage-articles" class="view-all-link">
                            <span>View all</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </router-link>
                    </div>

                    <section class="writer-articles-list">
                        <article
                            v-for="art in recentArticles"
                            :key="art.id"
                            class="writer-article-card cursor-pointer"
                            @click="openArticleViewer(art)"
                        >
                            <div class="article-card-header">
                                <div class="article-card-meta">
                                    <span class="article-card-category">{{ art.category }}</span>
                                    <span class="meta-dot">&bull;</span>
                                    <span class="article-card-date">
                                        <i class="fa-regular fa-calendar"></i> {{ art.date }}
                                    </span>
                                    <template v-if="art.status === 'Published'">
                                        <span class="meta-dot">&bull;</span>
                                        <span class="article-card-date">
                                            <i class="fa-regular fa-eye"></i> {{ formatNumber(art.views) }} views
                                        </span>
                                    </template>
                                </div>
                                <div class="article-card-status-top">
                                    <span class="status-badge" :class="getBadgeClass(art.status)">{{ art.status }}</span>
                                </div>
                            </div>

                            <div class="article-card-body">
                                <div class="article-card-body-content">
                                    <h3 class="article-card-title">{{ art.title }}</h3>
                                    <p v-if="art.excerpt" class="article-card-excerpt">{{ art.excerpt }}</p>
                                </div>

                                <!-- Actions: Katapat of title and excerpt -->
                                <div v-if="art.canEdit" class="article-card-actions">
                                    <button
                                        type="button"
                                        class="btn-box-edit"
                                        title="Edit article"
                                        @click.stop="editArticle(art.id, $event)"
                                    >
                                        <i class="fa-solid fa-pen-to-square"></i>
                                        <span>Edit</span>
                                    </button>
                                </div>
                            </div>
                        </article>

                        <div v-if="!isLoading && recentArticles.length === 0" class="writer-empty-state">
                            <i class="fa-regular fa-folder-open"></i>
                            <p class="empty-title">No Articles Yet</p>
                            <p class="empty-subtitle">You have not submitted or drafted any articles yet. Click "New Article" above to begin.</p>
                        </div>
                    </section>
                </div>

                <!-- Right Column: Top Performing Articles -->
                <aside class="writer-top-performing-column">
                    <section class="card-panel">
                        <div class="panel-header">
                            <h2 class="panel-title">Top Performing Articles</h2>
                            <span class="panel-badge">By Views</span>
                        </div>

                        <div class="ranked-list">
                            <div
                                v-for="(topArt, index) in topArticles"
                                :key="topArt.id"
                                class="ranked-item cursor-pointer"
                                @click="openArticleViewer(topArt)"
                            >
                                <span class="rank-number" :class="{ 'top-rank': index === 0 }">{{ index + 1 }}</span>
                                <div class="ranked-content">
                                    <div class="ranked-category-tag">{{ topArt.category }}</div>
                                    <button
                                        type="button"
                                        class="ranked-title-btn"
                                        :title="topArt.title"
                                    >
                                        {{ topArt.title }}
                                    </button>
                                    <div class="ranked-meta-row">
                                        <span class="ranked-author">
                                            <i class="fa-solid fa-pen-nib" aria-hidden="true" style="font-size: 0.70rem; margin-right: 4px; color: var(--text-muted, #667085);"></i>
                                            {{ topArt.author }}
                                        </span>
                                        <span class="ranked-stats">
                                            <span class="stat-metric" title="Views">
                                                <i class="fa-regular fa-eye" aria-hidden="true"></i> {{ formatNumber(topArt.views) }}
                                            </span>
                                            <span class="stat-metric" title="Shares">
                                                <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {{ formatNumber(topArt.shares || 0) }}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div v-if="!isLoading && topArticles.length === 0" style="font-size: 0.85rem; color: #667085; text-align: center; padding: 24px 0;">
                                No published articles yet.
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </main>

        <!-- Article Viewer Modal -->
        <div
            v-if="isViewerOpen && activeArticle"
            id="article-viewer-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-title"
            @click.self="closeArticleViewer"
        >
            <div class="modal-card viewer-modal-card">
                <div class="viewer-modal-header">
                    <div class="viewer-meta-row">
                        <span id="viewer-category" class="viewer-category-tag">{{ activeArticle.category }}</span>
                        <span class="viewer-dot">·</span>
                        <span id="viewer-date" class="viewer-date">{{ activeArticle.date }}</span>
                    </div>
                    <div class="viewer-header-right">
                        <span class="viewer-reading-time">
                            <i class="fa-regular fa-clock"></i>
                            <span id="viewer-read-time">{{ calculateReadingTime(activeArticle.content) }}</span>
                        </span>
                        <button type="button" id="close-viewer-btn" class="viewer-close-btn" @click="closeArticleViewer" aria-label="Close modal">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="viewer-modal-body">
                    <h1 id="viewer-title" class="viewer-title">{{ activeArticle.title }}</h1>
                    <div class="viewer-byline-row">
                        <div class="viewer-author-avatar">
                            <img
                                :src="getAuthorAvatar(activeArticle)"
                                :alt="(activeArticle.author || 'Author') + ' avatar'"
                                loading="lazy"
                            >
                        </div>
                        <div class="viewer-byline-text">
                            <span class="viewer-by">By <strong id="viewer-author">{{ activeArticle.author }}</strong></span>
                        </div>
                    </div>
                    <div v-if="activeArticle.remarks && (activeArticle.status || '').toLowerCase().includes('revision') && !activeArticle.status.toLowerCase().includes('head') && !activeArticle.status.toLowerCase().includes('section')" class="viewer-remarks-container" style="margin-bottom: 20px; padding: 12px 16px; background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 4px;">
                        <h4 style="margin: 0 0 4px; font-size: 0.85rem; font-weight: 700; color: #9f1239;">Revision Remarks:</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: #4c0519; line-height: 1.55; white-space: pre-wrap;">{{ activeArticle.remarks }}</p>
                    </div>
                    <div id="viewer-content" class="viewer-content-text" v-html="formatCleanArticleContent(activeArticle.content || activeArticle.excerpt)"></div>
                </div>
            </div>
        </div>
    </WriterLayout>
</template>
