import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
	  react(),
	  tailwindcss()
  ],
  server: {
  host: '0.0.0.0',
  proxy: {
      '/api': 'http://localhost:8000'
  },
  allowedHosts: ['catfish-teaching-notably.ngrok-free.app']
}

})
