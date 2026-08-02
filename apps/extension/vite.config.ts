import { defineConfig } from 'vite'
import { resolve } from 'path'

// Build config for extension
// Note: Content scripts need IIFE format, service worker needs ES modules
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'block-screen': resolve(__dirname, 'src/ui/block-screen/block-screen.ts'),
        'popup': resolve(__dirname, 'src/ui/popup/popup.ts'),
        'tab-manager': resolve(__dirname, 'src/modules/tab-manager/tab-manager.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  }
})
