<script setup>
import { ref, computed, onMounted } from 'vue';
import EicLayout from '../../layouts/EicLayout.vue';
import {
    getEicManageAccounts,
    storeEicAccount,
    updateEicAccountRole,
    toggleEicAccountStatus,
} from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { confirmAction, showToast as globalShowToast } from '../../utils/modal.js';
import '../../assets/css/executive-manage-accounts.css';

// State
const isLoading = ref(true);
const isSubmitting = ref(false);
const officers = ref([]);
const roles = ref([]);
const searchQuery = ref('');
const statusFilter = ref('all');

// Modals State
const isAddModalOpen = ref(false);
const newStudentNumber = ref('');
const studentNumberError = ref('');
const newFullName = ref('');
const newRoleId = ref('');

const isEditRoleModalOpen = ref(false);
const officerToEdit = ref(null);
const editRoleId = ref('');

const isDeactivateModalOpen = ref(false);
const officerToDeactivate = ref(null);

// Toast notification replacement
function showToast(message, type = 'success') {
    globalShowToast(message, type);
}

// Fallback roles for resilience
const defaultRoles = [
    { id: 1, role_name: 'President' },
    { id: 2, role_name: 'Executive Vice President' },
    { id: 3, role_name: 'Secretary' },
    { id: 4, role_name: 'Associate Secretary' },
    { id: 5, role_name: 'Treasurer' },
    { id: 6, role_name: 'Auditor' },
    { id: 7, role_name: 'Public Relations Officer' },
    { id: 8, role_name: 'Editor-in-Chief' },
    { id: 9, role_name: 'Associate Editor-in-Chief' },
    { id: 10, role_name: 'News Head' },
    { id: 11, role_name: 'Literary Head' },
    { id: 12, role_name: 'Feature Head' },
    { id: 13, role_name: 'Science and Technology Head' },
    { id: 14, role_name: 'Documentary and Podcast Head' },
    { id: 15, role_name: 'Media and Public Communications Head' },
    { id: 16, role_name: 'Associate Media and Public Communications Head' },
    { id: 17, role_name: 'Photojournalist Head' },
    { id: 18, role_name: 'Cartoonist Head' },
    { id: 19, role_name: 'Writer' },
    { id: 20, role_name: 'Cartoonist' },
    { id: 21, role_name: 'Media Team' },
];

const displayRoles = computed(() => {
    return (roles.value && roles.value.length > 0) ? roles.value : defaultRoles;
});

// Stats indicator
const totalCount = computed(() => officers.value.length);
const activeCount = computed(() => officers.value.filter(o => o.status === 'active').length);
const deactivatedCount = computed(() => totalCount.value - activeCount.value);

// Filtered Officers (Name, Role, Student Number + Status filter)
const filteredOfficers = computed(() => {
    let list = officers.value;

    if (statusFilter.value === 'active') {
        list = list.filter(o => o.status === 'active');
    } else if (statusFilter.value === 'deactivated') {
        list = list.filter(o => o.status === 'deactivated');
    }

    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter(o => {
            const name = (o.name || '').toLowerCase();
            const studentNo = (o.studentNumber || '').toLowerCase();
            const role = (o.role || '').toLowerCase();
            return name.includes(q) || studentNo.includes(q) || role.includes(q);
        });
    }

    return list;
});

// Avatar helper
function getAvatar(avatar) {
    if (!avatar) return '/images/member-placeholder.svg';
    const trimmed = String(avatar).trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return optimizeCloudinaryUrl(trimmed, { width: 100 });
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
}

function onAvatarError(e) {
    e.target.onerror = null;
    e.target.src = '/images/member-placeholder.svg';
}

// Load Officers & Roles
async function loadData() {
    isLoading.value = true;
    try {
        const res = await getEicManageAccounts(true);
        if (res) {
            officers.value = res.officers || [];
            roles.value = res.roles || [];
        }
    } catch (err) {
        console.error('Failed to load accounts:', err);
        showToast('Failed to load accounts directory.', 'danger');
    } finally {
        isLoading.value = false;
    }
}

// Add Officer Modal
const STUDENT_NUMBER_REGEX = /^\d{4}-\d{5}-BN-0$/;

function onStudentNumberInput(e) {
    let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let formatted = '';

    if (val.length > 0) formatted += val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 9);
    if (val.length > 9) formatted += '-' + val.substring(9, 11);
    if (val.length > 11) formatted += '-' + val.substring(11, 12);

    newStudentNumber.value = formatted;
    e.target.value = formatted;

    if (formatted.length === 0) {
        studentNumberError.value = '';
    } else if (formatted.length < 15) {
        studentNumberError.value = 'Format must be YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0).';
    } else if (!STUDENT_NUMBER_REGEX.test(formatted)) {
        studentNumberError.value = 'Invalid format. Example: 2024-00010-BN-0';
    } else {
        studentNumberError.value = '';
    }
}

function validateStudentNumber() {
    const val = newStudentNumber.value.trim().toUpperCase();
    if (!val) {
        studentNumberError.value = 'Student number is required.';
        return false;
    }
    if (!STUDENT_NUMBER_REGEX.test(val)) {
        studentNumberError.value = 'Format must be YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0).';
        return false;
    }
    studentNumberError.value = '';
    return true;
}

function openAddModal() {
    newStudentNumber.value = '';
    studentNumberError.value = '';
    newFullName.value = '';
    newRoleId.value = '';
    isAddModalOpen.value = true;
}

function closeAddModal() {
    isAddModalOpen.value = false;
    newStudentNumber.value = '';
    studentNumberError.value = '';
    newFullName.value = '';
    newRoleId.value = '';
}

async function handleAddOfficer() {
    const trimmedSn = newStudentNumber.value.trim().toUpperCase();
    newStudentNumber.value = trimmedSn;

    if (!validateStudentNumber()) {
        showToast(studentNumberError.value || 'Student number format must be YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0).', 'warning');
        return;
    }

    if (!newFullName.value.trim() || !newRoleId.value) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Create Officer Account',
        message: `Are you sure you want to create an account for ${newFullName.value.trim()}?`,
        confirmText: 'Create Account',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const payload = {
            student_number: trimmedSn,
            full_name: newFullName.value.trim(),
            role_id: newRoleId.value,
        };

        const res = await storeEicAccount(payload);
        if (res && res.officer) {
            officers.value.unshift(res.officer);
        } else {
            await loadData();
        }

        closeAddModal();
        showToast(res?.message || 'Officer account created successfully. Default password is thelenspupBN0.', 'success');
    } catch (err) {
        console.error('Failed to create account:', err);
        const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : 'Failed to create officer account.');
        showToast(msg, 'danger');
        if (err.response?.data?.errors?.student_number) {
            studentNumberError.value = Array.isArray(err.response.data.errors.student_number)
                ? err.response.data.errors.student_number[0]
                : err.response.data.errors.student_number;
        }
    } finally {
        isSubmitting.value = false;
    }
}

// Edit Role Modal
function openEditRoleModal(officer) {
    officerToEdit.value = officer;
    // Pre-select matching role id if available
    const matchedRole = displayRoles.value.find(r => 
        String(r.id) === String(officer.role_id) || 
        r.role_name?.toLowerCase() === (officer.role || '').toLowerCase()
    );
    editRoleId.value = matchedRole ? matchedRole.id : '';
    isEditRoleModalOpen.value = true;
}

function closeEditRoleModal() {
    isEditRoleModalOpen.value = false;
    officerToEdit.value = null;
    editRoleId.value = '';
}

async function handleSaveRole() {
    if (!officerToEdit.value || !editRoleId.value) return;

    const id = officerToEdit.value.id;
    const matchedRole = displayRoles.value.find(r => String(r.id) === String(editRoleId.value));
    const roleName = matchedRole ? matchedRole.role_name : '';
    const officerName = officerToEdit.value?.name || 'Officer';

    const confirmed = await confirmAction({
        title: 'Update Officer Role',
        message: `Are you sure you want to change the role of ${officerName} to ${roleName}?`,
        confirmText: 'Save Role',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const res = await updateEicAccountRole(id, {
            role_id: editRoleId.value,
            role: roleName,
        });

        if (res && res.officer) {
            const idx = officers.value.findIndex(o => String(o.id) === String(id));
            if (idx !== -1) {
                officers.value[idx] = res.officer;
            }
        } else {
            const target = officers.value.find(o => String(o.id) === String(id));
            if (target && roleName) {
                target.role = roleName;
            }
            await loadData();
        }

        closeEditRoleModal();
        showToast(res?.message || `Role for ${officerName} updated to ${roleName}.`, 'success');
    } catch (err) {
        console.error('Failed to update role:', err);
        const msg = err.response?.data?.message || 'Failed to update officer role.';
        showToast(msg, 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

// Deactivate / Reactivate
async function openDeactivateModal(officer) {
    officerToDeactivate.value = officer;
    const confirmed = await confirmAction({
        title: 'Deactivate Account',
        message: `Are you sure you want to deactivate ${officer.name}'s account? The officer's administrative credentials will be temporarily suspended.`,
        confirmText: 'Deactivate Account',
        cancelText: 'Cancel',
        type: 'danger',
    });
    if (!confirmed) return;
    await handleConfirmDeactivate();
}

function closeDeactivateModal() {
    isDeactivateModalOpen.value = false;
    officerToDeactivate.value = null;
}

async function handleConfirmDeactivate() {
    if (!officerToDeactivate.value) return;

    const target = officerToDeactivate.value;
    isSubmitting.value = true;
    try {
        const res = await toggleEicAccountStatus(target.id, 'deactivated');
        target.status = 'deactivated';
        closeDeactivateModal();
        showToast(res?.message || `Account for ${target.name} deactivated.`, 'success');
    } catch (err) {
        console.error('Failed to deactivate account:', err);
        const msg = err.response?.data?.message || 'Failed to deactivate account.';
        showToast(msg, 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

async function handleReactivate(officer) {
    const confirmed = await confirmAction({
        title: 'Reactivate Account',
        message: `Are you sure you want to reactivate ${officer.name}'s account?`,
        confirmText: 'Reactivate',
        cancelText: 'Cancel',
        type: 'maroon',
    });
    if (!confirmed) return;

    isSubmitting.value = true;
    try {
        const res = await toggleEicAccountStatus(officer.id, 'active');
        officer.status = 'active';
        showToast(res?.message || `Account for ${officer.name} reactivated successfully.`, 'success');
    } catch (err) {
        console.error('Failed to reactivate account:', err);
        const msg = err.response?.data?.message || 'Failed to reactivate account.';
        showToast(msg, 'danger');
    } finally {
        isSubmitting.value = false;
    }
}

onMounted(() => {
    loadData();
});
</script>

<template>
    <EicLayout>
        <main class="content-container">
            <div class="accounts-container">
                <!-- Header Row: Title & Active Stats Summary -->
                <div class="accounts-header-row">
                    <h1 class="accounts-page-title">Manage Accounts</h1>
                    <div id="accounts-stats-indicator" class="accounts-stats-indicator">
                        <span><strong class="stat-highlight">{{ totalCount }}</strong> Total Accounts</span>
                        <span class="stat-dot-separator">•</span>
                        <span><strong class="stat-highlight text-emerald-700">{{ activeCount }}</strong> Active</span>
                        <span class="stat-dot-separator">•</span>
                        <span><strong class="stat-highlight text-rose-700">{{ deactivatedCount }}</strong> Deactivated</span>
                    </div>
                </div>

                <!-- Controls Bar: Search Box + Status Filter + Add Officer Button -->
                <div class="accounts-controls-bar">
                    <div class="accounts-controls-left">
                        <!-- Search Box Input -->
                        <div class="accounts-search-wrapper">
                            <i class="fa-solid fa-magnifying-glass accounts-search-icon" aria-hidden="true"></i>
                            <input
                                v-model="searchQuery"
                                type="text"
                                class="accounts-search-input"
                                placeholder="Search officers by name, student number, or role..."
                                aria-label="Search officers"
                            >
                            <button
                                v-if="searchQuery"
                                type="button"
                                class="accounts-search-clear"
                                style="display: block;"
                                @click="searchQuery = ''"
                                aria-label="Clear search"
                            >
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <!-- Status Filter Dropdown -->
                        <div class="status-filter-wrapper">
                            <select
                                v-model="statusFilter"
                                class="status-filter-select"
                                aria-label="Filter by account status"
                            >
                                <option value="all">All Accounts</option>
                                <option value="active">Active Only</option>
                                <option value="deactivated">Deactivated Only</option>
                            </select>
                            <i class="fa-solid fa-chevron-down status-filter-chevron" aria-hidden="true"></i>
                        </div>
                    </div>

                    <!-- Add Officer Primary Button -->
                    <button
                        type="button"
                        class="btn-add-officer"
                        @click="openAddModal"
                        title="Add a new officer account"
                    >
                        <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                        <span>Add Officer</span>
                    </button>
                </div>

                <!-- Loading State -->
                <div v-if="isLoading" class="loading-state-container" style="text-align: center; padding: 60px 0;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #5c0a18;"></i>
                    <p style="margin-top: 12px; color: #667085; font-size: 0.95rem;">Loading accounts directory...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="filteredOfficers.length === 0" class="empty-accounts-box">
                    <i class="fa-solid fa-users-slash"></i>
                    <h4 class="empty-accounts-title">
                        {{ searchQuery || statusFilter !== 'all' ? 'No accounts found' : 'No accounts yet' }}
                    </h4>
                    <p v-if="searchQuery || statusFilter !== 'all'" class="empty-accounts-subtitle">
                        Try adjusting your search query or filter settings.
                    </p>
                </div>

                <!-- Accounts Dynamic List Container -->
                <div v-else class="accounts-list-container" aria-live="polite">
                    <div
                        v-for="officer in filteredOfficers"
                        :key="officer.id"
                        class="account-box"
                        :class="{ deactivated: officer.status === 'deactivated' }"
                        :id="'account-card-' + officer.id"
                    >
                        <!-- Left: Profile Picture + Details -->
                        <div class="account-info-stack">
                            <div class="officer-avatar-wrapper" :title="officer.name">
                                <img
                                    :src="getAvatar(officer.avatar)"
                                    :alt="officer.name"
                                    class="officer-profile-img"
                                    loading="lazy"
                                    @error="onAvatarError"
                                >
                            </div>

                            <div class="officer-details">
                                <!-- Top Line: Full Name + Role Tag -->
                                <div class="officer-primary-row">
                                    <h3 class="officer-name">{{ officer.name }}</h3>
                                    <span class="officer-role-tag">{{ officer.role }}</span>
                                </div>

                                <!-- Bottom Line: Account Status & Student Number -->
                                <div class="officer-meta-row">
                                    <span class="status-pill" :class="officer.status === 'deactivated' ? 'deactivated' : 'active'">
                                        <span class="status-dot"></span>
                                        <span>{{ officer.status === 'deactivated' ? 'Deactivated' : 'Active' }}</span>
                                    </span>
                                    <span class="text-xs text-stone-500 font-mono ml-2">{{ officer.studentNumber }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Right Actions: Edit Role + Deactivate / Activate -->
                        <div class="account-actions-stack">
                            <button
                                type="button"
                                class="btn-account-edit-role"
                                @click="openEditRoleModal(officer)"
                                title="Edit officer role"
                            >
                                <i class="fa-solid fa-user-pen"></i>
                                <span>Edit Role</span>
                            </button>

                            <button
                                v-if="officer.status === 'deactivated'"
                                type="button"
                                class="btn-account-activate"
                                :disabled="isSubmitting"
                                @click="handleReactivate(officer)"
                                title="Reactivate this account"
                            >
                                <i class="fa-solid fa-user-check"></i>
                                <span>Activate</span>
                            </button>
                            <button
                                v-else
                                type="button"
                                class="btn-account-deactivate"
                                :disabled="isSubmitting"
                                @click="openDeactivateModal(officer)"
                                title="Deactivate account credentials"
                            >
                                <i class="fa-solid fa-user-slash"></i>
                                <span>Deactivate</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL 1: ADD OFFICER ACCOUNT MODAL                                     -->
        <!-- ====================================================================== -->
        <div
            v-if="isAddModalOpen"
            id="add-officer-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-modal-title"
            @click.self="closeAddModal"
        >
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h3 id="add-modal-title" class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-user-plus text-[#5c0a18]"></i>
                        <span>Add New Officer Account</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" @click="closeAddModal" aria-label="Close dialog">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="add-officer-form" class="edit-modal-form" @submit.prevent="handleAddOfficer" novalidate>
                    <div class="form-field">
                        <label for="officer-input-student-id">Student Number *</label>
                        <input
                            id="officer-input-student-id"
                            :value="newStudentNumber"
                            @input="onStudentNumberInput"
                            @blur="validateStudentNumber"
                            type="text"
                            name="student_number"
                            class="form-input"
                            :class="{ 'border-red-500': !!studentNumberError }"
                            placeholder="e.g. 2024-00010-BN-0"
                            maxlength="15"
                            required
                        >
                        <p v-if="studentNumberError" style="color: #d92d20; font-size: 0.78rem; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>{{ studentNumberError }}</span>
                        </p>
                        <p v-else style="color: #667085; font-size: 0.74rem; margin-top: 3px;">
                            Format: YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0)
                        </p>
                    </div>

                    <div class="form-field">
                        <label for="officer-input-name">Full Name *</label>
                        <input
                            id="officer-input-name"
                            v-model="newFullName"
                            type="text"
                            name="full_name"
                            class="form-input"
                            placeholder="e.g. Maria Clara Santos"
                            required
                        >
                    </div>

                    <div class="form-field">
                        <label for="officer-input-role">Role *</label>
                        <select
                            id="officer-input-role"
                            v-model="newRoleId"
                            name="role_id"
                            class="form-select"
                            required
                        >
                            <option value="" disabled selected>Select role...</option>
                            <option
                                v-for="r in displayRoles"
                                :key="r.id"
                                :value="r.id"
                            >
                                {{ r.role_name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-field">
                        <label>Default Password</label>
                        <div class="default-password-box" style="display: flex; align-items: center; justify-content: space-between; background-color: #fafbfc; border: 1px solid #eaecf0; border-radius: 8px; padding: 9px 12px; font-size: 0.84rem;">
                            <span style="font-family: monospace; font-weight: 700; color: #5c0a18; letter-spacing: 0.03em;">thelenspupBN0</span>
                            <span style="font-size: 0.72rem; color: #667085;">Initial password (changeable later)</span>
                        </div>
                    </div>

                    <div class="modal-single-btn-footer">
                        <button type="submit" class="btn-modal-submit-maroon btn-create-account" :disabled="isSubmitting">
                            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-user-plus"></i>
                            <span>{{ isSubmitting ? 'Creating...' : 'Create Account' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 3: EDIT OFFICER ROLE MODAL                                      -->
        <!-- ====================================================================== -->
        <div
            v-if="isEditRoleModalOpen"
            id="edit-role-modal"
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-role-modal-title"
            @click.self="closeEditRoleModal"
        >
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h3 id="edit-role-modal-title" class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-user-pen text-[#5c0a18]"></i>
                        <span>Edit Officer Role</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" @click="closeEditRoleModal" aria-label="Close dialog">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="edit-role-form" class="edit-modal-form" @submit.prevent="handleSaveRole" novalidate>
                    <!-- Target Officer Banner -->
                    <div class="edit-role-officer-banner">
                        <div class="edit-role-avatar-wrap">
                            <img
                                :src="getAvatar(officerToEdit?.avatar)"
                                alt="Officer Avatar"
                                class="edit-role-avatar-img"
                                @error="onAvatarError"
                            >
                        </div>
                        <div class="edit-role-officer-info">
                            <div class="edit-role-name">{{ officerToEdit?.name }}</div>
                            <div class="edit-role-current">Current Role: <strong>{{ officerToEdit?.role }}</strong></div>
                        </div>
                    </div>

                    <div class="form-field">
                        <label for="edit-role-select">Select New Role *</label>
                        <select
                            id="edit-role-select"
                            v-model="editRoleId"
                            name="role_id"
                            class="form-select"
                            required
                        >
                            <option value="" disabled selected>Select role...</option>
                            <option
                                v-for="r in displayRoles"
                                :key="r.id"
                                :value="r.id"
                            >
                                {{ r.role_name }}
                            </option>
                        </select>
                    </div>

                    <div class="modal-single-btn-footer">
                        <button type="submit" class="btn-modal-submit-maroon btn-save-role" :disabled="isSubmitting">
                            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-check"></i>
                            <span>{{ isSubmitting ? 'Saving...' : 'Save Role' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </EicLayout>
</template>
