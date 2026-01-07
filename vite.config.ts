import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'esnext',
    minify: 'terser', // Enable minification for production
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/index.tsx',
      external: ['@logseq/libs'],
      output: {
        entryFileNames: 'index.js',
        format: 'iife',
        name: 'LogseqAIPlugin',
        // Note: Manual chunks not compatible with IIFE format
        // Code splitting would require ES module format
      },
    },
    // T121: Bundle size limits (500KB gzipped)
    chunkSizeWarningLimit: 500,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})
