CREATE TABLE "users" (
  "id" VARCHAR(32) NOT NULL,
  "openid_hash" VARCHAR(128) NOT NULL,
  "nickname" VARCHAR(64) NOT NULL DEFAULT '玩家',
  "avatar" TEXT NOT NULL DEFAULT '',
  "coin" INTEGER NOT NULL DEFAULT 0,
  "selected_card_back" VARCHAR(64) NOT NULL DEFAULT 'default',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_openid_hash_key" ON "users"("openid_hash");
CREATE INDEX "idx_users_coin_rank" ON "users"("coin" DESC, "created_at" ASC);

CREATE TABLE "rooms" (
  "id" VARCHAR(16) NOT NULL,
  "owner_id" VARCHAR(32) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_rooms_owner_id" ON "rooms"("owner_id");
CREATE INDEX "idx_rooms_status_created_at" ON "rooms"("status", "created_at");

CREATE TABLE "game_records" (
  "id" VARCHAR(32) NOT NULL,
  "room_id" VARCHAR(16) NOT NULL,
  "rule_config" JSONB NOT NULL,
  "players" JSONB NOT NULL,
  "rankings" JSONB NOT NULL,
  "winner_id" VARCHAR(32),
  "seed_hash" VARCHAR(128) NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL,
  "ended_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "game_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_game_records_room_id" ON "game_records"("room_id");
CREATE INDEX "idx_game_records_winner_id" ON "game_records"("winner_id");
CREATE INDEX "idx_game_records_ended_at" ON "game_records"("ended_at");

CREATE TABLE "game_actions" (
  "id" BIGSERIAL NOT NULL,
  "game_id" VARCHAR(32) NOT NULL,
  "player_id" VARCHAR(32),
  "action_type" VARCHAR(32) NOT NULL,
  "action_payload" JSONB NOT NULL,
  "state_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_game_actions_game_id" ON "game_actions"("game_id");
CREATE INDEX "idx_game_actions_created_at" ON "game_actions"("created_at");

CREATE TABLE "ad_rewards" (
  "id" BIGSERIAL NOT NULL,
  "user_id" VARCHAR(32) NOT NULL,
  "reward_type" VARCHAR(32) NOT NULL,
  "amount" INTEGER NOT NULL,
  "ad_unit_id" VARCHAR(128),
  "claimed_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_ad_rewards_user_date" ON "ad_rewards"("user_id", "claimed_date");
CREATE INDEX "idx_ad_rewards_type_date" ON "ad_rewards"("reward_type", "claimed_date");

CREATE TABLE "user_daily_stats" (
  "user_id" VARCHAR(32) NOT NULL,
  "stat_date" DATE NOT NULL,
  "games_played" INTEGER NOT NULL DEFAULT 0,
  "games_won" INTEGER NOT NULL DEFAULT 0,
  "ad_rewards_claimed" INTEGER NOT NULL DEFAULT 0,
  "coin_earned" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "user_daily_stats_pkey" PRIMARY KEY ("user_id", "stat_date"),
  CONSTRAINT "user_daily_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "app_configs" (
  "key" VARCHAR(64) NOT NULL,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "app_configs_pkey" PRIMARY KEY ("key")
);
