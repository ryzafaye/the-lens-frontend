import { reactive } from 'vue';
import { defineStore } from 'pinia';
import { getUser as fetchUserApi, logout as logoutApi } from '../services/api.js';

/**
 * Shared reactive user object for backwards compatibility with existing components.
 */
export const currentUser = reactive({
    id: localStorage.getItem('userId') || null,
    full_name: localStorage.getItem('userName') || localStorage.getItem('writerName') || localStorage.getItem('sectionHeadName') || 'Writer',
    role: localStorage.getItem('userRole') || localStorage.getItem('writerRole') || localStorage.getItem('sectionHeadRole') || 'Writer',
    avatar_url: localStorage.getItem('userAvatar') || '/images/member-placeholder.svg',
    student_number: localStorage.getItem('studentNumber') || '',
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
        try {
            localStorage.setItem('userName', name);
            localStorage.setItem('writerName', name);
            localStorage.setItem('sectionHeadName', name);
        } catch (e) {}
    }

    if (userData.role) {
        const role = typeof userData.role === 'string'
            ? userData.role
            : (userData.role?.role_name || currentUser.role);
        currentUser.role = role;
        try {
            localStorage.setItem('userRole', role);
            localStorage.setItem('writerRole', role);
            localStorage.setItem('sectionHeadRole', role);
        } catch (e) {}
    }

    if (userData.avatar_url || userData.avatarUrl || userData.profile_picture_url) {
        const avatar = userData.avatar_url || userData.avatarUrl || userData.profile_picture_url;
        currentUser.avatar_url = avatar;
        try {
            localStorage.setItem('userAvatar', avatar);
        } catch (e) {}
    } else if (userData.avatar_url === null || userData.profile_picture_url === null) {
        currentUser.avatar_url = '/images/member-placeholder.svg';
        try {
            localStorage.setItem('userAvatar', '/images/member-placeholder.svg');
        } catch (e) {}
    }

    if (userData.student_number || userData.studentNumber) {
        const num = userData.student_number || userData.studentNumber;
        currentUser.student_number = num;
        try {
            localStorage.setItem('studentNumber', num);
        } catch (e) {}
    }

    if (userData.id) {
        currentUser.id = userData.id;
        try {
            localStorage.setItem('userId', String(userData.id));
        } catch (e) {}
    }

    // Dispatch global event for instant updates across any component or layout
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated', {
            detail: {
                id: currentUser.id,
                full_name: currentUser.full_name,
                avatar_url: currentUser.avatar_url,
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
    currentUser.student_number = '';

    try {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('writerName');
        localStorage.removeItem('sectionHeadName');
        localStorage.removeItem('studentNumber');
        localStorage.removeItem('userAvatar');
        localStorage.removeItem('userId');
    } catch (e) {}

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
        currentRole: (state) => state.user?.role || currentUser.role,
        fullName: (state) => state.user?.full_name || currentUser.full_name,
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
