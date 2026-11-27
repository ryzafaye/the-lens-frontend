<script setup>
import { ref, computed } from 'vue';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { submitPublicFeedback } from '../../services/api.js';
import { validateEmail, normalizeEmail } from '../../utils/validation.js';
import '../../assets/css/public/feedback.css';

const form = ref({
    name: '',
    email: '',
    subject: '',
    message: '',
});

const isSubmitting = ref(false);
const successMessage = ref('');
const errorMessage = ref('');
const emailError = ref('');

const messageCount = computed(() => {
    return form.value.message ? form.value.message.length : 0;
});

function validateEmailField() {
    const err = validateEmail(form.value.email, { required: false, maxLength: 150 });
    emailError.value = err;
    return !err;
}

function onEmailInput() {
    if (emailError.value) {
        validateEmailField();
    }
}

function resetForm() {
    form.value.name = '';
    form.value.email = '';
    form.value.subject = '';
    form.value.message = '';
    successMessage.value = '';
    errorMessage.value = '';
    emailError.value = '';
}

async function handleSubmit() {
    if (!validateEmailField()) {
        errorMessage.value = emailError.value;
        return;
    }

    if (!form.value.subject.trim() || !form.value.message.trim()) {
        errorMessage.value = 'Please provide both a subject and your message.';
        return;
    }

    isSubmitting.value = true;
    errorMessage.value = '';
    successMessage.value = '';

    try {
        const cleanedEmail = form.value.email.trim() ? normalizeEmail(form.value.email) : null;
        const payload = {
            name: form.value.name.trim() || null,
            email: cleanedEmail,
            subject: form.value.subject.trim(),
            message: form.value.message.trim(),
            category: 'editorial',
        };
        const res = await submitPublicFeedback(payload);
        successMessage.value = res?.message || 'Thank you for sharing your thoughts with the editorial board. Your message has been safely logged in the publication inbox.';
        form.value.name = '';
        form.value.email = '';
        form.value.subject = '';
        form.value.message = '';
        emailError.value = '';
        window.scrollTo({ top: 120, behavior: 'smooth' });
    } catch (err) {
        console.error('Failed to submit feedback:', err);
        const errData = err.response?.data;
        if (errData?.errors?.email) {
            emailError.value = Array.isArray(errData.errors.email)
                ? errData.errors.email[0]
                : errData.errors.email;
        }
        if (errData?.errors) {
            errorMessage.value = Object.values(errData.errors).flat().join(' ');
        } else {
            errorMessage.value = errData?.message || 'Failed to submit feedback. Please try again.';
        }
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <PublicLayout>
        <main class="feedback-page page-shell" data-page="feedback">
            <section class="feedback-main-grid" aria-labelledby="feedback-title">
                <!-- Intro Column -->
                <div class="feedback-intro-copy">
                    <div>
                        <p class="feedback-eyebrow">THE LENS PUBLICATION</p>
                        <h1 id="feedback-title">Feedback to the Editor</h1>
                        <p>
                            Have a suggestion, concern, correction, or thought about our coverage? Send a note to The Lens. We value respectful reader feedback that helps us serve the campus community better.
                        </p>
                        <div class="feedback-intro-rule" aria-hidden="true"><span></span></div>
                    </div>

                    <!-- Animated Envelope Scene -->
                    <div class="feedback-envelope-scene" aria-hidden="true">
                        <span class="feedback-envelope-spark feedback-envelope-spark-one">✦</span>
                        <span class="feedback-envelope-spark feedback-envelope-spark-two">✧</span>
                        <span class="feedback-envelope-spark feedback-envelope-spark-three">✦</span>
                        <div class="feedback-envelope-art">
                            <div class="feedback-envelope-letter">
                                <span></span><span></span><span></span>
                                <i class="fa-regular fa-heart"></i>
                            </div>
                            <div class="feedback-envelope-back"></div>
                            <div class="feedback-envelope-flap"></div>
                            <div class="feedback-envelope-front"></div>
                            <span class="feedback-envelope-seal"><i class="fa-regular fa-envelope"></i></span>
                        </div>
                    </div>

                    <p class="feedback-small-note">
                        <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                        <span>Your feedback helps us keep campus journalism open, thoughtful, and accountable.</span>
                    </p>
                </div>

                <!-- Form Card Column -->
                <div class="feedback-form-card">
                    <!-- Success State -->
                    <div v-if="successMessage" class="feedback-success" role="alert">
                        <span class="feedback-success-icon"><i class="fa-solid fa-check"></i></span>
                        <p class="feedback-success-eyebrow">MESSAGE SENT</p>
                        <h2>Your feedback has been received!</h2>
                        <p class="feedback-success-copy">
                            {{ successMessage }}
                        </p>
                        <button type="button" class="feedback-new-message" @click="resetForm">
                            Send another message
                        </button>
                    </div>

                    <!-- Feedback Form -->
                    <form v-else id="editor-feedback-form" class="editor-feedback-form" @submit.prevent="handleSubmit" novalidate>
                        <div class="feedback-form-heading">
                            <span class="feedback-form-icon">
                                <i class="fa-regular fa-paper-plane" aria-hidden="true"></i>
                            </span>
                            <div>
                                <h2>Send your message</h2>
                                <p>Fields marked with an asterisk (<span class="required-indicator">*</span>) are required.</p>
                            </div>
                        </div>

                        <!-- Error Alert -->
                        <div v-if="errorMessage" class="feedback-field-error mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                            <i class="fa-solid fa-circle-exclamation text-rose-600"></i>
                            <span>{{ errorMessage }}</span>
                        </div>

                        <div class="feedback-field">
                            <label for="feedback-name">
                                Name <span>(optional)</span>
                            </label>
                            <input
                                type="text"
                                id="feedback-name"
                                v-model="form.name"
                                maxlength="80"
                                autocomplete="name"
                                placeholder="Your name or pseudonym"
                            >
                        </div>

                        <div class="feedback-field">
                            <label for="feedback-email">
                                Email <span>(optional)</span>
                            </label>
                            <input
                                type="email"
                                id="feedback-email"
                                v-model="form.email"
                                @input="onEmailInput"
                                @blur="validateEmailField"
                                :class="{ 'is-invalid': !!emailError }"
                                maxlength="150"
                                autocomplete="email"
                                placeholder="you@example.com"
                            >
                            <p v-if="emailError" class="feedback-field-error">
                                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                <span> {{ emailError }}</span>
                            </p>
                        </div>

                        <div class="feedback-field">
                            <label for="feedback-subject">
                                Subject <span class="required-indicator">*</span>
                            </label>
                            <input
                                type="text"
                                id="feedback-subject"
                                v-model="form.subject"
                                maxlength="120"
                                required
                                placeholder="What is your feedback about?"
                            >
                        </div>

                        <div class="feedback-field">
                            <div class="feedback-message-label-row">
                                <label for="feedback-message">
                                    Message <span class="required-indicator">*</span>
                                </label>
                                <span id="feedback-message-count" class="feedback-character-count">
                                    {{ messageCount }} / 3000
                                </span>
                            </div>
                            <textarea
                                id="feedback-message"
                                v-model="form.message"
                                rows="6"
                                maxlength="3000"
                                required
                                placeholder="Write your feedback, tips, questions, or concerns here…"
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="feedback-submit-button"
                        >
                            <span>{{ isSubmitting ? 'Sending…' : 'Submit feedback' }}</span>
                            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                        </button>

                        <p class="feedback-privacy-note">
                            <i class="fa-solid fa-lock" aria-hidden="true"></i>
                            <span>Please avoid including sensitive personal credentials.</span>
                        </p>
                    </form>
                </div>
            </section>

            <!-- Direct Contact Methods -->
            <section class="feedback-contact-section" aria-labelledby="feedback-contact-title">
                <div class="feedback-contact-intro">
                    <p class="feedback-eyebrow">DIRECT CONTACT</p>
                    <h2 id="feedback-contact-title">
                        Reach The Lens directly.
                    </h2>
                    <p>You can also contact the publication through its official email or Facebook page.</p>
                </div>
                <div class="feedback-contact-methods">
                    <a class="feedback-contact-link" href="mailto:thelenspublicationpupbc@gmail.com">
                        <span class="feedback-contact-icon">
                            <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                        </span>
                        <span>
                            <small>EMAIL US</small>
                            <strong>thelenspublicationpupbc@gmail.com</strong>
                        </span>
                        <i class="fa-solid fa-arrow-up-right-from-square feedback-contact-arrow" aria-hidden="true"></i>
                    </a>
                    <a class="feedback-contact-link" href="https://www.facebook.com/profile.php?id=61560889387183" target="_blank" rel="noopener noreferrer">
                        <span class="feedback-contact-icon">
                            <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
                        </span>
                        <span>
                            <small>FACEBOOK PAGE</small>
                            <strong>The Lens Publication</strong>
                        </span>
                        <i class="fa-solid fa-arrow-up-right-from-square feedback-contact-arrow" aria-hidden="true"></i>
                    </a>
                </div>
            </section>
        </main>
    </PublicLayout>
</template>
