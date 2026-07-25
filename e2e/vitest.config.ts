import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    // A single shared server/CLI/app fixture backs every test, so files must
    // not run in parallel and hooks need room to boot real processes.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
