import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is entirely client-side: no server, no accounts, no upload path.
// See spec §14 — that claim is what lets this be used without a security review.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
})
