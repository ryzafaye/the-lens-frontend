<script setup>
import { onBeforeUnmount, onMounted, useSlots, watch } from 'vue';

const props = defineProps({ title: { type: String, default: '' } });
const slots = useSlots();
const ownedLinks = new Map();

watch(() => props.title, (title) => {
    if (title) document.title = title;
}, { immediate: true });

function addSlotLinks() {
    for (const node of slots.default?.() ?? []) {
        if (typeof node.type !== 'string' || node.type.toLowerCase() !== 'link' || !node.props?.href) continue;
        const href = node.props.href;
        if (ownedLinks.has(href)) continue;

        const existing = [...document.head.querySelectorAll('link[rel="stylesheet"]')].find((link) => link.href === new URL(href, document.baseURI).href);
        if (existing) continue;

        const link = document.createElement('link');
        for (const [name, value] of Object.entries(node.props)) {
            if (value !== true && value !== false && value != null) link.setAttribute(name, String(value));
            else if (value === true) link.setAttribute(name, '');
        }
        document.head.append(link);
        ownedLinks.set(href, link);
    }
}

onMounted(addSlotLinks);
onBeforeUnmount(() => {
    for (const link of ownedLinks.values()) link.remove();
    ownedLinks.clear();
});
</script>

<template></template>
