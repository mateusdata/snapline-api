import {
  WebSocketGateway, SubscribeMessage, MessageBody,
  WebSocketServer, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { GameService } from './game.service'
import { Public } from 'src/common/decorators/public'

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
  creatorId: string
  gameOver: boolean
  isPrivate: boolean
}

interface ActiveUser {
  socketId: string
  userId: string
  name: string
  avatar: string | null
}

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

@WebSocketGateway({ namespace: '/api/game', cors: true })
@Public()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  private readonly rooms = new Map<string, RoomState>()
  private readonly socketRoom = new Map<string, string>()
  private readonly socketUser = new Map<string, string>()
  private readonly activeUsers = new Map<string, ActiveUser>()
  private readonly challenges = new Map<string, NodeJS.Timeout>()

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {}

handleDisconnect(client: Socket) {
    this.doLeaveRoom(client, false)
    
    const userId = this.socketUser.get(client.id)
    if (userId) {
      const activeUser = this.activeUsers.get(userId)
      if (activeUser && activeUser.socketId === client.id) {
        this.activeUsers.delete(userId)
      }
    }
    
    this.socketUser.delete(client.id)
    this.broadcastOnlinePlayers()
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const gems = await this.gameService.getGems(userId)
    const userInfo = await this.gameService.getUserInfo(userId)
    
    let defaultAvatar = userInfo.profileImage
    const eq = userInfo.userAvatars.find(a => a.isDefault)
    if (eq && eq.avatar.imageUrl) {
      defaultAvatar = eq.avatar.imageUrl
    }

    this.socketUser.set(client.id, userId)

    this.activeUsers.set(userId, {
      socketId: client.id,
      userId,
      name: userInfo.name,
      avatar: defaultAvatar
    })

    client.emit('authOk', { gems })
    this.broadcastOnlinePlayers()
  }

  private broadcastOnlinePlayers() {
    const players = Array.from(this.activeUsers.values()).map(u => ({
      id: u.userId,
      name: u.name,
      avatar: u.avatar
    }))
    this.server.emit('onlinePlayers', players)
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    this.doLeaveRoom(client, true)
  }

  @SubscribeMessage('findMatch')
  async findMatch(@ConnectedSocket() client: Socket) {
    await this.doFindMatch(client)
  }

  private async doFindMatch(client: Socket) {
    if (this.socketRoom.has(client.id)) return client.emit('error', 'Voce ja esta em uma sala')

    const userId = this.socketUser.get(client.id)
    if (!userId) return

    const user = this.activeUsers.get(userId)
    if (!user) return

    if (!(await this.gameService.hasEnoughGems(user.userId))) return client.emit('error', 'Gemas insuficientes')

    const waiting = [...this.rooms.values()].find(r => r.players.length === 1 && !r.isPrivate)

    if (waiting) {
      waiting.players.push({ socketId: client.id, userId: user.userId, role: 'p2' })
      client.join(waiting.code)
      this.socketRoom.set(client.id, waiting.code)
      await this.emitGameStart(waiting)
    } else {
      const code = this.genCode()
      const room: RoomState = {
        code,
        players: [{ socketId: client.id, userId: user.userId, role: 'p1' }],
        pieces: INITIAL_PIECES.map(p => ({ ...p })),
        turn: 'p1',
        wins: { p1: 0, p2: 0 },
        gemsAtStake: 100,
        creatorId: client.id,
        gameOver: false,
        isPrivate: false,
      }
      this.rooms.set(code, room)
      client.join(code)
      this.socketRoom.set(client.id, code)
      client.emit('waiting', { code })
    }
  }

  @SubscribeMessage('challengePlayer')
  async challengePlayer(@MessageBody() targetUserId: string, @ConnectedSocket() client: Socket) {
    const challengerId = this.socketUser.get(client.id)
    if (!challengerId) return

    const challengerUser = this.activeUsers.get(challengerId)
    if (!challengerUser) return

    if (!(await this.gameService.hasEnoughGems(challengerUser.userId))) return client.emit('error', 'Gemas insuficientes')

    const targetUser = this.activeUsers.get(targetUserId)
    if (!targetUser) return client.emit('error', 'Jogador offline')
    if (this.socketRoom.has(targetUser.socketId)) return client.emit('error', 'Jogador em partida')

    const challengeId = `${challengerUser.userId}-${targetUserId}`
    
    this.server.to(targetUser.socketId).emit('challengeReceived', {
      id: challengerUser.userId,
      name: challengerUser.name,
      avatar: challengerUser.avatar
    })

    const timeout = setTimeout(() => {
      this.server.to(client.id).emit('challengeExpired')
      this.server.to(targetUser.socketId).emit('challengeExpired')
      this.challenges.delete(challengeId)
    }, 15000)

    this.challenges.set(challengeId, timeout)
  }

  @SubscribeMessage('acceptChallenge')
  async acceptChallenge(@MessageBody() challengerId: string, @ConnectedSocket() client: Socket) {
    const targetId = this.socketUser.get(client.id)
    if (!targetId) return

    const targetUser = this.activeUsers.get(targetId)
    if (!targetUser) return

    const challengerUser = this.activeUsers.get(challengerId)
    if (!challengerUser) return client.emit('error', 'Desafiante offline')

    const challengeId = `${challengerId}-${targetUser.userId}`
    const timeout = this.challenges.get(challengeId)
    if (timeout) {
      clearTimeout(timeout)
      this.challenges.delete(challengeId)
    }

    const code = this.genCode()
    const room: RoomState = {
      code,
      players: [
        { socketId: challengerUser.socketId, userId: challengerUser.userId, role: 'p1' },
        { socketId: targetUser.socketId, userId: targetUser.userId, role: 'p2' }
      ],
      pieces: INITIAL_PIECES.map(p => ({ ...p })),
      turn: 'p1',
      wins: { p1: 0, p2: 0 },
      gemsAtStake: 100,
      creatorId: challengerUser.socketId,
      gameOver: false,
      isPrivate: true,
    }

    this.rooms.set(code, room)
    
    this.server.in(challengerUser.socketId).socketsJoin(code)
    client.join(code)

    this.socketRoom.set(challengerUser.socketId, code)
    this.socketRoom.set(targetUser.socketId, code)

    await this.emitGameStart(room)
  }

  @SubscribeMessage('declineChallenge')
  declineChallenge(@MessageBody() challengerId: string, @ConnectedSocket() client: Socket) {
    const targetId = this.socketUser.get(client.id)
    if (!targetId) return

    const targetUser = this.activeUsers.get(targetId)
    if (!targetUser) return

    const challengeId = `${challengerId}-${targetUser.userId}`
    const timeout = this.challenges.get(challengeId)
    if (timeout) {
      clearTimeout(timeout)
      this.challenges.delete(challengeId)
    }

    const challengerUser = this.activeUsers.get(challengerId)
    if (challengerUser) {
      this.server.to(challengerUser.socketId).emit('challengeDeclined', targetUser.name)
    }
  }

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
    room.turn = Math.random() < 0.5 ? 'p1' : 'p2'
    room.gameOver = false
    this.server.to(roomCode).emit('gameState', this.roomPayload(room))
    this.server.to(roomCode).emit('gameReset', { firstTurn: room.turn })
  }

  private async doLeaveRoom(client: Socket, notifySelf: boolean) {
    const code = this.socketRoom.get(client.id)
    if (!code) return

    const room = this.rooms.get(code)
    if (!room) {
      this.socketRoom.delete(client.id)
      return
    }

    const isCreator = room.creatorId === client.id
    const hadTwoPlayers = room.players.length === 2

    if (isCreator || hadTwoPlayers) {
      if (hadTwoPlayers) {
        if (room.gameOver) {
          this.server.to(code).except(client.id).emit('opponentLeft')
        } else {
          const leaver = room.players.find(p => p.socketId === client.id)
          const stayer = room.players.find(p => p.socketId !== client.id)

          if (leaver && stayer) {
            await this.gameService.applyResult(stayer.userId, leaver.userId, room.gemsAtStake)
            const stayerGems = await this.gameService.getGems(stayer.userId)
            this.server.to(stayer.socketId).emit('opponentAbandoned', { gems: stayerGems })
          } else {
            this.server.to(code).except(client.id).emit('opponentLeft')
          }
        }
      }

      if (notifySelf) client.emit('leftRoom')
      this.cleanRoom(room)
    } else {
      if (notifySelf) client.emit('leftRoom')
      this.socketRoom.delete(client.id)
      client.leave(code)
    }
  }

  private cleanRoom(room: RoomState) {
    room.players.forEach(p => {
      this.socketRoom.delete(p.socketId)
    })
    this.rooms.delete(room.code)
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

    room.gameOver = true

    this.server.to(room.code).emit('roundEnd', {
      winner,
      wins: room.wins,
      gems: { [wp.socketId]: wGems, [lp.socketId]: lGems },
    })

    if (lGems < 100) {
      await new Promise(r => setTimeout(r, 800))
      this.server.to(lp.socketId).emit('kicked', 'Voce ficou sem gemas')
      this.server.to(wp.socketId).emit('kicked', 'Oponente sem gemas')
      this.cleanRoom(room)
    }
  }

  private async emitGameStart(room: RoomState) {
    const [p1, p2] = room.players
    room.turn = Math.random() < 0.5 ? 'p1' : 'p2'

    const [p1Info, p2Info] = await Promise.all([
      this.gameService.getUserInfo(p1.userId),
      this.gameService.getUserInfo(p2.userId),
    ])

    let a1 = p1Info.profileImage; const e1 = p1Info.userAvatars.find(a => a.isDefault); if(e1) a1 = e1.avatar.imageUrl;
    let a2 = p2Info.profileImage; const e2 = p2Info.userAvatars.find(a => a.isDefault); if(e2) a2 = e2.avatar.imageUrl;

    const base = { code: room.code, firstTurn: room.turn, ...this.roomPayload(room) }

    this.server.to(p1.socketId).emit('gameStart', { ...base, opponent: { name: p2Info.name, profileImage: a2 } })
    this.server.to(p2.socketId).emit('gameStart', { ...base, opponent: { name: p1Info.name, profileImage: a1 } })

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