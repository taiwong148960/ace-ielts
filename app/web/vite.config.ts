import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ace-ielts/core/i18n": path.resolve(__dirname, "../../packages/core/src/i18n"),
      "@ace-ielts/core/adapters": path.resolve(__dirname, "../../packages/core/src/adapters"),
      "@ace-ielts/core/services": path.resolve(__dirname, "../../packages/core/src/services"),
      "@ace-ielts/core/hooks": path.resolve(__dirname, "../../packages/core/src/hooks"),
      "@ace-ielts/core/utils": path.resolve(__dirname, "../../packages/core/src/utils"),
      "@ace-ielts/core/types": path.resolve(__dirname, "../../packages/core/src/types"),
      "@ace-ielts/core": path.resolve(__dirname, "../../packages/core/src"),
      "@ace-ielts/ui": path.resolve(__dirname, "../../packages/ui/src")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    port: 3000,
    open: true
  }
})
