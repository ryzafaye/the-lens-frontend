<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { requestPasswordReset } from '../services/api.js';
import { validateEmail, normalizeEmail, extractApiErrorMessage } from '../utils/validation.js';
import '../assets/css/login.css';

const logoImg = '/images/logo.jpg';
const router = useRouter();

const STUDENT_NUMBER_REGEX = /^\d{4}-\d{5}-BN-0$/;

const studentNumber = ref('');
const studentNumberError = ref('');
const email = ref('');
const emailError = ref('');
const needsEmail = ref(false);
const accountHolderName = ref('');

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const emailSavedNotice = ref(false);
const isPageFlipped = ref(false);

function handlePageCurlClick() {
    isPageFlipped.value = true;
    setTimeout(() => {
        isPageFlipped.value = false;
    }, 1200);
}

function onStudentNumberInput(e) {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let formatted = '';

    if (val.length > 0) formatted += val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 9);
    if (val.length > 9) formatted += '-' + val.substring(9, 11);
    if (val.length > 11) formatted += '-' + val.substring(11, 12);

    studentNumber.value = formatted;
    e.target.value = formatted;

    if (studentNumberError.value) {
        validateStudentNumberField();
    }
}

function validateStudentNumberField() {
    const val = studentNumber.value.trim().toUpperCase();
    if (!val) {
        studentNumberError.value = 'Please enter your student number.';
        return false;
    }
    if (!STUDENT_NUMBER_REGEX.test(val)) {
        studentNumberError.value = 'Format must be YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0).';
        return false;
    }
    studentNumberError.value = '';
    return true;
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

function resetToStudentStep() {
    needsEmail.value = false;
    email.value = '';
    emailError.value = '';
    accountHolderName.value = '';
    errorMessage.value = '';
    successMessage.value = '';
    emailSavedNotice.value = false;
}

function startOver() {
    studentNumber.value = '';
    studentNumberError.value = '';
    resetToStudentStep();
}

async function handleSubmit() {
    if (isLoading.value) return;

    errorMessage.value = '';
    successMessage.value = '';

    if (!validateStudentNumberField()) {
        return;
    }

    if (needsEmail.value && !validateEmailField()) {
        return;
    }

    isLoading.value = true;
    try {
        const trimmedSn = studentNumber.value.trim().toUpperCase();
        const payload = {
            student_number: trimmedSn,
        };
        if (needsEmail.value) {
            payload.email = normalizeEmail(email.value);
        }

        const res = await requestPasswordReset(payload);

        if (res?.needs_email) {
            needsEmail.value = true;
            accountHolderName.value = res.full_name || '';
            emailError.value = '';
            return;
        }

        emailSavedNotice.value = Boolean(res?.email_saved);
        successMessage.value = res?.message || 'A password reset link has been sent to your registered email address.';
    } catch (error) {
        const errors = error.response?.data?.errors;
        if (errors?.student_number) {
            studentNumberError.value = Array.isArray(errors.student_number)
                ? errors.student_number[0]
                : errors.student_number;
        }
        if (errors?.email) {
            emailError.value = Array.isArray(errors.email)
                ? errors.email[0]
                : errors.email;
        }
        errorMessage.value = extractApiErrorMessage(error, 'Unable to process password reset request. Please try again.');
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

                <!-- Right Recovery Form Section -->
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
                                <i class="fa-regular fa-envelope-open" aria-hidden="true"></i>
                            </div>
                            <span class="auth-status-pill is-success">
                                <i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
                                <span>Reset Link Dispatched</span>
                            </span>
                            <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight mb-2">Check Your Inbox</h1>
                            <p class="auth-status-copy">
                                {{ successMessage }}
                            </p>

                            <div
                                v-if="emailSavedNotice"
                                class="w-full p-3.5 mb-5 rounded-xl text-xs bg-amber-50/90 text-amber-900 border border-amber-200 text-left flex items-start gap-2.5"
                            >
                                <i class="fa-solid fa-circle-info mt-0.5 text-amber-700" aria-hidden="true"></i>
                                <span>Your email address has also been saved to your system profile for future notifications.</span>
                            </div>

                            <div class="w-full space-y-2">
                                <button
                                    type="button"
                                    @click="router.push('/login')"
                                    class="shimmer-button auth-primary-btn"
                                >
                                    <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
                                    <span>Return to Sign In</span>
                                </button>
                                <button
                                    type="button"
                                    @click="startOver"
                                    class="auth-secondary-link"
                                >
                                    Use another student number
                                </button>
                            </div>
                        </div>

                        <!-- Form State -->
                        <template v-else>
                            <div class="mb-6">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase bg-rose-900/10 text-rose-900 mb-3">
                                    Account Recovery
                                </span>
                                <h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                                    Forgot Password
                                </h1>
                                <p class="mt-1.5 text-sm text-stone-500 leading-relaxed">
                                    {{
                                        needsEmail
                                            ? 'Register an email address to receive your reset link.'
                                            : 'Enter your student number and we will send a password reset link to your registered email.'
                                    }}
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

                            <form id="forgot-password-form" @submit.prevent="handleSubmit" class="space-y-4" novalidate>
                                <!-- Student Number Field -->
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between">
                                        <label for="forgot-student-number" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                            Student Number
                                        </label>
                                        <button
                                            v-if="needsEmail"
                                            type="button"
                                            @click="resetToStudentStep"
                                            class="text-xs font-medium text-wine hover:underline cursor-pointer"
                                        >
                                            Change
                                        </button>
                                    </div>
                                    <div class="relative group">
                                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                            <i class="fa-regular fa-id-card text-base" aria-hidden="true"></i>
                                        </div>
                                        <input
                                            type="text"
                                            id="forgot-student-number"
                                            name="student_number"
                                            :value="studentNumber"
                                            @input="onStudentNumberInput"
                                            @blur="validateStudentNumberField"
                                            :readonly="needsEmail"
                                            required
                                            autocomplete="username"
                                            placeholder="0000-00000-BN-0"
                                            maxlength="15"
                                            :class="{ 'auth-input-invalid': !!studentNumberError }"
                                        >
                                    </div>
                                    <p v-if="studentNumberError" class="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                                        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                        <span>{{ studentNumberError }}</span>
                                    </p>
                                </div>

                                <!-- Missing Email Prompt Step -->
                                <template v-if="needsEmail">
                                    <div class="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5">
                                        <i class="fa-solid fa-envelope-circle-check text-wine mt-0.5 text-sm" aria-hidden="true"></i>
                                        <div>
                                            <p class="font-semibold text-stone-900 mb-0.5">
                                                No email address found{{ accountHolderName ? ` for ${accountHolderName}` : '' }}.
                                            </p>
                                            <p class="text-stone-700">
                                                Please enter your email address below. We will also save this email in the system as your official account email.
                                            </p>
                                        </div>
                                    </div>

                                    <div class="space-y-1.5">
                                        <label for="forgot-email" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">
                                            Email Address *
                                        </label>
                                        <div class="relative group">
                                            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-rose-900 transition-colors">
                                                <i class="fa-regular fa-envelope text-sm" aria-hidden="true"></i>
                                            </div>
                                            <input
                                                type="email"
                                                id="forgot-email"
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
                                </template>

                                <div class="pt-2">
                                    <button
                                        type="submit"
                                        id="forgot-submit-button"
                                        :disabled="isLoading"
                                        class="shimmer-button auth-primary-btn"
                                    >
                                        <template v-if="isLoading">
                                            <i class="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true"></i>
                                            <span>{{ needsEmail ? 'Saving Email & Sending Link…' : 'Checking Account…' }}</span>
                                        </template>
                                        <template v-else>
                                            <span>{{ needsEmail ? 'Save Email & Send Reset Link' : 'Send Reset Link' }}</span>
                                            <i class="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
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
