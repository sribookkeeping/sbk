import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests run against a throwaway Postgres database (TEST_DATABASE_URL, default a
// local `sbk_test`) that global-setup syncs + clears on every run. Files run
// sequentially because they share one database.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/sbk_test";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: "./tests/global-setup.ts",
    fileParallelism: false,
    testTimeout: 20_000,
    include: ["tests/**/*.test.ts"],
  },
});
