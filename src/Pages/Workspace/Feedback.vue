<script setup>
import PageHead from '../../components/PageHead.vue';
import AdminLayout from '../../Layouts/AdminLayout.vue';
defineProps({ portal: { type: String, required: true }, feedbacks: { type: Array, default: () => [] } });
</script>

<template>
    <AdminLayout title="Feedback Inbox">
        <PageHead><link rel="stylesheet" href="/css/shared-feedback-inbox.css"></PageHead>
        <main class="feedback-page"><header><p class="feedback-eyebrow">READER MESSAGES</p><h1>Feedback Inbox</h1><p>Messages sent through the public feedback form.</p></header><section v-if="!feedbacks.length" class="feedback-empty"><span><i class="fa-regular fa-envelope-open"></i></span><h2>No feedback messages yet</h2><p>Reader messages will appear here when they are connected to the newsroom inbox.</p></section><section v-else class="feedback-list"><article v-for="item in feedbacks" :key="item.id" class="feedback-card"><h2>{{ item.subject || 'Reader feedback' }}</h2><p>{{ item.message }}</p><small>{{ item.name }} · {{ item.created_at }}</small></article></section></main>
    </AdminLayout>
</template>

<style scoped>
.feedback-page{max-width:1200px;margin:0 auto}.feedback-page header{margin-bottom:22px}.feedback-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.feedback-page h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.feedback-page header p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.feedback-empty{display:grid;justify-items:center;gap:9px;padding:58px 20px;background:#fff;border:1px dashed #dfd5d9;border-radius:14px;text-align:center}.feedback-empty span{display:grid;place-items:center;width:50px;height:50px;color:#700f2b;background:#f9eef2;border-radius:50%;font-size:1.2rem}.feedback-empty h2{margin:0;color:#2d2427;font:700 1.2rem 'Playfair Display',Georgia,serif}.feedback-empty p{margin:0;color:#756c6f;font-size:.82rem}.feedback-list{display:grid;gap:11px}.feedback-card{padding:16px;background:#fff;border:1px solid #eee6e8;border-radius:11px}.feedback-card h2{margin:0;font:700 1rem 'Playfair Display',Georgia,serif}.feedback-card p{color:#635a5d;white-space:pre-wrap}.feedback-card small{color:#847b7e}
</style>
