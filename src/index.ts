import { Context, Schema, h } from 'koishi'
import find from 'puppeteer-finder'
import puppeteer from "puppeteer-core";

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

// puppeteer-finder模块可以查找本机安装的Chrome / Firefox / Edge浏览器
const executablePath = find();

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
        return
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

  function randomInt(min, max) {
    return (Math.random() * (max - min + 1) + min) | 0;
  }

  function randomColor() {
    return '#' + ((Math.random() * 0xFFFFFF) | 0).toString(16).padStart(6, '0');
  }

  function lightenColor(color, percentage) {
    let colorInt = parseInt(color.slice(1), 16);
    for (let i = 0; i < 3; i++) {
      let channel = (colorInt >> (8 * i)) & 0xFF;
      channel = Math.min(255, Math.round(channel + ((255 - channel) * percentage / 200)));
      colorInt = (colorInt & ~(0xFF << (8 * i))) | (channel << (8 * i));
    }
    return '#' + colorInt.toString(16).padStart(6, '0');
  }

  async function generatePictureBuffer(n, ctx, guildId) {
    const blockSize = config.blockSize;
    const pictureSize = blockSize * n;

    const baseColor = randomColor();

    const diffColor = lightenColor(baseColor, config.diffPercentage);

    const diffRow = randomInt(0, n - 1);
    const diffCol = randomInt(0, n - 1);

    await ctx.model.set(GAME_ID, { guildId: guildId }, { block: diffRow * n + diffCol + 1 });

    const browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: "new",
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: pictureSize,
      height: pictureSize,
      deviceScaleFactor: 1,
    });

    let html = `<style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
  
      .container {
        display: grid;
        grid-template-columns: repeat(${n}, ${blockSize}px);
        grid-template-rows: repeat(${n}, ${blockSize}px);
        font-family: sans-serif;
        font-size: ${blockSize / 2}px;
        color: black;
        text-align: center;
        line-height: ${blockSize}px;
      }
  
      .block {
        background-color: ${baseColor};
        border: solid white ${blockSize / 10}px;
      }
  
      .diff {
        background-color: ${diffColor};
      }
      </style>
      <div class="container">`;

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const seqNum = row * n + col + 1;
        const className =
          row === diffRow && col === diffCol ? 'block diff' : 'block';
        html += `<div class="${className}">${seqNum}</div>`;
      }
    }

    html += '</div>';

    await page.setContent(html);

    const buffer = await page.screenshot({ type: 'png' });

    await browser.close();

    return buffer;
  }
}