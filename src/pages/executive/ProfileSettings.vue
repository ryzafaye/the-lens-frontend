<script setup>
import { ref, computed, onMounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getUser,
    updateProfileInfo,
    updatePassword,
} from '../../services/api.js';
import { setAuthUser, currentUser } from '../../stores/auth.js';
import { optimizeCloudinaryUrl, resolveUserAvatar } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/shared-profile-settings.css';

// State
const isLoading = ref(true);

// Profile form state
const fullName = ref('');
const studentNumber = ref('');
const userRole = ref('Executive Officer');
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

function resolveAvatarUrl(url) {
    return resolveUserAvatar(url);
}

async function loadProfile() {
    isLoading.value = true;
    try {
        const data = await getUser(true);
        const u = data?.user || data;
        if (u) {
            fullName.value = u.full_name || u.name || '';
            studentNumber.value = u.student_number || u.studentNumber || '';
            userRole.value = u.role?.role_name || u.role || 'Executive';
            avatarPreview.value = resolveAvatarUrl(u.avatar_url || u.avatar || u.profile_picture_url);
            setAuthUser(u);
        }
    } catch (err) {
        console.error('Failed to load user profile:', err);
        showToast('Failed to load profile details.', 'error');
    } finally {
        isLoading.value = false;
    }
}

function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'error');
        return;
    }
    if (file.size > 3 * 1024 * 1024) {
        showToast('Image size cannot exceed 3MB.', 'error');
        return;
    }

    avatarFile.value = file;
    removeAvatar.value = false;
    avatarPreview.value = URL.createObjectURL(file);
}

function triggerFileInput() {
    if (fileInputRef.value) {
        fileInputRef.value.click();
    }
}

async function handleRemoveAvatar() {
    avatarFile.value = null;
    removeAvatar.value = true;
    avatarPreview.value = '/images/member-placeholder.svg';
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
}

async function handleSaveProfile() {
    if (isSavingProfile.value) return;

    if (!fullName.value.trim()) {
        showToast('Full name is required.', 'error');
        return;
    }

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
        if (studentNumber.value.trim()) {
            formData.append('student_number', studentNumber.value.trim());
        }

        if (avatarFile.value) {
            formData.append('avatar', avatarFile.value);
        } else if (removeAvatar.value) {
            formData.append('remove_avatar', '1');
        }

        const res = await updateProfileInfo(formData);
        showToast(res.message || 'Profile information updated successfully.', 'success');

        const freshAvatar = res.profile_picture_url || res.user?.profile_picture_url || res.user?.avatar_url;
        const freshName = res.user?.full_name || fullName.value.trim();
        const freshStudent = res.user?.student_number || studentNumber.value.trim();

        if (removeAvatar.value) {
            avatarPreview.value = '/images/member-placeholder.svg';
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
                avatar_url: '/images/member-placeholder.svg',
                profile_picture_url: null,
            });
        } else if (freshAvatar) {
            avatarPreview.value = resolveAvatarUrl(freshAvatar);
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
                avatar_url: freshAvatar,
                profile_picture_url: freshAvatar,
            });
        } else {
            setAuthUser({
                full_name: freshName,
                student_number: freshStudent,
            });
        }

        removeAvatar.value = false;
        avatarFile.value = null;
    } catch (err) {
        console.error('Failed to save profile:', err);
        showToast(err.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
        isSavingProfile.value = false;
    }
}

async function handleSavePassword() {
    if (!canSubmitPassword.value) return;

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
        const res = await updatePassword({
            current_password: currentPassword.value,
            new_password: newPassword.value,
            new_password_confirmation: confirmPassword.value,
        });

        showToast(res.message || 'Password updated successfully.', 'success');
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (err) {
        console.error('Failed to update password:', err);
        const msg = err.response?.data?.errors?.current_password?.[0]
            || err.response?.data?.message
            || 'Failed to update password. Please check your current password.';
        showToast(msg, 'error');
    } finally {
        isSavingPassword.value = false;
    }
}

onMounted(() => {
    loadProfile();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Toast notification -->
            <transition name="fade">
                <div v-if="toastMessage" class="toast-container">
                    <div class="toast-message" :class="toastType">
                        <i :class="toastType === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
                        <span>{{ toastMessage }}</span>
                    </div>
                </div>
            </transition>

            <div class="profile-settings-container">
                <!-- Page Header -->
                <div class="settings-page-header">
                    <h1 class="settings-page-title">Profile Settings</h1>
                    <p class="settings-page-subtitle">Manage your account information, public editorial byline, and credentials.</p>
                </div>

                <div class="settings-grid">
                    <!-- Section 1: Profile & Avatar Information -->
                    <div class="settings-card">
                        <div class="settings-card-header">
                            <h2 class="settings-card-title">Editorial Identity</h2>
                            <p class="settings-card-desc">Your official name and avatar as shown across all publication bylines.</p>
                        </div>

                        <form class="settings-form" @submit.prevent="handleSaveProfile">
                            <!-- Avatar Preview & Actions -->
                            <div class="avatar-upload-row">
                                <div class="avatar-preview-circle">
                                    <img :src="avatarPreview" alt="Profile Avatar" loading="lazy">
                                </div>
                                <div class="avatar-controls">
                                    <button type="button" class="btn-avatar-upload" @click="triggerFileInput">
                                        <i class="fa-solid fa-arrow-up-from-bracket"></i>
                                        <span>Upload New Photo</span>
                                    </button>
                                    <button type="button" class="btn-avatar-remove" @click="handleRemoveAvatar">
                                        <span>Remove Photo</span>
                                    </button>
                                    <input
                                        ref="fileInputRef"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/jpg"
                                        style="display: none;"
                                        @change="handleFileChange"
                                    >
                                    <p class="avatar-hint">JPG, PNG, or WebP. Max size: 2MB.</p>
                                </div>
                            </div>

                            <!-- Full Name -->
                            <div class="form-group">
                                <label for="profile-full-name" class="form-label">Full Name *</label>
                                <input
                                    id="profile-full-name"
                                    v-model="fullName"
                                    type="text"
                                    class="form-control"
                                    placeholder="e.g. Maria Santos"
                                    required
                                >
                            </div>

                            <!-- Student Number (Read-Only) -->
                            <div class="form-group">
                                <label for="profile-student-number" class="form-label">Student Number</label>
                                <input
                                    id="profile-student-number"
                                    v-model="studentNumber"
                                    type="text"
                                    class="form-control"
                                    readonly
                                    disabled
                                    style="background-color: #f8fafc; cursor: not-allowed;"
                                >
                                <p class="form-hint">Student numbers are bound to your student account and cannot be modified.</p>
                            </div>

                            <!-- Role (Read-Only) -->
                            <div class="form-group">
                                <label for="profile-role" class="form-label">Designated Role</label>
                                <input
                                    id="profile-role"
                                    v-model="userRole"
                                    type="text"
                                    class="form-control"
                                    readonly
                                    disabled
                                    style="background-color: #f8fafc; cursor: not-allowed;"
                                >
                            </div>

                            <div class="settings-form-footer">
                                <button
                                    type="submit"
                                    class="btn-save-settings"
                                    :disabled="isSavingProfile"
                                >
                                    <i v-if="isSavingProfile" class="fa-solid fa-spinner fa-spin"></i>
                                    <span>{{ isSavingProfile ? 'Saving...' : 'Save Changes' }}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Section 2: Password Security -->
                    <div class="settings-card">
                        <div class="settings-card-header">
                            <h2 class="settings-card-title">Security &amp; Password</h2>
                            <p class="settings-card-desc">Keep your publication account secure by updating your password regularly.</p>
                        </div>

                        <form class="settings-form" @submit.prevent="handleSavePassword">
                            <!-- Current Password -->
                            <div class="form-group">
                                <label for="current-password" class="form-label">Current Password *</label>
                                <div class="password-input-wrapper">
                                    <input
                                        id="current-password"
                                        v-model="currentPassword"
                                        :type="showCurrentPassword ? 'text' : 'password'"
                                        class="form-control"
                                        placeholder="Enter your current password"
                                        required
                                    >
                                    <button
                                        type="button"
                                        class="toggle-password-btn"
                                        tabindex="-1"
                                        @click="showCurrentPassword = !showCurrentPassword"
                                    >
                                        <i :class="showCurrentPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- New Password -->
                            <div class="form-group">
                                <label for="new-password" class="form-label">New Password *</label>
                                <div class="password-input-wrapper">
                                    <input
                                        id="new-password"
                                        v-model="newPassword"
                                        :type="showNewPassword ? 'text' : 'password'"
                                        class="form-control"
                                        placeholder="Minimum 6 characters"
                                        required
                                    >
                                    <button
                                        type="button"
                                        class="toggle-password-btn"
                                        tabindex="-1"
                                        @click="showNewPassword = !showNewPassword"
                                    >
                                        <i :class="showNewPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Confirm Password -->
                            <div class="form-group">
                                <label for="confirm-password" class="form-label">Confirm New Password *</label>
                                <div class="password-input-wrapper">
                                    <input
                                        id="confirm-password"
                                        v-model="confirmPassword"
                                        :type="showConfirmPassword ? 'text' : 'password'"
                                        class="form-control"
                                        placeholder="Re-type new password"
                                        required
                                    >
                                    <button
                                        type="button"
                                        class="toggle-password-btn"
                                        tabindex="-1"
                                        @click="showConfirmPassword = !showConfirmPassword"
                                    >
                                        <i :class="showConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Password Requirement Pills -->
                            <div class="password-criteria-list">
                                <div class="criteria-item" :class="{ 'valid': isLengthValid }">
                                    <i :class="isLengthValid ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-regular fa-circle text-stone-400'"></i>
                                    <span>At least 6 characters long</span>
                                </div>
                                <div class="criteria-item" :class="{ 'valid': isMatchValid }">
                                    <i :class="isMatchValid ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-regular fa-circle text-stone-400'"></i>
                                    <span>Passwords match</span>
                                </div>
                            </div>

                            <div class="settings-form-footer">
                                <button
                                    type="submit"
                                    class="btn-save-settings"
                                    :disabled="!canSubmitPassword"
                                >
                                    <i v-if="isSavingPassword" class="fa-solid fa-spinner fa-spin"></i>
                                    <span>{{ isSavingPassword ? 'Updating...' : 'Update Password' }}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    </ExecutiveLayout>
</template>
