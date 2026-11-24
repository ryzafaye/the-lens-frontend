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

/**
 * Universal resolver for any photo or cartoon visual asset (object or string url).
 * Safely extracts the valid image URL and applies Cloudinary optimization if applicable.
 *
 * @param {object|string|null} itemOrUrl
 * @param {object} [options]
 * @returns {string}
 */
export function resolveMediaUrl(itemOrUrl, options = { width: 800, crop: 'limit' }) {
    if (!itemOrUrl) return '';

    let url = '';
    if (typeof itemOrUrl === 'string') {
        url = itemOrUrl.trim();
    } else if (typeof itemOrUrl === 'object') {
        url = String(
            itemOrUrl.file_url ||
            itemOrUrl.image ||
            itemOrUrl.image_url ||
            itemOrUrl.url ||
            itemOrUrl.coverImage ||
            ''
        ).trim();
    }

    if (!url) return '';

    // Data URLs and Blobs
    if (url.startsWith('data:image/') || url.startsWith('blob:')) {
        return url;
    }

    // Cloudinary URLs
    if (url.includes('res.cloudinary.com')) {
        return optimizeCloudinaryUrl(url, options);
    }

    // Full HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Relative backend URLs
    if (url.startsWith('/')) {
        return url;
    }

    return `/${url}`;
}

/**
 * Extracts a human-authored title/concept from an artwork/photo object,
 * suppressing raw camera filenames, downloads (e.g. Oip (2)), hashes, or machine slugs.
 *
 * @param {object|null} item
 * @param {string} [defaultFallback='']
 * @returns {string}
 */
export function getCustomTitle(item, defaultFallback = '') {
    if (!item) return defaultFallback;
    let raw = (item.title || item.caption || '').trim();
    if (!raw) return defaultFallback;

    // Strip image extension if contributor saved title as file name
    raw = raw.replace(/\.(jpg|jpeg|png|webp|svg|gif|bmp|avif)$/i, '').trim();
    if (!raw) return defaultFallback;

    // Filter out server/file paths or purely auto-generated fallback tokens
    if (
        raw.includes('/') ||
        raw.includes('\\') ||
        raw.includes('uploads') ||
        /^img[_\-0-9]+$/i.test(raw) ||
        /^oip(\s*\([0-9]+\))?$/i.test(raw) ||
        /^photo[_\-0-9]+$/i.test(raw) ||
        /^cartoon[_\-0-9]+$/i.test(raw) ||
        /^media[_\-0-9]+$/i.test(raw) ||
        /^screenshot[_\-0-9]+$/i.test(raw) ||
        /^untitled$/i.test(raw) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw)
    ) {
        return defaultFallback;
    }
    return raw;
}

/**
 * Universal resolver for user avatars (handles user object, avatar URL, Cloudinary, relative, or placeholder).
 *
 * @param {object|string|null} userOrUrl
 * @returns {string}
 */
export function resolveUserAvatar(userOrUrl) {
    if (!userOrUrl) return '/images/member-placeholder.svg';

    let url = '';
    if (typeof userOrUrl === 'string') {
        url = userOrUrl.trim();
    } else if (typeof userOrUrl === 'object') {
        url = String(
            userOrUrl.avatar_url ||
            userOrUrl.avatarUrl ||
            userOrUrl.profile_picture_url ||
            userOrUrl.avatar ||
            ''
        ).trim();
    }

    if (!url || url === 'null' || url === 'undefined') {
        return '/images/member-placeholder.svg';
    }

    // Direct placeholder match or contains member-placeholder
    if (url.includes('member-placeholder.svg')) {
        return '/images/member-placeholder.svg';
    }

    // Data URLs and Blobs
    if (url.startsWith('data:image/') || url.startsWith('blob:')) {
        return url;
    }

    // Cloudinary URLs
    if (url.includes('res.cloudinary.com')) {
        return optimizeCloudinaryUrl(url, { width: 300, height: 300, crop: 'limit' });
    }

    // HTTP / HTTPS URLs (e.g. external or hosted)
    if (url.startsWith('https://') || url.startsWith('http://')) {
        if (url.includes('/images/member-placeholder.svg')) {
            return '/images/member-placeholder.svg';
        }
        return url;
    }

    // Relative paths
    if (url.startsWith('/')) {
        return url;
    }

    return `/${url}`;
}

export default optimizeCloudinaryUrl;

