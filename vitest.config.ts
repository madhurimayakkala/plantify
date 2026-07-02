import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest's default test file matching also picks up Playwright's
    // *.spec.ts files in tests/, which breaks because those can only be
    // run by the Playwright test runner, not Vitest. This narrows Vitest
    // to only the actual unit test files in this project.
    include: ["lib/**/*.test.ts"],
  },
});