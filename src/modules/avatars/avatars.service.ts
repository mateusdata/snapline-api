import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
      Logger.debug('Avatars retornados do cache');
      return cached;
    }

    const avatars = await this.prismaService.avatar.findMany({
      where: { deletedAt: null },
      orderBy: { priceGems: 'asc' },
    });

    await this.cacheManager.set('avatars', avatars, 3600000 ); // 1 hora em milissegundos
    Logger.debug('Avatars retornados do banco e salvos no cache');
    return avatars;
  } catch (error) {
    Logger.error('Erro ao buscar avatars', error);
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

    if (!avatar) {
      throw new NotFoundException('Avatar não encontrado na loja');
    }

    const existingPurchase = await this.prismaService.userAvatar.findUnique({
      where: {
        userId_avatarId: { userId, avatarId }
      }
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

        await prisma.user.update({
          where: { id: userId },
          data: { gems: updatedGems },
        });
      }

      const expiresAt = isAdUnlock ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

      if (existingPurchase) {
        await prisma.userAvatar.update({
          where: { userId_avatarId: { userId, avatarId } },
          data: { expiresAt: expiresAt },
        });
      } else {
        await prisma.userAvatar.create({
          data: {
            userId: userId,
            avatarId: avatarId,
            isEquipped: false,
            expiresAt: expiresAt
          }
        });
      }

      return prisma.user.findFirst({
        where: { id: userId },
        include: {
          gemTransaction: true,
          userAvatars: true,
        }
      });
    });
  }
}