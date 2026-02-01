import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Target modern browsers for smaller bundle (Telegram uses modern WebView)
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize chunk splitting for faster initial load
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: (id) => {
          // React core - frequently used, cache separately
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-core';
          }
          // Drag-and-drop - only needed when interacting with grid
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }
          // Heavy media libs - lazy loaded, cache separately
          if (id.includes('lottie-web') || id.includes('html2canvas')) {
            return 'media';
          }
          // Compression utility - lazy loaded
          if (id.includes('pako')) {
            return 'pako';
          }
          // Modal - lazy loaded when user opens cell
          if (id.includes('react-modal')) {
            return 'modal';
          }
        },
        // Use hashed filenames for long-term caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Minification settings
    minify: 'esbuild',
    // Source maps in production for debugging (can disable if needed)
    sourcemap: false,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', '@dnd-kit/core', '@dnd-kit/sortable'],
    // Exclude heavy libs from pre-bundling to speed up dev start
    exclude: ['html2canvas'],
  },
})
