import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserGoogleDto } from './dto/create-user-google.dto';
@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    try {
      const passwordHash = await bcrypt.hash(createUserDto.password, 10);
      const user = await this.prismaService.user.create({
        data: { ...createUserDto, password: passwordHash }
      });
      return user;

    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }


async createGoogleUser(createUserGoogleDto: CreateUserGoogleDto) {

    const exitingUser = await this.prismaService.user.findUnique({
      where: { email: createUserGoogleDto.email },
    });

    if (exitingUser) {
      return exitingUser;
    }

    try {
      const user = await this.prismaService.user.create({
        data: createUserGoogleDto,
      });

      return user;
    } catch (error) {
      console.log(error);
      throw error
    }

  }


  async findAll() {
    const users = await this.prismaService.user.findMany();
    return users;
  }

  async findMe(id: string) {
    try {
      console.log('Finding user with id:', id);
      const user = await this.prismaService.user.findUnique({
        where: { id },
        include: {gemTransaction: true  },
      });
      
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
   
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id },
      });
      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.prismaService.user.update({
        where: { id },
        data: updateUserDto,
      });
      return updatedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const deletedUser = await this.prismaService.user.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: id },
      });
      return deletedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
