import { execSync } from "node:child_process";
import { Client } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/sbk_test";

export default async function setup() {
  // Ensure the schema exists on the throwaway TEST database, then wipe all
  // rows so every run starts clean (tests are family-scoped, but this keeps
  // runs deterministic). Never touches the dev/prod database.
  execSync("npx prisma db push", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length > 0) {
    const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
    await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
  await client.end();
}
