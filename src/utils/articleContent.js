/**
 * Utility for normalizing and sanitizing article content across all viewers and roles.
 * Ensures consistent paragraph and line spacing matching the rich text editor (cursor size, no added margins).
 */

export function decodeCorruptedHtmlEntities(text) {
    if (!text || typeof text !== 'string') return '';
    let decoded = text;
    let maxPasses = 5;
    while (maxPasses > 0 && /&amp;(?:lt|gt|quot|#0?39|amp);|&(?:lt|gt|quot|#0?39);/i.test(decoded)) {
        const next = decoded
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;/gi, "'");
        if (next === decoded) break;
        decoded = next;
        maxPasses--;
    }
    return decoded;
}

export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function formatCleanArticleContent(rawContent) {
    if (!rawContent || !String(rawContent).trim()) {
        return '<div style="color: #667085; font-style: italic;">No manuscript text provided.</div>';
    }

    let content = decodeCorruptedHtmlEntities(String(rawContent).trim());

    // Strip dangerous script/style/iframe tags and inline event handlers
    content = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // Unwrap unnecessary span tags while keeping their text intact
    content = content
        .replace(/<\/?span[^>]*>/gi, '')
        .replace(/\s*style="[^"]*"/gi, '')
        .replace(/\s*style='[^']*'/gi, '');

    const hasHtmlTags = /<\/?(?:div|p|br|h[1-6]|blockquote|ul|ol|li|strong|b|em|i|u|s|a|hr)[^>]*>/i.test(content);

    if (hasHtmlTags) {
        // Standardize <p> to <div> without injecting artificial extra blank line breaks
        content = content
            .replace(/<p[^>]*>/gi, '<div>')
            .replace(/<\/p>/gi, '</div>');

        // Normalize broken <div><br><div> constructs to standard <div><br></div>
        content = content.replace(/<div><br\s*\/?><div>/gi, '<div><br></div>');

        // Collapse excessive consecutive blank lines (3 or more) to a single break
        content = content.replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){3,}/gi, '<div><br></div>');

        // Remove leading and trailing empty lines
        content = content
            .replace(/^(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*)+/gi, '')
            .replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*)+$/gi, '');

        return content;
    }

    // Plain-text fallback: split by lines so single or double returns preserve exact cursor-height spacing
    const lines = content.split(/\r?\n/);
    return lines.map(line => {
        const trimmed = line.trim();
        return trimmed ? `<div>${escapeHTML(trimmed)}</div>` : '<div><br></div>';
    }).join('');
}

/**
 * Converts stored HTML/manuscript content into pure, clean plain text for editing inside textareas or saving to DB.
 * Strips all HTML tags (no <div> or <p> or <br>), decodes entities, and preserves clean paragraph line breaks.
 */
export function cleanContentForEditing(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return '';
    let text = decodeCorruptedHtmlEntities(String(rawContent).trim());

    // Replace non-breaking spaces
    text = text.replace(/&nbsp;|\u00A0/g, ' ');

    // Replace empty block lines like <div><br></div> or <p><br></p> with newline
    text = text.replace(/<(?:div|p)[^>]*>\s*<br\s*\/?>\s*<\/(?:div|p)>/gi, '\n');

    // Replace <br> tags with newline
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Replace block boundaries with clean paragraph breaks
    text = text.replace(/<\/(?:div|p|h[1-6]|li|blockquote)>\s*<(?:div|p|h[1-6]|li|blockquote)[^>]*>/gi, '\n\n');
    text = text.replace(/<\/(?:div|p|h[1-6]|li|blockquote)>/gi, '\n');
    text = text.replace(/<(?:div|p|h[1-6]|li|blockquote)[^>]*>/gi, '');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Strip any raw literal <div> or </div> or <br> if text was double-escaped in storage
    text = text.replace(/&lt;\/?(?:div|p|br)[^&gt;]*&gt;/gi, '');
    text = text.replace(/<\/?(?:div|p|br)[^>]*>/gi, '');

    // Decode standard entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'");

    // Normalize carriage returns and trim lines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map(l => l.trim());
    text = lines.join('\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}

/**
 * Prepares plain text from an editor/manuscript for saving to the backend/database.
 * Guarantees clean text article content only without <div><br> or HTML wrapper tags.
 */
export function prepareContentForSaving(plainText) {
    if (!plainText || typeof plainText !== 'string') return '';
    return cleanContentForEditing(plainText);
}

