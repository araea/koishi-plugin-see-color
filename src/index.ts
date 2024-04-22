// noinspection CssInvalidPropertyValue

import {Context, h, Schema} from 'koishi'
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
- \`seeColor.排行榜\`: 查看玩家的排名，根据他们的分数。`

// pz* pzx*
export interface Config {
  style: string
  diffMode: string
  blockSize: number
  initialLevel: number
  diffPercentage: number
  pictureQuality: number
  maxImageDimensions: number
  isCompressPicture: boolean
  isNumericGuessMiddlewareEnabled: boolean
  shouldInterruptMiddlewareChainAfterTriggered: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    initialLevel: Schema.number().default(2).description('游戏的初始等级。'),
    blockSize: Schema.number().default(50).description('每个颜色方块的大小（像素）。'),
    diffPercentage: Schema.number().default(10).description('不同颜色方块的差异百分比。'),
    diffMode: Schema.union(['变浅', '变深', '随机']).default('随机').role('radio').description('色块差异模式。'),
    style: Schema.union(['1', '2', '随机']).default('随机').role('radio').description('色块样式。'),
    maxImageDimensions: Schema.number().default(2000).description('图片的最大尺寸（像素）。'),
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
  channelId: string
  isStarted: boolean
  level: number
  block: number
  path: string
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
  const GAME_ID = 'see_color_games'
  const PLAYING_RECORD_ID = 'see_color_playing_records'
  const RANK_ID = 'see_color_rank'
  const msg = {
    start: `游戏开始啦！🎉`,
    guess: `请发送 [猜测指令 + 数字序号] 来找到不一样的色块吧~\n注意喔~指令与数字之间需要存在一个空格！😉`,
    guessRight: `恭喜你猜对了！👏你真厉害呀~😍`,
    guessWrong: `猜错了哦~😅快再试一次吧！😊`,
    continue: `让我们继续吧~这回看看你能猜出来嘛~😜`,
    restarted: `游戏已重新开始~👍`,
    stopped: `游戏停止了哦~😢\n让我们开始新的一轮游戏吧~😘`,
    isStarted: '游戏已经开始了喔~😎',
    isNotStarted: `游戏还没开始呢~😮\n快开始游戏吧~😁`
  }
  // tzb*
  ctx.database.extend(GAME_ID, {
    id: 'unsigned',
    channelId: 'string',
    isStarted: 'boolean',
    level: 'integer',
    block: 'integer',
    path: 'string',
  }, {
    primary: 'id',
    autoInc: true,
  })
  ctx.database.extend(PLAYING_RECORD_ID, {
    id: 'unsigned',
    channelId: 'string',
    userId: 'string',
    username: 'string',
    score: 'unsigned',
  }, {
    primary: 'id',
    autoInc: true,
  })
  ctx.database.extend(RANK_ID, {
    id: 'unsigned',
    userId: 'string',
    userName: 'string',
    score: 'integer',
  }, {
    primary: 'id',
    autoInc: true,
  })
  // zjj*
  ctx.middleware(async (session, next) => {
    const gameInfo = await getGameInfo(session.channelId)
    if (!gameInfo.isStarted || !config.isNumericGuessMiddlewareEnabled || !isNumericString(session.content)) {
      return await next()
    }
    await session.execute(`seeColor.猜 ${session.content}`)
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
      await updateGameState(session.channelId, true, config.initialLevel)
    })
  // c*
  ctx.command('seeColor.猜 <number:number>', '猜色块')
    .action(async ({session}, number) => {
      // 检验参数
      if (!number || isNaN(number)) {
        return
      }
      // 获取游戏信息
      const gameInfo = await getGameInfo(session.channelId)
      if (!gameInfo.isStarted) {
        return
      }

      if (number === gameInfo.block) {
        const playingRecord = await updatePlayingRecord(session, gameInfo)
        // 更新排行榜
        await updateRank(session.userId, session.username, playingRecord.score)
        // 继续游戏
        const buffer = await generatePictureBuffer(gameInfo.level + 1, session.channelId)
        await session.send(`${h.at(session.userId)} ~\n${msg.guessRight}\n你获得了 ${gameInfo.level} 点积分喔~ 再接再厉喵~😊\n${h.image(buffer, 'image/png')}\n${msg.continue}`)
        // 更新游戏状态
        await updateGameState(session.channelId, true, gameInfo.level + 1)
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
        await ctx.database.remove(PLAYING_RECORD_ID, {channelId: session.channelId})
        await ctx.database.set(GAME_ID, {channelId: session.channelId}, {isStarted: false})
        await session.send(`${h.at(session.userId)} ~\n嘿嘿~🤭猜不出来吧~\n刚才的答案是块 ${gameInfo.block} 喔~\n${msg.stopped}`)
      } else {
        return msg.isNotStarted
      }
    })
  // r* phb* sb*
  ctx.command('seeColor.排行榜', '查看色榜')
    .action(async ({}) => {
      const rankInfo: SeeColorRank[] = await ctx.database.get(RANK_ID, {})

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
  async function updatePlayingRecord(session, gameInfo) {
    let playingRecord = await ctx.database.get(PLAYING_RECORD_ID, {
      userId: session.userId,
      channelId: session.channelId
    });

    if (playingRecord.length === 0) {
      return await ctx.database.create(PLAYING_RECORD_ID, {
        channelId: session.channelId,
        userId: session.userId,
        username: session.username,
        score: gameInfo.level
      });
    } else {
      await ctx.database.set(PLAYING_RECORD_ID, {userId: session.userId}, {
        username: session.username,
        score: playingRecord[0].score + gameInfo.level
      });

      playingRecord = await ctx.database.get(PLAYING_RECORD_ID, {
        userId: session.userId,
        channelId: session.channelId
      });

    }
    return playingRecord[0]
  }

  async function updateRank(userId: string, userName: string, score: number) {
    const rankInfo: SeeColorRank[] = await ctx.database.get(RANK_ID, {userId: userId})
    if (rankInfo.length === 0) {
      await ctx.database.create(RANK_ID, {userId: userId, userName: userName, score: score})
    } else if (rankInfo[0].score < score) {
      await ctx.database.set(RANK_ID, {userId: userId}, {userName: userName, score: score})
    }
  }

  function isNumericString(input: string): boolean {
    return /^\d+$/.test(input);
  }

  async function getGameInfo(channelId: string): Promise<SeeColorGame> {
    const gameInfo = await ctx.database.get(GAME_ID, {channelId: channelId})
    if (gameInfo.length === 0) {
      return await ctx.database.create(GAME_ID, {channelId: channelId, isStarted: false})
    } else {
      return gameInfo[0]
    }
  }

  async function updateGameState(channelId: string, isStarted: boolean, level: number) {
    await ctx.database.set(GAME_ID, {channelId: channelId}, {isStarted: isStarted, level: level})
  }

  async function generatePictureBuffer(n: number, channelId: string) {
    const {blockSize, diffPercentage, diffMode, isCompressPicture, style, pictureQuality, maxImageDimensions} = config;
    let pictureSize = blockSize * n;
    if (pictureSize > maxImageDimensions) {
      pictureSize = maxImageDimensions;
    }

    const randomColor = () => {
      return '#' + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    };
    const adjustColor = (color, percentage, mode) => {
      const factor = 1 + Math.random() * (percentage / 200); // 随机因子
      const rgb = parseInt(color.slice(1), 16); // 十六进制颜色转为整数

      let adjusted; // 调整后的颜色值
      let newColor; // 调整后的颜色字符串

      do {
        adjusted = [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff].map((value) => {
          // 按照模式调整颜色
          return mode === '随机'
            ? Math.random() < 0.5
              ? Math.min(255, Math.round(value * factor))
              : Math.max(0, Math.round(value / factor))
            : mode === '变浅'
              ? Math.min(255, Math.round(value * factor))
              : mode === '变深'
                ? Math.max(0, Math.round(value / factor))
                : value;
        });

        // 处理溢出情况
        adjusted = adjusted.map((value) => Math.min(255, Math.max(0, value)));

        // 整数转为十六进制颜色
        newColor =
          '#' +
          adjusted
            .reduce((acc, cur) => (acc << 8) + cur, 0)
            .toString(16)
            .padStart(6, '0');
      } while (newColor === color); // 循环直到生成不同的颜色

      return newColor;
    };


    const randomInt = (min: number, max: number) => {
      return Math.round(Math.random() * (max - min)) + min;
    };

    // 将基色和扩色声明为常量
    const baseColor = randomColor();
    const diffColor = adjustColor(baseColor, diffPercentage, diffMode);

    // 为不同的块(而不是行和列)生成随机索引
    const diffIndex = randomInt(0, n * n - 1);

    await ctx.database.set(GAME_ID, {channelId: channelId}, {block: diffIndex + 1});

    let html: string = "";
    const styles = {
      '1': `
<style>
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
  border: ${blockSize / 10}px solid white;
  box-sizing: content-box; /* Add this line to exclude the border from the block's size */
}

.diff {
  background-color: ${diffColor};
}
</style>

<div class="container">
`,
      '2': `
<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.container {
  display: grid;
  grid-template-columns: repeat(${n}, ${blockSize}px);
  grid-template-rows: repeat(${n}, ${blockSize}px);
  font-family: 'Comic Sans MS', cursive;
  font-size: ${blockSize / 2}px;
  color: white;
  text-align: center;
  line-height: ${blockSize}px;
}

.block {
  background-color: ${baseColor};
  border: none;
  border-collapse: collapse;
  overflow: hidden;
}

.diff {
  background-color: ${diffColor};
}
</style>

<div class="container">
`,
    };
    let htmlStyleIndex = style;
    if (htmlStyleIndex === '随机') {
      htmlStyleIndex = ['1', '2'][Math.floor(Math.random() * 2)];
    }
    html += styles[htmlStyleIndex];

    html += `
    <style>
    .shrink {
        font-size: ${blockSize / 3}px;
    }
    </style>`;

    for (let i = 0; i < n * n; i++) {
      const seqNum = i + 1;
      const className = i === diffIndex ? 'block diff' : 'block';
      const numDigits = Math.floor(Math.log10(seqNum)) + 1;
      const shrinkClass = numDigits > 2 ? 'shrink' : '';

      html += `<div class="${className}">
            <span class="${shrinkClass}">${seqNum}</span>
        </div>`;
    }

    const browser = ctx.puppeteer.browser;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setViewport({width: pictureSize, height: pictureSize, deviceScaleFactor: 1});
    await page.goto(pageGotoFilePath);

    await page.setContent(html, {waitUntil: 'load'});
    const buffer = await page.screenshot(isCompressPicture ? {
      type: 'jpeg',
      quality: pictureQuality,
    } : {type: 'png'});

    await page.close();
    await context.close();

    return buffer;
  }


  // apply
}
