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
type Player = 'p1' | 'p2'

interface Piece { id: string; player: Player; position: number }

interface RoomPlayer { socketId: string; userId: string; role: Player }

interface RoomState {
  code: string
  players: RoomPlayer[]
  pieces: Piece[]
  turn: Player
  wins: { p1: number; p2: number }
  gemsAtStake: number
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

  private readonly rooms = new Map<string, RoomState>()
  private readonly socketRoom = new Map<string, string>()
  private readonly socketUser = new Map<string, string>()

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    Logger.log(`Ei client oreia seca você se conetou: ${client.id}`, 'GameGateway')
  }

  handleDisconnect(client: Socket) {
    Logger.log(`Ei client oreia seca você se desconectou: ${client.id}`, 'GameGateway')
    this.leaveRoom(client)
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
    Logger.log(`auth: userId=${userId} gems=${gems}`, 'GameGateway')
  }

  // ── matchmaking automático ─────────────────────────────────
  @SubscribeMessage('findMatch')
  async findMatch(@ConnectedSocket() client: Socket) {
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)
    if (!userId) return client.emit('error', 'Faça auth primeiro')

    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const waiting = [...this.rooms.values()].find(r => r.players.length === 1)

    if (waiting) {
      waiting.players.push({ socketId: client.id, userId, role: 'p2' })
      client.join(waiting.code)
      this.socketRoom.set(client.id, waiting.code)
      this.emitGameStart(waiting)
    } else {
      const code = this.genCode()
      const room: RoomState = {
        code,
        players: [{ socketId: client.id, userId, role: 'p1' }],
        pieces: INITIAL_PIECES.map(p => ({ ...p })),
        turn: 'p1',
        wins: { p1: 0, p2: 0 },
        gemsAtStake: 100,
      }
      this.rooms.set(code, room)
      client.join(code)
      this.socketRoom.set(client.id, code)
      client.emit('waiting', { code })
    }
  }

  // ── criar sala com código ──────────────────────────────────
  @SubscribeMessage('createGame')
  async createGame(@ConnectedSocket() client: Socket) {
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)
    if (!userId) return client.emit('error', 'Faça auth primeiro')

    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const code = this.genCode()
    const room: RoomState = {
      code,
      players: [{ socketId: client.id, userId, role: 'p1' }],
      pieces: INITIAL_PIECES.map(p => ({ ...p })),
      turn: 'p1',
      wins: { p1: 0, p2: 0 },
      gemsAtStake: 100,
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
    if (this.socketRoom.has(client.id))
      return client.emit('error', 'Você já está em uma sala')

    const userId = this.socketUser.get(client.id)
    if (!userId) return client.emit('error', 'Faça auth primeiro')

    if (!(await this.gameService.hasEnoughGems(userId)))
      return client.emit('error', 'Gemas insuficientes (mínimo 100)')

    const room = this.rooms.get(code.toUpperCase())
    if (!room) return client.emit('error', 'Sala não encontrada')
    if (room.players.length >= 2) return client.emit('error', 'Sala cheia')

    room.players.push({ socketId: client.id, userId, role: 'p2' })
    client.join(code.toUpperCase())
    this.socketRoom.set(client.id, code.toUpperCase())
    this.emitGameStart(room)
  }

  // movimentar peça ─────────────────────────────────────────────
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

    await new Promise(resolve => setTimeout(resolve, 600))

    await this.handleWin(room, myRole)
  } else {
    room.turn = myRole === 'p1' ? 'p2' : 'p1'
    this.server.to(roomCode).emit('gameState', this.roomPayload(room))
  }
}

  // ── resetar partida (mantém wins e sala) ───────────────────
  @SubscribeMessage('resetGame')
  async resetGame(@ConnectedSocket() client: Socket) {
    const roomCode = this.socketRoom.get(client.id)
    if (!roomCode) return

    const room = this.rooms.get(roomCode)
    if (!room || room.players.length < 2) return

    const isPlayer = room.players.some(p => p.socketId === client.id)
    if (!isPlayer) return

    for (const p of room.players) {
      if (!(await this.gameService.hasEnoughGems(p.userId))) {
        this.server.to(roomCode).emit('error', 'Jogador sem gemas para continuar')
        return
      }
    }

    room.pieces = INITIAL_PIECES.map(p => ({ ...p }))
    // ← sorteia quem começa a revanche
    room.turn = Math.random() < 0.5 ? 'p1' : 'p2'
    this.server.to(roomCode).emit('gameState', this.roomPayload(room))
    this.server.to(roomCode).emit('gameReset', { firstTurn: room.turn })
  }

  // ── info de salas ──────────────────────────────────────────
  @SubscribeMessage('findAllGame')
  findAllGame() {
    return [...this.rooms.values()].map(r => ({
      code: r.code,
      players: r.players.length,
      wins: r.wins,
    }))
  }

  @SubscribeMessage('findOneGame')
  findOneGame(@MessageBody() code: string) {
    const room = this.rooms.get(code.toUpperCase())
    if (!room) return null
    return this.roomPayload(room)
  }

  // ── privados ───────────────────────────────────────────────

  private async handleWin(room: RoomState, winner: Player) {
    const loser: Player = winner === 'p1' ? 'p2' : 'p1'
    const winnerPlayer = room.players.find(p => p.role === winner)!
    const loserPlayer = room.players.find(p => p.role === loser)!

    await this.gameService.applyResult(
      winnerPlayer.userId,
      loserPlayer.userId,
      room.gemsAtStake,
    )

    const [wGems, lGems] = await Promise.all([
      this.gameService.getGems(winnerPlayer.userId),
      this.gameService.getGems(loserPlayer.userId),
    ])

    this.server.to(room.code).emit('roundEnd', {
      winner,
      wins: room.wins,
      gems: {
        [winnerPlayer.socketId]: wGems,
        [loserPlayer.socketId]: lGems,
      },
    })
  }

  private emitGameStart(room: RoomState) {
    const [p1, p2] = room.players

    // ← sorteia quem começa
    room.turn = Math.random() < 0.5 ? 'p1' : 'p2'
    Logger.log(`Sala ${room.code} — começa: ${room.turn}`, 'GameGateway')

    this.server.to(room.code).emit('gameStart', {
      code: room.code,
      players: { p1: p1.socketId, p2: p2.socketId },
      firstTurn: room.turn,
      ...this.roomPayload(room),
    })
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

  private leaveRoom(client: Socket) {
    const code = this.socketRoom.get(client.id)
    if (!code) return

    const room = this.rooms.get(code)
    if (room) {
      this.server.to(code).emit('opponentLeft')
      this.rooms.delete(code)
      room.players.forEach(p => {
        this.socketRoom.delete(p.socketId)
        this.socketUser.delete(p.socketId)
      })
    }

    this.socketRoom.delete(client.id)
    this.socketUser.delete(client.id)
  }

  private genCode(): string {
    let code: string
    do { code = Math.random().toString(36).slice(2, 6).toUpperCase() }
    while (this.rooms.has(code))
    return code
  }
}