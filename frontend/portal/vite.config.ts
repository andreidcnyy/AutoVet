import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '^/app/': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/sanctum': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // `vite preview` gets its own proxy table -- without one, a production build
  // served locally has no /media route and every uploaded image 404s.
  preview: {
    port: 4174,
    proxy: {
      '/api': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/sanctum': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://autovet.test',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
