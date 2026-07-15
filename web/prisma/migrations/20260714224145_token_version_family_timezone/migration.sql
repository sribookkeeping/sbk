-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Family" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Family" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Family";
DROP TABLE "Family";
ALTER TABLE "new_Family" RENAME TO "Family";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "emoji" TEXT NOT NULL DEFAULT '🙂',
    "email" TEXT,
    "passwordHash" TEXT,
    "reportFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "lastReportSentAt" DATETIME,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("createdAt", "email", "emoji", "familyId", "id", "isHead", "isPlatformAdmin", "lastReportSentAt", "name", "passwordHash", "reportFrequency", "role") SELECT "createdAt", "email", "emoji", "familyId", "id", "isHead", "isPlatformAdmin", "lastReportSentAt", "name", "passwordHash", "reportFrequency", "role" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
