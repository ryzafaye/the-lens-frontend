<script setup>
import PageHead from '../../Components/PageHead.vue';
import AdminLayout from '../../Layouts/AdminLayout.vue';
</script>

<template>
    <AdminLayout title="Transparency">
        <PageHead><link rel="stylesheet" href="/css/executive-transparency.css"></PageHead>
        <main class="transparency-page"><section class="transparency-card"><span><i class="fa-solid fa-hammer"></i></span><small><b></b> Under development</small><h1>This page is under development</h1><p>Transparency reports will be available here.</p></section></main>
    </AdminLayout>
</template>

<style scoped>
.transparency-page{display:grid;place-items:center;min-height:55vh}.transparency-card{display:grid;justify-items:center;gap:16px;width:min(520px,100%);padding:44px 28px;background:#fff;border:1px solid #eee6e8;border-radius:16px;text-align:center;box-shadow:0 10px 35px #3a09140b}.transparency-card>span{display:grid;place-items:center;width:62px;height:62px;color:#700f2b;background:#f9eef2;border-radius:18px;font-size:1.4rem}.transparency-card small{display:flex;align-items:center;gap:7px;padding:6px 10px;color:#946200;background:#fff7df;border-radius:99px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.transparency-card small b{width:7px;height:7px;background:#eab308;border-radius:50%}.transparency-card h1{margin:0;color:#2d2226;font:700 1.55rem 'Playfair Display',Georgia,serif}.transparency-card p{margin:0;color:#756c6f;font-size:.84rem}
</style>
