<script setup>
import { ref, computed, onMounted } from 'vue';
import ExecutiveLayout from '../../layouts/ExecutiveLayout.vue';
import {
    getExecutiveManageAccounts,
    storeExecutiveAccount,
    updateExecutiveAccountRole,
    toggleExecutiveAccountStatus,
} from '../../services/api.js';
import { optimizeCloudinaryUrl } from '../../utils/image.js';
import { currentUser } from '../../stores/auth.js';
import '../../assets/css/executive-manage-accounts.css';

const user = currentUser;

// RBAC
const isPresOrVp = computed(() => {
    return ['President', 'Vice President', 'Executive Vice President'].includes(user?.role || '');
});

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

// Toast notification
const toast = ref({
    show: false,
    message: '',
    type: 'success',
});
let toastTimer = null;

function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toast.value = { show: true, message, type };
    toastTimer = setTimeout(() => {
        toast.value.show = false;
    }, 3400);
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
    { id: 11, role_name: 'Features Head' },
    { id: 12, role_name: 'Literature Head' },
    { id: 13, role_name: 'Science & Technology Head' },
    { id: 14, role_name: 'Media and Public Communications Head' },
    { id: 15, role_name: 'Cartoonist Head' },
    { id: 16, role_name: 'Photojournalist Head' },
    { id: 17, role_name: 'Writer' },
    { id: 18, role_name: 'Cartoonist' },
    { id: 19, role_name: 'Photojournalist' },
    { id: 20, role_name: 'Media Team' },
];

const availableRoles = computed(() => {
    return roles.value.length > 0 ? roles.value : defaultRoles;
});

function resolveAvatarUrl(url) {
    if (!url) return '/images/member-placeholder.svg';
    const trimmed = String(url).trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
        return optimizeCloudinaryUrl(trimmed, { width: 100, crop: 'limit' });
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
}

async function loadAccounts() {
    isLoading.value = true;
    try {
        const data = await getExecutiveManageAccounts(true);
        if (data) {
            if (Array.isArray(data.officers)) {
                officers.value = data.officers;
            }
            if (Array.isArray(data.roles)) {
                roles.value = data.roles;
            }
        }
    } catch (err) {
        console.error('Failed to load accounts:', err);
        showToast('Failed to load officer accounts.', 'error');
    } finally {
        isLoading.value = false;
    }
}

// Filtered Accounts
const filteredOfficers = computed(() => {
    let list = officers.value;

    if (statusFilter.value !== 'all') {
        list = list.filter(o => (o.status || 'active').toLowerCase() === statusFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(o => {
            const name = (o.name || '').toLowerCase();
            const studentNo = (o.studentNumber || '').toLowerCase();
            const role = (o.role || '').toLowerCase();
            return name.includes(q) || studentNo.includes(q) || role.includes(q);
        });
    }

    return list;
});

const activeCount = computed(() => {
    return officers.value.filter(o => (o.status || 'active').toLowerCase() === 'active').length;
});

// Auto-hyphenation & student number validation
function formatStudentNumber(val) {
    let cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let parts = [];
    if (cleaned.length > 0) parts.push(cleaned.substring(0, 4));
    if (cleaned.length > 4) parts.push(cleaned.substring(4, 9));
    if (cleaned.length > 9) parts.push(cleaned.substring(9, 11));
    if (cleaned.length > 11) parts.push(cleaned.substring(11, 12));
    return parts.join('-');
}

function onStudentNumberInput(e) {
    const raw = e.target.value;
    const formatted = formatStudentNumber(raw);
    newStudentNumber.value = formatted;
    validateStudentNumber(formatted);
}

function validateStudentNumber(val) {
    const regex = /^\d{4}-\d{5}-BN-0$/;
    if (!val) {
        studentNumberError.value = 'Student number is required.';
        return false;
    }
    if (!regex.test(val)) {
        studentNumberError.value = 'Format must be YEAR-5DIGIT-BN-0 (e.g. 2024-00010-BN-0)';
        return false;
    }
    studentNumberError.value = '';
    return true;
}

// Add Account
function openAddModal() {
    newStudentNumber.value = '';
    studentNumberError.value = '';
    newFullName.value = '';
    newRoleId.value = availableRoles.value[0]?.id || '';
    isAddModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeAddModal() {
    isAddModalOpen.value = false;
    studentNumberError.value = '';
    document.body.classList.remove('modal-open');
}

async function handleCreateAccount() {
    if (!validateStudentNumber(newStudentNumber.value)) {
        return;
    }
    if (!newFullName.value.trim()) {
        showToast('Please enter the officer full name.', 'error');
        return;
    }
    if (!newRoleId.value) {
        showToast('Please select a role.', 'error');
        return;
    }

    isSubmitting.value = true;
    try {
        const res = await storeExecutiveAccount({
            student_number: newStudentNumber.value.trim(),
            full_name: newFullName.value.trim(),
            role_id: newRoleId.value,
        });
        showToast(res.message || 'Officer account created successfully. Default password is thelenspupBN0.', 'success');
        closeAddModal();
        await loadAccounts();
    } catch (err) {
        console.error('Failed to create account:', err);
        const msg = err.response?.data?.errors?.student_number?.[0]
            || err.response?.data?.message
            || 'Failed to create officer account.';
        showToast(msg, 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Edit Role
function openEditRoleModal(officer) {
    officerToEdit.value = officer;
    const currentRoleObj = availableRoles.value.find(r => r.role_name === officer.role);
    editRoleId.value = currentRoleObj ? currentRoleObj.id : (availableRoles.value[0]?.id || '');
    isEditRoleModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeEditRoleModal() {
    isEditRoleModalOpen.value = false;
    officerToEdit.value = null;
    document.body.classList.remove('modal-open');
}

async function handleSaveRole() {
    if (!officerToEdit.value || !editRoleId.value) return;

    isSubmitting.value = true;
    try {
        const res = await updateExecutiveAccountRole(officerToEdit.value.id, {
            role_id: editRoleId.value,
        });
        showToast(res.message || 'Officer role updated successfully.', 'success');
        closeEditRoleModal();
        await loadAccounts();
    } catch (err) {
        console.error('Failed to update role:', err);
        showToast(err.response?.data?.message || 'Failed to update officer role.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

// Deactivate / Reactivate
function openToggleStatusModal(officer) {
    officerToDeactivate.value = officer;
    isDeactivateModalOpen.value = true;
    document.body.classList.add('modal-open');
}

function closeToggleStatusModal() {
    isDeactivateModalOpen.value = false;
    officerToDeactivate.value = null;
    document.body.classList.remove('modal-open');
}

async function handleConfirmToggleStatus() {
    if (!officerToDeactivate.value) return;

    const currentStatus = (officerToDeactivate.value.status || 'active').toLowerCase();
    const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';

    isSubmitting.value = true;
    try {
        const res = await toggleExecutiveAccountStatus(officerToDeactivate.value.id, newStatus);
        showToast(res.message || `Officer account ${newStatus === 'active' ? 'reactivated' : 'deactivated'}.`, 'success');
        closeToggleStatusModal();
        await loadAccounts();
    } catch (err) {
        console.error('Failed to update status:', err);
        showToast(err.response?.data?.message || 'Failed to update account status.', 'error');
    } finally {
        isSubmitting.value = false;
    }
}

onMounted(() => {
    loadAccounts();
});
</script>

<template>
    <ExecutiveLayout>
        <main class="content-container">
            <!-- Access Check for Non-Pres/VP -->
            <div v-if="!isPresOrVp" class="card-panel text-center py-12">
                <i class="fa-solid fa-lock text-4xl text-[#700f2b] mb-4"></i>
                <h2 class="text-xl font-bold text-stone-800">Access Restricted</h2>
                <p class="text-stone-500 mt-2 max-w-md mx-auto text-sm">
                    This section is restricted to the President and Vice President of the executive board.
                </p>
                <router-link to="/executive/dashboard" class="btn-primary mt-6 inline-block">
                    Return to Dashboard
                </router-link>
            </div>

            <div v-else>
                <!-- Toast Notification -->
                <transition name="fade">
                    <div v-if="toast.show" class="toast-container">
                        <div class="toast-message" :class="toast.type">
                            <i :class="toast.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
                            <span>{{ toast.message }}</span>
                        </div>
                    </div>
                </transition>

                <div class="accounts-container">
                    <!-- Header Row: Title & Active Stats Summary -->
                    <div class="accounts-header-row">
                        <h1 class="accounts-page-title">Manage Accounts</h1>
                        <div id="accounts-stats-indicator" class="accounts-stats-indicator">
                            <span class="stats-badge-pill">
                                <strong>{{ activeCount }}</strong> active of {{ officers.length }} total officers
                            </span>
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
                                    id="officer-search-input"
                                    class="accounts-search-input"
                                    placeholder="Search officers by name, student number, or role..."
                                    aria-label="Search officers"
                                >
                                <button
                                    v-if="searchQuery"
                                    type="button"
                                    id="officer-search-clear"
                                    class="accounts-search-clear"
                                    aria-label="Clear search"
                                    @click="searchQuery = ''"
                                >
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <!-- Status Filter Dropdown -->
                            <div class="status-filter-wrapper">
                                <select id="status-filter-select" v-model="statusFilter" class="status-filter-select" aria-label="Filter by account status">
                                    <option value="all">All Accounts</option>
                                    <option value="active">Active Only</option>
                                    <option value="deactivated">Deactivated Only</option>
                                </select>
                                <i class="fa-solid fa-chevron-down status-filter-chevron" aria-hidden="true"></i>
                            </div>
                        </div>

                        <!-- Add Officer Primary Button (Maroon styled) -->
                        <button
                            type="button"
                            id="btn-open-add-modal"
                            class="btn-add-officer"
                            style="background-color: #700f2b; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s;"
                            title="Add a new officer account"
                            @click="openAddModal"
                        >
                            <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                            <span>Add Officer</span>
                        </button>
                    </div>

                    <!-- Accounts Dynamic List Container -->
                    <div id="accounts-list-container" class="accounts-list-container" aria-live="polite">
                        <div
                            v-for="officer in filteredOfficers"
                            :key="officer.id"
                            class="officer-box-card"
                            :class="{ 'officer-deactivated': (officer.status || 'active').toLowerCase() === 'deactivated' }"
                        >
                            <div class="officer-card-header">
                                <div class="officer-avatar-wrap">
                                    <img
                                        :src="resolveAvatarUrl(officer.avatar)"
                                        :alt="officer.name"
                                        class="officer-avatar-img"
                                        loading="lazy"
                                    >
                                </div>
                                <div class="officer-info-wrap">
                                    <h3 class="officer-name-text">{{ officer.name }}</h3>
                                    <span class="officer-student-no">{{ officer.studentNumber }}</span>
                                </div>
                                <div class="officer-status-wrap">
                                    <span
                                        class="officer-status-badge"
                                        :class="(officer.status || 'active').toLowerCase() === 'active' ? 'status-active' : 'status-deactivated'"
                                    >
                                        <span class="status-indicator-dot"></span>
                                        {{ (officer.status || 'active').toLowerCase() === 'active' ? 'Active' : 'Deactivated' }}
                                    </span>
                                </div>
                            </div>

                            <div class="officer-card-body">
                                <span class="officer-role-pill">{{ officer.role }}</span>
                            </div>

                            <div class="officer-card-actions">
                                <button
                                    type="button"
                                    class="btn-officer-action btn-edit-role"
                                    style="background-color: #700f2b; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
                                    title="Edit role"
                                    @click="openEditRoleModal(officer)"
                                >
                                    <i class="fa-solid fa-user-pen"></i>
                                    <span>Edit Role</span>
                                </button>
                                <button
                                    type="button"
                                    class="btn-officer-action"
                                    :class="(officer.status || 'active').toLowerCase() === 'active' ? 'btn-deactivate' : 'btn-activate'"
                                    :title="(officer.status || 'active').toLowerCase() === 'active' ? 'Deactivate account' : 'Reactivate account'"
                                    @click="openToggleStatusModal(officer)"
                                >
                                    <i :class="(officer.status || 'active').toLowerCase() === 'active' ? 'fa-solid fa-user-xmark' : 'fa-solid fa-user-check'"></i>
                                    <span>{{ (officer.status || 'active').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}</span>
                                </button>
                            </div>
                        </div>

                        <!-- Empty State -->
                        <div v-if="!isLoading && filteredOfficers.length === 0" class="accounts-empty-state">
                            <i class="fa-regular fa-id-badge empty-icon"></i>
                            <h3 class="empty-title">No officers found</h3>
                            <p class="empty-desc">There are no officer accounts matching your current search or filter.</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- ====================================================================== -->
        <!-- MODAL 1: ADD OFFICER ACCOUNT MODAL                                     -->
        <!-- ====================================================================== -->
        <div v-if="isAddModalOpen" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-modal-title">
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h3 id="add-modal-title" class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-user-plus text-[#700f2b]"></i>
                        <span>Add New Officer Account</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" aria-label="Close dialog" @click="closeAddModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form class="edit-modal-form" @submit.prevent="handleCreateAccount">
                    <div class="form-field">
                        <label for="officer-input-student-id">Student Number *</label>
                        <input
                            id="officer-input-student-id"
                            :value="newStudentNumber"
                            type="text"
                            class="form-input"
                            placeholder="e.g. 2024-00010-BN-0"
                            maxlength="15"
                            required
                            @input="onStudentNumberInput"
                        >
                        <p v-if="studentNumberError" style="color: #dc2626; font-size: 0.74rem; margin-top: 3px;">
                            {{ studentNumberError }}
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
                            class="form-input"
                            placeholder="e.g. Juan Dela Cruz"
                            maxlength="255"
                            required
                        >
                    </div>

                    <div class="form-field">
                        <label for="officer-select-role">Organizational Role *</label>
                        <select id="officer-select-role" v-model="newRoleId" class="form-select" required>
                            <option value="" disabled>Select role...</option>
                            <option v-for="r in availableRoles" :key="r.id" :value="r.id">
                                {{ r.role_name }}
                            </option>
                        </select>
                    </div>

                    <!-- Default Password Notice -->
                    <div style="background: #fdf2f4; border: 1px solid #f9d8e0; border-radius: 6px; padding: 10px 14px; margin-top: 6px;">
                        <p style="font-size: 0.78rem; color: #700f2b; margin: 0;">
                            <i class="fa-solid fa-key" style="margin-right: 4px;"></i>
                            Default password will be <strong>thelenspupBN0</strong>. The officer can change it upon initial login.
                        </p>
                    </div>

                    <div class="edit-modal-footer" style="margin-top: 18px;">
                        <button type="button" class="btn-cancel" @click="closeAddModal">Cancel</button>
                        <button
                            type="submit"
                            class="btn-save"
                            style="background-color: #700f2b; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;"
                            :disabled="isSubmitting"
                        >
                            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                            <span>{{ isSubmitting ? 'Creating...' : 'Create Account' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 2: EDIT ROLE MODAL                                               -->
        <!-- ====================================================================== -->
        <div v-if="isEditRoleModalOpen" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-role-modal-title">
            <div class="modal-card edit-modal-card">
                <div class="modal-header-simple">
                    <h3 id="edit-role-modal-title" class="modal-title font-semibold text-base">
                        <i class="fa-solid fa-user-pen text-[#700f2b]"></i>
                        <span>Edit Role: {{ officerToEdit?.name }}</span>
                    </h3>
                    <button type="button" class="viewer-close-btn" aria-label="Close dialog" @click="closeEditRoleModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="edit-modal-form">
                    <div class="form-field">
                        <label for="edit-officer-role-select">Select New Role *</label>
                        <select id="edit-officer-role-select" v-model="editRoleId" class="form-select">
                            <option v-for="r in availableRoles" :key="r.id" :value="r.id">
                                {{ r.role_name }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="edit-modal-footer">
                    <button type="button" class="btn-cancel" @click="closeEditRoleModal">Cancel</button>
                    <button
                        type="button"
                        class="btn-save"
                        style="background-color: #700f2b; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;"
                        :disabled="isSubmitting"
                        @click="handleSaveRole"
                    >
                        <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                        <span>{{ isSubmitting ? 'Saving...' : 'Save Role' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ====================================================================== -->
        <!-- MODAL 3: DEACTIVATE / REACTIVATE CONFIRMATION MODAL                    -->
        <!-- ====================================================================== -->
        <div v-if="isDeactivateModalOpen" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card confirm-modal-card">
                <div
                    class="confirm-icon-wrap"
                    :class="(officerToDeactivate?.status || 'active').toLowerCase() === 'active' ? 'delete' : 'restore'"
                >
                    <i :class="(officerToDeactivate?.status || 'active').toLowerCase() === 'active' ? 'fa-solid fa-user-slash' : 'fa-solid fa-user-check'"></i>
                </div>

                <h3 class="confirm-title">
                    {{ (officerToDeactivate?.status || 'active').toLowerCase() === 'active' ? 'Deactivate Account?' : 'Reactivate Account?' }}
                </h3>

                <p class="confirm-desc">
                    {{
                        (officerToDeactivate?.status || 'active').toLowerCase() === 'active'
                            ? `Are you sure you want to deactivate ${officerToDeactivate?.name}'s account? They will lose access to the system until reactivated.`
                            : `Are you sure you want to reactivate ${officerToDeactivate?.name}'s account? They will regain access to their portal.`
                    }}
                </p>

                <div class="confirm-actions">
                    <button type="button" class="btn-cancel" @click="closeToggleStatusModal">Cancel</button>
                    <button
                        type="button"
                        class="btn-confirm"
                        :class="(officerToDeactivate?.status || 'active').toLowerCase() === 'active' ? 'delete' : 'restore'"
                        :disabled="isSubmitting"
                        @click="handleConfirmToggleStatus"
                    >
                        <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
                        <span>
                            {{
                                (officerToDeactivate?.status || 'active').toLowerCase() === 'active'
                                    ? 'Yes, Deactivate'
                                    : 'Yes, Reactivate'
                            }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </ExecutiveLayout>
</template>
