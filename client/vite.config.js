import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Listen on all network interfaces
    allowedHosts: [
      'macbook-air-de-benot.tailc7a918.ts.net',
      '.tailc7a918.ts.net' // Allow all subdomains
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true // Needed for external clients
      }
    }
  }
});
