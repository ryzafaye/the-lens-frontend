<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../services/api.js';
import { setAuthUser, useAuthStore } from '../stores/auth.js';
const logoImg = '/images/logo.jpg';
import '../assets/css/login.css';

const router = useRouter();

// State
const studentNumber = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const isPageFlipped = ref(false);

function handlePageCurlClick() {
    isPageFlipped.value = true;
    setTimeout(() => {
        isPageFlipped.value = false;
    }, 1200);
}

// Auto-format student number to 0000-00000-BN-0 format (exact logic from login.js)
function onStudentNumberInput(e) {
    let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let formatted = '';

    if (val.length > 0) formatted += val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 9);
    if (val.length > 9) formatted += '-' + val.substring(9, 11);
    if (val.length > 11) formatted += '-' + val.substring(11, 12);

    studentNumber.value = formatted;
    e.target.value = formatted;
}

// Password toggle (exact logic from login.js)
function togglePassword() {
    showPassword.value = !showPassword.value;
}

function handleBackToSite(e) {
    if (router) {
        e.preventDefault();
        router.push('/');
    }
}

// Form Submission connected to Backend
async function handleLogin() {
    if (isLoading.value) return;

    errorMessage.value = '';
    isLoading.value = true;

    // Safety timeout: ensure loading state never hangs indefinitely if network stalls
    const loginTimeout = setTimeout(() => {
        if (isLoading.value) {
            isLoading.value = false;
            errorMessage.value = 'Sign-in is taking longer than expected. Please check your connection and try again.';
        }
    }, 12000);

    try {
        const data = await login(studentNumber.value, password.value);
        clearTimeout(loginTimeout);

        // Store role & user information for instantaneous hydration in Pinia and localStorage
        const authStore = useAuthStore();
        if (data.user) {
            authStore.setUser(data.user);
        }

        // Direct to portal based on user role/portal from API
        let targetRoute = data.redirect;
        if (!targetRoute) {
            const portal = data.user?.portal;
            if (portal === 'eic') targetRoute = '/eic/dashboard';
            else if (portal === 'executive') targetRoute = '/executive/dashboard';
            else if (portal === 'section-head') targetRoute = '/section-head/dashboard';
            else if (portal === 'cartoonist') targetRoute = '/cartoonist/dashboard';
            else if (portal === 'media') targetRoute = '/media/dashboard';
            else if (portal === 'mpc') targetRoute = '/mpc/dashboard';
            else targetRoute = '/writer/dashboard';
        }

        if (router) {
            await router.push(targetRoute);
        } else {
            window.location.href = targetRoute;
        }
    } catch (error) {
        clearTimeout(loginTimeout);
        if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
            errorMessage.value = 'Server connection timed out. Please verify the backend is running and try again.';
        } else if (error.response?.data?.errors?.student_number) {
            const err = error.response.data.errors.student_number;
            errorMessage.value = Array.isArray(err) ? err[0] : err;
        } else if (error.response?.data?.message) {
            errorMessage.value = error.response.data.message;
        } else {
            errorMessage.value = 'Invalid student number or password. Please try again.';
        }
    } finally {
        clearTimeout(loginTimeout);
        isLoading.value = false;
    }
}
</script>

<template>
    <div class="login-page-container min-h-screen w-full bg-white font-body text-stone-900 selection:bg-wine selection:text-white flex items-center justify-center p-4 sm:p-8 md:p-12 lg:p-16 relative overflow-x-hidden">
        <!-- Radial ambient background -->
        <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(112,15,43,0.04),transparent_70%)]"></div>

        <!-- 3D Book Container -->
        <div class="book-wrapper w-full max-w-4xl lg:max-w-5xl relative z-10 animate-book my-6">
            <div class="book-edge-stack hidden sm:block"></div>
            <div class="book-edge-stack-sub hidden sm:block"></div>

            <div class="open-book bg-stone-900 flex flex-col lg:flex-row rounded-2xl sm:rounded-3xl overflow-hidden relative border-4 border-[#3a0614] z-10">
                <div class="silk-ribbon hidden lg:block" title="The Lens Bookmark"></div>

                <!-- Left Book Cover / Graphic Section -->
                <section class="relative lg:w-1/2 py-6 px-4 sm:py-8 sm:px-6 lg:p-14 min-h-[140px] sm:min-h-[180px] lg:min-h-[580px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#22020b] via-[#4a091b] to-[#120207] shadow-inner">
                    <div class="left-page-spine-shadow pointer-events-none absolute right-0 top-0 bottom-0 w-12 hidden lg:block z-20"></div>
                    <div class="pointer-events-none absolute -top-16 -left-16 w-80 h-80 rounded-full bg-rose-600/25 blur-3xl animate-drift-1"></div>
                    <div class="pointer-events-none absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-wine/50 blur-3xl animate-drift-2"></div>
                    <div class="pointer-events-none absolute inset-0 opacity-[0.06]" style="background-image: radial-gradient(rgba(255, 255, 255, 0.9) 1px, transparent 1px); background-size: 20px 20px;"></div>
                    <div class="pointer-events-none absolute inset-4 sm:inset-6 rounded-2xl border border-white/10 hidden sm:block"></div>

                    <div class="relative z-10 flex items-center justify-center">
                        <div class="relative group cursor-pointer">
                            <div class="absolute -inset-3 sm:-inset-4 lg:-inset-6 rounded-full bg-gradient-to-tr from-rose-600/50 via-wine/70 to-amber-500/35 blur-xl sm:blur-2xl lg:blur-3xl animate-pulse-glow"></div>
                            <div class="absolute -inset-2.5 sm:-inset-3.5 lg:-inset-5 rounded-full border border-white/25 border-dashed animate-spin" style="animation-duration: 35s;"></div>
                            <div class="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-80 lg:h-80 rounded-full p-1.5 sm:p-2 lg:p-3 bg-gradient-to-b from-white/30 via-white/10 to-transparent shadow-xl lg:shadow-2xl backdrop-blur-xl animate-float-logo">
                                <div class="w-full h-full rounded-full overflow-hidden border border-white/40 lg:border-2 shadow-inner bg-[#4a091b] flex items-center justify-center">
                                    <img :src="logoImg" alt="The Lens Logo" class="w-full h-full object-cover select-none transition-transform duration-700 group-hover:scale-105">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Page Curl / Flipped Page (bottom-left corner) -->
                    <div
                        class="page-curl-wrapper"
                        :class="{ 'page-flipped': isPageFlipped }"
                        @click="handlePageCurlClick"
                        title="The Lens — Turn page"
                        role="button"
                        tabindex="0"
                        aria-label="Turn page decorative fold"
                    >
                        <svg class="page-curl-svg" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <filter id="softRollShadow" x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="3" dy="-3" stdDeviation="5" flood-color="#000000" flood-opacity="0.55" />
                                </filter>

                                <filter id="pageCastShadow" x="-40%" y="-40%" width="180%" height="180%">
                                    <feGaussianBlur stdDeviation="8" />
                                </filter>

                                <linearGradient id="parchmentBase" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#ded8cb" />
                                    <stop offset="40%" stop-color="#ede7db" />
                                    <stop offset="85%" stop-color="#e2dacb" />
                                    <stop offset="100%" stop-color="#cfc7b4" />
                                </linearGradient>

                                <linearGradient id="creaseDepression" x1="100%" y1="100%" x2="0%" y2="0%">
                                    <stop offset="0%" stop-color="rgba(24, 3, 8, 0.45)" />
                                    <stop offset="35%" stop-color="rgba(30, 4, 10, 0.2)" />
                                    <stop offset="70%" stop-color="rgba(30, 4, 10, 0.05)" />
                                    <stop offset="100%" stop-color="transparent" />
                                </linearGradient>

                                <linearGradient id="paperRollCylinder" x1="15%" y1="85%" x2="85%" y2="20%">
                                    <stop offset="0%" stop-color="#140207" />
                                    <stop offset="18%" stop-color="#28050e" />
                                    <stop offset="38%" stop-color="#4d091d" />
                                    <stop offset="60%" stop-color="#730f2c" />
                                    <stop offset="78%" stop-color="#9e183e" />
                                    <stop offset="90%" stop-color="#c94b6d" />
                                    <stop offset="96%" stop-color="#f0b6c5" />
                                    <stop offset="100%" stop-color="#ffffff" />
                                </linearGradient>

                                <linearGradient id="rimLightGrad" x1="0%" y1="0%" x2="100%" y2="30%">
                                    <stop offset="0%" stop-color="rgba(255,255,255,0.2)" />
                                    <stop offset="60%" stop-color="rgba(255,255,255,0.85)" />
                                    <stop offset="100%" stop-color="rgba(255,255,255,0.95)" />
                                </linearGradient>
                            </defs>

                            <!-- Exposed Under-Page -->
                            <path d="M 0 20 L 0 144 Q 0 160 16 160 L 150 160 C 112 120 54 62 0 20 Z" fill="url(#parchmentBase)" />

                            <!-- Realistic Faint Printed Article Lines -->
                            <g opacity="0.65" stroke="#968c77" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 3">
                                <line x1="10" y1="52" x2="68" y2="110" />
                                <line x1="12" y1="74" x2="58" y2="120" />
                                <line x1="14" y1="96" x2="48" y2="130" />
                                <line x1="18" y1="118" x2="38" y2="138" />
                            </g>

                            <!-- Soft Shadow on Exposed Parchment -->
                            <path d="M 0 20 L 0 144 Q 0 160 16 160 L 150 160 C 112 120 54 62 0 20 Z" fill="url(#creaseDepression)" />

                            <!-- Soft Cast Ambient Shadow -->
                            <path d="M 0 20 C 35 20 85 14 142 26 C 150 68 152 118 150 160 C 120 130 65 75 0 20 Z" fill="rgba(0,0,0,0.55)" filter="url(#pageCastShadow)" />

                            <!-- Curled Page Roll -->
                            <path d="M 0 20 C 35 22 88 15 142 26 C 150 68 153 118 150 160 C 110 122 52 64 0 20 Z" fill="url(#paperRollCylinder)" filter="url(#softRollShadow)" />

                            <!-- Subtle Specular Highlight Curve -->
                            <path d="M 2 22 C 36 24 88 17 141 28" stroke="url(#rimLightGrad)" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.9" />

                            <!-- Delicate Right Flap Rim Light -->
                            <path d="M 141 28 C 149 70 152 118 149 158" stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.75" />
                        </svg>
                    </div>
                </section>

                <!-- Right Form Section -->
                <main class="lg:w-1/2 flex flex-col justify-center p-6 sm:p-10 lg:p-16 bg-[#ffffff] relative">
                    <!-- Back to Site Link -->
                    <div class="absolute top-4 right-4 sm:top-8 sm:right-8 z-30">
                        <a
                            href="/"
                            @click="handleBackToSite"
                            class="group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-stone-500 hover:text-wine transition-colors duration-200 py-1.5 px-3 rounded-lg hover:bg-stone-100"
                            aria-label="Back to public site"
                        >
                            <i class="fa-solid fa-arrow-left text-xs transition-transform group-hover:-translate-x-1" aria-hidden="true"></i>
                            <span>Back to site</span>
                        </a>
                    </div>

                    <div class="right-page-spine-shadow pointer-events-none absolute left-0 top-0 bottom-0 w-10 hidden lg:block z-20"></div>
                    <div class="pointer-events-none absolute inset-4 sm:inset-6 rounded-2xl border border-stone-200/60 hidden sm:block"></div>

                    <div class="w-full max-w-sm mx-auto relative z-20">
                        <div class="mb-6 sm:mb-8 pt-4 sm:pt-0">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase bg-rose-900/10 text-rose-900 mb-3">
                                Member Portal
                            </span>
                            <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                                Sign In
                            </h1>
                            <p class="mt-1.5 text-sm text-stone-500">
                                Enter your student number and password to proceed.
                            </p>
                        </div>

                        <!-- Error Message Box -->
                        <div
                            v-if="errorMessage"
                            class="mb-6 p-3.5 rounded-xl text-xs sm:text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2"
                            role="alert"
                        >
                            <i class="fa-solid fa-circle-exclamation text-rose-500" aria-hidden="true"></i>
                            <span>{{ errorMessage }}</span>
                        </div>

                        <form id="login-form" @submit.prevent="handleLogin" class="space-y-5">
                            <!-- Student Number Field -->
                            <div class="space-y-1.5">
                                <label for="student-number" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                    Student Number
                                </label>
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                        <i class="fa-regular fa-id-card text-base" aria-hidden="true"></i>
                                    </div>
                                    <input
                                        type="text"
                                        id="student-number"
                                        name="student_number"
                                        :value="studentNumber"
                                        @input="onStudentNumberInput"
                                        required
                                        autocomplete="username"
                                        placeholder="0000-00000-BN-0"
                                        class="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-stone-200 bg-stone-50/60 text-stone-900 placeholder:text-stone-400 text-sm font-medium tracking-wide focus:outline-none focus:border-rose-900 focus:bg-white focus:ring-4 focus:ring-rose-900/10 transition-all duration-200 shadow-sm"
                                    >
                                </div>
                            </div>

                            <!-- Password Field -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        id="forgot-password-link"
                                        style="font-size: 10px !important; line-height: 14px !important;"
                                        class="font-medium text-wine hover:text-[#4a091b] hover:underline focus:outline-none cursor-pointer transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                        <i class="fa-solid fa-lock text-sm" aria-hidden="true"></i>
                                    </div>
                                    <input
                                        :type="showPassword ? 'text' : 'password'"
                                        id="password"
                                        name="password"
                                        v-model="password"
                                        required
                                        autocomplete="current-password"
                                        placeholder="Enter your password"
                                        class="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-stone-200 bg-stone-50/60 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:border-rose-900 focus:bg-white focus:ring-4 focus:ring-rose-900/10 transition-all duration-200 shadow-sm"
                                    >
                                    <button
                                        type="button"
                                        id="toggle-password"
                                        @click="togglePassword"
                                        class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 focus:outline-none transition-colors cursor-pointer"
                                        :aria-label="showPassword ? 'Hide password' : 'Show password'"
                                    >
                                        <i id="toggle-password-icon" class="text-sm" :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Submit Button -->
                            <div class="pt-2">
                                <button
                                    type="submit"
                                    id="login-button"
                                    :disabled="isLoading"
                                    :style="isLoading ? { opacity: '0.85', cursor: 'wait' } : {}"
                                    class="shimmer-button w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#700f2b] to-[#8d1337] hover:from-[#5e0c24] hover:to-[#700f2b] text-white font-medium text-sm tracking-wide shadow-md hover:shadow-lg shadow-rose-900/25 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-rose-900/25 cursor-pointer"
                                >
                                    <template v-if="isLoading">
                                        <i class="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true"></i>
                                        <span>Signing In…</span>
                                    </template>
                                    <template v-else>
                                        <span>Log In</span>
                                        <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                                    </template>
                                </button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    </div>
</template>
