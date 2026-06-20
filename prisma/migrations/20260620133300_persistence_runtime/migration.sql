CREATE TABLE "auth_sessions" (
  "token_hash" VARCHAR(128) NOT NULL,
  "user_id" VARCHAR(32) NOT NULL,
  "openid_hash" VARCHAR(128) NOT NULL,
  "session_key_hash" VARCHAR(128),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions"("user_id");
CREATE INDEX "idx_auth_sessions_expires_at" ON "auth_sessions"("expires_at");

CREATE TABLE "user_task_claims" (
  "user_id" VARCHAR(32) NOT NULL,
  "task_id" VARCHAR(64) NOT NULL,
  "claim_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_task_claims_pkey" PRIMARY KEY ("user_id", "task_id", "claim_date"),
  CONSTRAINT "user_task_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_user_task_claims_task_date" ON "user_task_claims"("task_id", "claim_date");

CREATE TABLE "user_card_backs" (
  "user_id" VARCHAR(32) NOT NULL,
  "card_back_id" VARCHAR(64) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_card_backs_pkey" PRIMARY KEY ("user_id", "card_back_id"),
  CONSTRAINT "user_card_backs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_user_card_backs_card_back_id" ON "user_card_backs"("card_back_id");
