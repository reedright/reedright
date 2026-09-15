-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirect_uris" TEXT NOT NULL,
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "secret_hash" TEXT,
    "metadata" TEXT NOT NULL,
    "fetched_at" TEXT,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "oauth_codes" (
    "code_hash" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "scope" TEXT,
    "resource" TEXT,
    "expires_at" TEXT NOT NULL,
    "used_at" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "oauth_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TEXT,
    "revoked_at" TEXT,
    "created_at" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pat',
    "client_id" TEXT,
    "expires_at" TEXT,
    "refresh_token_hash" TEXT,
    "refresh_expires_at" TEXT,
    CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "api_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "api_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_api_tokens" ("created_at", "id", "last_used_at", "name", "org_id", "prefix", "revoked_at", "token_hash", "user_id") SELECT "created_at", "id", "last_used_at", "name", "org_id", "prefix", "revoked_at", "token_hash", "user_id" FROM "api_tokens";
DROP TABLE "api_tokens";
ALTER TABLE "new_api_tokens" RENAME TO "api_tokens";
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");
CREATE UNIQUE INDEX "api_tokens_refresh_token_hash_key" ON "api_tokens"("refresh_token_hash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
