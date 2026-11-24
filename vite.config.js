import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        host: true,
        allowedHosts: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/sanctum': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/storage': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/uploads': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        manifest: 'manifest.json',
        outDir: 'dist',
        emptyOutDir: true,
    },
});
