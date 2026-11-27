<script setup>
import { ref, computed, onMounted } from 'vue';
import WriterLayout from '../../layouts/WriterLayout.vue';
import { getUser, updateProfileInfo, updatePassword } from '../../services/api.js';
import { setAuthUser } from '../../stores/auth.js';
import { optimizeCloudinaryUrl, resolveUserAvatar } from '../../utils/image.js';
import { validateEmail, normalizeEmail, extractApiErrorMessage } from '../../utils/validation.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/shared-profile-settings.css';

// State
const isLoading = ref(true);

// Profile form state
const fullName = ref('');
const studentNumber = ref('');
const email = ref('');
const emailError = ref('');
const userRole = ref('Writer');
const avatarPreview = ref('/images/member-placeholder.svg');
const avatarFile = ref(null);
const removeAvatar = ref(false);
const fileInputRef = ref(null);
const isSavingProfile = ref(false);

// Password form state
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const isSavingPassword = ref(false);

// Toast replacement
function showToast(msg, type = 'success') {
    globalShowToast(msg, type);
}

// Password criteria checks
const isLengthValid = computed(() => {
    return newPassword.value.length >= 6;
});

const isMatchValid = computed(() => {
    return newPassword.value.length > 0 && newPassword.value === confirmPassword.value;
});

const isCurrentPasswordEntered = computed(() => {
    return currentPassword.value.length > 0;
});

const canSubmitPassword = computed(() => {
    return isCurrentPasswordEntered.value && isLengthValid.value && isMatchValid.value && !isSavingPassword.value;
});

// Avatar URL resolver: ensures Cloudinary and relative URLs render cleanly
function resolveAvatarUrl(url) {
    return resolveUserAvatar(url);
}

const computedAvatarSrc = computed(() => {
    return resolveAvatarUrl(avatarPreview.value);
});

// Avatar handlers
function triggerAvatarUpload() {
    if (fileInputRef.value) {
        fileInputRef.value.click();
    }
}

function onAvatarFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate avatar max file size (3072 KB = 3MB)
    if (file.size > 3072 * 1024) {
        showToast('Image file too large. Please select an image under 3MB.', 'danger');
        e.target.value = '';
        return;
    }

    avatarFile.value = file;
    removeAvatar.value = false;

    const reader = new FileReader();
    reader.onload = (event) => {
        avatarPreview.value = event.target.result;
    };
    reader.readAsDataURL(file);
}

function onResetAvatar() {
    avatarFile.value = null;
    removeAvatar.value = true;
    avatarPreview.value = '/images/member-placeholder.svg';
    if (fileInputRef.value) fileInputRef.value.value = '';
    showToast('Photo marked for removal. Click Save Changes to confirm.', 'info');
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

// Submit Profile Info
async function handleUpdateProfile() {
    if (!fullName.value.trim() || !studentNumber.value.trim()) {
        showToast('Please fill in Full Name and Student Number.', 'danger');
        return;
    }
    if (!validateEmailField()) {
        showToast(emailError.value || 'Please enter a valid email address.', 'danger');
        return;
    }

    const cleanedEmail = normalizeEmail(email.value);
    email.value = cleanedEmail;

    const confirmed = await confirmAction({
        title: 'Save Profile Changes',
        message: 'Are you sure you want to update your profile information?',
        confirmText: 'Save Profile',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSavingProfile.value = true;

    try {
        const formData = new FormData();
        formData.append('full_name', fullName.value.trim());
        formData.append('student_number', studentNumber.value.trim());
        formData.append('email', cleanedEmail);

        if (avatarFile.value) {
            formData.append('avatar', avatarFile.value);
        } else if (removeAvatar.value) {
            formData.append('remove_avatar', '1');
        }

        const res = await updateProfileInfo(formData);
        showToast(res.message || 'Profile updated successfully!', 'success');

        const freshAvatar = res.profile_picture_url || res.user?.profile_picture_url || res.user?.avatar_url;
        const freshName = res.user?.full_name || fullName.value.trim();
        const freshStudent = res.user?.student_number || studentNumber.value.trim();
        const freshEmail = res.user?.email || cleanedEmail;
        email.value = freshEmail;
        emailError.value = '';

        if (removeAvatar.value) {
            avatarPreview.value = '/images/member-placeholder.svg';
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
                email: freshEmail,
                avatar_url: '/images/member-placeholder.svg',
                profile_picture_url: null,
            });
        } else if (freshAvatar) {
            avatarPreview.value = resolveAvatarUrl(freshAvatar);
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
                email: freshEmail,
                avatar_url: freshAvatar,
                profile_picture_url: freshAvatar,
            });
        } else {
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
                email: freshEmail,
            });
        }

        removeAvatar.value = false;
        avatarFile.value = null;
        if (fileInputRef.value) fileInputRef.value.value = '';
    } catch (err) {
        if (err.response?.data?.errors?.email) {
            emailError.value = Array.isArray(err.response.data.errors.email)
                ? err.response.data.errors.email[0]
                : err.response.data.errors.email;
        }
        const errMsg = extractApiErrorMessage(err, 'Failed to update profile.');
        showToast(errMsg, 'danger');
    } finally {
        isSavingProfile.value = false;
    }
}

// Submit Password Change
async function handleUpdatePassword() {
    if (!currentPassword.value) {
        showToast('Please enter your current password.', 'error');
        return;
    }
    if (!isLengthValid.value) {
        showToast('New password must be at least 6 characters.', 'error');
        return;
    }
    if (!isMatchValid.value) {
        showToast('New and confirm passwords must match.', 'error');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Update Password',
        message: 'Are you sure you want to change your account password?',
        confirmText: 'Change Password',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSavingPassword.value = true;

    try {
        const res = await updatePassword(
            currentPassword.value,
            newPassword.value,
            confirmPassword.value
        );
        showToast(res.message || 'Password changed successfully.', 'success');
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (err) {
        const errMsg = err.response?.data?.errors?.current_password?.[0]
            || err.response?.data?.errors?.new_password?.[0]
            || err.response?.data?.message
            || 'Failed to update password. Please check your current password.';
        showToast(errMsg, 'error');
    } finally {
        isSavingPassword.value = false;
    }
}

onMounted(async () => {
    // Immediate zero-latency hydration from localStorage
    const cachedName = localStorage.getItem('userName');
    const cachedStudent = localStorage.getItem('studentNumber');
    const cachedEmail = localStorage.getItem('userEmail');
    const cachedAvatar = localStorage.getItem('userAvatar');
    if (cachedName) fullName.value = cachedName;
    if (cachedStudent) studentNumber.value = cachedStudent;
    if (cachedEmail) email.value = cachedEmail;
    if (cachedAvatar) avatarPreview.value = resolveAvatarUrl(cachedAvatar);

    try {
        const data = await getUser();
        if (data?.user) {
            fullName.value = data.user.full_name || data.user.name || '';
            studentNumber.value = data.user.student_number || data.user.studentNumber || '';
            email.value = data.user.email || '';
            userRole.value = data.user.role?.role_name || data.user.role || 'Writer';
            const userAvatar = data.user.profile_picture_url || data.user.avatar_url || data.user.avatarUrl;
            if (userAvatar) {
                avatarPreview.value = resolveAvatarUrl(userAvatar);
            }
            setAuthUser(data.user);
        }
    } catch (err) {
        console.warn('Could not fetch user profile:', err);
    } finally {
        isLoading.value = false;
    }
});
</script>

<template>
    <WriterLayout>
        <main class="content-container">
            <div class="profile-settings-container">
                <!-- Page Header (Adjusted with subtitle removed) -->
                <div class="profile-header-row">
                    <div class="profile-title-wrap">
                        <h1 class="page-title">Profile Settings</h1>
                    </div>
                </div>

                <!-- 2-Column Responsive Settings Grid -->
                <div class="profile-settings-grid">
                    <!-- CARD 1: WRITER PROFILE INFORMATION -->
                    <section class="settings-card" aria-labelledby="writer-info-heading">
                        <div class="settings-card-header">
                            <div class="settings-card-icon">
                                <i class="fa-regular fa-id-badge"></i>
                            </div>
                            <div class="settings-card-titles">
                                <h2 id="writer-info-heading">Writer Profile</h2>
                                <p>Update your personal details and author profile photo.</p>
                            </div>
                        </div>

                        <form id="profile-info-form" @submit.prevent="handleUpdateProfile" class="settings-card-body" novalidate>
                            <!-- Profile Picture Upload Row -->
                            <div class="profile-avatar-row">
                                <div class="avatar-preview-wrapper">
                                    <img
                                        id="avatar-preview-img"
                                        class="avatar-preview-img"
                                        :src="computedAvatarSrc"
                                        alt="Writer Avatar"
                                    >
                                </div>
                                <div class="avatar-upload-info">
                                    <span class="settings-label">Profile Picture</span>
                                    <div class="avatar-actions-group">
                                        <button
                                            type="button"
                                            id="btn-change-avatar"
                                            class="btn-upload-avatar"
                                            @click="triggerAvatarUpload"
                                        >
                                            <i class="fa-solid fa-arrow-up-from-bracket"></i>
                                            <span>Upload Photo</span>
                                        </button>

                                        <button
                                            type="button"
                                            id="btn-reset-avatar"
                                            class="btn-reset-avatar"
                                            @click="onResetAvatar"
                                            title="Reset to default placeholder"
                                        >
                                            <i class="fa-regular fa-trash-can"></i>
                                            <span>Remove</span>
                                        </button>

                                        <!-- Hidden Native File Input -->
                                        <input
                                            ref="fileInputRef"
                                            type="file"
                                            id="avatar-file-input"
                                            name="avatar"
                                            accept="image/png, image/jpeg, image/webp"
                                            style="display: none;"
                                            @change="onAvatarFileChange"
                                            aria-label="Upload writer profile picture"
                                        >
                                    </div>
                                    <p class="avatar-hint-text">Supported formats: JPG, PNG, or WEBP (Max 3MB).</p>
                                </div>
                            </div>

                            <!-- Student Number Field -->
                            <div class="settings-field-group">
                                <label for="input-student-number" class="settings-label">
                                    <span>Student Number <span class="req">*</span></span>
                                </label>
                                <input
                                    type="text"
                                    id="input-student-number"
                                    v-model="studentNumber"
                                    class="settings-input"
                                    placeholder="Enter your student number"
                                    required
                                    maxlength="30"
                                    autocomplete="off"
                                >
                            </div>

                            <!-- Full Name Field -->
                            <div class="settings-field-group">
                                <label for="input-full-name" class="settings-label">
                                    <span>Full Name <span class="req">*</span></span>
                                </label>
                                <input
                                    type="text"
                                    id="input-full-name"
                                    v-model="fullName"
                                    class="settings-input"
                                    placeholder="Enter your full name"
                                    required
                                    maxlength="80"
                                    autocomplete="name"
                                >
                            </div>

                            <!-- Email Address Field -->
                            <div class="settings-field-group">
                                <label for="input-email" class="settings-label">
                                    <span>Email Address <span class="req">*</span></span>
                                </label>
                                <input
                                    type="email"
                                    id="input-email"
                                    v-model="email"
                                    @input="onEmailInput"
                                    @blur="validateEmailField"
                                    class="settings-input"
                                    :class="{ 'is-invalid': !!emailError }"
                                    placeholder="Enter your email address"
                                    required
                                    maxlength="255"
                                    autocomplete="email"
                                >
                                <p v-if="emailError" class="settings-field-error">
                                    <i class="fa-solid fa-circle-exclamation"></i>
                                    <span>{{ emailError }}</span>
                                </p>
                            </div>

                            <!-- Role Field -->
                            <div class="settings-field-group">
                                <label for="input-officer-role" class="settings-label">
                                    <span>Role</span>
                                </label>
                                <input
                                    type="text"
                                    id="input-officer-role"
                                    class="settings-input"
                                    :value="userRole"
                                    readonly
                                    disabled
                                >
                            </div>

                            <!-- Submit Action -->
                            <div class="card-actions-row">
                                <button
                                    type="submit"
                                    id="btn-save-profile"
                                    class="btn-save-primary"
                                    :disabled="isSavingProfile"
                                >
                                    <i class="fa-solid fa-check"></i>
                                    <span>{{ isSavingProfile ? 'Saving…' : 'Save Changes' }}</span>
                                </button>
                            </div>
                        </form>
                    </section>

                    <!-- CARD 2: SECURITY & PASSWORD -->
                    <section class="settings-card" aria-labelledby="security-heading">
                        <div class="settings-card-header">
                            <div class="settings-card-icon">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <div class="settings-card-titles">
                                <h2 id="security-heading">Account Security</h2>
                                <p>Ensure your account remains safe with a strong password.</p>
                            </div>
                        </div>

                        <form id="password-form" @submit.prevent="handleUpdatePassword" class="settings-card-body" novalidate>
                            <!-- Current Password -->
                            <div class="settings-field-group">
                                <label for="input-current-password" class="settings-label">
                                    <span>Current Password <span class="req">*</span></span>
                                </label>
                                <div class="password-input-wrapper">
                                    <input
                                        :type="showCurrentPassword ? 'text' : 'password'"
                                        id="input-current-password"
                                        v-model="currentPassword"
                                        class="settings-input"
                                        placeholder="Enter current password"
                                        required
                                        autocomplete="current-password"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle-btn"
                                        @click="showCurrentPassword = !showCurrentPassword"
                                        aria-label="Toggle current password visibility"
                                    >
                                        <i class="fa-regular" :class="showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- New Password -->
                            <div class="settings-field-group">
                                <label for="input-new-password" class="settings-label">
                                    <span>New Password <span class="req">*</span></span>
                                </label>
                                <div class="password-input-wrapper">
                                    <input
                                        :type="showNewPassword ? 'text' : 'password'"
                                        id="input-new-password"
                                        v-model="newPassword"
                                        class="settings-input"
                                        placeholder="Enter new password (min. 6 characters)"
                                        required
                                        minlength="6"
                                        autocomplete="new-password"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle-btn"
                                        @click="showNewPassword = !showNewPassword"
                                        aria-label="Toggle new password visibility"
                                    >
                                        <i class="fa-regular" :class="showNewPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Confirm Password -->
                            <div class="settings-field-group">
                                <label for="input-confirm-password" class="settings-label">
                                    <span>Confirm New Password <span class="req">*</span></span>
                                </label>
                                <div class="password-input-wrapper">
                                    <input
                                        :type="showConfirmPassword ? 'text' : 'password'"
                                        id="input-confirm-password"
                                        v-model="confirmPassword"
                                        class="settings-input"
                                        placeholder="Re-enter new password"
                                        required
                                        minlength="6"
                                        autocomplete="new-password"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle-btn"
                                        @click="showConfirmPassword = !showConfirmPassword"
                                        aria-label="Toggle confirm password visibility"
                                    >
                                        <i class="fa-regular" :class="showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Password Requirement Checklist -->
                            <div class="password-criteria-list" aria-live="polite">
                                <div
                                    class="password-criteria-item"
                                    :class="{ met: isLengthValid, 'unmet-error': newPassword && !isLengthValid }"
                                    id="crit-length"
                                >
                                    <i :class="isLengthValid ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i>
                                    <span>Minimum 6 characters</span>
                                </div>
                                <div
                                    class="password-criteria-item"
                                    :class="{ met: isMatchValid, 'unmet-error': confirmPassword && !isMatchValid }"
                                    id="crit-match"
                                >
                                    <i :class="isMatchValid ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i>
                                    <span>New and confirm passwords must match</span>
                                </div>
                            </div>

                            <!-- Submit Action -->
                            <div class="card-actions-row">
                                <button
                                    type="submit"
                                    id="btn-update-password"
                                    class="btn-update-maroon"
                                    :disabled="isSavingPassword"
                                >
                                    <i class="fa-solid fa-key"></i>
                                    <span>{{ isSavingPassword ? 'Updating…' : 'Update Password' }}</span>
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </main>
    </WriterLayout>
</template>
