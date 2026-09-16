import { Schema } from 'koishi'

export interface Config {
  initialLevel: number
  blockGuessTimeLimitInSeconds: number
  blockSize: number
  spacingBetweenGrids: number
  enableDirectInput: boolean
  shouldInterruptMiddlewareChainAfterTriggered: boolean
  retractDelay: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    initialLevel: Schema.natural().min(2).default(2)
      .description('初始网格边长（2 表示 2×2），每猜对一次加一。'),
    blockGuessTimeLimitInSeconds: Schema.natural().default(0)
      .description('单次猜测的时间限制（秒），0 表示不限时。'),
    blockSize: Schema.natural().min(8).default(50)
      .description('每个色块的边长（像素）。'),
    spacingBetweenGrids: Schema.natural().default(10)
      .description('色块之间的间距（像素）。'),
    enableDirectInput: Schema.boolean().default(true)
      .description('对局中直接发送 `行 列` 或块号即可猜测，无需指令前缀。'),
    shouldInterruptMiddlewareChainAfterTriggered: Schema.boolean().default(true)
      .description('上述猜测触发后中断中间件链，避免被其他插件重复处理。'),
  }).description('基础配置'),

  Schema.object({
    retractDelay: Schema.natural().default(0)
      .description('自动撤回延迟（秒），0 表示不撤回。'),
  }).description('消息发送设置'),
]) as Schema<Config>
