/**
 * Formats a Cloudinary URL with responsive transformations (f_auto, q_auto, width, crop).
 * Returns non-Cloudinary or already transformed URLs unmodified.
 *
 * @param {string|null} url
 * @param {object} options
 * @param {number} [options.width] - Desired width (e.g. 300 for avatar, 800 for thumbnail)
 * @param {number} [options.height] - Optional desired height
 * @param {string} [options.crop='limit'] - Cloudinary crop mode ('limit', 'fill', 'thumb', etc.)
 * @param {string} [options.gravity] - Gravity anchor ('face', 'center', etc.)
 * @returns {string}
 */
export function optimizeCloudinaryUrl(url, { width = null, height = null, crop = 'limit', gravity = null } = {}) {
    if (!url || typeof url !== 'string') return url || '';

    const trimmed = url.trim();
    if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes('/upload/')) {
        return trimmed;
    }

    // Do not double-transform
    if (trimmed.includes('f_auto') || trimmed.includes('q_auto')) {
        return trimmed;
    }

    const transforms = ['f_auto', 'q_auto'];

    if (width) {
        transforms.push(`w_${width}`);
    }
    if (height) {
        transforms.push(`h_${height}`);
    }
    if (gravity) {
        transforms.push(`g_${gravity}`);
    }
    if (crop) {
        transforms.push(`c_${crop}`);
    }

    const transformStr = transforms.join(',');
    return trimmed.replace('/upload/', `/upload/${transformStr}/`);
}

export default optimizeCloudinaryUrl;
