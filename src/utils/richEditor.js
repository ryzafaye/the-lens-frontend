/**
 * Shared keydown, paste, and toolbar command helpers for contenteditable rich article bodies.
 */

export function handleRichEditorKeydown(e, targetEl, onSync = null, onSave = null) {
    if (!targetEl) return;

    if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            document.execCommand('outdent', false, null);
        } else {
            document.execCommand('indent', false, null);
        }
        onSync?.();
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'b' || key === 'i' || key === 'u') {
            e.preventDefault();
            const cmd = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
            document.execCommand(cmd, false, null);
            onSync?.();
        } else if (key === 'z') {
            e.preventDefault();
            document.execCommand(e.shiftKey ? 'redo' : 'undo', false, null);
            onSync?.();
        } else if (key === 'y') {
            e.preventDefault();
            document.execCommand('redo', false, null);
            onSync?.();
        } else if (key === 's' && typeof onSave === 'function') {
            e.preventDefault();
            onSave();
        }
    }
}

export function handleRichEditorPaste(e, onSync = null) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const text = clipboardData.getData('text/plain') || '';
    const html = clipboardData.getData('text/html') || '';

    if (e.shiftKey || !html.trim()) {
        if (text) {
            document.execCommand('insertText', false, text);
            onSync?.();
        }
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        doc.body
            .querySelectorAll('script, style, meta, link, object, embed, iframe, xml, title, noscript, applet')
            .forEach(el => el.remove());

        let tagToUnwrap;
        while ((tagToUnwrap = doc.body.querySelector('span, font, o\\:p, meta'))) {
            const parent = tagToUnwrap.parentNode;
            if (parent) {
                while (tagToUnwrap.firstChild) {
                    parent.insertBefore(tagToUnwrap.firstChild, tagToUnwrap);
                }
                parent.removeChild(tagToUnwrap);
            } else {
                tagToUnwrap.remove();
            }
        }

        const forbiddenAttrs = [
            'style', 'class', 'id', 'face', 'size', 'color',
            'dir', 'lang', 'align', 'valign', 'bgcolor', 'border',
        ];
        doc.body.querySelectorAll('*').forEach(el => {
            forbiddenAttrs.forEach(attr => el.removeAttribute(attr));
        });

        doc.body.querySelectorAll('p').forEach(p => {
            const div = doc.createElement('div');
            while (p.firstChild) div.appendChild(p.firstChild);
            if (p.parentNode) p.parentNode.replaceChild(div, p);
        });

        const cleanHtml = doc.body.innerHTML.trim();
        if (cleanHtml) {
            document.execCommand('insertHTML', false, cleanHtml);
        } else if (text) {
            document.execCommand('insertText', false, text);
        }
    } catch (err) {
        if (text) {
            document.execCommand('insertText', false, text);
        }
    }

    onSync?.();
}
