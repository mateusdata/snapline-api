import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from 'src/common/decorators/user.decorator';
import { UsersModule } from '../users/users.module';
import { GoogleOAuthProvider } from './google-auth.provider';
import { UsersService } from '../users/users.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService,GoogleOAuthProvider, UsersService],
})
export class AuthModule {}
