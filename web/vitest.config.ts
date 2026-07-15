import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests run against a throwaway SQLite db (prisma/test.db) that global-setup
// recreates from the schema on every run. Files run sequentially because they
// share one database.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    env: { DATABASE_URL: "file:./prisma/test.db" },
    globalSetup: "./tests/global-setup.ts",
    fileParallelism: false,
    testTimeout: 20_000,
    include: ["tests/**/*.test.ts"],
  },
});
