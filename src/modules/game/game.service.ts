import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly prismaService: PrismaService) {}

  async getGems(userId: string): Promise<number> {
    const user = await this.prismaService.user.findUnique({
      where : { id: userId },
      select: { gems: true },
    });
    return user?.gems ?? 0;
  }

  async hasEnoughGems(userId: string, amount = 100): Promise<boolean> {
    const gems = await this.getGems(userId);
    return gems >= amount;
  }

  async getUserInfo(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        profileImage: true,
        userAvatars: {
          where: {
            deletedAt: null,
            isDefault: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          select: {
            isDefault: true,
            avatar: {
              select: { imageUrl: true }
            }
          }
        }
      },
    });

    return {
      name: user?.name ?? 'Jogador',
      profileImage: user?.profileImage ?? null,
      userAvatars: user?.userAvatars ?? [],
    };
  }

  async applyResult(winnerId: string, loserId: string, amount = 100) {
    const loser = await this.prismaService.user.findUnique({
      where : { id: loserId },
      select: { gems: true },
    });
    const loserNewGems = Math.max((loser?.gems ?? 0) - amount, 0);

    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: winnerId },
        data : { gems: { increment: amount } },
      }),
      this.prismaService.user.update({
        where: { id: loserId },
        data : { gems: loserNewGems },
      }),
      this.prismaService.gemTransaction.create({
        data: { userId: winnerId, amount: +amount, reason: 'win' },
      }),
      this.prismaService.gemTransaction.create({
        data: { userId: loserId, amount: -amount, reason: 'loss' },
      }),
    ]);

    Logger.log(
      `Gemas: +${amount} → ${winnerId} | -${amount} → ${loserId} (novo saldo perdedor: ${loserNewGems})`,
      'GameService',
    );
  }
}