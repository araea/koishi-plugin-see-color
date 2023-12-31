import { Context, Schema, h } from 'koishi'
import find from 'puppeteer-finder'
import puppeteer, { Browser } from "puppeteer-core";
import tmp from 'tmp'
import fs from 'fs'
import { result } from 'lodash';

export const name = 'see-color'
export const usage = `## ⚙️ 配置

- \`initialLevel\`: 游戏的初始等级。默认值为 \`2\`。
- \`blockSize\`: 每个颜色方块的大小（像素）。默认值为 \`50\`。
- \`diffPercentage\`: 不同颜色方块的差异百分比。默认值为 \`10\`。

新增配置项：

- \`diffMode\`: 色块差异模式。可选值为 "变浅"、"变深"、"随机"。默认值为 "随机"。
- \`style\`: 色块样式。可选值为 "1"、"2"、"随机"。默认值为 "1"。

图片配置：

- \`isCompressPicture\`: 是否压缩图片（不建议使用）。默认值为 \`false\`。

如果 \`isCompressPicture\` 为 \`true\`，则添加以下配置项：

- \`pictureQuality\`: 压缩后图片的质量（1-100）。取值范围为 1 到 100，默认值为 80。

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
  isCompressPicture: boolean
  pictureQuality: number
  initialLevel: number
  blockSize: number
  diffPercentage: number
  diffMode: string
  style: string
}
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    initialLevel: Schema.number().default(2).description('游戏的初始等级'),
    blockSize: Schema.number().default(50).description('每个颜色方块的大小（像素）'),
    diffPercentage: Schema.number().default(10).description('不同颜色方块的差异百分比'),
    diffMode: Schema
      .union(['变浅', '变深', '随机']).default('随机')
      .role('radio').description('色块差异模式'),
    style: Schema
      .union(['1', '2', '随机']).default('1')
      .role('radio').description('色块样式'),
  }).description('基础配置'),
  Schema.object({
    isCompressPicture: Schema.boolean().default(false).description('是否压缩图片(不建议)'),
  }).description('图片配置'),
  Schema.union([
    Schema.object({
      isCompressPicture: Schema.const(true).required(),
      pictureQuality: Schema.number().min(1).max(100).default(80).description('压缩后图片的质量(1-100)'),
    }),
    Schema.object({}),
  ]),
]) as Schema<Config>

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
  path: string
}
export interface SeeColorRank {
  id: number
  userId: string
  userName: string
  score: number
}

// puppeteer-finder模块可以查找本机安装的Chrome / Firefox / Edge浏览器


export async function apply(ctx: Context, config: Config) {
  const executablePath = await find();
  // 过滤上下文，仅群聊可用
  ctx = ctx.guild()
  // 拓展表
  extendTables(ctx)
  // 注册 Koishi 指令： seeColor start guess stop restart rank
  registerAllKoishiCommands(ctx, config, executablePath)
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
    path: 'string',
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

function registerAllKoishiCommands(ctx: Context, config: Config, executablePath: any) {
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
      const result = processGameInfo(gameInfo)
      if (result !== null) {
        return result
      }
      // 开始游戏
      const buffer = await generatePictureBuffer(initialLevel, ctx, session.guildId)
      await session.send(`${h.at(session.userId)} ~\n${msg.start}\n${h.image(buffer, 'image/png')}\n${msg.guess}`)
      // 更新游戏状态
      updateGameState(ctx, session.guildId, true, initialLevel)

      function getImageBufferFromPath(imagePath) {
        return new Promise((resolve, reject) => {
          fs.readFile(imagePath, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
      }
      function isFileExists(path) {
        return new Promise((resolve) => {
          fs.access(path, fs.constants.F_OK, (err) => {
            resolve(!err);
          });
        });
      }

      async function processGameInfo(gameInfo) {
        if (gameInfo.isStarted) {
          const isExists = await isFileExists(gameInfo.path);
          if (!isExists) {
            return msg.isStarted;
          }

          const buffer = await getImageBufferFromPath(gameInfo.path) as any;
          return `${msg.isStarted}\n${h.image(buffer, 'image/png')}`;
        }

        return null;
      }
    })

  // test
  // ctx.command('seeColor.test', '测试')
  //   .action(async ({ session }) => {
  //     // 开始游戏
  //     const buffer = await generatePictureBuffer(60, ctx, session.guildId)
  //     await session.send(`${h.at(session.userId)} ~\n${msg.start}\n${h.image(buffer, 'image/png')}\n${msg.guess}`)
  //   })

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

  // 浏览器管理
  class BrowserManager {
    private browser: Browser;

    async getBrowserInstance() {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          executablePath: executablePath,
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      }
      return this.browser;
    }

    async closeBrowserInstance() {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  // 创建 BrowserManager 的实例
  const browserManager = new BrowserManager();

  // 声明一个变量来保存 cleanupCallback
  let myCleanupCallback;

  // 关闭插件时消除插件的副作用
  ctx.on('dispose', async () => {
    await browserManager.closeBrowserInstance();
    if (myCleanupCallback) {
      myCleanupCallback();
    }
  })

  // 核心功能实现
  const generatePictureBuffer = async (n: number, ctx: Context, guildId: string) => {
    const { blockSize, diffPercentage, diffMode, isCompressPicture, style, pictureQuality } = config;
    const pictureSize = blockSize * n;

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

    // 将块索引存储在模型中
    await ctx.model.set(GAME_ID, { guildId: guildId }, { block: diffIndex + 1 });

    const page = await (await browserManager.getBrowserInstance()).newPage();

    // 设置视区
    await page.setViewport({
      width: pictureSize,
      height: pictureSize,
      deviceScaleFactor: 1,
    });

    let html: string = "";
    // 使用对象文字将每种样式映射到其对应的 HTML 字符串
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
  font-family: 'Comic Sans MS', cursive; /* Use a playful font */
  font-size: ${blockSize / 2}px;
  color: white;
  text-align: center;
  line-height: ${blockSize}px;
}

.block {
  background-color: ${baseColor};
  border: none; /* Remove the border */
  border-collapse: collapse; /* Collapse table borders */
  overflow: hidden; /* Hide any overflowing content */
}

.diff {
  background-color: ${diffColor};
}
</style>

<div class="container">
`,
    };
    let htmlStyleIndex = style
    // 如果 style 为‘随机’，则使用三元运算符生成随机样式
    if (htmlStyleIndex === '随机') {
      htmlStyleIndex = ['1', '2'][Math.floor(Math.random() * 2)];
    }
    // 将样式的 HTML 字符串追加到 html 变量
    html += styles[htmlStyleIndex];

    // 使用 += 运算符追加其他 HTML 字符串
    html += `
<style>
.shrink {
  font-size: ${blockSize / 3}px;
}
</style>`;

    // 使用 for 循环遍历块的数量，并将每个 HTML 字符串附加到 html 变量
    for (let i = 0; i < n * n; i++) {
      const seqNum = i + 1;

      // 使用三元运算符确定每个块的类名
      const className = i === diffIndex ? 'block diff' : 'block';

      // 使用 Math.log10 计算每个序列号中的位数
      const numDigits = Math.floor(Math.log10(seqNum)) + 1;

      // 使用三元运算符确定是否对每个序列号应用收缩类
      const shrinkClass = numDigits > 2 ? 'shrink' : '';

      html += `<div class="${className}">
    <span class="${shrinkClass}">${seqNum}</span>
  </div>`;
    }

    // 使用 html 变量设置页面内容
    await page.setContent(html);

    // 将缓冲区声明为常量，并使用三元运算符为页面分配不同的选项。截图取决于 isCompressPicture
    const buffer = await page.screenshot(
      isCompressPicture ? { type: 'jpeg', quality: pictureQuality } : { type: 'png' }
    );

    // 使用 tmp.file 方法创建一个临时文件
    tmp.file(function (err, path, fd, cleanupCallback) {
      if (err) throw err;

      // 使用 fs.write 方法将缓冲区的内容写入到文件中
      fs.write(fd, buffer, 0, buffer.length, 0, async function (err, written, buffer) {
        if (err) throw err;
        await ctx.model.set(GAME_ID, { guildId: guildId }, { path: path })

        // 如果不需要文件了，可以手动调用清理回调函数，或者等待程序退出时自动清理
        // 将 cleanupCallback 赋值给外部变量 myCleanupCallback
        myCleanupCallback = cleanupCallback;
        // cleanupCallback();
      });
    });
    return buffer;
  }


}