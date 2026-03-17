import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './modules/auth/constants';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth/auth-guard';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { GameModule } from './modules/game/game.module';
import { CallModule } from './modules/call/call.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '100  d' },
    }),
    UsersModule,
    AuthModule,
    WebsocketsModule,
    PrismaModule,
    GameModule,
    CallModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');

  }
}