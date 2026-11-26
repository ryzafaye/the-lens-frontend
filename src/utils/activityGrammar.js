/**
 * Utility for formatting activity log statements into natural, grammatically correct English sentences.
 * Ensures consistent phrasing and prevents crude string concatenations across all dashboards and logs.
 */

/**
 * Format activity log tokens into a structured sentence statement.
 *
 * @param {Object} item Raw activity log item
 * @returns {{ causer: string, beforeSubject: string, subjectName: string, afterSubject: string, fullStatement: string }}
 */
export function formatActivityStatement(item) {
    if (!item) {
        return {
            causer: 'System',
            beforeSubject: 'performed an action',
            subjectName: '',
            afterSubject: '',
            fullStatement: 'System performed an action'
        };
    }

    // 1. Resolve Causer Name
    let causer = 'System';
    if (typeof item.causer === 'string' && item.causer.trim()) {
        causer = item.causer.trim();
    } else if (item.causer?.name) {
        causer = item.causer.name.trim();
    } else if (typeof item.user === 'string' && item.user.trim()) {
        causer = item.user.trim();
    }

    // 2. Resolve Subject Type & Natural Noun Phrase
    let rawType = item.subjectType || item.subject?.type || item.entity_type || 'Article';
    // If it's a PHP class name like App\Models\Article
    if (rawType.includes('\\')) {
        rawType = rawType.split('\\').pop();
    }

    let lowerType = String(rawType).trim().toLowerCase();
    if (['record', 'desk record', 'editorial item', ''].includes(lowerType)) {
        lowerType = 'article';
    }

    let typePhrase = `the ${lowerType}`;
    if (['officer account', 'user account', 'user'].includes(lowerType)) {
        typePhrase = 'the officer account';
    } else if (['photo', 'photograph'].includes(lowerType)) {
        typePhrase = 'the photo';
    } else if (['media asset', 'graphic material', 'graphic'].includes(lowerType)) {
        typePhrase = 'the media asset';
    } else if (['editorial cartoon', 'cartoon'].includes(lowerType)) {
        typePhrase = 'the editorial cartoon';
    }

    // 3. Resolve Subject Name / Title
    let rawSubjectName = item.subjectName || item.subject?.title || item.target || item.title || '';
    let cleanSubjectName = String(rawSubjectName).trim();
    if (['record', 'desk record', 'untitled article', 'editorial item'].includes(cleanSubjectName.toLowerCase())) {
        cleanSubjectName = '';
    }

    // 4. Resolve Action and Grammatical Clauses
    let beforeSubject = '';
    let afterSubject = '';

    // Check if backend provided a valid, grammatical statementBefore
    let hasCleanStatementBefore = false;
    if (item.statementBefore !== undefined && item.statementBefore !== null && item.statementBefore !== '') {
        const rawBefore = String(item.statementBefore).trim();
        const beforeLower = rawBefore.toLowerCase();
        // Reject malformed or ungrammatical patterns (e.g. "edited manuscript the Article", "returned for revision the")
        const isMalformed =
            beforeLower.includes('edited manuscript') ||
            beforeLower.includes('returned for revision the') ||
            beforeLower.includes('the article the article') ||
            beforeLower.includes('cartoon the editorial cartoon') ||
            beforeLower.includes('photo the photo') ||
            beforeLower.includes('media the media') ||
            beforeLower.includes('artwork the visual') ||
            rawBefore.includes('the Article') ||
            rawBefore.includes('the Editorial Item') ||
            rawBefore.includes('the Desk Record');

        if (!isMalformed) {
            beforeSubject = rawBefore;
            afterSubject = item.statementAfter || '';
            hasCleanStatementBefore = true;
        }
    }

    if (!hasCleanStatementBefore) {
        const actionRaw = String(item.action || '').trim();
        const actionLower = actionRaw.toLowerCase();

        if (actionLower === 'edited manuscript' || actionLower === 'edited article' || actionLower === 'updated manuscript' || actionLower === 'edited') {
            beforeSubject = `edited the manuscript for ${typePhrase}`;
        } else if (actionLower === 'returned for revision' || actionLower === 'returned article for revision' || actionLower === 'returned for revisions') {
            beforeSubject = `returned ${typePhrase}`;
            afterSubject = 'for revision';
        } else if (actionLower.startsWith('returned') && actionLower.includes('revision')) {
            let noun = typePhrase;
            if (actionLower.includes('cartoon')) noun = 'the editorial cartoon';
            else if (actionLower.includes('photo')) noun = 'the photo';
            else if (actionLower.includes('visual')) noun = 'the visual asset';
            beforeSubject = `returned ${noun}`;
            afterSubject = 'for revision';
        } else if (actionLower.startsWith('endorsed') && (actionLower.includes('eic') || actionLower.includes('editor-in-chief'))) {
            let noun = typePhrase;
            if (actionLower.includes('cartoon')) noun = 'the editorial cartoon';
            else if (actionLower.includes('photo')) noun = 'the photo';
            else if (actionLower.includes('visual')) noun = 'the visual asset';
            beforeSubject = `endorsed ${noun}`;
            afterSubject = 'to the EIC';
        } else if (actionLower === 'assigned cover to') {
            beforeSubject = `assigned a cover to ${typePhrase}`;
        } else if (actionLower === 'created account for' || actionLower === 'created user') {
            beforeSubject = 'created an officer account for';
        } else if (actionLower === 'updated role for') {
            beforeSubject = 'updated the role for';
        } else if (actionLower === 'deactivated account for') {
            beforeSubject = 'deactivated the account for';
        } else if (actionLower === 'activated account for') {
            beforeSubject = 'activated the account for';
        } else if (actionLower === 'approved visual artwork') {
            beforeSubject = 'approved the visual artwork';
        } else if (actionLower === 'submitted editorial cartoon') {
            beforeSubject = 'submitted the editorial cartoon';
        } else if (actionLower === 'resubmitted editorial cartoon') {
            beforeSubject = 'resubmitted the editorial cartoon';
        } else if (actionLower === 'submitted photo') {
            beforeSubject = 'submitted the photo';
        } else if (actionLower === 'resubmitted photo') {
            beforeSubject = 'resubmitted the photo';
        } else if (actionLower === 'submitted media' || actionLower === 'submitted illustration') {
            beforeSubject = `submitted ${typePhrase}`;
        } else if (actionLower === 'resubmitted media' || actionLower === 'resubmitted illustration' || actionLower === 'resubmitted article' || actionLower === 'resubmitted') {
            beforeSubject = `resubmitted ${typePhrase}`;
        } else if (actionLower.startsWith('resubmitted ')) {
            let noun = typePhrase;
            if (actionLower.includes('cartoon')) noun = 'the editorial cartoon';
            else if (actionLower.includes('photo')) noun = 'the photo';
            else if (actionLower.includes('visual') || actionLower.includes('artwork')) noun = 'the visual artwork';
            else if (actionLower.includes('media') || actionLower.includes('graphic')) noun = 'the media asset';
            beforeSubject = `resubmitted ${noun}`;
        } else if (['emergency delete', 'emergency deleted', 'hard delete', 'hard deleted', 'permanently delete', 'permanently deleted'].includes(actionLower)) {
            beforeSubject = `permanently deleted ${typePhrase}`;
        } else if (['deleted', 'deleted article'].includes(actionLower)) {
            beforeSubject = `deleted ${typePhrase}`;
        } else if (['rejected', 'declined', 'rejected article', 'declined article'].includes(actionLower)) {
            beforeSubject = `rejected ${typePhrase}`;
        } else if (['submitted', 'submitted article'].includes(actionLower)) {
            beforeSubject = `submitted ${typePhrase}`;
        } else if (['approved', 'approved article'].includes(actionLower)) {
            beforeSubject = `approved ${typePhrase}`;
        } else if (['published', 'published article'].includes(actionLower)) {
            beforeSubject = `published ${typePhrase}`;
        } else if (['unpublished', 'unpublished article'].includes(actionLower)) {
            beforeSubject = `unpublished ${typePhrase}`;
        } else if (['archived', 'archived article'].includes(actionLower)) {
            beforeSubject = `archived ${typePhrase}`;
        } else if (['restored', 'restored article'].includes(actionLower)) {
            beforeSubject = `restored ${typePhrase}`;
        } else if (['submitted', 'approved', 'published', 'unpublished', 'archived', 'restored'].includes(actionLower)) {
            beforeSubject = `${actionLower} ${typePhrase}`;
        } else {
            // Avoid duplicating the resource noun if actionRaw already contains it
            const alreadyHasNoun =
                actionLower.includes(lowerType) ||
                actionLower.includes('editorial cartoon') ||
                actionLower.includes('photo') ||
                actionLower.includes('media asset') ||
                actionLower.includes('visual artwork') ||
                actionLower.includes('article');
            beforeSubject = alreadyHasNoun ? actionRaw : `${actionRaw} ${typePhrase}`;
        }
    }

    const namePart = cleanSubjectName ? ` "${cleanSubjectName}"` : '';
    const afterPart = afterSubject ? ` ${afterSubject}` : '';
    const fullStatement = `${causer} ${beforeSubject}${namePart}${afterPart}`.replace(/\s+/g, ' ').trim();

    return {
        causer,
        beforeSubject,
        subjectName: cleanSubjectName,
        afterSubject,
        fullStatement
    };
}

/**
 * Formats any date string or ISO timestamp strictly in Philippine Standard Time (PST / Asia/Manila, UTC+8).
 * Example: "Nov 23, 2026 • 8:20 PM"
 *
 * @param {string|Date|number|null} dateInput
 * @returns {string}
 */
export function formatPhilippineDateTime(dateInput) {
    if (!dateInput) return '';

    // If it's already in the exact format "Mmm DD, YYYY • H:MM AM/PM", return it directly
    const preformattedRegex = /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+•\s+\d{1,2}:\d{2}\s+(AM|PM)$/i;
    if (typeof dateInput === 'string' && preformattedRegex.test(dateInput.trim())) {
        return dateInput.trim();
    }

    try {
        let str = String(dateInput).trim();
        // If it's an ISO date or SQL datetime without timezone offset, ensure UTC parsing
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
            str = str.replace(' ', 'T') + 'Z';
        }

        const date = new Date(str);
        if (isNaN(date.getTime())) {
            return String(dateInput);
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const parts = formatter.formatToParts(date);
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        const hour = parts.find(p => p.type === 'hour')?.value || '';
        const minute = parts.find(p => p.type === 'minute')?.value || '';
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value?.toUpperCase() || '';

        return `${month} ${day}, ${year} • ${hour}:${minute} ${dayPeriod}`;
    } catch {
        return String(dateInput);
    }
}

/**
 * Returns human-readable relative time (e.g. "5 minutes ago", "Just now", "2 hours ago")
 * calculated against Philippine Standard Time.
 *
 * @param {string|Date|number|null} dateInput
 * @returns {string}
 */
export function formatPhilippineRelativeTime(dateInput) {
    if (!dateInput) return 'Recently';

    // If already pre-computed relative string like "5 minutes ago", "Just now", return it
    if (typeof dateInput === 'string' && /ago|just now|yesterday|recently/i.test(dateInput)) {
        return dateInput;
    }

    try {
        let str = String(dateInput).trim();
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
            str = str.replace(' ', 'T') + 'Z';
        }

        const date = new Date(str);
        if (isNaN(date.getTime())) {
            return String(dateInput);
        }

        const now = Date.now();
        const diffMs = now - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);

        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        }
        const months = Math.floor(diffDays / 30);
        if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
        const years = Math.floor(diffDays / 365);
        return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    } catch {
        return String(dateInput);
    }
}

/**
 * Resolves calendar day grouping in Philippine Standard Time.
 *
 * @param {string|Date|number|null} dateInput
 * @returns {string} e.g. "Today", "Yesterday", or "Nov 23, 2026"
 */
export function getPhilippineDayGroup(dateInput) {
    if (!dateInput) return 'Earlier';

    try {
        let str = String(dateInput).trim();
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
            str = str.replace(' ', 'T') + 'Z';
        }
        const date = new Date(str);
        if (isNaN(date.getTime())) return 'Earlier';

        const keyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD
        const dateKey = keyFormatter.format(date);
        const todayKey = keyFormatter.format(new Date());
        const yesterdayKey = keyFormatter.format(new Date(Date.now() - 86400000));

        if (dateKey === todayKey) return 'Today';
        if (dateKey === yesterdayKey) return 'Yesterday';

        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date);
    } catch {
        return 'Earlier';
    }
}
