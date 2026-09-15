-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "orgs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "github_installation_id" INTEGER,
    "repo_owner" TEXT,
    "repo_name" TEXT,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "similarity_threshold" REAL NOT NULL DEFAULT 0.9,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "memberships" (
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TEXT NOT NULL,

    PRIMARY KEY ("user_id", "org_id"),
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "accepted_at" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TEXT,
    "revoked_at" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "api_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "write_requests" (
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
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "write_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "write_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "write_request_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "approver_handle" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "approvals_write_request_id_fkey" FOREIGN KEY ("write_request_id") REFERENCES "write_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "run" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "usage_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orgs_slug_key" ON "orgs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_org_id_handle_key" ON "memberships"("org_id", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "write_requests_org_id_status_idx" ON "write_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "usage_logs_org_id_path_idx" ON "usage_logs"("org_id", "path");
