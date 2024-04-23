// noinspection CssInvalidPropertyValue

import {Context, h, Random, Schema} from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import path from "path";

export const name = 'see-color'
export const inject = {
  required: ['database', 'puppeteer'],
  // optional: ['markdownToImage'],
}
export const usage = `## 🎮 使用

- 启动 \`puppeteer\` 服务插件。
- 建议为各指令添加合适的指令别名。

## 📝 命令

- \`seeColor.开始\`: 开始一个新的游戏。
- \`seeColor.猜 <number>\`: 猜测不同颜色方块的序号。
- \`seeColor.结束\`: 结束当前的游戏。
- \`seeColor.排行榜\`: 查看玩家的排名，根据他们的分数。

## 🐱 QQ 群

-  956758505`

// pz* pzx*
export interface Config {
  blockSize: number
  initialLevel: number
  pictureQuality: number
  isCompressPicture: boolean
  spacingBetweenGrids: number
  blockGuessTimeLimitInSeconds: number
  isNumericGuessMiddlewareEnabled: boolean
  shouldInterruptMiddlewareChainAfterTriggered: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    initialLevel: Schema.number().default(2).description('游戏的初始等级。'),
    blockGuessTimeLimitInSeconds: Schema.number().min(0).default(0).description('猜测色块的时间限制（秒），值为 0 时则不限制时间。'),
    blockSize: Schema.number().default(50).description('每个颜色方块的大小（像素）。'),
    spacingBetweenGrids: Schema.number().default(10).description('色块之间的水平与垂直间距（像素）。'),
    isNumericGuessMiddlewareEnabled: Schema.boolean().default(true).description('是否启用数字猜测中间件。'),
    shouldInterruptMiddlewareChainAfterTriggered: Schema.boolean().default(true).description('是否在触发后中断中间件链。'),
  }).description('基础配置'),
  Schema.object({
    isCompressPicture: Schema.boolean().default(false).description('是否压缩图片（不建议）。'),
  }).description('图片配置'),
  Schema.union([
    Schema.object({
      isCompressPicture: Schema.const(true).required(),
      pictureQuality: Schema.number().min(1).max(100).default(80).description('压缩后图片的质量（1 ~ 100）。'),
    }),
    Schema.object({}),
  ]),
]) as any

// smb*
declare module 'koishi' {
  interface Tables {
    see_color_rank: SeeColorRank
    see_color_games: SeeColorGame
    see_color_playing_records: SeeColorPlayingRecord
  }
}

// jk*
export interface SeeColorGame {
  id: number
  level: number
  block: number
  channelId: string
  timestamp: string
  isStarted: boolean
}

export interface SeeColorPlayingRecord {
  id: number
  channelId: string
  userId: string
  username: string
  score: number
}

export interface SeeColorRank {
  id: number
  userId: string
  userName: string
  score: number
}

// zhs*
export function apply(ctx: Context, config: Config) {
  // wj*
  const filePath = path.join(__dirname, 'emptyHtml.html').replace(/\\/g, '/');
  const pageGotoFilePath = 'file://' + filePath;
  // cl*
  const msg = {
    start: `🎉 猜色块游戏开启！`,
    guess: `请输入 '行 列' 来揭示色块。\n例如: '2 1'。记得空格哦！😉`,
    guessRight: `👏 猜中啦！你太棒了！😍`,
    guessWrong: `哎呀，没猜中。再来一次吧！😊`,
    continue: `继续游戏，看你的了！😜`,
    restarted: `👍 游戏重置！`,
    stopped: `😢 游戏暂停。\n新一轮，开始！😘`,
    isStarted: `😎 游戏进行中...`,
    isNotStarted: `😮 还没开始。\n让我们动起来！😁`
  }
  // tzb*
  ctx.database.extend('see_color_games', {
    id: 'unsigned',
    channelId: 'string',
    isStarted: 'boolean',
    level: 'unsigned',
    block: 'unsigned',
    timestamp: 'string',
  }, {
    primary: 'id',
    autoInc: true,
  })
  ctx.database.extend('see_color_playing_records', {
    id: 'unsigned',
    channelId: 'string',
    userId: 'string',
    username: 'string',
    score: 'unsigned',
  }, {
    primary: 'id',
    autoInc: true,
  })
  ctx.database.extend('see_color_rank', {
    id: 'unsigned',
    userId: 'string',
    userName: 'string',
    score: 'unsigned',
  }, {
    primary: 'id',
    autoInc: true,
  })
  // zjj*
  ctx.middleware(async (session, next) => {
    const gameInfo = await getGameInfo(session.channelId)
    if (!gameInfo.isStarted || !config.isNumericGuessMiddlewareEnabled) {
      return await next()
    }
    if (checkFormat(session.content, gameInfo.level)) {
      await session.execute(`seeColor.猜 ${session.content}`)
    } else if (isValidNumber(session.content, gameInfo.level)) {
      await session.execute(`seeColor.猜 ${session.content}`)
    } else {
      return await next()
    }
    if (config.shouldInterruptMiddlewareChainAfterTriggered) {
      return
    } else {
      return await next()
    }
  })
  // zl*
  // bz* h*
  ctx.command('seeColor', '给我点颜色看看帮助')
    .action(async ({session}) => {
      await session.execute(`seecolor -h`)
    })
  // ks* s*
  ctx.command('seeColor.开始', '开始游戏')
    .action(async ({session}) => {
      // 获取游戏信息
      const gameInfo = await getGameInfo(session.channelId)
      if (gameInfo.isStarted) {
        return msg.isStarted;
      }
      await updatePlayingRecord(session, {level: 0})
      // 开始游戏
      const buffer = await generatePictureBuffer(config.initialLevel, session.channelId)
      await session.send(`${h.at(session.userId)} ~\n${msg.start}\n${h.image(buffer, `image/${config.isCompressPicture ? `jpeg` : `png`}`)}\n${msg.guess}`)
      // 更新游戏状态
      await updateGameState(session.channelId, true, config.initialLevel, String(session.timestamp))
    })
  // c*
  ctx.command('seeColor.猜 <numberString:text>', '猜色块')
    .action(async ({session}, numberString) => {
      // 检验参数
      if (!numberString) {
        return msg.guess
      }

      // 获取游戏信息
      const gameInfo = await getGameInfo(session.channelId)
      const isCheckFormat = checkFormat(numberString, gameInfo.level)
      const isValidNumberString = isValidNumber(numberString, gameInfo.level)
      if (!isCheckFormat && !isValidNumberString) {
        return msg.guess
      }

      if (!gameInfo.isStarted) {
        return msg.isNotStarted
      }

      const lastTimestamp = Number(gameInfo.timestamp)
      const timeDifference = calculateTimeDifference(lastTimestamp, session.timestamp)
      if (timeDifference > config.blockGuessTimeLimitInSeconds && config.blockGuessTimeLimitInSeconds > 0) {
        await session.send(`时间超过 ${config.blockGuessTimeLimitInSeconds} 秒！游戏结束！😢`)
        await session.execute(`seeColor.结束`)
        return
      }

      let number = 0;
      const {row, col} = getRowCol(gameInfo.level, gameInfo.block - 1);
      if (isValidNumberString) {
        number = parseFloat(numberString);
      } else {
        const [rowStr, colStr] = numberString.split(' ');
        const rowNumber = parseInt(rowStr);
        const colNumber = parseInt(colStr);
        if (rowNumber === row + 1 && colNumber === col + 1) {
          number = gameInfo.block;
        } else {
          return msg.guessWrong
        }
      }

      if (number === gameInfo.block) {
        const playingRecord = await updatePlayingRecord(session, gameInfo)
        // 更新排行榜
        await updateRank(session.userId, session.username, playingRecord.score)
        // 继续游戏
        const buffer = await generatePictureBuffer(gameInfo.level + 1, session.channelId)
        await session.send(`${h.at(session.userId)} ~\n${msg.guessRight}\n赢得 ${gameInfo.level} 点积分！再接再厉喵~😊\n${h.image(buffer, `image/${config.isCompressPicture ? `jpeg` : `png`}`)}\n${msg.continue}`)
        // 更新游戏状态
        await updateGameState(session.channelId, true, gameInfo.level + 1, String(session.timestamp))
        return
      } else {
        return msg.guessWrong
      }
    })
  // tz* s* js*
  ctx.command('seeColor.结束', '强制结束游戏')
    .action(async ({session}) => {
      // 获取游戏信息
      const gameInfo = await getGameInfo(session.channelId)
      if (gameInfo.isStarted) {
        await ctx.database.remove('see_color_playing_records', {channelId: session.channelId})
        await ctx.database.set('see_color_games', {channelId: session.channelId}, {isStarted: false})
        const {row, col} = getRowCol(gameInfo.level, gameInfo.block - 1);
        await session.send(`${h.at(session.userId)} ~\n嘿嘿~🤭猜不出来吧~\n答案是块 ${gameInfo.block}（${row + 1} ${col + 1}） 喔~\n${msg.stopped}`)
      } else {
        return msg.isNotStarted
      }
    })
  // r* phb* sb*
  ctx.command('seeColor.排行榜', '查看色榜')
    .action(async ({}) => {
      const rankInfo: SeeColorRank[] = await ctx.database.get('see_color_rank', {})

      rankInfo.sort((a, b) => b.score - a.score)

      return generateRankTable(rankInfo.slice(0, 10))

      // 定义一个函数来生成排行榜的纯文本
      function generateRankTable(rankInfo: SeeColorRank[]): string {
        // 定义排行榜的模板字符串
        return `
给我点颜色看看排行榜：
 排名  昵称   积分
--------------------
${rankInfo.map((player, index) => ` ${String(index + 1).padStart(2, ' ')}   ${player.userName.padEnd(6, ' ')} ${player.score.toString().padEnd(4, ' ')}`).join('\n')}
`
      }
    })

  // hs*
  function calculateTimeDifference(previousTimestamp: number, currentTimestamp: number): number {
    return (currentTimestamp - previousTimestamp) / 1000;
  }

  function getLevel(n: number): number {
    // 确定 level 的范围
    const minLevel = 6;
    const maxLevel = 12;
    const range = maxLevel - minLevel + 1; // 7

    return n % range + minLevel;
  }

  function randomSign() {
    return Random.int(2) * 2 - 1
  }

  function to256(scale: number) {
    scale *= 256
    return scale > 255 ? 'ff' : scale < 0 ? '00' : Math.floor(scale).toString(16).padStart(2, '0')
  }

  function createColor(r: number, g: number, b: number) {
    return `#${to256(r)}${to256(g)}${to256(b)}`
  }

  function hsv(h: number, s: number = 1, v: number = 1) {
    let c = v * s
    const hh = h / 60
    const m = v - c
    const x = c * (1 - Math.abs(hh % 2 - 1)) + m
    c = c + m
    switch (Math.floor(hh)) {
      case 0:
        return createColor(c, x, m)
      case 1:
        return createColor(x, c, m)
      case 2:
        return createColor(m, c, x)
      case 3:
        return createColor(m, x, c)
      case 4:
        return createColor(x, m, c)
      case 5:
        return createColor(c, m, x)
    }
  }

  function isValidNumber(content: string, level: number): boolean {
    // 使用正则表达式检查字符串是否为一个合法的数字
    const isValidFormat = /^\d+(\.\d+)?$/.test(content);

    if (!isValidFormat) {
      return false;
    }

    const number = parseFloat(content);

    // 检查数字是否在指定范围内
    if (number >= 1 && number <= level * level) {
      return true;
    }

    return false;
  }

  function checkFormat(content: string, level: number): boolean {
    const regex = /^\d+\s\d+$/; // 正则表达式匹配数字 空格 数字的格式

    if (!regex.test(content)) {
      return false; // 如果不符合格式直接返回 false
    }

    const [num1, num2] = content.split(' ').map(Number); // 将字符串按空格分割并转换为数字

    if (isNaN(num1) || isNaN(num2)) {
      return false; // 如果无法解析数字则返回 false
    }

    if (num1 < 1 || num1 > level || num2 < 1 || num2 > level) {
      return false; // 如果数字不在范围内返回 false
    }

    return true; // 符合所有条件，返回 true
  }

  function getRowCol(n: number, diffIndex: number): { row: number, col: number } {
    const row = Math.floor(diffIndex / n);
    const col = diffIndex % n;
    return {row, col};
  }

  function adjustColor(color, percentage, mode, maxIterations = 100) {
    const rgb = parseInt(color.slice(1), 16);

    let newColor;
    let iterations = 0;

    do {
      const factor = 1 + Math.random() * (percentage / 200); // Generate a random factor
      const adjusted = [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff].map((value) => {
        let newValue;
        if (mode === '随机') {
          newValue = Math.random() < 0.5 ? Math.min(255, Math.round(value * factor)) : Math.max(0, Math.round(value / factor));
        } else if (mode === '变浅') {
          newValue = Math.min(255, Math.round(value * factor));
        } else if (mode === '变深') {
          newValue = Math.max(0, Math.round(value / factor));
        } else {
          newValue = value;
        }
        return newValue;
      });

      const adjustedColor = adjusted.map((value) => Math.min(255, Math.max(0, value)));
      newColor = '#' + adjustedColor.reduce((acc, cur) => (acc << 8) + cur, 0).toString(16).padStart(6, '0');

      iterations++;

      if (iterations >= maxIterations) {
        newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        break;
      }
    } while (newColor === color);

    return newColor;
  }

  function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomColor() {
    return '#' + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  }

  async function updatePlayingRecord(session, gameInfo) {
    let playingRecord = await ctx.database.get('see_color_playing_records', {
      userId: session.userId,
      channelId: session.channelId
    });

    if (playingRecord.length === 0) {
      return await ctx.database.create('see_color_playing_records', {
        channelId: session.channelId,
        userId: session.userId,
        username: session.username,
        score: gameInfo.level
      });
    } else {
      await ctx.database.set('see_color_playing_records', {channelId: session.channelId, userId: session.userId}, {
        username: session.username,
        score: playingRecord[0].score + gameInfo.level
      });

      playingRecord = await ctx.database.get('see_color_playing_records', {
        userId: session.userId,
        channelId: session.channelId
      });

    }
    return playingRecord[0]
  }

  async function updateRank(userId: string, userName: string, score: number) {
    const rankInfo: SeeColorRank[] = await ctx.database.get('see_color_rank', {userId: userId})
    if (rankInfo.length === 0) {
      await ctx.database.create('see_color_rank', {userId: userId, userName: userName, score: score})
    } else if (rankInfo[0].score < score) {
      await ctx.database.set('see_color_rank', {userId: userId}, {userName: userName, score: score})
    }
  }

  function isNumericString(input: string): boolean {
    return /^\d+$/.test(input);
  }

  async function getGameInfo(channelId: string): Promise<SeeColorGame> {
    const gameInfo = await ctx.database.get('see_color_games', {channelId: channelId})
    if (gameInfo.length === 0) {
      return await ctx.database.create('see_color_games', {channelId: channelId, isStarted: false})
    } else {
      return gameInfo[0]
    }
  }

  async function updateGameState(channelId: string, isStarted: boolean, level: number, timestamp: string) {
    await ctx.database.set('see_color_games', {channelId: channelId}, {
      isStarted: isStarted,
      level: level,
      timestamp: timestamp
    })
  }

  async function generatePictureBuffer(n: number, channelId: string) {
    const {
      blockSize,
      isCompressPicture,
      pictureQuality,
      spacingBetweenGrids
    } = config;

    // 将基色和扩色声明为常量
    // 使用Random库生成随机色相、饱和度和明度值
    const h = Random.real(360) // 随机色相值，范围是0到360
    const s = Random.real(0.2, 1) // 随机饱和度值，范围是0.2到1
    const v = Random.real(0.2, 1) // 随机明度值，范围是0.2到1
    const baseColor = hsv(h, s, v); // 使用这些值创建基础颜色

    // 计算色相、饱和度和明度的变化因子
    const factorH = Math.random() * 0.3 + 0.1
    const residue = 1 - factorH
    const factorS = Math.random() * residue * 0.6 + residue * 0.2
    const factorV = residue - factorS // 明度变化因子

    const level = getLevel(n); // 6 ~ 12
    // 根据 level 计算色相、饱和度和明度的变化范围
    const rangeH = 30 * Math.exp(-0.2 * level)
    const rangeS = 0.5 * Math.exp(-0.1 * level)
    const rangeV = 0.2 * Math.exp(-0.1 * level)

    // 计算饱和度和明度的实际变化量
    let deltaS = factorS * rangeS
    if (deltaS + s > 1) {
      deltaS *= -1
    } else if (deltaS <= s) {
      deltaS *= randomSign()
    }
    let deltaV = factorV * rangeV
    if (deltaV + v > 1) {
      deltaV *= -1
    } else if (deltaV <= v) {
      deltaV *= randomSign()
    }

    // 计算总的变化因子，并据此计算色相的变化量
    const factor = s + v + deltaS / 2 + deltaV / 2
    const deltaH = factorH * rangeH * randomSign() / factor
    let biasedH = h + deltaH
    if (biasedH < 0) biasedH += 360
    else if (biasedH >= 360) biasedH -= 360

    const diffColor = hsv(biasedH, s + deltaS, v + deltaV); // 生成新的颜色


    // 为不同的块(而不是行和列)生成随机索引
    const diffIndex = randomInt(0, n * n - 1);
    const {row, col} = getRowCol(n, diffIndex);
    const offset = blockSize;
    const canvasSize = n * blockSize + (n - 1) * spacingBetweenGrids + offset * 2;
    await ctx.database.set('see_color_games', {channelId: channelId}, {block: diffIndex + 1});

    let html: string = `
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>色块网格</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        canvas {
            /*border: 1px solid #000;*/
        }
    </style>
</head>
<body>
<canvas id="colorGridCanvas"></canvas>
<script>
    const n = ${n}; // 网格的大小
    const blockSize = ${blockSize}; // 色块的边长
    const spacingBetweenGrids = ${spacingBetweenGrids}; // 色块间距
    const baseColor = '${baseColor}'; // 基础色块颜色
    const diffColor = '${diffColor}'; // 不同色块的颜色
    const offset = ${offset}; // 行号和列号的偏移量

    const canvas = document.getElementById('colorGridCanvas');
    const ctx = canvas.getContext('2d');

    // 设置 canvas 大小，增加额外空间用于显示行号和列号
    canvas.width = ${canvasSize};
    canvas.height = ${canvasSize};

    // 随机选择一个色块改变颜色
    const diffBlockRow = ${row};
    const diffBlockCol = ${col};

    // 绘制色块网格
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            const color = (row === diffBlockRow && col === diffBlockCol) ? diffColor : baseColor;
            const x = col * (blockSize + spacingBetweenGrids) + offset;
            const y = row * (blockSize + spacingBetweenGrids) + offset;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, blockSize, blockSize);
        }
    }

    // 设置字体样式
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 在色块外侧显示行号和列号
    for (let i = 0; i < n; i++) {
        // 显示列号
        ctx.fillText(i + 1, i * (blockSize + spacingBetweenGrids) + blockSize / 2 + offset, blockSize / 2);
        // 显示行号
        ctx.fillText(i + 1, blockSize / 2, i * (blockSize + spacingBetweenGrids) + blockSize / 2 + offset);
    }
</script>
</body>
</html>
`;

    const browser = ctx.puppeteer.browser;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setViewport({width: canvasSize, height: canvasSize, deviceScaleFactor: 1});
    await page.goto(pageGotoFilePath);

    await page.setContent(html, {waitUntil: 'load'});
    const canvas = await page.$('#colorGridCanvas');
    const buffer = await canvas.screenshot(isCompressPicture ? {
      type: 'jpeg',
      quality: pictureQuality,
    } : {type: 'png'});

    await page.close();
    await context.close();

    return buffer;
  }


  // apply
}
