<script setup>
import { computed, ref } from 'vue';
import PageHead from '../../components/PageHead.vue';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, activities: { type: Array, default: () => [] } });
const query = ref('');
const filtered = computed(() => props.activities.filter((item) => `${item.causer} ${item.causerRole} ${item.action} ${item.subjectName} ${item.subjectType}`.toLowerCase().includes(query.value.trim().toLowerCase())));
</script>

<template>
    <AdminLayout title="Activity Logs">
        <PageHead><link rel="stylesheet" href="/css/executive-activity-logs.css"></PageHead>
        <main class="activity-page"><header><div><p class="activity-eyebrow">NEWSROOM HISTORY</p><h1>Activity Logs</h1><p>Recent editorial and account activity across your workspace.</p></div></header><label class="activity-search"><i class="fa-solid fa-magnifying-glass"></i><input v-model="query" type="search" placeholder="Search by person, action, or item"></label>
            <section v-if="filtered.length" class="activity-list"><article v-for="entry in filtered" :key="entry.id" class="activity-item"><img :src="entry.causerAvatar ?? entry.avatar" alt=""><div class="activity-main"><div class="activity-title"><strong>{{ entry.causer ?? entry.user }}</strong><span>{{ entry.causerRole }}</span></div><p>{{ entry.action }} <b>{{ entry.subjectName ?? entry.target }}</b><small v-if="entry.subjectType"> · {{ entry.subjectType }}</small></p><div class="activity-time"><span>{{ entry.formattedDate }}</span><span>{{ entry.timestampText ?? entry.time }}</span></div></div></article></section>
            <div v-else class="activity-empty"><i class="fa-regular fa-clock"></i><h2>{{ activities.length ? 'No matching activity' : 'No activity yet' }}</h2><p>{{ activities.length ? 'Try a different search.' : 'New activity will appear here as your team works.' }}</p></div>
        </main>
    </AdminLayout>
</template>

<style scoped>
.activity-page{max-width:1100px;margin:0 auto}.activity-page header{margin-bottom:20px}.activity-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.activity-page h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.activity-page header p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.activity-search{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 14px;color:#82797c;background:#fff;border:1px solid #eee6e8;border-radius:10px}.activity-search input{flex:1;min-width:0;border:0;outline:0;font-size:.84rem}.activity-list{display:grid;gap:10px}.activity-item{display:flex;gap:13px;padding:15px;background:#fff;border:1px solid #eee6e8;border-radius:12px}.activity-item>img{width:42px;height:42px;object-fit:cover;border-radius:50%;background:#f3edef}.activity-main{min-width:0;flex:1}.activity-title{display:flex;align-items:center;gap:8px}.activity-title strong{color:#292124;font-size:.83rem}.activity-title span{color:#82797c;font-size:.68rem}.activity-main p{margin:5px 0 8px;color:#655d60;font-size:.8rem;line-height:1.45}.activity-main p b{color:#342a2d}.activity-main p small{color:#82797c}.activity-time{display:flex;gap:10px;color:#968e90;font-size:.68rem}.activity-empty{padding:50px 20px;text-align:center;color:#736b6e;background:#fff;border:1px dashed #dfd5d9;border-radius:13px}.activity-empty i{color:#700f2b;font-size:1.6rem}.activity-empty h2{margin:10px 0 4px;color:#2c2426;font:700 1.12rem 'Playfair Display',Georgia,serif}.activity-empty p{margin:0;font-size:.82rem}
</style>
