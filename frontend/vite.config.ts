import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em desenvolvimento, /api é encaminhado para a placa (ESP_TARGET=http://192.168.4.1)
// ou para o servidor de testes local (npm run mock).
const target = process.env.ESP_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': { target, changeOrigin: true } } },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    sourcemap: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // nomes curtos: o LittleFS limita o tamanho dos nomes de arquivo
        entryFileNames: 'assets/[hash:10].js',
        chunkFileNames: 'assets/[hash:10].js',
        assetFileNames: 'assets/[hash:10][extname]',
      },
    },
  },
})
