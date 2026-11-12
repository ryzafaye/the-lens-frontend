import { reactive } from 'vue';

const defaultShared = {
    auth: { user: null },
    flash: {},
    errors: {},
};

export const appState = reactive({
    shared: { ...defaultShared },
    pageProps: {},
    props: { ...defaultShared },
    loading: false,
    error: null,
    revision: 0,
});

export function useAppState() {
    return appState;
}

export function setPageResponse(response = {}) {
    const shared = { ...defaultShared, ...(response.shared ?? {}) };
    const pageProps = response.props ?? {};

    appState.shared = shared;
    appState.pageProps = pageProps;
    appState.props = { ...shared, ...pageProps };
    appState.error = null;
    appState.revision += 1;
}

export function updateShared(values = {}) {
    appState.shared = { ...appState.shared, ...values };
    appState.props = { ...appState.props, ...values };
}

export function showFlash(kind, message) {
    const flash = { ...(appState.shared.flash ?? {}), [kind]: message };
    updateShared({ flash });
}
