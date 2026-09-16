-- CreateTable
CREATE TABLE "drive_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "drive_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "last_run_at" TEXT,
    "last_error" TEXT,
    "last_request_id" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "drive_syncs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "drive_sync_items" (
    "sync_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "modified_time" TEXT NOT NULL,
    "checksum" TEXT,
    "request_id" TEXT,
    "archived_at" TEXT,
    "updated_at" TEXT NOT NULL,

    PRIMARY KEY ("sync_id", "file_id"),
    CONSTRAINT "drive_sync_items_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "drive_syncs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_write_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "run" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lint_report" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'entry',
    "paths" TEXT,
    "summary" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "write_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "write_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_write_requests" ("branch", "created_at", "domain", "handle", "id", "lint_report", "org_id", "path", "pr_number", "pr_url", "run", "status", "title", "type", "updated_at", "user_id") SELECT "branch", "created_at", "domain", "handle", "id", "lint_report", "org_id", "path", "pr_number", "pr_url", "run", "status", "title", "type", "updated_at", "user_id" FROM "write_requests";
DROP TABLE "write_requests";
ALTER TABLE "new_write_requests" RENAME TO "write_requests";
CREATE INDEX "write_requests_org_id_status_idx" ON "write_requests"("org_id", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "drive_syncs_org_id_drive_id_key" ON "drive_syncs"("org_id", "drive_id");
