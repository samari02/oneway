import { defineConfig } from 'vite'
import { resolve } from 'path'

// Build config for extension
// Note: Content scripts need IIFE format, service worker needs ES modules.
// In development watch, keep emptyOutDir false so concurrent esbuild content-script
// output and copy-files artifacts in dist/ are not wiped on each Vite rebuild.
export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    emptyOutDir: mode !== 'development',
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
}))
