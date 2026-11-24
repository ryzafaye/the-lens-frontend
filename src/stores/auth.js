import { reactive } from 'vue';
import { defineStore } from 'pinia';
import { getUser as fetchUserApi, logout as logoutApi } from '../services/api.js';

function safeGetStorage(key, fallback = null) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key) || fallback;
        }
    } catch (e) {}
    return fallback;
}

function safeSetStorage(key, value) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, String(value));
        }
    } catch (e) {}
}

function safeRemoveStorage(key) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        }
    } catch (e) {}
}

/**
 * Shared reactive user object for backwards compatibility with existing components.
 */
export const currentUser = reactive({
    id: safeGetStorage('userId'),
    full_name: safeGetStorage('userName') || safeGetStorage('writerName') || safeGetStorage('sectionHeadName') || 'Writer',
    role: safeGetStorage('userRole') || safeGetStorage('writerRole') || safeGetStorage('sectionHeadRole') || 'Writer',
    avatar_url: safeGetStorage('userAvatar') || '/images/member-placeholder.svg',
    profile_picture_url: safeGetStorage('userAvatar') || '/images/member-placeholder.svg',
    avatar: safeGetStorage('userAvatar') || '/images/member-placeholder.svg',
    student_number: safeGetStorage('studentNumber') || '',
});

/**
 * Updates the global reactive user state, localStorage, and dispatches a window event
 * so all headers, sidebars, and avatar elements reflect changes immediately without page refresh.
 */
export function setAuthUser(userData) {
    if (!userData) return;

    if (userData.full_name || userData.name) {
        const name = userData.full_name || userData.name;
        currentUser.full_name = name;
        safeSetStorage('userName', name);
        safeSetStorage('writerName', name);
        safeSetStorage('sectionHeadName', name);
    }

    if (userData.role) {
        const role = typeof userData.role === 'string'
            ? userData.role
            : (userData.role?.role_name || currentUser.role);
        currentUser.role = role;
        safeSetStorage('userRole', role);
        safeSetStorage('writerRole', role);
        safeSetStorage('sectionHeadRole', role);
    }

    const rawAvatar = userData.avatar_url || userData.avatarUrl || userData.profile_picture_url || userData.avatar;
    if (rawAvatar && rawAvatar !== 'null' && rawAvatar !== 'undefined') {
        currentUser.avatar_url = rawAvatar;
        currentUser.profile_picture_url = rawAvatar;
        currentUser.avatar = rawAvatar;
        safeSetStorage('userAvatar', rawAvatar);
    } else if (userData.avatar_url === null || userData.profile_picture_url === null || userData.avatar === null) {
        currentUser.avatar_url = '/images/member-placeholder.svg';
        currentUser.profile_picture_url = '/images/member-placeholder.svg';
        currentUser.avatar = '/images/member-placeholder.svg';
        safeSetStorage('userAvatar', '/images/member-placeholder.svg');
    }

    if (userData.student_number || userData.studentNumber) {
        const num = userData.student_number || userData.studentNumber;
        currentUser.student_number = num;
        safeSetStorage('studentNumber', num);
    }

    if (userData.id) {
        currentUser.id = userData.id;
        safeSetStorage('userId', String(userData.id));
    }

    // Dispatch global event for instant updates across any component or layout
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated', {
            detail: {
                id: currentUser.id,
                full_name: currentUser.full_name,
                avatar_url: currentUser.avatar_url,
                profile_picture_url: currentUser.profile_picture_url,
                avatar: currentUser.avatar,
                student_number: currentUser.student_number,
                role: currentUser.role,
            }
        }));
    }
}

/**
 * Clears current user state and storage on logout.
 */
export function clearAuthUser() {
    currentUser.id = null;
    currentUser.full_name = 'Writer';
    currentUser.role = 'Writer';
    currentUser.avatar_url = '/images/member-placeholder.svg';
    currentUser.profile_picture_url = '/images/member-placeholder.svg';
    currentUser.avatar = '/images/member-placeholder.svg';
    currentUser.student_number = '';

    safeRemoveStorage('userRole');
    safeRemoveStorage('userName');
    safeRemoveStorage('writerName');
    safeRemoveStorage('sectionHeadName');
    safeRemoveStorage('studentNumber');
    safeRemoveStorage('userAvatar');
    safeRemoveStorage('userId');

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated', {
            detail: {
                id: null,
                full_name: currentUser.full_name,
                avatar_url: currentUser.avatar_url,
                student_number: currentUser.student_number,
                role: currentUser.role,
            }
        }));
    }
}

// In-flight promise variable to prevent concurrent fetchUser() calls across layout, router guard, and pages
let inFlightFetchPromise = null;

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: currentUser.id ? { ...currentUser } : null,
        loading: false,
        initialized: !!currentUser.id,
    }),

    getters: {
        isAuthenticated: (state) => !!state.user?.id || !!currentUser.id,
        currentRole: (state) => {
            const r = state.user?.role || currentUser.role;
            if (!r) return '';
            if (typeof r === 'string') return r;
            return r.role_name || r.name || '';
        },
        fullName: (state) => {
            const u = state.user?.full_name || currentUser.full_name;
            if (!u) return 'Writer';
            if (typeof u === 'string') return u;
            return u.name || 'Writer';
        },
        avatarUrl: (state) => state.user?.avatar_url || currentUser.avatar_url,
    },

    actions: {
        /**
         * Fetches current authenticated user with in-flight promise deduplication.
         * Concurrent calls within the same page load will share the exact same network request.
         */
        async fetchUser(forceFresh = false) {
            if (!forceFresh && this.initialized && this.user) {
                return this.user;
            }

            if (inFlightFetchPromise && !forceFresh) {
                return inFlightFetchPromise;
            }

            this.loading = true;
            inFlightFetchPromise = (async () => {
                try {
                    const data = await fetchUserApi(forceFresh);
                    const rawUser = data?.user || data;
                    if (rawUser && (rawUser.id || rawUser.student_number)) {
                        setAuthUser(rawUser);
                        this.user = {
                            id: currentUser.id,
                            full_name: currentUser.full_name,
                            role: currentUser.role,
                            avatar_url: currentUser.avatar_url,
                            profile_picture_url: currentUser.profile_picture_url,
                            avatar: currentUser.avatar,
                            student_number: currentUser.student_number,
                        };
                        this.initialized = true;
                        return this.user;
                    }
                    return null;
                } catch (err) {
                    if (err.response?.status === 401) {
                        this.clearUser();
                    }
                    throw err;
                } finally {
                    this.loading = false;
                    inFlightFetchPromise = null;
                }
            })();

            return inFlightFetchPromise;
        },

        setUser(userData) {
            setAuthUser(userData);
            this.user = {
                id: currentUser.id,
                full_name: currentUser.full_name,
                role: currentUser.role,
                avatar_url: currentUser.avatar_url,
                profile_picture_url: currentUser.profile_picture_url,
                avatar: currentUser.avatar,
                student_number: currentUser.student_number,
            };
            this.initialized = true;
        },

        async logout() {
            try {
                await logoutApi();
            } catch (e) {
                console.warn('Logout API error:', e);
            } finally {
                this.clearUser();
            }
        },

        clearUser() {
            clearAuthUser();
            this.user = null;
            this.initialized = false;
            inFlightFetchPromise = null;
        },
    },
});

export default useAuthStore;
