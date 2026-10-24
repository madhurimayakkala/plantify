import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    // Vitest's default test file matching also picks up Playwright's
    // *.spec.ts files in tests/, which breaks because those can only be
    // run by the Playwright test runner, not Vitest. This narrows Vitest
    // to only the actual unit test files in this project.
    //
    // Hook tests opt in to a browser-like environment per file with
    // `// @vitest-environment jsdom`.
    include: ["lib/**/*.test.ts", "hooks/**/*.test.ts"],
  },
});
