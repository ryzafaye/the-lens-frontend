<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import {
    confirmationState,
    feedbackState,
    closeConfirmation,
    closeFeedback,
} from '../utils/modal.js';

const confirmationIcon = computed(() => {
    if (confirmationState.value.type === 'danger') return 'fa-solid fa-triangle-exclamation';
    if (confirmationState.value.type === 'warning') return 'fa-solid fa-triangle-exclamation';
    return 'fa-solid fa-circle-question';
});

const feedbackIcon = computed(() => {
    const type = feedbackState.value.type;
    if (type === 'error' || type === 'danger') return 'fa-solid fa-circle-exclamation';
    if (type === 'warning') return 'fa-solid fa-triangle-exclamation';
    if (type === 'info') return 'fa-solid fa-circle-info';
    return 'fa-solid fa-circle-check';
});

function handleKeydown(e) {
    if (e.key === 'Escape') {
        if (confirmationState.value.show) {
            closeConfirmation(false);
        } else if (feedbackState.value.show) {
            closeFeedback();
        }
    }
}

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <teleport to="body">
        <!-- Confirmation Modal -->
        <div
            v-if="confirmationState.show"
            class="global-modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeConfirmation(false)"
        >
            <div class="global-modal-card">
                <div class="global-modal-icon-badge" :class="confirmationState.type">
                    <i :class="confirmationIcon"></i>
                </div>
                <h3 class="global-modal-title">{{ confirmationState.title }}</h3>
                <p class="global-modal-message">{{ confirmationState.message }}</p>
                <div class="global-modal-actions">
                    <button
                        type="button"
                        class="btn-modal-cancel"
                        @click="closeConfirmation(false)"
                    >
                        {{ confirmationState.cancelText }}
                    </button>
                    <button
                        type="button"
                        class="btn-modal-confirm"
                        :class="confirmationState.type"
                        @click="closeConfirmation(true)"
                    >
                        {{ confirmationState.confirmText }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Feedback / Result Modal (Replaces Toast Notifications) -->
        <div
            v-if="feedbackState.show"
            class="global-modal-overlay"
            role="dialog"
            aria-modal="true"
            @click.self="closeFeedback"
        >
            <div class="global-modal-card">
                <div class="global-modal-icon-badge" :class="feedbackState.type">
                    <i :class="feedbackIcon"></i>
                </div>
                <h3 class="global-modal-title">{{ feedbackState.title }}</h3>
                <p class="global-modal-message">{{ feedbackState.message }}</p>
                <div class="global-modal-actions" style="justify-content: center;">
                    <button
                        type="button"
                        class="btn-modal-confirm maroon"
                        style="min-width: 120px;"
                        @click="closeFeedback"
                    >
                        {{ feedbackState.confirmText || 'OK' }}
                    </button>
                </div>
            </div>
        </div>
    </teleport>
</template>
