import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) { }
  async create(createAuthDto: CreateAuthDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: createAuthDto.email
        },
        omit: { password: false }
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const isPasswordValid =  await bcrypt.compare(createAuthDto.password, user.password);

      if (!isPasswordValid) {
        throw new NotFoundException('User or password is incorrect');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      
      const token = this.jwtService.sign(payload);
      const { password, ...userWithoutPassword } = user;

      return { user: userWithoutPassword, token };

    } catch (error) {
      console.error(error);
      throw error;
    }

  }

}
