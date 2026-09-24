-- CreateEnum
CREATE TYPE "schedule_rule_kind" AS ENUM ('daily', 'weekdays', 'monthdays', 'dates');

-- AlterTable
ALTER TABLE "day_templates" ADD COLUMN     "month_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "rule_from" DATE,
ADD COLUMN     "rule_kind" "schedule_rule_kind",
ADD COLUMN     "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "series_date" DATE,
ADD COLUMN     "series_detached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "series_id" UUID;

-- CreateTable
CREATE TABLE "day_profiles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "starter_categories_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_series" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_minute" INTEGER,
    "duration_minutes" INTEGER NOT NULL,
    "priority" "task_priority" NOT NULL DEFAULT 'normal',
    "category_id" UUID,
    "color_override" TEXT,
    "rule_kind" "schedule_rule_kind" NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "month_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dates" DATE[],
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "excluded_dates" DATE[] DEFAULT ARRAY[]::DATE[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_template_applications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "template_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "applied_on" DATE NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_template_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_profiles_user_id_key" ON "day_profiles"("user_id");

-- CreateIndex
CREATE INDEX "task_series_user_id_idx" ON "task_series"("user_id");

-- CreateIndex
CREATE INDEX "day_template_applications_user_id_applied_on_idx" ON "day_template_applications"("user_id", "applied_on");

-- CreateIndex
CREATE UNIQUE INDEX "day_template_applications_template_id_applied_on_key" ON "day_template_applications"("template_id", "applied_on");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_series_id_series_date_key" ON "tasks"("series_id", "series_date");

-- AddForeignKey
ALTER TABLE "day_profiles" ADD CONSTRAINT "day_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_series" ADD CONSTRAINT "task_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "task_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_template_applications" ADD CONSTRAINT "day_template_applications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "day_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_template_applications" ADD CONSTRAINT "day_template_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

