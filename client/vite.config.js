import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true
    })
  ],
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
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'utils': ['dompurify']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
