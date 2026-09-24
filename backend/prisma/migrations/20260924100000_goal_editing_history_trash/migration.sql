-- AlterTable
ALTER TABLE "goal_stages" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "goal_steps" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "creation_key" UUID,
ADD COLUMN     "deadline_warning_days" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "initial_value" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "life_goals" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "goal_progress_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "value" DECIMAL(14,3) NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_progress_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_progress_entries_goal_id_created_at_idx" ON "goal_progress_entries"("goal_id", "created_at");

-- CreateIndex
CREATE INDEX "goal_progress_entries_user_id_created_at_idx" ON "goal_progress_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "goal_stages_deleted_at_idx" ON "goal_stages"("deleted_at");

-- CreateIndex
CREATE INDEX "goal_steps_deleted_at_idx" ON "goal_steps"("deleted_at");

-- CreateIndex
CREATE INDEX "goals_deleted_at_idx" ON "goals"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "goals_user_id_creation_key_key" ON "goals"("user_id", "creation_key");

-- AddForeignKey
ALTER TABLE "goal_progress_entries" ADD CONSTRAINT "goal_progress_entries_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress_entries" ADD CONSTRAINT "goal_progress_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

