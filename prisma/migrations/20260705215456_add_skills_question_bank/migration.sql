-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('JUNIOR', 'MID', 'SENIOR');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TECHNICAL', 'BEHAVIORAL', 'SITUATIONAL');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "seniority" "Seniority" NOT NULL DEFAULT 'MID';

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "seniority" "Seniority",
    "type" "QuestionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_job_id_name_key" ON "skills"("job_id", "name");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
