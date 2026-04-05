/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `avatars` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[imageUrl]` on the table `avatars` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "avatars_name_key" ON "avatars"("name");

-- CreateIndex
CREATE UNIQUE INDEX "avatars_imageUrl_key" ON "avatars"("imageUrl");
