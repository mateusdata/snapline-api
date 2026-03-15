/*
  Warnings:

  - You are about to drop the `gems` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "gems" DROP CONSTRAINT "gems_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gems" INTEGER NOT NULL DEFAULT 500;

-- DropTable
DROP TABLE "gems";

-- CreateTable
CREATE TABLE "gem_transactions" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gem_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gem_transactions" ADD CONSTRAINT "gem_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
