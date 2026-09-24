-- CreateEnum
CREATE TYPE "goal_progress_mode" AS ENUM ('manual', 'automatic');

-- CreateEnum
CREATE TYPE "goal_status" AS ENUM ('active', 'completed', 'abandoned');

-- CreateTable
CREATE TABLE "life_goals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "primary_goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "life_goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "measure_unit" TEXT NOT NULL,
    "target_value" DECIMAL(14,3) NOT NULL,
    "current_value" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "progress_mode" "goal_progress_mode" NOT NULL DEFAULT 'manual',
    "status" "goal_status" NOT NULL DEFAULT 'active',
    "outcome_note" TEXT,
    "position" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_stages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_steps" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "stage_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "estimated_minutes" INTEGER,
    "completed_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "life_goals_user_id_key" ON "life_goals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "life_goals_primary_goal_id_key" ON "life_goals"("primary_goal_id");

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goals_life_goal_id_position_idx" ON "goals"("life_goal_id", "position");

-- CreateIndex
CREATE INDEX "goal_stages_goal_id_position_idx" ON "goal_stages"("goal_id", "position");

-- CreateIndex
CREATE INDEX "goal_steps_stage_id_position_idx" ON "goal_steps"("stage_id", "position");

-- CreateIndex
CREATE INDEX "goal_steps_user_id_completed_at_idx" ON "goal_steps"("user_id", "completed_at");

-- AddForeignKey
ALTER TABLE "life_goals" ADD CONSTRAINT "life_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_goals" ADD CONSTRAINT "life_goals_primary_goal_id_fkey" FOREIGN KEY ("primary_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_life_goal_id_fkey" FOREIGN KEY ("life_goal_id") REFERENCES "life_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_stages" ADD CONSTRAINT "goal_stages_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_stages" ADD CONSTRAINT "goal_stages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_steps" ADD CONSTRAINT "goal_steps_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "goal_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_steps" ADD CONSTRAINT "goal_steps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
