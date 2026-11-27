// Shared form & email validation helpers for The Lens frontend

const EMAIL_FORMAT_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * Normalize an email string for storage/comparison.
 * @param {string} value
 * @returns {string}
 */
export function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase();
}

/**
 * Validate an email address field.
 * Returns an empty string when valid, or a user-facing validation error message.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.required=true]
 * @param {number} [options.maxLength=255]
 * @param {string} [options.requiredMessage='Email address is required.']
 * @returns {string}
 */
export function validateEmail(value, options = {}) {
    const {
        required = true,
        maxLength = 255,
        requiredMessage = 'Email address is required.',
    } = options;

    const trimmed = String(value ?? '').trim();

    if (!trimmed) {
        return required ? requiredMessage : '';
    }

    if (trimmed.length > maxLength) {
        return `Email address must not exceed ${maxLength} characters.`;
    }

    if (/\s/.test(trimmed)) {
        return 'Email address cannot contain spaces.';
    }

    const parts = trimmed.split('@');
    if (parts.length !== 2) {
        return 'Please enter a valid email address (e.g. name@example.com).';
    }

    const [localPart, domainPart] = parts;
    if (!localPart || localPart.length > 64 || !domainPart || domainPart.length > 253) {
        return 'Please enter a valid email address (e.g. name@example.com).';
    }

    if (
        localPart.startsWith('.') ||
        localPart.endsWith('.') ||
        localPart.includes('..') ||
        domainPart.includes('..')
    ) {
        return 'Please enter a valid email address (e.g. name@example.com).';
    }

    if (!EMAIL_FORMAT_REGEX.test(trimmed)) {
        return 'Please enter a valid email address (e.g. name@example.com).';
    }

    const domainLabels = domainPart.split('.');
    const tld = domainLabels[domainLabels.length - 1] || '';
    if (!/^[A-Za-z]{2,}$/.test(tld)) {
        return 'Please enter a valid email domain (e.g. name@example.com).';
    }

    return '';
}

/**
 * Extract the most helpful message from an Axios/Laravel error response.
 * @param {any} err
 * @param {string} fallback
 * @returns {string}
 */
export function extractApiErrorMessage(err, fallback = 'An error occurred. Please try again.') {
    const data = err?.response?.data;
    if (data?.errors && typeof data.errors === 'object') {
        const msgs = Object.values(data.errors).flat().filter(Boolean);
        if (msgs.length > 0) return msgs.join(' ');
    }
    return data?.message || fallback;
}
