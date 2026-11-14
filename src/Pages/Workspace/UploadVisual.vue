<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import PageHead from '../../components/PageHead.vue';
import { router } from '../../router/index.js';
import { apiFetch } from '../../services/api.js';
import AdminLayout from '../../Layouts/AdminLayout.vue';

const props = defineProps({ portal: { type: String, required: true }, kind: { type: String, default: 'photo' } });
const file = ref(null);
const preview = ref('');
const title = ref('');
const caption = ref('');
const type = ref('photo');
const error = ref('');
const busy = ref(false);
const input = ref(null);
const isCartoon = computed(() => props.kind === 'cartoon');
const target = computed(() => isCartoon.value ? '/cartoonist/submit-cartoon' : `/${props.portal}/submit-media`);
const doneTarget = computed(() => isCartoon.value ? '/cartoonist/manage-cartoons' : `/${props.portal}/manage-media`);
const heading = computed(() => isCartoon.value ? 'Submit Cartoon' : props.portal === 'mpc' ? 'Submit Publication Material' : 'Submit Photo');

function selectFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/') || selected.size > 10 * 1024 * 1024) {
        error.value = 'Choose an image up to 10 MB.';
        event.target.value = '';
        return;
    }
    error.value = '';
    if (preview.value) URL.revokeObjectURL(preview.value);
    file.value = selected;
    preview.value = URL.createObjectURL(selected);
}
function clearFile() {
    if (preview.value) URL.revokeObjectURL(preview.value);
    file.value = null;
    preview.value = '';
    if (input.value) input.value.value = '';
}
async function submit() {
    if (!file.value) { error.value = 'Choose an image to upload.'; return; }
    busy.value = true;
    error.value = '';
    const data = new FormData();
    data.append(isCartoon.value ? 'cartoon_file' : 'media_file', file.value);
    if (title.value) data.append('title', title.value);
    if (caption.value) data.append('caption', caption.value);
    if (!isCartoon.value) data.append('type', props.portal === 'mpc' ? type.value : 'photo');
    try {
        const response = await apiFetch(target.value, { method: 'POST', body: data });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            const validationMessage = result.errors ? Object.values(result.errors).flat()[0] : null;
            throw new Error(validationMessage ?? result.message ?? 'Upload could not be completed.');
        }
        router.push(doneTarget.value);
    } catch (submissionError) { error.value = submissionError.message; }
    finally { busy.value = false; }
}
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value); });
</script>

<template>
    <AdminLayout :title="heading">
        <PageHead><link rel="stylesheet" href="/css/mpc-submit-media.css"></PageHead>
        <main class="upload-page"><header><p class="upload-eyebrow">VISUAL CONTRIBUTIONS</p><h1>{{ heading }}</h1><p>Upload a clear, publication-ready image for the newsroom.</p></header><form class="upload-card" @submit.prevent="submit"><div class="upload-drop" role="button" tabindex="0" @click="input?.click()" @keydown.enter.prevent="input?.click()" @dragover.prevent @drop.prevent="selectFile({ target: { files: $event.dataTransfer.files } })"><input ref="input" type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden @change="selectFile"><template v-if="preview"><img :src="preview" :alt="file?.name || 'Image preview'"><button type="button" class="upload-remove" aria-label="Remove selected image" @click.stop="clearFile">×</button></template><template v-else><i class="fa-solid fa-cloud-arrow-up"></i><strong>Drop your image here or browse</strong><span>SVG, PNG, JPG, or WEBP · Maximum 10 MB</span></template></div><p v-if="file" class="upload-file-name"><i class="fa-regular fa-image"></i> {{ file.name }} · {{ (file.size / 1024 / 1024).toFixed(2) }} MB</p><div class="upload-fields"><label>Title <span>(optional)</span><input v-model="title" maxlength="255" :placeholder="isCartoon ? 'Editorial cartoon title' : 'Photo or graphic title'"></label><label>Caption <span>(optional)</span><textarea v-model="caption" rows="3" placeholder="Add context or a caption for the image."></textarea></label><label v-if="portal === 'mpc' && !isCartoon">Visual type<select v-model="type"><option value="photo">Photo</option><option value="graphic">Publication graphic</option></select></label></div><p v-if="error" class="upload-error" role="alert">{{ error }}</p><footer><RouterLink :to="doneTarget">Cancel</RouterLink><button type="submit" :disabled="busy">{{ busy ? 'Uploading…' : isCartoon ? 'Submit Cartoon' : 'Submit Media' }}</button></footer></form></main>
    </AdminLayout>
</template>

<style scoped>
.upload-page{max-width:900px;margin:0 auto}.upload-page>header{margin-bottom:20px}.upload-eyebrow{margin:0 0 6px;color:#700f2b;font-size:.68rem;font-weight:800;letter-spacing:.13em}.upload-page h1{margin:0;color:#251a1e;font:800 clamp(1.8rem,3vw,2.4rem)/1.15 'Playfair Display',Georgia,serif}.upload-page>header p:last-child{margin:7px 0 0;color:#667085;font-size:.88rem}.upload-card{padding:22px;background:#fff;border:1px solid #eee6e8;border-radius:14px;box-shadow:0 5px 20px #3a09140a}.upload-drop{position:relative;display:flex;min-height:260px;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;color:#635a5d;background:#fbf9fa;border:2px dashed #ddcbd2;border-radius:12px;text-align:center;cursor:pointer}.upload-drop>i{color:#700f2b;font-size:2rem}.upload-drop strong{color:#33292c;font-size:.92rem}.upload-drop span{color:#837b7e;font-size:.72rem}.upload-drop img{max-width:100%;max-height:330px;object-fit:contain}.upload-remove{position:absolute;top:10px;right:10px;width:30px;height:30px;color:#fff;background:#8c1737;border:0;border-radius:50%;font-size:1.2rem;cursor:pointer}.upload-file-name{color:#62595c;font-size:.77rem}.upload-fields{display:grid;gap:13px;margin-top:15px}.upload-fields label{display:grid;gap:6px;color:#40383b;font-size:.77rem;font-weight:800}.upload-fields label span{color:#8a8284;font-weight:500}.upload-fields input,.upload-fields textarea,.upload-fields select{width:100%;padding:10px 11px;border:1px solid #ddd3d7;border-radius:8px;font:400 .84rem/1.5 'DM Sans',sans-serif}.upload-error{padding:10px 12px;color:#9f1239;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;font-size:.8rem}.upload-card footer{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:17px;padding-top:15px;border-top:1px solid #f0ebed}.upload-card footer a,.upload-card footer button{padding:10px 14px;border:1px solid #eadde2;border-radius:8px;color:#700f2b;background:#fff;font-size:.77rem;font-weight:800;text-decoration:none;cursor:pointer}.upload-card footer button{color:#fff;background:#700f2b;border-color:#700f2b}.upload-card footer button:disabled{opacity:.6}@media(max-width:560px){.upload-card{padding:14px}.upload-drop{min-height:210px}}
</style>
