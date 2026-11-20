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
        } else if (actionLower === 'submitted photo') {
            beforeSubject = 'submitted the photo';
        } else if (actionLower === 'submitted media' || actionLower === 'submitted illustration') {
            beforeSubject = `submitted ${typePhrase}`;
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
            // Fallback for custom or direct action strings
            if (actionLower.endsWith(' for') || actionLower.endsWith(' to') || actionLower.endsWith(' of')) {
                beforeSubject = `${actionRaw} ${typePhrase}`;
            } else {
                beforeSubject = `${actionRaw} ${typePhrase}`;
            }
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
