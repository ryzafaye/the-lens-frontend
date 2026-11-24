<script setup>
import { computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    isOpen: {
        type: Boolean,
        default: false,
    },
    'is-open': {
        type: Boolean,
        default: false,
    },
    modelValue: {
        type: Boolean,
        default: false,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    isLoading: {
        type: Boolean,
        default: false,
    },
    'is-loading': {
        type: Boolean,
        default: false,
    },
    isSubmitting: {
        type: Boolean,
        default: false,
    },
    'is-submitting': {
        type: Boolean,
        default: false,
    },
    isLoggingOut: {
        type: Boolean,
        default: false,
    },
    'is-logging-out': {
        type: Boolean,
        default: false,
    },
});

const isModalVisible = computed(() => {
    return Boolean(props.show || props.isOpen || props['is-open'] || props.modelValue);
});

const isActionLoading = computed(() => {
    return Boolean(
        props.loading ||
        props.isLoading ||
        props['is-loading'] ||
        props.isSubmitting ||
        props['is-submitting'] ||
        props.isLoggingOut ||
        props['is-logging-out']
    );
});

const emit = defineEmits([
    'confirm',
    'cancel',
    'close',
    'update:show',
    'update:isOpen',
    'update:is-open',
    'update:modelValue',
]);

function handleClose() {
    if (isActionLoading.value) return;
    emit('cancel');
    emit('close');
    emit('update:show', false);
    emit('update:isOpen', false);
    emit('update:is-open', false);
    emit('update:modelValue', false);
}

function handleKeydown(e) {
    if (e.key === 'Escape' && isModalVisible.value && !isActionLoading.value) {
        handleClose();
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
    <div
        v-if="isModalVisible"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        @click.self="handleClose"
    >
        <div class="modal-card logout-confirmation-card">
            <button
                type="button"
                class="logout-close-icon-btn"
                aria-label="Close"
                :disabled="isActionLoading"
                @click="handleClose"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="logout-modal-body">
                <div class="logout-icon-badge">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </div>
                <h3 id="logout-modal-title" class="logout-modal-title">
                    Are you sure to logout?
                </h3>
                <p class="logout-modal-subtitle">
                    You will be signed out of your account.
                </p>
            </div>
            <div class="logout-modal-actions">
                <button
                    type="button"
                    class="logout-btn-cancel"
                    :disabled="isActionLoading"
                    @click="handleClose"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="logout-btn-confirm"
                    :disabled="isActionLoading"
                    @click="$emit('confirm')"
                >
                    <i v-if="isActionLoading" class="fa-solid fa-spinner fa-spin"></i>
                    <span>Confirm</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(16, 24, 40, 0.55);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: modalFadeIn 0.15s ease both;
}

@keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.logout-confirmation-card {
    position: relative;
    max-width: 380px;
    width: 100%;
    background: #ffffff;
    border-radius: 14px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.08);
    animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes modalScaleIn {
    from {
        opacity: 0;
        transform: scale(0.96) translateY(8px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.logout-close-icon-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #98a2b3;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.15s ease;
}

.logout-close-icon-btn:hover:not(:disabled) {
    background: #f2f4f7;
    color: #344054;
}

.logout-modal-body {
    padding: 28px 24px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
}

.logout-icon-badge {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background-color: #fee2e2;
    color: #b91c1c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    margin-bottom: 4px;
}

.logout-modal-title {
    font-family: inherit;
    font-size: 1.15rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
}

.logout-modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.45;
}

.logout-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 24px;
    background-color: #fafbfc;
    border-top: 1px solid #f2f4f7;
}

.logout-btn-cancel {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    background-color: #ffffff;
    border: 1px solid #d0d5dd;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.logout-btn-cancel:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #98a2b3;
}

.logout-btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    background-color: #5c0a18;
    border: 1px solid #5c0a18;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(92, 10, 24, 0.25);
}

.logout-btn-confirm:hover:not(:disabled) {
    background-color: #3e050f;
    border-color: #3e050f;
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(92, 10, 24, 0.32);
}

.logout-btn-confirm:disabled,
.logout-btn-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
