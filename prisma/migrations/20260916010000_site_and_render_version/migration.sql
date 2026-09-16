-- AlterTable
ALTER TABLE "orgs" ADD COLUMN "site_url" TEXT;
ALTER TABLE "orgs" ADD COLUMN "site_published_at" TEXT;

-- AlterTable
ALTER TABLE "drive_sync_items" ADD COLUMN "render_version" INTEGER NOT NULL DEFAULT 0;
