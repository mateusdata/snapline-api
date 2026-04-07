import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AvatarsService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async create(createAvatarDto: CreateAvatarDto) {
    return this.prismaService.avatar.create({
      data: createAvatarDto,
    });
  }

  async findAll() {
    try {
      const cached = await this.cacheManager.get('avatars');
      if (cached) {
        return cached;
      }

      const avatars = await this.prismaService.avatar.findMany({
        where: { deletedAt: null },
        orderBy: { priceGems: 'asc' },
      });

      await this.cacheManager.set('avatars', avatars, 2000 );
      return avatars;
    } catch (error) {
      throw error;
    }
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

  async buyAvatar(userId: string, avatarId: string, isAdUnlock: boolean = false) {
    const avatar = await this.prismaService.avatar.findFirst({
      where: { id: avatarId },
    });

    if (!avatar) throw new NotFoundException('Avatar não encontrado na loja');

    const existingPurchase = await this.prismaService.userAvatar.findUnique({
      where: { userId_avatarId: { userId, avatarId } }
    });

    if (existingPurchase && !existingPurchase.expiresAt) {
      throw new ConflictException('Você já possui este avatar permanentemente');
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (!isAdUnlock && !avatar.isPremium && avatar.priceGems > 0) {
      if (user.gems < avatar.priceGems) {
        throw new BadRequestException('Gemas insuficientes');
      }
    }

    return await this.prismaService.$transaction(async (prisma) => {
      let updatedGems = user.gems;

      if (!isAdUnlock && !avatar.isPremium && avatar.priceGems > 0) {
        updatedGems -= avatar.priceGems;
        await prisma.gemTransaction.create({
          data: {
            amount: -avatar.priceGems,
            reason: `Compra de avatar: ${avatar.name || avatar.id}`,
            userId: userId,
          },
        });
      }

      const expiresAt = isAdUnlock ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

      await prisma.userAvatar.updateMany({
        where: { userId: userId },
        data: { isDefault: false }
      });

      if (existingPurchase) {
        await prisma.userAvatar.update({
          where: { userId_avatarId: { userId, avatarId } },
          data: { expiresAt: expiresAt, isDefault: true },
        });
      } else {
        await prisma.userAvatar.create({
          data: {
            userId: userId,
            avatarId: avatarId,
            expiresAt: expiresAt,
            isDefault: true
          }
        });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { 
          gems: updatedGems
        },
      });

      return prisma.user.findFirst({
        where: { id: userId },
        include: { 
          gemTransaction: true, 
          userAvatars: {
            where: {
              deletedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            select: { id: true, isDefault: true, expiresAt: true, avatar: true }
          }
        }
      });
    });
  }

  async defaultAvatar(userId: string, avatarId: string) {
    const ownership = await this.prismaService.userAvatar.findUnique({
      where: {
        userId_avatarId: { userId, avatarId }
      },
      include: {
        avatar: true
      }
    });

    if (!ownership || ownership.deletedAt) {
      throw new NotFoundException('Você não possui esta peça no seu inventário.');
    }

    if (ownership.expiresAt && new Date(ownership.expiresAt) < new Date()) {
      throw new BadRequestException('O tempo desta peça expirou. Libere-a novamente!');
    }

    return await this.prismaService.$transaction(async (prisma) => {
      
      await prisma.userAvatar.updateMany({
        where: { userId: userId },
        data: { isDefault: false }
      });

      await prisma.userAvatar.update({
        where: { userId_avatarId: { userId, avatarId } },
        data: { isDefault: true }
      });

      return prisma.user.findUnique({
        where: { id: userId },
        include: {
          userAvatars: {
            where: {
              deletedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            select: { id: true, isDefault: true, expiresAt: true, avatar: true }
          }
        }
      });
    });
  }
}