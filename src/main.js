import './app.css';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);
app.use(router);
await router.isReady();
app.mount('#app');
