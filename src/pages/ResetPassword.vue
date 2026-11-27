<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { resetPassword } from '../services/api.js';
import { validateEmail, normalizeEmail, extractApiErrorMessage } from '../utils/validation.js';
import '../assets/css/login.css';

const logoImg = '/images/logo.jpg';
const route = useRoute();
const router = useRouter();

const token = ref('');
const email = ref('');
const emailError = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const isPageFlipped = ref(false);

const hasToken = computed(() => Boolean(token.value.trim()));
const isLengthValid = computed(() => password.value.length >= 6);
const isMatchValid = computed(() => password.value.length > 0 && password.value === passwordConfirmation.value);

onMounted(() => {
    const queryToken = typeof route.query.token === 'string' ? route.query.token.trim() : '';
    const queryEmail = typeof route.query.email === 'string' ? route.query.email.trim() : '';
    token.value = queryToken;
    email.value = queryEmail;
});

function handlePageCurlClick() {
    isPageFlipped.value = true;
    setTimeout(() => {
        isPageFlipped.value = false;
    }, 1200);
}

function validateEmailField() {
    const err = validateEmail(email.value, { required: true, maxLength: 255 });
    emailError.value = err;
    return !err;
}

function onEmailInput() {
    if (emailError.value) {
        validateEmailField();
    }
}

async function handleSubmit() {
    if (isLoading.value) return;

    errorMessage.value = '';

    if (!hasToken.value) {
        errorMessage.value = 'This password reset link is invalid or incomplete. Please request a new reset link.';
        return;
    }

    if (!validateEmailField()) {
        return;
    }

    if (!isLengthValid.value) {
        errorMessage.value = 'Password must be at least 6 characters long.';
        return;
    }

    if (!isMatchValid.value) {
        errorMessage.value = 'Passwords do not match. Please verify your new password.';
        return;
    }

    isLoading.value = true;
    try {
        const res = await resetPassword({
            token: token.value,
            email: normalizeEmail(email.value),
            password: password.value,
            password_confirmation: passwordConfirmation.value,
        });
        successMessage.value = res?.message || 'Your password has been reset successfully.';
    } catch (error) {
        const errors = error.response?.data?.errors;
        if (errors?.email) {
            emailError.value = Array.isArray(errors.email) ? errors.email[0] : errors.email;
        }
        errorMessage.value = extractApiErrorMessage(error, 'Unable to reset password. Your reset link may have expired.');
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div class="login-page-container min-h-screen w-full bg-white font-body text-stone-900 selection:bg-wine selection:text-white flex items-center justify-center p-4 sm:p-8 md:p-12 lg:p-16 relative overflow-x-hidden">
        <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(112,15,43,0.04),transparent_70%)]"></div>

        <div class="book-wrapper w-full max-w-4xl lg:max-w-5xl relative z-10 animate-book my-6">
            <div class="book-edge-stack hidden sm:block"></div>
            <div class="book-edge-stack-sub hidden sm:block"></div>

            <div class="open-book bg-stone-900 flex flex-col lg:flex-row rounded-2xl sm:rounded-3xl overflow-hidden relative border-4 border-[#3a0614] z-10">
                <div class="silk-ribbon hidden lg:block" title="The Lens Bookmark"></div>

                <!-- Left Maroon Editorial Cover -->
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
                            <path d="M 0 20 L 0 144 Q 0 160 16 160 L 150 160 C 112 120 54 62 0 20 Z" fill="url(#parchmentBase)" />
                            <g opacity="0.65" stroke="#968c77" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 3">
                                <line x1="10" y1="52" x2="68" y2="110" />
                                <line x1="12" y1="74" x2="58" y2="120" />
                                <line x1="14" y1="96" x2="48" y2="130" />
                                <line x1="18" y1="118" x2="38" y2="138" />
                            </g>
                            <path d="M 0 20 L 0 144 Q 0 160 16 160 L 150 160 C 112 120 54 62 0 20 Z" fill="url(#creaseDepression)" />
                            <path d="M 0 20 C 35 20 85 14 142 26 C 150 68 152 118 150 160 C 120 130 65 75 0 20 Z" fill="rgba(0,0,0,0.55)" filter="url(#pageCastShadow)" />
                            <path d="M 0 20 C 35 22 88 15 142 26 C 150 68 153 118 150 160 C 110 122 52 64 0 20 Z" fill="url(#paperRollCylinder)" filter="url(#softRollShadow)" />
                            <path d="M 2 22 C 36 24 88 17 141 28" stroke="url(#rimLightGrad)" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.9" />
                            <path d="M 141 28 C 149 70 152 118 149 158" stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.75" />
                        </svg>
                    </div>
                </section>

                <!-- Right Reset Password Form Section -->
                <main class="lg:w-1/2 flex flex-col justify-center p-6 sm:p-10 lg:p-16 bg-[#ffffff] relative">
                    <div class="absolute top-4 right-4 sm:top-8 sm:right-8 z-30">
                        <router-link
                            to="/login"
                            class="group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-stone-500 hover:text-wine transition-colors duration-200 py-1.5 px-3 rounded-lg hover:bg-stone-100"
                        >
                            <i class="fa-solid fa-arrow-left text-xs transition-transform group-hover:-translate-x-1" aria-hidden="true"></i>
                            <span>Back to Sign In</span>
                        </router-link>
                    </div>

                    <div class="right-page-spine-shadow pointer-events-none absolute left-0 top-0 bottom-0 w-10 hidden lg:block z-20"></div>
                    <div class="pointer-events-none absolute inset-4 sm:inset-6 rounded-2xl border border-stone-200/60 hidden sm:block"></div>

                    <div class="w-full max-w-sm mx-auto relative z-20 pt-8 sm:pt-4">
                        <!-- Success State -->
                        <div v-if="successMessage" class="auth-status-card">
                            <div class="auth-status-icon is-success">
                                <i class="fa-solid fa-check" aria-hidden="true"></i>
                            </div>
                            <span class="auth-status-pill is-success">
                                <i class="fa-solid fa-circle-check text-[10px]" aria-hidden="true"></i>
                                <span>Password Updated</span>
                            </span>
                            <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight mb-2">Ready to Sign In</h1>
                            <p class="auth-status-copy">
                                {{ successMessage }}
                            </p>
                            <div class="w-full">
                                <button
                                    type="button"
                                    @click="router.push('/login')"
                                    class="shimmer-button auth-primary-btn"
                                >
                                    <span>Proceed to Sign In</span>
                                    <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Invalid / Missing Token State -->
                        <div v-else-if="!hasToken" class="auth-status-card">
                            <div class="auth-status-icon is-error">
                                <i class="fa-solid fa-link-slash" aria-hidden="true"></i>
                            </div>
                            <span class="auth-status-pill is-error">
                                <i class="fa-solid fa-triangle-exclamation text-[10px]" aria-hidden="true"></i>
                                <span>Link Expired or Invalid</span>
                            </span>
                            <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight mb-2">Invalid Reset Link</h1>
                            <p class="auth-status-copy">
                                The password reset link is missing or malformed. Please request a fresh password reset link.
                            </p>
                            <router-link
                                to="/forgot-password"
                                class="shimmer-button auth-primary-btn"
                            >
                                <span>Request New Reset Link</span>
                                <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                            </router-link>
                        </div>

                        <!-- Reset Form -->
                        <template v-else>
                            <div class="mb-6">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase bg-rose-900/10 text-rose-900 mb-3">
                                    Password Reset
                                </span>
                                <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                                    Set New Password
                                </h1>
                                <p class="mt-1.5 text-sm text-stone-500">
                                    Choose a strong new password for your account.
                                </p>
                            </div>

                            <div
                                v-if="errorMessage"
                                class="mb-5 p-3.5 rounded-xl text-xs sm:text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-start gap-2.5"
                                role="alert"
                            >
                                <i class="fa-solid fa-circle-exclamation text-rose-500 mt-0.5" aria-hidden="true"></i>
                                <span>{{ errorMessage }}</span>
                            </div>

                            <form id="reset-password-form" @submit.prevent="handleSubmit" class="space-y-4" novalidate>
                                <!-- Account Email -->
                                <div class="space-y-1.5">
                                    <label for="reset-email" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                        Email Address
                                    </label>
                                    <div class="relative group">
                                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                                            <i class="fa-regular fa-envelope text-sm" aria-hidden="true"></i>
                                        </div>
                                        <input
                                            type="email"
                                            id="reset-email"
                                            name="email"
                                            v-model="email"
                                            @input="onEmailInput"
                                            @blur="validateEmailField"
                                            required
                                            maxlength="255"
                                            autocomplete="email"
                                            placeholder="you@example.com"
                                            :class="{ 'auth-input-invalid': !!emailError }"
                                        >
                                    </div>
                                    <p v-if="emailError" class="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                                        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                        <span>{{ emailError }}</span>
                                    </p>
                                </div>

                                <!-- New Password -->
                                <div class="space-y-1.5">
                                    <label for="reset-password" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                        New Password
                                    </label>
                                    <div class="relative group">
                                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                            <i class="fa-solid fa-lock text-sm" aria-hidden="true"></i>
                                        </div>
                                        <input
                                            :type="showPassword ? 'text' : 'password'"
                                            id="reset-password"
                                            name="password"
                                            v-model="password"
                                            required
                                            autocomplete="new-password"
                                            placeholder="At least 6 characters"
                                        >
                                        <button
                                            type="button"
                                            @click="showPassword = !showPassword"
                                            class="auth-toggle-password"
                                            :aria-label="showPassword ? 'Hide password' : 'Show password'"
                                        >
                                            <i class="text-sm" :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Confirm New Password -->
                                <div class="space-y-1.5">
                                    <label for="reset-password-confirmation" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                        Confirm New Password
                                    </label>
                                    <div class="relative group">
                                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                            <i class="fa-solid fa-shield-halved text-sm" aria-hidden="true"></i>
                                        </div>
                                        <input
                                            :type="showConfirmPassword ? 'text' : 'password'"
                                            id="reset-password-confirmation"
                                            name="password_confirmation"
                                            v-model="passwordConfirmation"
                                            required
                                            autocomplete="new-password"
                                            placeholder="Re-enter your new password"
                                        >
                                        <button
                                            type="button"
                                            @click="showConfirmPassword = !showConfirmPassword"
                                            class="auth-toggle-password"
                                            :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                                        >
                                            <i class="text-sm" :class="showConfirmPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Live Password Checklist -->
                                <div class="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1.5 text-xs">
                                    <div class="flex items-center gap-2" :class="isLengthValid ? 'text-emerald-700 font-medium' : 'text-stone-500'">
                                        <i class="fa-solid" :class="isLengthValid ? 'fa-circle-check text-emerald-600' : 'fa-circle text-[7px] text-stone-400'" aria-hidden="true"></i>
                                        <span>At least 6 characters</span>
                                    </div>
                                    <div class="flex items-center gap-2" :class="isMatchValid ? 'text-emerald-700 font-medium' : 'text-stone-500'">
                                        <i class="fa-solid" :class="isMatchValid ? 'fa-circle-check text-emerald-600' : 'fa-circle text-[7px] text-stone-400'" aria-hidden="true"></i>
                                        <span>Passwords match</span>
                                    </div>
                                </div>

                                <div class="pt-2">
                                    <button
                                        type="submit"
                                        id="reset-submit-button"
                                        :disabled="isLoading"
                                        class="shimmer-button auth-primary-btn"
                                    >
                                        <template v-if="isLoading">
                                            <i class="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true"></i>
                                            <span>Updating Password…</span>
                                        </template>
                                        <template v-else>
                                            <span>Reset Password</span>
                                            <i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
                                        </template>
                                    </button>
                                </div>
                            </form>
                        </template>
                    </div>
                </main>
            </div>
        </div>
    </div>
</template>
