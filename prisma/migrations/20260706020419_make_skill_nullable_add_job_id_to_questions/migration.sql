-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_skill_id_fkey";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "job_id" TEXT,
ALTER COLUMN "skill_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "questions_job_id_idx" ON "questions"("job_id");
