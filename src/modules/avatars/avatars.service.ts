import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class AvatarsService {
  constructor(private readonly prismaService: PrismaService) { }

  async create(createAvatarDto: CreateAvatarDto) {
    return this.prismaService.avatar.create({
      data: createAvatarDto,
    });
  }

  async findAll() {
    return this.prismaService.avatar.findMany({
      where: { deletedAt: null },
      orderBy: { priceGems: 'asc' },
    });
  }

  async findOne(id: string) {
    const avatar = await this.prismaService.avatar.findFirst({
      where: { id, deletedAt: null }
    });
    if (!avatar) throw new NotFoundException('Avatar não encontrado');
    return avatar;
  }

  async update(id: string, updateAvatarDto: UpdateAvatarDto) {
    try {
      return await this.prismaService.avatar.update({
        where: { id },
        data: updateAvatarDto,
      });
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('Avatar não encontrado');
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prismaService.avatar.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('Avatar não encontrado');
      throw error;
    }
  }

  async buyAvatar(userId: string, avatarId: string) {
    const avatar = await this.prismaService.avatar.findFirst({
      where: { id: avatarId },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar não encontrado na loja');
    }

    const existingPurchase = await this.prismaService.userAvatar.findUnique({
      where: {
        userId_avatarId: { userId, avatarId }
      }
    });

    if (existingPurchase) {
      throw new ConflictException('Você já possui este avatar');
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (!avatar.isPremium && avatar.priceGems > 0) {
      if (user.gems < avatar.priceGems) {
        throw new BadRequestException('Gemas insuficientes');
      }
    }

    return await this.prismaService.$transaction(async (prisma) => {
      let updatedGems = user.gems;

      if (!avatar.isPremium && avatar.priceGems > 0) {
        updatedGems -= avatar.priceGems;

        await prisma.gemTransaction.create({
          data: {
            amount: -avatar.priceGems,
            reason: `Compra de avatar: ${avatar.name || avatar.id}`,
            userId: userId,
          },
        });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gems: updatedGems },
      });

      await prisma.userAvatar.create({
        data: {
          userId: userId,
          avatarId: avatarId,
          isEquipped: false
        }
      });

      return prisma.user.findFirst({
        where: { id: userId },
        include: {
          gemTransaction: true,
          userAvatars: true, // Do jeito que você falou que funcionou!
        }
      });
    });
  }
}