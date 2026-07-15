// Demo data for local trial: `npm run seed`
// Sign in as ravi@demo.family / demo1234 (head), sita@demo.family / demo1234
// (other parent), or arjun@demo.family / demo1234 (kid).
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const existing = await db.family.findFirst({ where: { name: "The Demo Family" } });
  if (existing) {
    console.log("Demo family already exists — nothing to do.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const family = await db.family.create({ data: { name: "The Demo Family" } });

  const ravi = await db.member.create({
    data: {
      familyId: family.id, name: "Ravi", role: "PARENT", isHead: true,
      emoji: "🧑‍💼", email: "ravi@demo.family", passwordHash,
      isPlatformAdmin: true, // demo platform admin — /admin + impersonation
    },
  });
  const sita = await db.member.create({
    data: {
      familyId: family.id, name: "Sita", role: "PARENT",
      emoji: "👩", email: "sita@demo.family", passwordHash,
    },
  });
  const arjun = await db.member.create({
    data: {
      familyId: family.id, name: "Arjun", role: "CHILD",
      emoji: "🧒", email: "arjun@demo.family", passwordHash,
    },
  });
  await db.member.create({
    data: { familyId: family.id, name: "Meera", role: "CHILD", emoji: "👧" },
  });
  await db.member.create({
    data: {
      familyId: family.id, name: "Grandma Lakshmi", role: "GRANDPARENT",
      emoji: "👵", email: "grandma@demo.family", passwordHash,
    },
  });

  // Active pool chores (created before both parents existed → seeded as active).
  const pool = [
    { title: "Mow the lawn", details: "Front and back yard", amountCents: 1000 },
    { title: "Do the dishes", details: "After dinner", amountCents: 300 },
    { title: "Fold the laundry", details: "", amountCents: 500 },
    { title: "Vacuum the living room", details: "", amountCents: 400 },
  ];
  for (const c of pool) {
    await db.chore.create({
      data: { ...c, familyId: family.id, kind: "POOL", poolStatus: "ACTIVE", createdById: ravi.id },
    });
  }

  // A kid-proposed chore awaiting any parent's approval (requirement 5).
  const kidChore = await db.chore.create({
    data: {
      familyId: family.id, title: "Water the plants", amountCents: 200,
      kind: "POOL", poolStatus: "PENDING_APPROVAL", createdById: arjun.id,
    },
  });
  await db.approvalRequest.create({
    data: { familyId: family.id, type: "POOL_CHORE", requestedById: arjun.id, choreId: kidChore.id },
  });

  // A parent-proposed chore awaiting the OTHER parent (requirement 6).
  const parentChore = await db.chore.create({
    data: {
      familyId: family.id, title: "Wash the car", amountCents: 800,
      kind: "POOL", poolStatus: "PENDING_APPROVAL", createdById: sita.id,
    },
  });
  await db.approvalRequest.create({
    data: { familyId: family.id, type: "POOL_CHORE", requestedById: sita.id, choreId: parentChore.id },
  });

  console.log("Seeded demo family. Sign in: ravi@demo.family / demo1234");
}

main().finally(() => db.$disconnect());
