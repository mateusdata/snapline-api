import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class AvatarsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createAvatarDto: CreateAvatarDto) {
    return this.prismaService.avatar.create({
      data: createAvatarDto,
    });
  }

  async findAll() {
    return this.prismaService.avatar.findMany({
      orderBy: { priceGems: 'asc' }, 
    });
  }

  async findOne(id: string) {
    const avatar = await this.prismaService.avatar.findUnique({ where: { id } });
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
      return await this.prismaService.avatar.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('Avatar não encontrado');
      throw error;
    }
  }

  // --- A LÓGICA DE COMPRA ATUALIZADA ---
  async buyAvatar(userId: string, avatarId: string) {
    const avatar = await this.prismaService.avatar.findUnique({
      where: { id: avatarId },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar não encontrado na loja');
    }

    // 1. Verifica na nova tabela se o usuário já comprou esse avatar
    const existingPurchase = await this.prismaService.userAvatar.findUnique({
      where: {
        userId_avatarId: { userId, avatarId } // Usando a chave composta @@unique do Prisma
      }
    });

    if (existingPurchase) {
      throw new ConflictException('Você já possui este avatar');
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // 2. Valida o saldo de gemas
    if (!avatar.isPremium && avatar.priceGems > 0) {
      if (user.gems < avatar.priceGems) {
        throw new BadRequestException('Gemas insuficientes para comprar este avatar');
      }
    }

    // 3. Executa a transação no banco
    const result = await this.prismaService.$transaction(async (prisma) => {
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

      // Atualiza o saldo do usuário
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { gems: updatedGems },
      });

      // Salva a compra na NOVA TABELA explícita
      await prisma.userAvatar.create({
        data: {
          userId: userId,
          avatarId: avatarId,
          isEquipped: false // Já entra como false por padrão
        }
      });

      // Retorna o usuário atualizado com as relações pra bater com o Frontend
      return prisma.user.findUnique({
        where: { id: userId },
        include: {
          gemTransaction: true,
          userAvatars: {
            include: { avatar: true }
          }
        }
      });
    });

    return result;
  }
}