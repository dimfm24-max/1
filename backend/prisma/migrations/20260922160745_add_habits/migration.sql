-- CreateEnum
CREATE TYPE "habit_schedule" AS ENUM ('daily', 'weekdays', 'interval');

-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "schedule" "habit_schedule" NOT NULL DEFAULT 'daily',
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "started_on" DATE NOT NULL,
    "archived_at" TIMESTAMP(3),
    "color" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_marks" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "habit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "marked_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habits_user_id_position_idx" ON "habits"("user_id", "position");

-- CreateIndex
CREATE INDEX "habit_marks_user_id_marked_on_idx" ON "habit_marks"("user_id", "marked_on");

-- CreateIndex
CREATE UNIQUE INDEX "habit_marks_habit_id_marked_on_key" ON "habit_marks"("habit_id", "marked_on");

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_marks" ADD CONSTRAINT "habit_marks_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_marks" ADD CONSTRAINT "habit_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
