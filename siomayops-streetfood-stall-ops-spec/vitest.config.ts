import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // The UI integration tests render real components (tests/ui, tests/integration). Next.js supplies
  // the automatic JSX runtime in the app; Vitest needs it declared so those components compile the
  // same way here. Merged from two branches that added this option independently.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    coverage: { provider: "v8", reporter: ["text", "html"] }
  }
});
