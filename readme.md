# koishi-plugin-see-color

[![npm](https://img.shields.io/npm/v/koishi-plugin-see-color?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-see-color)

## 🎈 介绍

一款有趣而简单的视觉游戏。🎮

游戏开始后，系统会生成并发送一个由多个色块组成的图片，图片中有一个色块的颜色与其他色块稍有差异，你需要在规定时间内找出这个色块，并发送指令来猜测。

如果你回答正确，系统会给你积分奖励，并生成一个难度更高的图片继续游戏。如果你回答错误，则会提示你再试一次。

你找到的色块越多，你的分数就越高。😎

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可
```

## ⚙️ 配置

### 基础配置

- `initialLevel`: 游戏的初始等级。默认值为 `2`。
- `blockSize`: 每个颜色方块的大小（像素）。默认值为 `50`。
- `isNumericGuessMiddlewareEnabled`: 是否启用数字猜测中间件。默认值为 `true`。
- `blockGuessTimeLimitInSeconds`: 猜测颜色方块的时间限制（秒）。默认值为 `0`，为 `0` 时则不限制时间。

### 图片配置：

- `isCompressPicture`: 是否压缩图片（不建议使用）。默认值为 `false`。

#### 如果 `isCompressPicture` 为 `true`，则添加以下配置项：

- `pictureQuality`: 压缩后图片的质量（1-100）。取值范围为 1 到 100，默认值为 80。

## 🎮 使用

- 启动 `puppeteer` 服务插件。
- 建议为各指令添加合适的指令别名。

## 📝 命令

- `seeColor.开始`: 开始一个新的游戏。
- `seeColor.猜 <number>`: 猜测不同颜色方块的序号。
- `seeColor.结束`: 结束当前的游戏。
- `seeColor.排行榜`: 查看玩家的排名，根据他们的分数。

## 🙏 致谢

* [Koishi](https://koishi.chat/) - 机器人框架
* [longyong](https://forum.koishi.xyz/u/longyong/summary) - 提供动力
* [yunzai · 闲心/xianxin-plugin](https://gitee.com/xianxincoder/xianxin-plugin/blob/master/apps/seecolor.js) - 提供参考
* [koishi-plugin-color-bias](https://github.com/koishijs/koishi-plugin-color-bias/blob/main/src/state.ts) -
  颜色差异代码参考，梦宝永远滴神！

## 🐱 QQ 群

- 956758505

## 📄 License

MIT License © 2024

希望您喜欢这款插件！ 💫

如有任何问题或建议，欢迎联系我哈~ 🎈


