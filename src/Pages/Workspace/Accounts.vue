<script setup>
import { computed, reactive, ref } from 'vue';
import PageHead from '../../components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import { useAppState } from '../../state/appState.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, officers: { type: Array, default: () => [] }, roles: { type: Array, default: () => [] } });
const page = useAppState();
const query = ref('');
const filter = ref('all');
const form = reactive({ full_name: '', student_number: '', role_id: '' });
const errors = ref({});
const notice = ref('');
const busy = ref(false);
const filteredOfficers = computed(() => props.officers.filter((officer) => {
    const matchesQuery = `${officer.name} ${officer.studentNumber} ${officer.role}`.toLowerCase().includes(query.value.trim().toLowerCase());
    return matchesQuery && (filter.value === 'all' || officer.status === filter.value);
}));
async function send(path, method, data) {
    busy.value = true;
    notice.value = '';
    try {
        const response = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            errors.value = result.errors ?? {};
            throw new Error(result.message ?? 'The account could not be updated.');
        }
        errors.value = {};
        notice.value = result.message ?? 'Account updated.';
        router.reload({ only: ['officers'], preserveScroll: true });
        return true;
    } catch (error) { notice.value = error.message; return false; }
    finally { busy.value = false; }
}
async function addOfficer() {
    if (await send(`/${props.portal}/manage-accounts`, 'POST', form)) {
        form.full_name = '';
        form.student_number = '';
        form.role_id = '';
    }
}
function setRole(officer, event) { send(`/${props.portal}/manage-accounts/${officer.id}/role`, 'PUT', { role_id: event.target.value }); }
function toggleStatus(officer) { const next = officer.status === 'deactivated' ? 'active' : 'deactivated'; send(`/${props.portal}/manage-accounts/${officer.id}/status`, 'PATCH', { status: next }); }
</script>

<template>
    <AdminLayout title="Manage Accounts">
        <PageHead><link rel="stylesheet" href="/css/executive-manage-accounts.css"></PageHead>
        <main class="accounts-page"><header class="accounts-heading"><div><p class="accounts-eyebrow">TEAM ADMINISTRATION</p><h1>Manage Accounts</h1><p>Create newsroom accounts and manage roles and access.</p></div><span class="accounts-total">{{ officers.length }} accounts</span></header>
            <p v-if="notice" class="accounts-notice" role="status">{{ notice }}</p>
            <section class="accounts-create"><div><h2>Create account</h2><p>New accounts start with the temporary password <strong>password123</strong>.</p></div><form @submit.prevent="addOfficer"><label>Full name<input v-model="form.full_name" maxlength="255" required autocomplete="name"><small v-if="errors.full_name">{{ errors.full_name[0] }}</small></label><label>Student number<input v-model="form.student_number" maxlength="50" required autocomplete="off"><small v-if="errors.student_number">{{ errors.student_number[0] }}</small></label><label>Role<select v-model="form.role_id" required><option value="" disabled>Select role</option><option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option></select><small v-if="errors.role_id">{{ errors.role_id[0] }}</small></label><button type="submit" :disabled="busy"><i class="fa-solid fa-user-plus"></i> {{ busy ? 'Creating…' : 'Create account' }}</button></form></section>
            <div class="accounts-toolbar"><input v-model="query" type="search" placeholder="Search name, student number, or role" aria-label="Search accounts"><select v-model="filter" aria-label="Filter account status"><option value="all">All accounts</option><option value="active">Active</option><option value="deactivated">Deactivated</option></select></div>
            <div class="accounts-table-wrap"><table class="accounts-table"><thead><tr><th>Member</th><th>Student number</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody><tr v-for="officer in filteredOfficers" :key="officer.id"><td><div class="accounts-person"><img :src="officer.avatar" alt=""><strong>{{ officer.name }}</strong></div></td><td>{{ officer.studentNumber }}</td><td><select :value="officer.roleId" :aria-label="`Role for ${officer.name}`" @change="setRole(officer, $event)"><option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option></select><small class="accounts-role-current">{{ officer.role }}</small></td><td><span class="accounts-status" :class="officer.status === 'active' ? 'is-active' : 'is-disabled'">{{ officer.status }}</span></td><td><button type="button" class="accounts-toggle" :disabled="String(officer.id) === String(page.props.auth?.user?.id)" @click="toggleStatus(officer)">{{ officer.status === 'deactivated' ? 'Reactivate' : 'Deactivate' }}</button></td></tr><tr v-if="!filteredOfficers.length"><td colspan="5" class="accounts-empty">No accounts match your search.</td></tr></tbody></table></div>
        </main>
    </AdminLayout>
</template>

<style scoped>
.accounts-page{max-width:1400px;margin:0 auto}.accounts-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.accounts-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.accounts-heading h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.accounts-heading p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.accounts-total{padding:8px 11px;color:#700f2b;background:#f9eef2;border-radius:99px;font-size:.74rem;font-weight:800}.accounts-create{display:grid;grid-template-columns:250px 1fr;gap:20px;margin-bottom:18px;padding:19px;background:#fff;border:1px solid #eee6e8;border-radius:13px}.accounts-create h2{margin:0;color:#2a2023;font:700 1.1rem 'Playfair Display',Georgia,serif}.accounts-create p{margin:7px 0;color:#777176;font-size:.76rem;line-height:1.5}.accounts-create form{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr)) auto;align-items:end;gap:10px}.accounts-create label{display:grid;gap:6px;color:#4f4649;font-size:.73rem;font-weight:700}.accounts-create input,.accounts-create select,.accounts-toolbar input,.accounts-toolbar select,.accounts-table select{min-width:0;padding:9px 10px;color:#30282a;background:#fff;border:1px solid #e4dadd;border-radius:8px;font-size:.78rem}.accounts-create label small{color:#be123c;font-size:.67rem}.accounts-create button,.accounts-toggle{padding:10px 12px;color:#fff;background:#700f2b;border:0;border-radius:8px;font-size:.73rem;font-weight:800;cursor:pointer;white-space:nowrap}.accounts-create button:disabled{opacity:.6}.accounts-toolbar{display:flex;gap:10px;margin-bottom:12px;padding:12px;background:#fff;border:1px solid #eee6e8;border-radius:10px}.accounts-toolbar input{flex:1}.accounts-table-wrap{overflow:auto;background:#fff;border:1px solid #eee6e8;border-radius:12px}.accounts-table{width:100%;border-collapse:collapse;text-align:left}.accounts-table th{padding:12px 14px;color:#777176;background:#faf8f9;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}.accounts-table td{padding:12px 14px;border-top:1px solid #f0ebed;color:#4a4245;font-size:.77rem}.accounts-person{display:flex;align-items:center;gap:9px}.accounts-person img{width:34px;height:34px;object-fit:cover;border-radius:50%;background:#f3edef}.accounts-person strong{color:#2c2426}.accounts-role-current{display:block;margin-top:4px;color:#82797c;font-size:.65rem}.accounts-status{padding:4px 8px;border-radius:99px;font-size:.65rem;font-weight:800;text-transform:capitalize}.accounts-status.is-active{color:#047857;background:#ecfdf5}.accounts-status.is-disabled{color:#b42318;background:#fff1f2}.accounts-toggle{color:#700f2b;background:#fff;border:1px solid #eadde2}.accounts-toggle:disabled{opacity:.45;cursor:not-allowed}.accounts-empty{text-align:center;padding:24px!important;color:#82797c!important}@media(max-width:850px){.accounts-create{grid-template-columns:1fr}.accounts-create form{grid-template-columns:repeat(2,minmax(0,1fr))}.accounts-create button{grid-column:span 2}}@media(max-width:520px){.accounts-heading{align-items:flex-start;flex-direction:column}.accounts-create form{grid-template-columns:1fr}.accounts-create button{grid-column:auto}.accounts-toolbar{flex-direction:column}.accounts-toolbar input{width:100%}}
</style>
