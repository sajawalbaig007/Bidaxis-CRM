-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "company" TEXT,
ADD COLUMN     "followUpExpiry" TIMESTAMP(3),
ADD COLUMN     "followUpNotes" TEXT,
ADD COLUMN     "interestedService" TEXT,
ADD COLUMN     "nextSchedule" TEXT,
ADD COLUMN     "nextTime" TEXT,
ADD COLUMN     "projectBudget" TEXT,
ADD COLUMN     "projectDeadline" TEXT,
ADD COLUMN     "projectNotes" TEXT,
ADD COLUMN     "projectTitle" TEXT,
ADD COLUMN     "timezone" TEXT;
