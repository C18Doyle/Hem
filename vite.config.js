import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // background-removal ships wasm/onnx assets that Vite should not pre-bundle
  optimizeDeps: { exclude: ["@imgly/background-removal"] },
});
