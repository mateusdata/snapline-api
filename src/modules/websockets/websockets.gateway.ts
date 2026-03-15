import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { WebsocketsService } from './websockets.service';
import { CreateWebsocketDto } from './dto/create-websocket.dto';
import { UpdateWebsocketDto } from './dto/update-websocket.dto';
import { Public } from 'src/common/decorators/public';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
@WebSocketGateway({ namespace: '/api/websockets' })
@Public()
export class WebsocketsGateway {
  constructor(private readonly websocketsService: WebsocketsService) { }

  @WebSocketServer()
  server: Server;

  handleConnection(client: any, ...args: any[]) {
    Logger.log(`Ei client oreia seca você se conetou: ${client.id}`, 'WebsocketsGateway');
  }

  handleDisconnect(client: any) {
    Logger.log(`Ei client oreia seca você se desconectou: ${client.id}`, 'WebsocketsGateway');
  }


  @SubscribeMessage('createWebsocket')
  create(@MessageBody() createWebsocketDto: CreateWebsocketDto) {

    return this.websocketsService.create(createWebsocketDto);
  }

  @SubscribeMessage('findAllWebsockets')
  findAll() {
    return this.websocketsService.findAll();
  }

  @SubscribeMessage('findOneWebsocket')
  findOne(@MessageBody() id: number) {
    return this.websocketsService.findOne(id);
  }

  @SubscribeMessage('updateWebsocket')
  update(@MessageBody() updateWebsocketDto: UpdateWebsocketDto) {
    return this.websocketsService.update(updateWebsocketDto.id, updateWebsocketDto);
  }

  @SubscribeMessage('removeWebsocket')
  remove(@MessageBody() id: number) {
    return this.websocketsService.remove(id);
  }
}
