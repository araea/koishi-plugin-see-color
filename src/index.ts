import { Context, h, Random, Session } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { Config } from './config'
import { defineTables, SeeColorGame } from './model'
import { renderGrid } from './render'

export { Config }
export const name = 'see-color'
export const inject = ['database', 'puppeteer']
export const usage = `## 使用

1. 启动 \`puppeteer\` 服务。
2. 用 \`seeColor.开始\` 开一局，直接发送 \`行 列\`（如 \`2 1\`）或块号即可猜测。

## QQ 群

- 956758505`

const MESSAGES = {
  hint: '请发送 `行 列`（如 `2 1`）或块号来指认与众不同的色块。',
  right: '👏 猜中啦！',
  wrong: '差一点点，再看看？',
  running: '本频道已经有一局在进行啦。',
  idle: '还没有开始哦，先来一句 `seeColor.开始` 吧。',
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name)
  defineTables(ctx)

  // 同频道内串行处理，避免两条消息同时猜中导致重复计分
  const busy = new Set<string>()
  const mime = `image/${config.isCompressPicture ? 'jpeg' : 'png'}`

  async function send(session: Session, content: h.Fragment) {
    const ids = await session.send(content)
    if (!config.enableAutoRecall) return ids
    ctx.setTimeout(() => {
      for (const id of ids) {
        session.bot.deleteMessage(session.channelId, id)
          .catch((error) => logger.warn('撤回消息 %s 失败：%s', id, error.message))
      }
    }, (config.autoRecallDelay ?? 60) * 1000)
    return ids
  }

  /** 读取频道当前的对局，没有开局时返回 undefined。 */
  async function getGame(channelId: string): Promise<SeeColorGame> {
    const [game] = await ctx.database.get('see_color_games', { channelId })
    return game?.isStarted ? game : undefined
  }

  /** 出下一题：随机挑一块作为答案，落库后返回图片。 */
  async function deal(session: Session, level: number) {
    const block = Random.int(1, level * level + 1)
    const image = await renderGrid(ctx, config, level, block - 1)
    const { channelId } = session
    const state = { isStarted: true, level, block, timestamp: String(session.timestamp) }
    const [existing] = await ctx.database.get('see_color_games', { channelId }, ['id'])
    if (existing) await ctx.database.set('see_color_games', { channelId }, state)
    else await ctx.database.create('see_color_games', { channelId, ...state })
    return h.image(image, mime)
  }

  /** 把块号换算成人类可读的「第 R 行 第 C 列」。 */
  function locate(level: number, block: number) {
    return `${Math.floor((block - 1) / level) + 1} ${(block - 1) % level + 1}`
  }

  /** 解析猜测，返回块号（从 1 开始）；无法解析时返回 0。 */
  function parse(input: string, level: number) {
    const text = input.trim().replace(/\s+/g, ' ')
    const pair = /^(\d+) (\d+)$/.exec(text)
    if (pair) {
      const [row, col] = [+pair[1], +pair[2]]
      if (row < 1 || row > level || col < 1 || col > level) return 0
      return (row - 1) * level + col
    }
    if (!/^\d+$/.test(text)) return 0
    const block = +text
    return block >= 1 && block <= level * level ? block : 0
  }

  async function addScore(session: Session, delta: number) {
    const where = { channelId: session.channelId, userId: session.userId }
    const [record] = await ctx.database.get('see_color_playing_records', where)
    const score = (record?.score ?? 0) + delta
    if (record) {
      await ctx.database.set('see_color_playing_records', where, { username: session.username, score })
    } else {
      await ctx.database.create('see_color_playing_records', { ...where, username: session.username, score })
    }

    const [best] = await ctx.database.get('see_color_rank', { userId: session.userId })
    if (!best) {
      await ctx.database.create('see_color_rank', { userId: session.userId, userName: session.username, score })
    } else if (best.score < score) {
      await ctx.database.set('see_color_rank', { userId: session.userId }, { userName: session.username, score })
    }
    return score
  }

  async function stop(channelId: string) {
    await ctx.database.set('see_color_games', { channelId }, { isStarted: false })
    await ctx.database.remove('see_color_playing_records', { channelId })
  }

  /** 处理一次猜测；返回 false 表示这条消息不是一次有效猜测。 */
  async function guess(session: Session, input: string) {
    const game = await getGame(session.channelId)
    if (!game) return false
    const block = parse(input, game.level)
    if (!block) return false
    if (busy.has(session.channelId)) return true
    busy.add(session.channelId)
    try {
      const limit = config.blockGuessTimeLimitInSeconds
      if (limit > 0 && session.timestamp - Number(game.timestamp) > limit * 1000) {
        await stop(session.channelId)
        await send(session, `⏰ 超过 ${limit} 秒啦，本局结束。答案是块 ${game.block}（${locate(game.level, game.block)}）。`)
        return true
      }
      if (block !== game.block) {
        await send(session, MESSAGES.wrong)
        return true
      }
      const score = await addScore(session, game.level)
      const image = await deal(session, game.level + 1)
      await send(session, [
        h.at(session.userId),
        ` ${MESSAGES.right}本题 +${game.level} 分，累计 ${score} 分。\n`,
        image,
        `\n${MESSAGES.hint}`,
      ])
      return true
    } finally {
      busy.delete(session.channelId)
    }
  }

  // 游戏进行中时，直接发数字即可猜测，无需输入指令
  ctx.middleware(async (session, next) => {
    if (!config.isNumericGuessMiddlewareEnabled) return next()
    if (!/^\d+(\s+\d+)?$/.test(session.content.trim())) return next()
    if (!await guess(session, session.content)) return next()
    if (!config.shouldInterruptMiddlewareChainAfterTriggered) return next()
  })

  const cmd = ctx.command('seeColor', '给我点颜色看看')
    .action(({ session }) => session.execute('help seeColor'))

  cmd.subcommand('.开始', '开始一局')
    .action(async ({ session }) => {
      if (await getGame(session.channelId)) return MESSAGES.running
      if (busy.has(session.channelId)) return
      busy.add(session.channelId)
      try {
        await ctx.database.remove('see_color_playing_records', { channelId: session.channelId })
        const image = await deal(session, config.initialLevel)
        await send(session, [h.at(session.userId), ' 🎉 猜色块开始！\n', image, `\n${MESSAGES.hint}`])
      } finally {
        busy.delete(session.channelId)
      }
    })

  cmd.subcommand('.猜 <input:text>', '猜一次色块')
    .usage('参数为 `行 列`（如 `2 1`）或块号。')
    .example('seeColor.猜 2 1')
    .action(async ({ session }, input) => {
      if (!await getGame(session.channelId)) return MESSAGES.idle
      if (!await guess(session, input ?? '')) return MESSAGES.hint
    })

  cmd.subcommand('.结束', '结束本局并公布答案')
    .action(async ({ session }) => {
      const game = await getGame(session.channelId)
      if (!game) return MESSAGES.idle
      await stop(session.channelId)
      await send(session, `🤭 猜不出来吧～答案是块 ${game.block}（${locate(game.level, game.block)}）。`)
    })

  cmd.subcommand('.排行榜 [count:posint]', '查看色榜')
    .action(async (_, count = 10) => {
      const rank = await ctx.database
        .select('see_color_rank')
        .orderBy('score', 'desc')
        .limit(Math.min(count, 50))
        .execute()
      if (!rank.length) return '色榜还空着，快去开一局吧～'
      return ['给我点颜色看看 · 色榜', ...rank.map((row, index) =>
        `${String(index + 1).padStart(2)}. ${row.userName} — ${row.score} 分`)].join('\n')
    })
}
