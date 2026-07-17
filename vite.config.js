import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Proxies /api requests to the backend during local dev, so the frontend
// can call fetch('/api/...') without worrying about CORS or hardcoding
// http://localhost:5000 everywhere.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
});
