import { Context } from 'koishi'

declare module 'koishi' {
  interface Tables {
    see_color_games: SeeColorGame
    see_color_playing_records: SeeColorPlayingRecord
    see_color_rank: SeeColorRank
  }
}

/** 每个频道一局，记录当前网格边长与答案所在的块号（从 1 开始）。 */
export interface SeeColorGame {
  id: number
  channelId: string
  isStarted: boolean
  level: number
  block: number
  /** 上一次出题的时间戳，用于限时判定。 */
  timestamp: string
}

/** 本局内某人的累计得分，游戏结束时清空。 */
export interface SeeColorPlayingRecord {
  id: number
  channelId: string
  userId: string
  username: string
  score: number
}

/** 跨频道的历史最高分。 */
export interface SeeColorRank {
  id: number
  userId: string
  userName: string
  score: number
}

export function defineTables(ctx: Context) {
  const key = { primary: 'id', autoInc: true } as const

  ctx.model.extend('see_color_games', {
    id: 'unsigned',
    channelId: 'string',
    isStarted: 'boolean',
    level: 'unsigned',
    block: 'unsigned',
    timestamp: 'string',
  }, key)

  ctx.model.extend('see_color_playing_records', {
    id: 'unsigned',
    channelId: 'string',
    userId: 'string',
    username: 'string',
    score: 'unsigned',
  }, key)

  ctx.model.extend('see_color_rank', {
    id: 'unsigned',
    userId: 'string',
    userName: 'string',
    score: 'unsigned',
  }, key)
}
