import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.config.errorHandler = (err, instance, info) => {
    console.error('Vue runtime error:', err, info);
};

if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise Rejection:', event.reason);
    });
}

app.use(pinia);
app.use(router);

router.isReady().then(() => {
    app.mount('#app');
});

