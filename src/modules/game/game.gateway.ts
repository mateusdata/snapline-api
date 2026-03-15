// game.gateway.ts
import {
  WebSocketGateway, SubscribeMessage, MessageBody,
  WebSocketServer, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { GameService } from './game.service'
import { Public } from 'src/common/decorators/public'

// ── tipos ──────────────────────────────────────────────────────
type Player  = 'p1' | 'p2'
type PendCmd = 'findMatch' | 'createGame' | { type: 'joinGame'; code: string }

interface Piece      { id: string; player: Player; position: number }
interface RoomPlayer { socketId: string; userId: string; role: Player }

interface RoomState {
  code       : string
  players    : RoomPlayer[]
  pieces     : Piece[]
  turn       : Player
  wins       : { p1: number; p2: number }
  gemsAtStake: number
  creatorId  : string
}

// ── constantes ─────────────────────────────────────────────────
const INITIAL_PIECES: Piece[] = [
  { id: 'p1-1', player: 'p1', position: 6 },
  { id: 'p1-2', player: 'p1', position: 7 },
  { id: 'p1-3', player: 'p1', position: 8 },
  { id: 'p2-1', player: 'p2', position: 0 },
  { id: 'p2-2', player: 'p2', position: 1 },
  { id: 'p2-3', player: 'p2', position: 2 },
]

const CONNECTIONS: Record<number, number[]> = {
  0: [1, 3, 4], 1: [0, 2, 4], 2: [1, 5, 4],
  3: [0, 6, 4], 4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [2, 8, 4], 6: [3, 7, 4], 7: [6, 8, 4], 8: [5, 7, 4],
}

const VALID_LINES = [[3, 4, 5], [1, 4, 7], [0, 4, 8], [2, 4, 6]]

// ── gateway ────────────────────────────────────────────────────
@WebSocketGateway({ namespace: '/api/game', cors: true })
@Public()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  private readonly rooms      = new Map<string, RoomState>()
  private readonly socketRoom = new Map<string, string>()
  private readonly socketUser = new Map<string, string>()
  private readonly pendingCmd = new Map<string, PendCmd>()

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    Logger.log(`Conectado: ${client.id}`, 'GameGateway')
  }

  handleDisconnect(client: Socket) {
    Logger.log(`Desconectado: ${client.id}`, 'GameGateway')
    this.pendingCmd.delete(client.id)
    // notifySelf = false — socket já foi embora, não adianta emitir
    this.doLeaveRoom(client, false)
  }

  // ── auth ───────────────────────────────────────────────────
  @SubscribeMessage('auth')
  async handleAuth(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const gems = await this.gameService.getGems(userId)
    this.socketUser.set(client.id, userId)
    client.emit('authOk', { gems })
    Logger.log(`auth ok: userId=${userId} gems=${gems}`, 'GameGateway')

    // executa comando enfileirado antes do auth completar
    const pending = this.pendingCmd.get(client.id)
    if (pending) {
      this.pendingCmd.delete(client.id)
      if (pending === 'findMatch')        await this.doFindMatch(client)
      else if (pending === 'createGame')  await this.doCreateGame(client)
      else if (typeof pending === 'object' && pending.type === 'joinGame')
        await this.doJoinGame(pending.code, client)
    }
  }

  // ── sair da sala voluntariamente ───────────────────────────
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    // notifySelf = true — confirma para o cliente que a sala foi limpa
    this.doLeaveRoom(client, true)
  }

  // ── matchmaking automático ─────────────────────────────────
  @SubscribeMessage('findMatch')
  async findMatch(@ConnectedSocket() client: Socket) {
    if (!this.socketUser.has(client.id)) {
      this.pendingCmd.set(client.id, 'findMatch'); return
    }
    await this.doFindMatch(client)
  }

  private async doFindMatch(client: Socket) {
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)!
    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const waiting = [...this.rooms.values()].find(r => r.players.length === 1)

    if (waiting) {
      waiting.players.push({ socketId: client.id, userId, role: 'p2' })
      client.join(waiting.code)
      this.socketRoom.set(client.id, waiting.code)
      await this.emitGameStart(waiting)
    } else {
      const code = this.genCode()
      const room: RoomState = {
        code,
        players    : [{ socketId: client.id, userId, role: 'p1' }],
        pieces     : INITIAL_PIECES.map(p => ({ ...p })),
        turn       : 'p1',
        wins       : { p1: 0, p2: 0 },
        gemsAtStake: 100,
        creatorId  : client.id,
      }
      this.rooms.set(code, room)
      client.join(code)
      this.socketRoom.set(client.id, code)
      client.emit('waiting', { code })
    }
  }

  // ── criar sala ─────────────────────────────────────────────
  @SubscribeMessage('createGame')
  async createGame(@ConnectedSocket() client: Socket) {
    if (!this.socketUser.has(client.id)) {
      this.pendingCmd.set(client.id, 'createGame'); return
    }
    await this.doCreateGame(client)
  }

  private async doCreateGame(client: Socket) {
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)!
    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const code = this.genCode()
    const room: RoomState = {
      code,
      players    : [{ socketId: client.id, userId, role: 'p1' }],
      pieces     : INITIAL_PIECES.map(p => ({ ...p })),
      turn       : 'p1',
      wins       : { p1: 0, p2: 0 },
      gemsAtStake: 100,
      creatorId  : client.id,
    }
    this.rooms.set(code, room)
    client.join(code)
    this.socketRoom.set(client.id, code)
    client.emit('roomCreated', { code })
  }

  // ── entrar com código ──────────────────────────────────────
  @SubscribeMessage('joinGame')
  async joinGame(
    @MessageBody() code: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.socketUser.has(client.id)) {
      this.pendingCmd.set(client.id, { type: 'joinGame', code }); return
    }
    await this.doJoinGame(code, client)
  }

  private async doJoinGame(code: string, client: Socket) {
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)!
    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const room = this.rooms.get(code.toUpperCase())
    if (!room)                    return client.emit('error', 'Sala não encontrada')
    if (room.players.length >= 2) return client.emit('error', 'Sala cheia')

    room.players.push({ socketId: client.id, userId, role: 'p2' })
    client.join(code.toUpperCase())
    this.socketRoom.set(client.id, code.toUpperCase())
    await this.emitGameStart(room)
  }

  // ── mover peça ─────────────────────────────────────────────
  @SubscribeMessage('move')
  async handleMove(
    @MessageBody() payload: { pieceId: string; to: number },
    @ConnectedSocket() client: Socket,
  ) {
    const roomCode = this.socketRoom.get(client.id)
    if (!roomCode) return
    const room = this.rooms.get(roomCode)
    if (!room) return

    const myRole = room.players.find(p => p.socketId === client.id)?.role
    if (!myRole || myRole !== room.turn) return

    const piece = room.pieces.find(p => p.id === payload.pieceId)
    if (!piece || piece.player !== myRole) return

    const occupied = room.pieces.map(p => p.position)
    if (!CONNECTIONS[piece.position].includes(payload.to)) return
    if (occupied.includes(payload.to)) return

    room.pieces = room.pieces.map(p =>
      p.id === payload.pieceId ? { ...p, position: payload.to } : p,
    )

    if (this.checkWin(room.pieces, myRole)) {
      room.wins[myRole]++
      this.server.to(roomCode).emit('gameState', this.roomPayload(room))
      await new Promise(r => setTimeout(r, 600))
      await this.handleWin(room, myRole)
    } else {
      room.turn = myRole === 'p1' ? 'p2' : 'p1'
      this.server.to(roomCode).emit('gameState', this.roomPayload(room))
    }
  }

  // ── resetar partida ────────────────────────────────────────
  @SubscribeMessage('resetGame')
  async resetGame(@ConnectedSocket() client: Socket) {
    const roomCode = this.socketRoom.get(client.id)
    if (!roomCode) return
    const room = this.rooms.get(roomCode)
    if (!room || room.players.length < 2) return
    if (!room.players.some(p => p.socketId === client.id)) return

    for (const p of room.players) {
      if (!(await this.gameService.hasEnoughGems(p.userId))) {
        this.server.to(roomCode).emit('error', 'Jogador sem gemas para continuar')
        return
      }
    }

    room.pieces = INITIAL_PIECES.map(p => ({ ...p }))
    room.turn   = Math.random() < 0.5 ? 'p1' : 'p2'
    this.server.to(roomCode).emit('gameState', this.roomPayload(room))
    this.server.to(roomCode).emit('gameReset', { firstTurn: room.turn })
  }

  // ── info de salas ──────────────────────────────────────────
  @SubscribeMessage('findAllGame')
  findAllGame() {
    return [...this.rooms.values()].map(r => ({
      code: r.code, players: r.players.length, wins: r.wins,
    }))
  }

  @SubscribeMessage('findOneGame')
  findOneGame(@MessageBody() code: string) {
    const room = this.rooms.get(code.toUpperCase())
    return room ? this.roomPayload(room) : null
  }

  // ── privados ───────────────────────────────────────────────

  /**
   * Lógica central de saída.
   * notifySelf = true → saída voluntária, envia 'leftRoom' de volta ao cliente.
   * notifySelf = false → desconexão abrupta, socket já sumiu.
   */
  private doLeaveRoom(client: Socket, notifySelf: boolean) {
    const code = this.socketRoom.get(client.id)
    if (!code) return

    const room = this.rooms.get(code)
    if (!room) {
      this.socketRoom.delete(client.id)
      this.socketUser.delete(client.id)
      return
    }

    const isCreator     = room.creatorId === client.id
    const hadTwoPlayers = room.players.length === 2

    if (isCreator || hadTwoPlayers) {
      // notifica quem ficou (exceto quem saiu)
      if (hadTwoPlayers) {
        this.server.to(code).except(client.id).emit('opponentLeft')
      }
      // confirma saída para o próprio cliente (só em saída voluntária)
      if (notifySelf) client.emit('leftRoom')
      this.cleanRoom(room)
    } else {
      // sala com 1 jogador (não criador) — apenas remove o registro
      if (notifySelf) client.emit('leftRoom')
      this.socketRoom.delete(client.id)
      this.socketUser.delete(client.id)
      client.leave(code)
    }
  }

  private cleanRoom(room: RoomState) {
    room.players.forEach(p => {
      this.socketRoom.delete(p.socketId)
      this.socketUser.delete(p.socketId)
    })
    this.rooms.delete(room.code)
    Logger.log(`Sala ${room.code} encerrada`, 'GameGateway')
  }

  private async handleWin(room: RoomState, winner: Player) {
    const loser: Player = winner === 'p1' ? 'p2' : 'p1'
    const wp = room.players.find(p => p.role === winner)!
    const lp = room.players.find(p => p.role === loser)!

    await this.gameService.applyResult(wp.userId, lp.userId, room.gemsAtStake)

    const [wGems, lGems] = await Promise.all([
      this.gameService.getGems(wp.userId),
      this.gameService.getGems(lp.userId),
    ])

    this.server.to(room.code).emit('roundEnd', {
      winner,
      wins: room.wins,
      gems: { [wp.socketId]: wGems, [lp.socketId]: lGems },
    })
  }

  /**
   * Emite gameStart para cada jogador com as informações do OPONENTE
   * (nome + avatar) para exibir na tela.
   */
  private async emitGameStart(room: RoomState) {
    const [p1, p2] = room.players
    room.turn = Math.random() < 0.5 ? 'p1' : 'p2'
    Logger.log(`Sala ${room.code} — começa: ${room.turn}`, 'GameGateway')

    const [p1Info, p2Info] = await Promise.all([
      this.gameService.getUserInfo(p1.userId),
      this.gameService.getUserInfo(p2.userId),
    ])

    const base = { code: room.code, firstTurn: room.turn, ...this.roomPayload(room) }

    // cada jogador recebe os dados do OUTRO
    this.server.to(p1.socketId).emit('gameStart', { ...base, opponent: p2Info })
    this.server.to(p2.socketId).emit('gameStart', { ...base, opponent: p1Info })

    this.server.to(p1.socketId).emit('yourRole', 'p1')
    this.server.to(p2.socketId).emit('yourRole', 'p2')
  }

  private roomPayload(room: RoomState) {
    return { pieces: room.pieces, turn: room.turn, wins: room.wins }
  }

  private checkWin(pieces: Piece[], player: Player): boolean {
    const pos = pieces.filter(p => p.player === player).map(p => p.position)
    return VALID_LINES.some(line => line.every(p => pos.includes(p)))
  }

  private genCode(): string {
    let code: string
    do { code = Math.random().toString(36).slice(2, 6).toUpperCase() }
    while (this.rooms.has(code))
    return code
  }
}