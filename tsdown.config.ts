import { defineConfig } from "tsdown";

export default defineConfig({
  dts: {
    tsgo: true,
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  exports: true,
  minify: true,
  // ...config options
});
