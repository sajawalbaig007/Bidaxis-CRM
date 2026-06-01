/*
  Warnings:

  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "role" DROP DEFAULT,
ALTER COLUMN "lastActive" DROP NOT NULL,
ALTER COLUMN "lastActive" DROP DEFAULT;
