import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { Public } from 'src/common/decorators/public';
import { CreateAuthGoogleDto } from './dto/create-auth-google.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  create(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.create(createAuthDto);
  }
   @Public()
    @Post('google')
    loginWithGoogle(@Body() createAuthGoogleDto: CreateAuthGoogleDto) {
        return this.authService.loginWithGoogle(createAuthGoogleDto);
    }

}
