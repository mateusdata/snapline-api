import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateAuthGoogleDto } from './dto/create-auth-google.dto';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import { UsersService } from '../users/users.service';
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private userService: UsersService,
    @Inject('GOOGLE_OAUTH')
    private readonly googleClient: OAuth2Client,

  ) { }

  async create(createAuthDto: CreateAuthDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: createAuthDto.email },
        omit: { password: false },
      });

      if (!user) throw new NotFoundException();

      if (createAuthDto.password && user.password) {
        const isPasswordValid = await bcrypt.compare(createAuthDto.password, user.password);
        if (!isPasswordValid) throw new UnauthorizedException("User or password invalid");
      }


      const payload = { sub: user.id, email: user.email, roles: user.role };
      const { password, ...userWithoutPassword } = user;

      return { ...userWithoutPassword, token: this.jwtService.sign(payload) };
    } catch (error) {
      Logger.error('Error during user authentication', error);
      throw error;
    }
  }


  async loginWithGoogle(createAuthGoogleDto: CreateAuthGoogleDto) {

    try {
      const { idToken } = createAuthGoogleDto;
      if (!idToken) throw new BadRequestException("ID token is required");

      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.AUDIENCE,
      })

      if (!ticket) throw new UnauthorizedException("Invalid Google ID token");

      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new UnauthorizedException("Invalid Google ID token payload");



      await this.userService.createGoogleUser({ email: payload.email, name: payload.name!!, avatar: payload.picture });

      const user = await this.create({ email: payload.email });

      return user;
    } catch (error) {
      Logger.error('Failed to authenticate with Google', error);
      throw error;
    }
  }

}
