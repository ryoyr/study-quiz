import { defineConfig } from "vite";

const base = process.env.VITE_BASE_PATH?.trim() || "/study-quiz/";

export default defineConfig({
  base: base.endsWith("/") ? base : `${base}/`,
  build: {
    target: "es2022",
    sourcemap: false,
  },
});



