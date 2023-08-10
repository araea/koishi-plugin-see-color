import { Context, Schema, h } from 'koishi'
// 导入 jimp 库以创建和操作图像
import Jimp from 'jimp';

export const name = 'see-color'
export const usage = `## ⚙️ 配置

- \`initialLevel\`: 游戏的初始等级。默认是 \`2\`。
- \`blockSize\`: 每个颜色方块的大小（像素）。默认是 \`50\`。
- \`diffPercentage\`: 不同颜色方块的差异百分比。默认是 \`10\`。

## 🎮 使用

- 仅群聊触发
- 建议为各指令添加合适的指令别名

- 发送 \`给我颜色看看\` 即可开始游戏

## 📝 命令

- \`seeColor.start\`: 开始一个新的游戏。指令别名为：\`给我点颜色看看\`
- \`seeColor.guess <number>\`: 猜测不同颜色方块的序号。指令别名为：\`块 <number>\`
- \`seeColor.stop\`: 停止当前的游戏。
- \`seeColor.restart\`: 重启当前的游戏。
- \`seeColor.rank\`: 查看玩家的排名，根据他们的分数。`

export interface Config {
  initialLevel: number
  blockSize: number
  diffPercentage: number
}

export const Config: Schema<Config> = Schema.object({
  initialLevel: Schema.number().default(2).description('游戏的初始等级'),
  blockSize: Schema.number().default(50).description('每个颜色方块的大小（像素）'),
  diffPercentage: Schema.number().default(10).description('不同颜色方块的差异百分比'),
})

// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    see_color_games: SeeColorGames
    see_color_rank: SeeColorRank
  }
}

// 拓展表接口
export interface SeeColorGames {
  id: number
  guildId: string
  isStarted: boolean
  level: number
  block: number
}
export interface SeeColorRank {
  id: number
  userId: string
  userName: string
  score: number
}

export function apply(ctx: Context, config: Config) {
  // 过滤上下文，仅群聊可用
  ctx = ctx.guild()
  // 拓展表
  extendTables(ctx)
  // 注册 Koishi 指令： seeColor start guess stop restart rank
  registerAllKoishiCommands(ctx, config)
}

function extendTables(ctx: Context) {
  // 拓展 seeColor 游戏管理表
  ctx.model.extend('see_color_games', {
    // 各字段类型
    id: 'unsigned',
    guildId: 'string',
    isStarted: 'boolean',
    level: 'integer',
    block: 'integer',
  }, {
    // 使用自增的主键值
    autoInc: true,
  })

  // 拓展 seeColor 排行榜表
  ctx.model.extend('see_color_rank', {
    // 各字段类型
    id: 'unsigned',
    userId: 'string',
    userName: 'string',
    score: 'integer',
  }, {
    // 使用自增的主键值
    autoInc: true,
  })
}

function registerAllKoishiCommands(ctx: Context, config: Config) {
  // ID
  const GAME_ID = 'see_color_games'
  const RANK_ID = 'see_color_rank'
  // msg
  const msg = {
    start: `游戏开始啦！🎉`,
    guess: `请发送 \`块 xxx\` 来找到不一样的色块吧~\n注意喔~块与数字之间需要存在一个空格！😉`,
    guessRight: `恭喜你猜对了！👏你真厉害呀~😍`,
    guessWrong: `猜错了哦~😅快再试一次吧！😊`,
    continue: `让我们继续吧~这回看看你能猜出来嘛~😜`,
    restarted: `游戏已重新开始~👍`,
    stopped: `游戏停止了哦~😢\n发送 \`给我点颜色看看\` 开始新的一轮游戏吧~😘`,
    isStarted: '游戏已经开始了喔~😎',
    isNotStarted: `游戏还没开始呢~😮\n快发送 \`给我点颜色看看\` 开始游戏吧~😁`
  }
  const initialLevel = config.initialLevel
  // seeColor
  ctx.command('seeColor', '给我点颜色看看帮助')
    .action(async ({ session }) => {
      await session.execute(`seecolor -h`)
    })
  // start
  ctx.command('seeColor.start', '开始游戏').alias('给我点颜色看看')
    .action(async ({ session }) => {
      // 获取游戏信息
      const gameInfo = await getGameInfo(ctx, session.guildId)
      if (gameInfo.isStarted) {
        return msg.isStarted
      }
      // 开始游戏
      const buffer = await generatePictureBuffer(initialLevel, ctx, session.guildId)
      await session.send(`${h.at(session.userId)} ~\n${msg.start}\n${h.image(buffer, 'image/png')}\n${msg.guess}`)
      // 更新游戏状态
      updateGameState(ctx, session.guildId, true, initialLevel)
    })
  // guess
  ctx.command('seeColor.guess <number:number>', '猜色块').alias('块')
    .action(async ({ session }, number) => {
      // 检验参数
      if (!number || isNaN(number)) {
        return
      }
      // 获取游戏信息
      const gameInfo = await getGameInfo(ctx, session.guildId)
      if (!gameInfo.isStarted) {
        return msg.isNotStarted
      }
      if (number === gameInfo.block) {
        // 更新排行榜
        updateRank(ctx, session.userId, session.username, gameInfo.level)
        // 继续游戏
        const buffer = await generatePictureBuffer(gameInfo.level + 1, ctx, session.guildId)
        await session.send(`${h.at(session.userId)} ~\n${msg.guessRight}\n你获得了 ${gameInfo.level} 点积分喔~ 再接再厉喵~😊\n${h.image(buffer, 'image/png')}\n${msg.continue}`)
        // 更新游戏状态
        updateGameState(ctx, session.guildId, true, gameInfo.level + 1)
        return
      } else {
        return msg.guessWrong
      }

      async function updateRank(ctx: Context, userId: string, userName: string, score: number) {
        const rankInfo = await ctx.model.get(RANK_ID, { userId: userId })
        if (rankInfo.length === 0) {
          await ctx.model.create(RANK_ID, { userId: userId, userName: userName, score: score })
        } else {
          await ctx.model.set(RANK_ID, { userId: userId }, { userName: userName, score: rankInfo[0].score + score })
        }
      }
    })
  // stop 
  ctx.command('seeColor.stop', '停止游戏')
    .action(async ({ session }) => {
      // 获取游戏信息
      const gameInfo = await getGameInfo(ctx, session.guildId)
      if (gameInfo.isStarted) {
        await ctx.model.set(GAME_ID, { guildId: session.guildId }, { isStarted: false })
        await session.send(`${h.at(session.userId)} ~\n嘿嘿~🤭猜不出来吧~\n刚才的答案是块 ${gameInfo.block} 喔~\n${msg.stopped}`)
      } else {
        return msg.isNotStarted
      }
    })
  // restart
  ctx.command('seeColor.restart', '重新开始')
    .action(async ({ session }) => {
      // 获取游戏信息
      const gameInfo = await getGameInfo(ctx, session.guildId)
      if (gameInfo.isStarted) {
        await ctx.model.set(GAME_ID, { guildId: session.guildId }, { isStarted: false, level: 2 })
        const buffer = await generatePictureBuffer(initialLevel, ctx, session.guildId)
        await session.send(`${h.at(session.userId)} ~\n嘿嘿~🤭猜不出来吧~\n刚才的答案是块 ${gameInfo.block} 喔~\n${msg.restarted}\n${h.image(buffer, 'image/png')}\n${msg.guess}`)
        // 更新游戏状态
        updateGameState(ctx, session.guildId, true, initialLevel)
      } else {
        return msg.isNotStarted
      }
    })
  // rank
  ctx.command('seeColor.rank', '查看色榜')
    .action(async ({ }) => {
      // 获取游戏信息
      const rankInfo: SeeColorRank[] = await ctx.model.get(RANK_ID, {})
      // 根据score属性进行降序排序
      rankInfo.sort((a, b) => b.score - a.score)
      // 只保留前十名玩家，并生成排行榜的纯文本
      const table: string = generateRankTable(rankInfo.slice(0, 10))
      return table

      // 定义一个函数来生成排行榜的纯文本
      function generateRankTable(rankInfo: SeeColorRank[]): string {
        // 定义排行榜的模板字符串
        const template = `
给我点颜色看看排行榜：
 排名  昵称   积分  
--------------------
${rankInfo.map((player, index) => ` ${String(index + 1).padStart(2, ' ')}   ${player.userName.padEnd(6, ' ')} ${player.score.toString().padEnd(4, ' ')}`).join('\n')}
`
        return template
      }
    })

  // 辅助函数

  async function getGameInfo(ctx: Context, guildId: string): Promise<SeeColorGames> {
    const gameInfo = await ctx.model.get(GAME_ID, { guildId: guildId })
    if (gameInfo.length === 0) {
      return await ctx.model.create(GAME_ID, { guildId: guildId, isStarted: false })
    } else {
      return gameInfo[0]
    }
  }

  async function updateGameState(ctx: Context, guildId: string, isStarted: boolean, level: number) {
    await ctx.model.set(GAME_ID, { guildId: guildId }, { isStarted: isStarted, level: level })
  }

  // 核心功能实现

  // 定义一个函数以生成介于最小和最大(含)之间的随机整数
  function randomInt(min: number, max: number): number {
    // 使用位运算符来代替 Math.floor，因为它更快
    return (Math.random() * (max - min + 1) + min) | 0;
  }

  // 定义一个函数以生成十六进制格式的随机颜色
  function randomColor(): string {
    // 使用 toString(16) 来直接生成十六进制字符串，而不是使用数组和循环
    // 使用 padStart(6, '0') 来确保字符串长度为6
    return '#' + ((Math.random() * 0xFFFFFF) | 0).toString(16).padStart(6, '0');
  }

  // 定义一个按给定百分比使颜色变亮的函数
  function lightenColor(color: string, percentage: number): string {
    // 将颜色字符串转换为整数
    let colorInt = parseInt(color.slice(1), 16);
    // 循环三次以处理每个 RGB 通道
    for (let i = 0; i < 3; i++) {
      // 通过移位和掩蔽提取当前通道值
      let channel = (colorInt >> (8 * i)) & 0xFF;
      // 按百分比使通道值变亮
      channel = Math.min(255, Math.round(channel + ((255 - channel) * percentage / 200)));
      // 通过遮罩和移位来更新颜色整数
      colorInt = (colorInt & ~(0xFF << (8 * i))) | (channel << (8 * i));
    }
    // 将颜色整数转换回带有填充零的字符串
    return '#' + colorInt.toString(16).padStart(6, '0');
  }

  // 定义一个函数来为游戏生成图片缓冲区
  async function generatePictureBuffer(n: number, ctx: Context, guildId: string): Promise<Buffer> {
    // 定义图片大小和字体大小的一些常量
    const blockSize = config.blockSize; // 每个颜色块的大小(以像素为单位)
    const pictureSize = blockSize * n; // 图片的大小(以像素为单位)

    // 为颜色块生成随机颜色
    const baseColor = randomColor();

    // 为不同的颜色块生成较浅的颜色
    const diffColor = lightenColor(baseColor, config.diffPercentage);

    // 生成较浅的颜色为不同颜色块生成不同颜色块的随机位置
    const diffRow = randomInt(0, n - 1);
    const diffCol = randomInt(0, n - 1);

    await ctx.model.set(GAME_ID, { guildId: guildId }, { block: diffRow * n + diffCol + 1 })

    // 创建具有图片大小和基色的新图像
    const image = new Jimp(pictureSize, pictureSize, baseColor);

    // 加载用于书写序列号的字体
    const font = Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

    // 循环通过颜色块的每一行和每一列
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        // 计算当前颜色块的序列号
        const seqNum = row * n + col + 1;
        // 计算当前颜色块的x和y坐标
        const x = col * blockSize;
        const y = row * blockSize;
        // 检查当前颜色块是否为不同的颜色块
        if (row === diffRow && col === diffCol) {
          // 用较浅的颜色在基色上绘制一个矩形
          image.scan(x, y, blockSize, blockSize, (x, y, idx) => {
            image.bitmap.data[idx] = parseInt(diffColor.slice(1, 3), 16);
            image.bitmap.data[idx + 1] = parseInt(diffColor.slice(3, 5), 16);
            image.bitmap.data[idx + 2] = parseInt(diffColor.slice(5), 16);
          });
        }
        // 用字体将序列号写在当前颜色块的中心
        // 使用 print 的第四个参数来指定文本的宽度和高度，以避免文本超出边界
        image.print(await font, x, y, { text: seqNum.toString(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, blockSize, blockSize);
      }

    }
    // 以PNG格式返回图片的缓冲区
    return await image.getBufferAsync(Jimp.MIME_PNG);
  }
}