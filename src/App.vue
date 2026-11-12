<script setup>
import { RouterView } from 'vue-router';
import { appState } from './state/appState.js';
import { router } from './router/index.js';
</script>

<template>
    <div v-if="appState.error" class="min-h-screen grid place-items-center bg-stone-50 p-6 font-body text-stone-800">
        <section class="max-w-xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <p class="mb-2 text-xs font-bold uppercase tracking-widest text-wine">The Lens</p>
            <h1 class="font-display text-2xl font-bold">We couldn’t load this page</h1>
            <p class="mt-3 text-sm text-stone-600">{{ appState.error }}</p>
            <button class="mt-6 rounded-lg bg-wine px-4 py-2 text-sm font-semibold text-white" @click="router.reload()">Try again</button>
        </section>
    </div>
    <RouterView v-else v-slot="{ Component, route }">
        <component :is="Component" :key="route.fullPath + ':' + appState.revision" v-bind="appState.pageProps" />
    </RouterView>
</template>
