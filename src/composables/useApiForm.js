import { reactive } from 'vue';
import { apiRequest } from '../services/api.js';
import { appState, showFlash, updateShared } from '../state/appState.js';

function firstErrors(errors = {}) {
    return Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export function useApiForm(initialData) {
    const keys = Object.keys(initialData);
    const form = reactive({
        ...initialData,
        errors: {},
        processing: false,
        wasSuccessful: false,
        reset(...fields) {
            const selected = fields.length ? fields : keys;
            for (const key of selected) {
                if (keys.includes(key)) form[key] = initialData[key];
            }
            form.clearErrors(...selected);
        },
        clearErrors(...fields) {
            if (!fields.length) {
                form.errors = {};
                return;
            }
            const errors = { ...form.errors };
            for (const field of fields) delete errors[field];
            form.errors = errors;
        },
        setError(field, message) {
            form.errors = { ...form.errors, [field]: message };
        },
        async post(url, options = {}) {
            return submit('POST', url, options);
        },
        async put(url, options = {}) {
            return submit('PUT', url, options);
        },
        async patch(url, options = {}) {
            return submit('PATCH', url, options);
        },
        async delete(url, options = {}) {
            return submit('DELETE', url, options);
        },
    });

    async function submit(method, url, options) {
        form.processing = true;
        form.wasSuccessful = false;
        form.clearErrors();
        updateShared({ errors: {} });

        const values = Object.fromEntries(keys.map((key) => [key, form[key]]));
        let data = values;
        if (options.forceFormData || Object.values(values).some((value) => value instanceof File || value instanceof Blob)) {
            data = new FormData();
            for (const [key, value] of Object.entries(values)) {
                if (value !== null && value !== undefined) data.append(key, value);
            }
        }

        try {
            const response = await apiRequest(url, { method, data });
            const result = response.data ?? {};
            if (result.shared) updateShared(result.shared);
            if (result.user) updateShared({ auth: { ...(appState.shared.auth ?? {}), user: result.user } });
            if (result.message) showFlash('success', result.message);
            form.wasSuccessful = true;
            await options.onSuccess?.(result);
            return result;
        } catch (error) {
            const errors = firstErrors(error.response?.data?.errors ?? {});
            if (!Object.keys(errors).length && error.response?.data?.message) errors.general = error.response.data.message;
            form.errors = errors;
            updateShared({ errors });
            await options.onError?.(errors);
            return null;
        } finally {
            form.processing = false;
        }
    }

    return form;
}
