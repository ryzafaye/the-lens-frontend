<script setup>
import { computed, ref } from 'vue';
import PageHead from '../../Components/PageHead.vue';
import { useApiForm } from '../../composables/useApiForm.js';
import { useAppState } from '../../state/appState.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const page = useAppState();
const user = computed(() => page.props.auth?.user ?? {});
const avatarInput = ref(null);
const avatarPreview = ref(user.value.avatarUrl ?? '/images/member-placeholder.svg');
const profileForm = useApiForm({
    full_name: user.value.name ?? '',
    student_number: user.value.studentNumber ?? '',
    avatar: null,
    remove_avatar: '0',
});
const passwordForm = useApiForm({ current_password: '', new_password: '', new_password_confirmation: '' });
const passwordVisibility = ref({ current: false, next: false, confirm: false });
const passwordLongEnough = computed(() => passwordForm.new_password.length >= 6);
const passwordsMatch = computed(() => passwordForm.new_password.length > 0 && passwordForm.new_password === passwordForm.new_password_confirmation);

function selectAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024 || !file.type.startsWith('image/')) {
        event.target.value = '';
        return;
    }
    profileForm.avatar = file;
    profileForm.remove_avatar = '0';
    avatarPreview.value = URL.createObjectURL(file);
}

function removeAvatar() {
    profileForm.avatar = null;
    profileForm.remove_avatar = '1';
    if (avatarInput.value) avatarInput.value.value = '';
    avatarPreview.value = '/images/member-placeholder.svg';
}

function saveProfile() {
    profileForm.post('/profile/update-info', {
        forceFormData: true,
        preserveScroll: true,
        onSuccess: () => { avatarPreview.value = page.props.auth?.user?.avatarUrl ?? '/images/member-placeholder.svg'; },
    });
}

function updatePassword() {
    passwordForm.post('/profile/update-password', {
        preserveScroll: true,
        onSuccess: () => passwordForm.reset(),
    });
}
</script>

<template>
    <AdminLayout title="Profile Settings">
        <PageHead>
            <link rel="stylesheet" href="/css/shared-profile-settings.css">
            <link rel="stylesheet" href="/css/executive-profile-settings.css">
        </PageHead>
        <div class="profile-settings-container">
            <div class="profile-header-row"><div class="profile-title-wrap"><h1>Profile Settings</h1><p>Manage your personal details, assigned desk, and account security.</p></div></div>
            <div v-if="page.props.flash?.success" class="settings-notice" role="status">{{ page.props.flash.success }}</div>
            <div class="profile-settings-grid">
                <section class="settings-card" aria-labelledby="profile-info-heading">
                    <div class="settings-card-header"><div class="settings-card-icon"><i class="fa-regular fa-id-badge" aria-hidden="true"></i></div><div class="settings-card-titles"><h2 id="profile-info-heading">Profile Information</h2><p>Update your personal details and author profile photo.</p></div></div>
                    <form class="settings-card-body" @submit.prevent="saveProfile">
                        <div class="profile-avatar-row"><div class="avatar-preview-wrapper"><img class="avatar-preview-img" :src="avatarPreview" alt="Profile picture preview"></div><div class="avatar-upload-info"><span class="settings-label">Profile Picture</span><div class="avatar-actions-group"><button type="button" class="btn-upload-avatar" @click="avatarInput?.click()"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i><span>Upload Photo</span></button><button type="button" class="btn-reset-avatar" @click="removeAvatar"><i class="fa-regular fa-trash-can" aria-hidden="true"></i><span>Remove</span></button><input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Upload profile picture" @change="selectAvatar"></div><p class="avatar-hint-text">Supported formats: JPG, PNG, or WEBP. Maximum 3 MB.</p></div></div>
                        <div class="settings-field-group"><label for="input-student-number" class="settings-label">Student Number <span class="req">*</span></label><input id="input-student-number" v-model="profileForm.student_number" class="settings-input" placeholder="Enter your student number" required maxlength="30" autocomplete="off"><p v-if="profileForm.errors.student_number" class="settings-error">{{ profileForm.errors.student_number }}</p></div>
                        <div class="settings-field-group"><label for="input-full-name" class="settings-label">Full Name <span class="req">*</span></label><input id="input-full-name" v-model="profileForm.full_name" class="settings-input" placeholder="Enter your full name" required maxlength="80" autocomplete="name"><p v-if="profileForm.errors.full_name" class="settings-error">{{ profileForm.errors.full_name }}</p></div>
                        <div class="settings-field-group"><label for="input-profile-role" class="settings-label">Role</label><input id="input-profile-role" class="settings-input" readonly :value="user.role ?? 'Member'" aria-readonly="true"></div>
                        <div class="card-actions-row"><button type="submit" class="btn-update-maroon" :disabled="profileForm.processing"><i class="fa-solid fa-check" aria-hidden="true"></i><span>{{ profileForm.processing ? 'Saving…' : 'Save Profile' }}</span></button></div>
                    </form>
                </section>
                <section class="settings-card" aria-labelledby="security-heading">
                    <div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></div><div class="settings-card-titles"><h2 id="security-heading">Password &amp; Security</h2><p>Manage your account password and security credentials.</p></div></div>
                    <form class="settings-card-body" @submit.prevent="updatePassword">
                        <div class="settings-field-group"><label for="input-current-password" class="settings-label">Current Password <span class="req">*</span></label><div class="password-input-wrapper"><input id="input-current-password" v-model="passwordForm.current_password" :type="passwordVisibility.current ? 'text' : 'password'" class="settings-input" placeholder="Enter current password" required autocomplete="current-password"><button type="button" class="password-toggle-btn" aria-label="Toggle current password visibility" @click="passwordVisibility.current = !passwordVisibility.current"><i :class="passwordVisibility.current ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i></button></div><p v-if="passwordForm.errors.current_password" class="settings-error">{{ passwordForm.errors.current_password }}</p></div>
                        <div class="settings-field-group"><label for="input-new-password" class="settings-label">New Password <span class="req">*</span></label><div class="password-input-wrapper"><input id="input-new-password" v-model="passwordForm.new_password" :type="passwordVisibility.next ? 'text' : 'password'" class="settings-input" placeholder="Enter new password" required minlength="6" autocomplete="new-password"><button type="button" class="password-toggle-btn" aria-label="Toggle new password visibility" @click="passwordVisibility.next = !passwordVisibility.next"><i :class="passwordVisibility.next ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i></button></div><p v-if="passwordForm.errors.new_password" class="settings-error">{{ passwordForm.errors.new_password }}</p></div>
                        <div class="settings-field-group"><label for="input-confirm-password" class="settings-label">Confirm New Password <span class="req">*</span></label><div class="password-input-wrapper"><input id="input-confirm-password" v-model="passwordForm.new_password_confirmation" :type="passwordVisibility.confirm ? 'text' : 'password'" class="settings-input" placeholder="Confirm new password" required minlength="6" autocomplete="new-password"><button type="button" class="password-toggle-btn" aria-label="Toggle confirmation visibility" @click="passwordVisibility.confirm = !passwordVisibility.confirm"><i :class="passwordVisibility.confirm ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i></button></div></div>
                        <div class="password-criteria-list"><div class="password-criteria-item" :class="{ 'is-valid': passwordLongEnough }"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>Minimum 6 characters</span></div><div class="password-criteria-item" :class="{ 'is-valid': passwordsMatch }"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>New and confirm passwords must match</span></div></div>
                        <div class="card-actions-row"><button type="submit" class="btn-update-maroon" :disabled="passwordForm.processing"><i class="fa-solid fa-key" aria-hidden="true"></i><span>{{ passwordForm.processing ? 'Updating…' : 'Update Password' }}</span></button></div>
                    </form>
                </section>
            </div>
        </div>
    </AdminLayout>
</template>

<style scoped>
.settings-notice { margin: 0 0 20px; padding: 12px 16px; border: 1px solid #a7f3d0; border-radius: 10px; color: #065f46; background: #ecfdf5; font-size: .88rem; }
.settings-error { margin: 6px 0 0; color: #be123c; font-size: .78rem; }
.password-criteria-item { color: #899096; }
.password-criteria-item.is-valid { color: #047857; }
button:disabled { opacity: .65; cursor: wait; }
</style>
