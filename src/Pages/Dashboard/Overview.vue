<script setup>
import { computed } from 'vue';
import { useAppState } from '../../state/appState.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({
    title: { type: String, default: 'Dashboard' },
    portal: { type: String, default: 'executive' },
    metrics: { type: Object, default: () => ({}) },
    writerStats: { type: Object, default: () => ({}) },
    pendingArticles: { type: Array, default: () => [] },
    publishedArticles: { type: Array, default: () => [] },
    recentActivities: { type: Array, default: () => [] },
    recentArticles: { type: Array, default: () => [] },
    topArticles: { type: Array, default: () => [] },
    mediaItems: { type: Array, default: () => [] },
    cartoons: { type: Array, default: () => [] },
    isSectionHead: { type: Boolean, default: false },
    category: { type: String, default: null },
});

const page = useAppState();
const firstName = computed(() => page.props.auth?.user?.name?.trim().split(/\s+/)[0] ?? 'Member');
const metricLabels = {
    total_views: 'Total views', monthly_views: 'Monthly views', published: 'Published articles',
    published_stories: 'Published stories', pending: 'Pending review', drafts: 'Drafts',
    active_members: 'Active members', library: 'Media library',
};

const cards = computed(() => {
    const values = Object.keys(props.writerStats).length ? props.writerStats : props.metrics;
    return Object.entries(values).map(([key, value]) => ({
        key,
        label: metricLabels[key] ?? key.replaceAll('_', ' '),
        value: Number(value ?? 0).toLocaleString(),
    }));
});

const workItems = computed(() => props.pendingArticles.length
    ? props.pendingArticles
    : props.mediaItems.length ? props.mediaItems
    : props.cartoons.length ? props.cartoons
    : props.recentArticles);

const publishedItems = computed(() => props.publishedArticles.length ? props.publishedArticles : props.topArticles);
const submitUrl = computed(() => props.portal === 'media' ? '/media/submit-media' : props.portal === 'cartoonist' ? '/cartoonist/submit-cartoon' : `/${props.portal}/submit-article`);
const submitLabel = computed(() => props.portal === 'media' ? 'Submit Photo' : props.portal === 'cartoonist' ? 'Submit Cartoon' : 'New Article');

function itemTitle(item) {
    return item.title ?? item.name ?? item.filename ?? item.image_type ?? 'Publication submission';
}

function itemDate(item) {
    return item.date ?? item.created_at ?? item.updated_at ?? '';
}

function activityText(item) {
    return item.description ?? item.action ?? item.message ?? item.event ?? 'Publication activity';
}
</script>

<template>
    <AdminLayout :title="title">
        <div class="portal-dashboard">
            <header class="overview-header">
                <div><p class="overview-kicker">{{ page.props.auth?.user?.role ?? 'MEMBER PORTAL' }}<span v-if="category"> · {{ category }}</span></p><h1 class="overview-title">Welcome back, {{ firstName }}</h1><p class="overview-subtitle">Here is your publication overview and current workload.</p></div>
                <a :href="submitUrl" class="overview-primary-action"><i :class="portal === 'media' ? 'fa-solid fa-camera' : portal === 'cartoonist' ? 'fa-solid fa-paintbrush' : 'fa-solid fa-feather-pointed'" aria-hidden="true"></i>{{ submitLabel }}</a>
            </header>

            <section class="overview-metrics" aria-label="Portal metrics">
                <article v-for="card in cards" :key="card.key" class="overview-metric-card"><span class="overview-metric-label">{{ card.label }}</span><strong class="overview-metric-value">{{ card.value }}</strong><i class="fa-solid fa-chart-line" aria-hidden="true"></i></article>
                <article v-if="!cards.length" class="overview-metric-card"><span class="overview-metric-label">No metrics available</span><strong class="overview-metric-value">—</strong></article>
            </section>

            <div class="overview-content-grid">
                <section class="overview-panel" aria-labelledby="work-heading"><div class="overview-panel-heading"><div><p class="overview-kicker">YOUR WORKSPACE</p><h2 id="work-heading">{{ portal === 'media' || portal === 'cartoonist' ? 'Recent submissions' : 'Current workload' }}</h2></div><a :href="`/${portal}/manage-my-articles`" v-if="!['media', 'cartoonist'].includes(portal)" class="overview-view-all">Manage articles <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
                    <div v-if="workItems.length" class="overview-list"><article v-for="(item, index) in workItems" :key="item.id ?? index" class="overview-list-row"><span class="overview-list-icon"><i :class="portal === 'media' ? 'fa-solid fa-camera' : portal === 'cartoonist' ? 'fa-solid fa-palette' : 'fa-regular fa-file-lines'" aria-hidden="true"></i></span><div class="overview-list-copy"><h3>{{ itemTitle(item) }}</h3><p>{{ item.author ?? item.category ?? item.status ?? 'Submission' }}<span v-if="itemDate(item)"> · {{ itemDate(item) }}</span></p></div><span v-if="item.status" class="overview-status">{{ item.status }}</span></article></div>
                    <p v-else class="overview-empty">Nothing needs your attention right now.</p>
                </section>
                <section class="overview-panel" aria-labelledby="published-heading"><div class="overview-panel-heading"><div><p class="overview-kicker">RECENTLY PUBLISHED</p><h2 id="published-heading">Stories readers can see</h2></div></div><div v-if="publishedItems.length" class="overview-list"><article v-for="(item, index) in publishedItems" :key="item.id ?? index" class="overview-list-row"><span class="overview-list-icon"><i class="fa-regular fa-newspaper" aria-hidden="true"></i></span><div class="overview-list-copy"><h3>{{ itemTitle(item) }}</h3><p>{{ item.category ?? item.author ?? 'The Lens Publication' }}<span v-if="item.views !== undefined"> · {{ Number(item.views).toLocaleString() }} views</span></p></div></article></div><p v-else class="overview-empty">Published stories will appear here.</p></section>
            </div>

            <section v-if="recentActivities.length" class="overview-panel overview-activity-panel" aria-labelledby="activity-heading"><div class="overview-panel-heading"><div><p class="overview-kicker">PUBLICATION ACTIVITY</p><h2 id="activity-heading">Recent activity</h2></div><a :href="`/${portal}/activity-logs`" class="overview-view-all">Activity logs <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div><ol class="overview-activity-list"><li v-for="(activity, index) in recentActivities" :key="activity.id ?? index"><span class="activity-dot"></span><div><p>{{ activityText(activity) }}</p><time>{{ activity.date ?? activity.created_at ?? activity.time ?? '' }}</time></div></li></ol></section>
        </div>
    </AdminLayout>
</template>

<style scoped>
.portal-dashboard { max-width: 1440px; margin: 0 auto; }
.overview-header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:28px; }
.overview-kicker { margin:0 0 7px; color:#700f2b; font-size:.68rem; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
.overview-title { margin:0; color:#20191b; font-family:'Playfair Display',Georgia,serif; font-size:clamp(1.8rem,3vw,2.5rem); font-weight:800; }
.overview-subtitle { margin:7px 0 0; color:#667085; font-size:.9rem; }
.overview-primary-action { display:inline-flex; align-items:center; gap:9px; padding:12px 17px; color:#fff; background:linear-gradient(120deg,#700f2b,#8d1337); border-radius:10px; box-shadow:0 6px 18px #700f2b24; font-size:.84rem; font-weight:700; text-decoration:none; }
.overview-metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:16px; margin-bottom:22px; }
.overview-metric-card { position:relative; display:flex; flex-direction:column; gap:10px; padding:20px; background:#fff; border:1px solid #eee6e8; border-radius:14px; box-shadow:0 4px 16px #3a09140a; }
.overview-metric-label { color:#667085; font-size:.76rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
.overview-metric-value { color:#251a1e; font-size:1.9rem; line-height:1.1; }
.overview-metric-card > i { position:absolute; right:18px; top:18px; color:#9c526b; opacity:.55; }
.overview-content-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
.overview-panel { min-width:0; padding:22px; background:#fff; border:1px solid #eee6e8; border-radius:14px; box-shadow:0 4px 16px #3a09140a; }
.overview-panel-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:15px; }
.overview-panel-heading h2 { margin:0; color:#251a1e; font-family:'Playfair Display',Georgia,serif; font-size:1.25rem; font-weight:700; }
.overview-view-all { display:inline-flex; align-items:center; gap:7px; color:#700f2b; font-size:.76rem; font-weight:700; text-decoration:none; white-space:nowrap; }
.overview-list { display:grid; }
.overview-list-row { display:flex; align-items:center; gap:12px; min-width:0; padding:13px 0; border-top:1px solid #f0ebed; }
.overview-list-icon { display:grid; place-items:center; width:38px; height:38px; flex:none; color:#700f2b; background:#f9eef2; border-radius:11px; }
.overview-list-copy { min-width:0; flex:1; }
.overview-list-copy h3 { overflow:hidden; margin:0; color:#2c2426; font-size:.88rem; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
.overview-list-copy p { margin:4px 0 0; color:#7a7073; font-size:.74rem; }
.overview-status { padding:5px 8px; color:#75510b; background:#fff7df; border-radius:999px; font-size:.66rem; font-weight:800; white-space:nowrap; }
.overview-empty { margin:0; padding:25px 8px; color:#81818a; text-align:center; font-size:.85rem; }
.overview-activity-panel { margin-top:20px; }
.overview-activity-list { display:grid; gap:0; margin:0; padding:0; list-style:none; }
.overview-activity-list li { display:flex; gap:12px; padding:12px 0; border-top:1px solid #f0ebed; }
.activity-dot { width:9px; height:9px; flex:none; margin:5px 0 0 2px; background:#8d1337; border-radius:50%; }
.overview-activity-list p { margin:0; color:#41393b; font-size:.84rem; }
.overview-activity-list time { display:block; margin-top:4px; color:#8c8587; font-size:.72rem; }
@media (max-width: 850px) { .overview-content-grid { grid-template-columns:1fr; } }
@media (max-width: 600px) { .overview-header { align-items:flex-start; flex-direction:column; } .overview-primary-action { width:100%; justify-content:center; } .overview-panel { padding:17px; } .overview-list-row { align-items:flex-start; } .overview-status { margin-left:auto; } }
</style>
