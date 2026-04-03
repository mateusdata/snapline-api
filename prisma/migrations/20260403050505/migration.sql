/*
  Warnings:

  - You are about to drop the `_AvatarToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AvatarToUser" DROP CONSTRAINT "_AvatarToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_AvatarToUser" DROP CONSTRAINT "_AvatarToUser_B_fkey";

-- DropTable
DROP TABLE "_AvatarToUser";

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_userId_avatarId_key" ON "user_avatars"("userId", "avatarId");

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
