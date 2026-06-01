/*
  Warnings:

  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive",
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'csr';
