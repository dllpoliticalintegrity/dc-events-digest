import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  plugins: [react(), yaml()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
