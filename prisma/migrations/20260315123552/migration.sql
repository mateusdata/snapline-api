-- AlterTable
ALTER TABLE "gem_transactions" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;
