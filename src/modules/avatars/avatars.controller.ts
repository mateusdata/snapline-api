import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { User } from 'src/common/decorators/user.decorator';
import { Rules } from 'src/common/decorators/rules.decorator';
import { Role } from 'src/generated/prisma/enums';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';

@Controller('avatars')
@ApiBearerAuth()
@UseGuards(RolesGuard)
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) { }

  // Apenas Admin pode criar um avatar novo na loja
  @Rules(Role.ADMIN)
  @Post()
  create(@Body() createAvatarDto: CreateAvatarDto) {
    return this.avatarsService.create(createAvatarDto);
  }

  // Qualquer usuário logado pode ver a lista de avatares
  @Get()
  findAll() {
    return this.avatarsService.findAll();
  }

  // Qualquer usuário logado pode ver detalhes de um avatar
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.avatarsService.findOne(id);
  }

  @Post(':id/buy')
  buyAvatar(
    @User('sub') userId: string, 
    @Param('id') avatarId: string,
    @Body('isAdUnlock') isAdUnlock?: boolean
  ) {
    return this.avatarsService.buyAvatar(userId, avatarId, isAdUnlock); 
  }

  @Patch(':id/default')
  setDefault(@User('sub') userId: string, @Param('id') avatarId: string) {
    return this.avatarsService.defaultAvatar(userId, avatarId);
  }

  // Apenas Admin pode atualizar dados do avatar (preço, foto, etc)
  @Rules(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAvatarDto: UpdateAvatarDto) {
    return this.avatarsService.update(id, updateAvatarDto);
  }

  // Apenas Admin pode deletar um avatar
  @Rules(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.avatarsService.remove(id);
  }
}