import { Schema } from 'koishi'

export interface Config {
  initialLevel: number
  blockGuessTimeLimitInSeconds: number
  blockSize: number
  spacingBetweenGrids: number
  isNumericGuessMiddlewareEnabled: boolean
  shouldInterruptMiddlewareChainAfterTriggered: boolean
  isCompressPicture: boolean
  pictureQuality?: number
  enableAutoRecall: boolean
  autoRecallDelay?: number
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
    isNumericGuessMiddlewareEnabled: Schema.boolean().default(true)
      .description('游戏中直接发送 `行 列` 或块号即可猜测，无需输入指令。'),
    shouldInterruptMiddlewareChainAfterTriggered: Schema.boolean().default(true)
      .description('上述猜测触发后中断中间件链，避免被其他插件重复处理。'),
  }).description('基础配置'),

  Schema.intersect([
    Schema.object({
      isCompressPicture: Schema.boolean().default(false)
        .description('以 JPEG 输出，牺牲画质换取更小的体积（不建议，色差游戏对画质敏感）。'),
    }),
    Schema.union([
      Schema.object({
        isCompressPicture: Schema.const(true).required(),
        pictureQuality: Schema.natural().min(1).max(100).default(80)
          .description('JPEG 质量（1 ~ 100）。'),
      }),
      Schema.object({}),
    ]),
  ]).description('图片配置'),

  Schema.intersect([
    Schema.object({
      enableAutoRecall: Schema.boolean().default(false)
        .description('一段时间后自动撤回本插件发出的消息。'),
    }),
    Schema.union([
      Schema.object({
        enableAutoRecall: Schema.const(true).required(),
        autoRecallDelay: Schema.natural().min(1).default(60)
          .description('撤回延迟（秒）。需要机器人拥有撤回权限。'),
      }),
      Schema.object({}),
    ]),
  ]).description('自动撤回配置'),
]) as Schema<Config>
