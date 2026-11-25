import DOMPurify from 'dompurify';

/**
 * Utility for normalizing and sanitizing article content across all viewers and roles.
 * Ensures consistent paragraph and line spacing matching the rich text editor (cursor size, no added margins).
 */

export const ALLOWED_TAGS = [
    'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'sub', 'sup', 'a', 'hr', 'div', 'code', 'pre', 'span'
];

export const ALLOWED_ATTR = ['style', 'href', 'target', 'rel', 'title', 'align', 'class'];

export const SANITIZE_CONFIG = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
};

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

/**
 * Extracts and retains only safe styling rules (text alignments and indentations)
 * while removing dangerous scripts, fixed dimensions, positions, and arbitrary styles.
 */
function sanitizeInlineStyle(styleStr) {
    if (!styleStr || typeof styleStr !== 'string') return '';
    const safeRules = [];
    const alignMatch = styleStr.match(/text-align\s*:\s*(center|right|justify|left)/i);
    if (alignMatch) {
        safeRules.push(`text-align: ${alignMatch[1].toLowerCase()};`);
    }
    const marginMatch = styleStr.match(/(?:margin-left|padding-left)\s*:\s*([0-9.]+(?:px|em|rem|%))/i);
    if (marginMatch) {
        safeRules.push(`margin-left: ${marginMatch[1]};`);
    }
    return safeRules.length > 0 ? ` style="${safeRules.join(' ')}"` : '';
}

/**
 * Standardizes raw stored content for displaying cleanly in readers, manuscripts, and modals.
 * Converts line breaks to standardized paragraphs while preserving safe alignments and indentations.
 */
export function formatCleanArticleContent(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return '';

    let content = decodeCorruptedHtmlEntities(String(rawContent).trim());

    // Normalize Windows/Mac line endings
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strip dangerous script/style/iframe tags and inline event handlers
    content = content
        .replace(/<(script|style|iframe|object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

    // Normalize align="..." attribute to style="text-align: ..."
    content = content.replace(/\s*align\s*=\s*["']?(center|right|justify|left)["']?/gi, (match, align) => {
        return ` style="text-align: ${align.toLowerCase()};"`;
    });

    // Sanitize style attributes to keep only text-align and margin-left
    content = content.replace(/\s*style\s*=\s*["']([^"']*)["']/gi, (match, styleVal) => {
        return sanitizeInlineStyle(styleVal);
    });

    const hasHtmlTags = /<\/?(?:div|p|br|h[1-6]|blockquote|ul|ol|li|strong|b|em|i|u|s|del|strike|sub|sup|a|hr)[^>]*>/i.test(content);

    if (hasHtmlTags) {
        // Clean leading and trailing empty lines
        content = content
            .replace(/^(?:\s*<(?:div|p)[^>]*>\s*(?:<br\s*\/?>)?\s*<\/(?:div|p)>|<br\s*\/?>)+/gi, '')
            .replace(/(?:\s*<(?:div|p)[^>]*>\s*(?:<br\s*\/?>)?\s*<\/(?:div|p)>|<br\s*\/?>)+$/gi, '');

        const sanitized = DOMPurify.sanitize(content, SANITIZE_CONFIG);
        return (typeof sanitized === 'string' ? sanitized : String(sanitized)).trim();
    }

    // Plain-text fallback: split by lines so single or double returns preserve clean paragraph spacing
    const lines = content.split(/\r?\n/);
    return lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return `<div class="article-bullet-item">${escapeHTML(trimmed.replace(/^[•\-]\s*/, ''))}</div>`;
        }
        return `<p>${escapeHTML(trimmed)}</p>`;
    }).filter(Boolean).join('');
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

    // Preserve bullet format for list items when converting to plain text
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');

    // Replace block boundaries with clean paragraph breaks
    text = text.replace(/<\/(?:div|p|h[1-6]|blockquote)>\s*<(?:div|p|h[1-6]|blockquote)[^>]*>/gi, '\n\n');
    text = text.replace(/<\/(?:div|p|h[1-6]|blockquote)>/gi, '\n');
    text = text.replace(/<(?:div|p|h[1-6]|blockquote)[^>]*>/gi, '');

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

/**
 * Sanitizes and normalizes HTML from the rich text editor before sending to backend.
 * Preserves safe formatting tags (bold, italic, headings, quotes, links, strikethrough, alignments, indentations, lists <ul>, <ol>, <li>)
 * and uses DOMPurify to eliminate XSS, stripped tags, and broken attributes.
 */
export function sanitizeRichArticleHtml(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    let html = decodeCorruptedHtmlEntities(rawHtml.trim());

    // Strip dangerous scripts, styles, iframes, objects, embeds, and event handlers
    html = html
        .replace(/<(script|style|iframe|object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

    // Remove empty <div><br></div>, <p><br></p>, and raw <br> empty lines completely
    html = html.replace(/<(?:div|p)[^>]*>\s*(?:<br\s*\/?>)?\s*<\/(?:div|p)>/gi, '');
    html = html.replace(/<div[^>]*><br\s*\/?>/gi, '');

    // Normalize align="..." to style="text-align: ..."
    html = html.replace(/\s*align\s*=\s*["']?(center|right|justify|left)["']?/gi, (match, align) => {
        return ` style="text-align: ${align.toLowerCase()};"`;
    });

    // Sanitize style attributes to keep only safe text-align and indentations
    html = html.replace(/\s*style\s*=\s*["']([^"']*)["']/gi, (match, styleVal) => {
        return sanitizeInlineStyle(styleVal);
    });

    // Convert any <div> wrapper to semantic <p>
    html = html.replace(/<div(\s+[^>]*)?>(.*?)<\/div>/gis, (match, attrs, inner) => {
        const trimmedInner = inner.trim();
        if (!trimmedInner || /^(?:<br\s*\/?>|\s*)+$/i.test(trimmedInner)) {
            return '';
        }
        return `<p${attrs ? ' ' + attrs.trim() : ''}>${trimmedInner}</p>`;
    });

    // Strip any residual div, br, code, pre tags
    html = html.replace(/<\/?(?:div|br|code|pre)\b[^>]*>/gi, '');
    html = html.replace(/&lt;\/?(?:div|br|code|pre)\b[^&gt;]*&gt;/gi, '');

    // Strip empty tags
    html = html.replace(/<(?:p|h[1-6]|blockquote)[^>]*>\s*<\/(?:p|h[1-6]|blockquote)>/gi, '');

    // Clean redundant empty lines at beginning or end
    html = html
        .replace(/^(?:\s*<p[^>]*>\s*<\/p>)+/gi, '')
        .replace(/(?:\s*<p[^>]*>\s*<\/p>)+$/gi, '');

    const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote',
            'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
            'sub', 'sup', 'a', 'hr'
        ],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'style'],
        ALLOW_DATA_ATTR: false
    });
    return (typeof sanitized === 'string' ? sanitized : String(sanitized)).trim();
}

/**
 * Determines whether an article status indicates that the article was returned for revision.
 */
export function isRevisionStatus(status) {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return s.includes('revision');
}

/**
 * Checks if the new article body content is meaningfully modified
 * compared to the original content (ignoring raw HTML wrappers and whitespace).
 */
export function isArticleBodyModified(originalContent, newContent) {
    const normalize = (html) => {
        if (!html) return '';
        return String(html)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    };

    return normalize(originalContent) !== normalize(newContent);
}


