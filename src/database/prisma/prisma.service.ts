import "dotenv/config";
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { addSoftDeleteFilter } from "./add-soft-delete-filter";



@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL
    });

    super({ adapter, omit: { user: { password: true } } });

    const extendedClient = (this as PrismaClient).$extends({
      name: 'softDelete',
      query: {
        $allModels: {
          async $allOperations({ operation, args, query }: any) {
            if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 
                 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              
              args.where = { ...args.where, deletedAt: null };
              
              if (args.include) {
                args.include = addSoftDeleteFilter(args.include);
              }
            }
            
            return query(args);
          }
        }
      }
    });

    return extendedClient as any;
  }

  async onModuleInit() {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}