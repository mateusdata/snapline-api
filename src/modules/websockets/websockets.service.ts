import { Injectable } from '@nestjs/common';
import { CreateWebsocketDto } from './dto/create-websocket.dto';
import { UpdateWebsocketDto } from './dto/update-websocket.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class WebsocketsService {
  constructor( private readonly prismaService: PrismaService) {}
  create(createWebsocketDto: CreateWebsocketDto) {
    return `Você mandou pra mim isso : ${createWebsocketDto} pega de volta que eu nao quero oreia seca`;
  }

  findAll() {
    return `This action returns all websockets`;
  }

  findOne(id: number) {
    return `This action returns a #${id} websocket`;
  }

  update(id: number, updateWebsocketDto: UpdateWebsocketDto) {
    return `This action updates a #${id} websocket`;
  }

  remove(id: number) {
    return `This action removes a #${id} websocket`;
  }
}
