// src/call/call.gateway.ts
import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

interface SinalDTO {
  sala : string
  tipo : 'oferta' | 'resposta' | 'ice'
  dados: any
}

@WebSocketGateway({ cors: { origin: '*' } })
export class CallGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server

  private salas = new Map<string, string>()

  @SubscribeMessage('entrar')
  entrar(@MessageBody() sala: string, @ConnectedSocket() s: Socket) {
    s.join(sala)
    this.salas.set(s.id, sala)
    console.log(`✅ ${s.id} entrou na sala ${sala}`)
    s.to(sala).emit('parceiro-entrou')
  }

  @SubscribeMessage('sinal')
  sinal(@MessageBody() d: SinalDTO, @ConnectedSocket() s: Socket) {
    console.log(`📡 sinal [${d.tipo}] sala ${d.sala}`)
    s.to(d.sala).emit('sinal', d)
  }

  handleDisconnect(s: Socket) {
    const sala = this.salas.get(s.id)
    if (sala) {
      console.log(`❌ ${s.id} saiu da sala ${sala}`)
      s.to(sala).emit('parceiro-saiu')
      this.salas.delete(s.id)
    }
  }
}