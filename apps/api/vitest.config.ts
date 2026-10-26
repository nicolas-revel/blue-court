import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Nest reads constructor types from decorator metadata, which esbuild does not emit.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
});
