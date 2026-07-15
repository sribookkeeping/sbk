import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

export default function setup() {
  // Recreate the throwaway TEST database (prisma/test.db — never the dev db)
  // from the schema on every run: remove the file, then push the schema fresh.
  const testDb = path.join(process.cwd(), "prisma", "test.db");
  rmSync(testDb, { force: true });
  rmSync(`${testDb}-journal`, { force: true });

  execSync("npx prisma db push", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
    stdio: "inherit",
  });
}
