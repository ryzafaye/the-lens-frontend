<script setup>
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import '../../assets/css/executive-transparency.css';
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <div class="transparency-container">
                <div class="under-dev-card">
                    <div class="under-dev-icon-wrap">
                        <i class="fa-solid fa-hammer"></i>
                    </div>

                    <div class="under-dev-badge">
                        <span class="under-dev-badge-dot"></span>
                        <span>Under Development</span>
                    </div>

                    <h1 class="under-dev-title">This page is under development</h1>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
