import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^najm-kit\/theme\.css$/,
        replacement: resolve(__dirname, "../../packages/najm-kit/src/theme.css"),
      },
      {
        find: /^najm-kit$/,
        replacement: resolve(__dirname, "../../packages/najm-kit/src/index.ts"),
      },
    ],
  },
});
