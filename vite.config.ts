/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project site: https://incoherentthoughts.github.io/raffle/
export default defineConfig({
  base: '/raffle/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Agent worktrees live inside the repo; don't run their copies of the suite.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
