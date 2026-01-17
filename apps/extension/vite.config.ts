import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
        'block-screen': resolve(__dirname, 'src/ui/block-screen/block-screen.ts'),
        'popup': resolve(__dirname, 'src/ui/popup/popup.ts')
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  }
})
