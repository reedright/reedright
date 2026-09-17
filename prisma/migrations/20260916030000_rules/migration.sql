-- AlterTable
ALTER TABLE "orgs" ADD COLUMN "enabled_rules" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "write_requests" ADD COLUMN "flags" TEXT;
