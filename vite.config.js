import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates report when ANALYZE=true
    visualizer({
      open: false,
      filename: 'dist/bundle-analysis.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
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
          // Lottie canvas player - lighter variant for TGS animations
          if (id.includes('lottie-web') || id.includes('lottie_canvas')) {
            return 'lottie';
          }
          // HTML to canvas - only needed for export functionality
          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }
          // Compression utility - lazy loaded for TGS decompression
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
    // Chunk size warning limit: 250KB is a good target for Telegram Mini Apps
    // React core (~193KB) is unavoidable; lottie (~267KB) is lazy-loaded
    // Adjust if adding new large dependencies
    chunkSizeWarningLimit: 250,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', '@dnd-kit/core', '@dnd-kit/sortable'],
    // Exclude heavy libs from pre-bundling to speed up dev start
    exclude: ['html2canvas', 'lottie-web'],
  },
})
