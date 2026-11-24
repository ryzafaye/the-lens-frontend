import { ref, computed } from 'vue';

export const confirmationState = ref({
    show: false,
    title: 'Confirmation',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'maroon', // 'maroon' | 'danger' | 'warning'
    resolve: null,
});

export const feedbackState = ref({
    show: false,
    title: 'Success',
    message: '',
    type: 'success', // 'success' | 'error' | 'warning' | 'info'
    confirmText: 'OK',
    resolve: null,
});

/**
 * Prompts a confirmation modal in the center of the screen before a major action.
 * Resolves to true if user clicks Confirm, or false if user cancels.
 * 
 * @param {Object|string} options
 * @returns {Promise<boolean>}
 */
export function confirmAction(options = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    const {
        title = 'Confirmation',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'maroon',
    } = opts;

    return new Promise((resolve) => {
        confirmationState.value = {
            show: true,
            title,
            message,
            confirmText,
            cancelText,
            type,
            resolve,
        };
    });
}

/**
 * Displays a result / feedback modal at the very center of the screen (replaces toast notification).
 * 
 * @param {Object|string} options
 * @returns {Promise<void>}
 */
export function showFeedbackModal(options = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    const {
        title = '',
        message = '',
        type = 'success',
        confirmText = 'OK',
    } = opts;

    let defaultTitle = 'Success';
    const normType = (type === 'danger' ? 'error' : (type || 'success')).toLowerCase();
    if (normType === 'error') defaultTitle = 'Error';
    else if (normType === 'warning') defaultTitle = 'Notice';
    else if (normType === 'info') defaultTitle = 'Information';

    return new Promise((resolve) => {
        feedbackState.value = {
            show: true,
            title: title || defaultTitle,
            message: message || '',
            type: normType,
            confirmText,
            resolve,
        };
    });
}

/**
 * Universal drop-in replacement for showToast across the entire system.
 * Shows the result modal at the very center of the screen instead of a floating bottom toast.
 */
export function showToast(message, type = 'success', title = '') {
    return showFeedbackModal({
        message,
        type: type === 'danger' ? 'error' : type,
        title,
    });
}

export function closeConfirmation(result = false) {
    if (confirmationState.value.resolve) {
        confirmationState.value.resolve(Boolean(result));
    }
    confirmationState.value.show = false;
    confirmationState.value.resolve = null;
}

export function closeFeedback() {
    if (feedbackState.value.resolve) {
        feedbackState.value.resolve();
    }
    feedbackState.value.show = false;
    feedbackState.value.resolve = null;
}
