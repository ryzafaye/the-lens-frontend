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
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // Normalize align="..." attribute to style="text-align: ..."
    content = content.replace(/\s*align\s*=\s*["']?(center|right|justify|left)["']?/gi, (match, align) => {
        return ` style="text-align: ${align.toLowerCase()};"`;
    });

    // Sanitize style attributes to keep only text-align and margin-left
    content = content.replace(/\s*style\s*=\s*["']([^"']*)["']/gi, (match, styleVal) => {
        return sanitizeInlineStyle(styleVal);
    });

    // Unwrap unnecessary span tags while keeping their text intact
    content = content
        .replace(/<\/?span[^>]*>/gi, '');

    const hasHtmlTags = /<\/?(?:div|p|br|h[1-6]|blockquote|ul|ol|li|strong|b|em|i|u|s|del|strike|sub|sup|a|hr)[^>]*>/i.test(content);

    if (hasHtmlTags) {
        // Standardize <p> to <div> while preserving safe inline style attributes
        content = content
            .replace(/<p\b([^>]*)>/gi, (match, attrs) => {
                const safeStyle = sanitizeInlineStyle(attrs);
                return safeStyle ? `<div${safeStyle}>` : '<div>';
            })
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
        if (!trimmed) return '<div><br></div>';
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return `<div class="article-bullet-item">${escapeHTML(trimmed.replace(/^[•\-]\s*/, ''))}</div>`;
        }
        return `<div>${escapeHTML(trimmed)}</div>`;
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
 * Preserves safe formatting tags (bold, italic, headings, quotes, links, strikethrough, alignments, indentations)
 * while converting list tags (<ul>, <ol>, <li>) into clean bullets (• ) and numbered items (1. ) so NO raw <li>
 * tags are ever transmitted to or stored in the database.
 */
export function sanitizeRichArticleHtml(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    let html = decodeCorruptedHtmlEntities(rawHtml.trim());

    // Strip dangerous scripts, styles, iframes, objects, embeds, and event handlers
    html = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // Convert ordered lists into numbered text paragraphs
    html = html.replace(/<ol\b[^>]*>(.*?)<\/ol>/gis, (match, listContent) => {
        let index = 1;
        const replaced = listContent.replace(/<li\b[^>]*>(.*?)<\/li>/gis, (liMatch, itemText) => {
            const cleanItem = itemText.replace(/<\/?(?:div|p)[^>]*>/gi, '').trim();
            const numLine = `<div>${index}. ${cleanItem}</div>`;
            index++;
            return numLine;
        });
        return replaced;
    });

    // Convert unordered lists into clean bullet text paragraphs
    html = html.replace(/<ul\b[^>]*>(.*?)<\/ul>/gis, (match, listContent) => {
        return listContent.replace(/<li\b[^>]*>(.*?)<\/li>/gis, (liMatch, itemText) => {
            const cleanItem = itemText.replace(/<\/?(?:div|p)[^>]*>/gi, '').trim();
            return `<div>• ${cleanItem}</div>`;
        });
    });

    // Handle any stray list tags
    html = html.replace(/<li\b[^>]*>(.*?)<\/li>/gis, (match, itemText) => {
        const cleanItem = itemText.replace(/<\/?(?:div|p)[^>]*>/gi, '').trim();
        return `<div>• ${cleanItem}</div>`;
    });
    html = html.replace(/<\/?(?:ul|ol|li)[^>]*>/gi, '');
    html = html.replace(/&lt;\/?(?:ul|ol|li)[^&gt;]*&gt;/gi, '');

    // Normalize align="..." to style="text-align: ..."
    html = html.replace(/\s*align\s*=\s*["']?(center|right|justify|left)["']?/gi, (match, align) => {
        return ` style="text-align: ${align.toLowerCase()};"`;
    });

    // Sanitize style attributes to keep only safe text-align and indentations
    html = html.replace(/\s*style\s*=\s*["']([^"']*)["']/gi, (match, styleVal) => {
        return sanitizeInlineStyle(styleVal);
    });

    // Unwrap useless font tags and empty spans while preserving text
    html = html
        .replace(/<\/?font[^>]*>/gi, '')
        .replace(/<\/?span[^>]*>/gi, '');

    // Clean redundant empty lines at beginning or end
    html = html
        .replace(/^(?:<(?:div|p)>\s*(?:<br\s*\/?>)?\s*<\/(?:div|p)>)+/gi, '')
        .replace(/(?:<(?:div|p)>\s*(?:<br\s*\/?>)?\s*<\/(?:div|p)>)+$/gi, '');

    return html.trim();
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


