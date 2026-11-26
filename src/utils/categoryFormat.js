/**
 * Shared category formatting helpers for internal officer dashboards & tables.
 * Abbreviates "Science & Technology" to "SciTech" for compact badge display
 * without mutating underlying database or API category values.
 */
export function formatCategoryDisplay(categoryName) {
    if (!categoryName) return 'General';
    const trimmed = String(categoryName).trim();
    if (!trimmed) return 'General';
    if (/^science\s*(&|and)\s*technology$/i.test(trimmed)) {
        return 'SciTech';
    }
    return trimmed;
}
