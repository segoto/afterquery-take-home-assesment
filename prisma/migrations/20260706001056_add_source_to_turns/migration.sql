-- CreateEnum
CREATE TYPE "TurnSource" AS ENUM ('ANTHROPIC', 'OPENROUTER');

-- AlterTable
ALTER TABLE "turns" ADD COLUMN     "source" "TurnSource";
