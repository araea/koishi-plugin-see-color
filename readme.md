# koishi-plugin-see-color

[![npm](https://img.shields.io/npm/v/koishi-plugin-see-color?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-see-color)

## 🎈 介绍

基于 Koishi 的小游戏娱乐插件，一款有趣而简单的视觉游戏。🎮

游戏的名字叫做《给我点颜色看看》，也可以称为《找色块》或《猜色块》。

游戏开始后，系统会生成并发送一个由多个色块组成的图片，图片中有一个色块的颜色与其他色块稍有差异，你需要在规定时间内找出这个色块，并发送 块 xxx 来回答，其中 xxx 是色块的序号。

如果你回答正确，系统会给你积分奖励，并生成一个难度更高的图片继续游戏。如果你回答错误，插件会提示你再试一次。

你找到的色块越多，你的分数就越高。😎

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可
```

## ⚙️ 配置

- `initialLevel`: 游戏的初始等级。默认是 `2`。
- `blockSize`: 每个颜色方块的大小（像素）。默认是 `50`。
- `diffPercentage`: 不同颜色方块的差异百分比。默认是 `10`。

## 🎮 使用

- 仅群聊触发
- 建议为各指令添加合适的指令别名

- 发送 `给我颜色看看` 即可开始游戏

## 📝 命令

- `seeColor.start`: 开始一个新的游戏。指令别名为：`给我点颜色看看`
- `seeColor.guess <number>`: 猜测不同颜色方块的序号。指令别名为：`块 <number>`
- `seeColor.stop`: 停止当前的游戏。
- `seeColor.restart`: 重启当前的游戏。
- `seeColor.rank`: 查看玩家的排名，根据他们的分数。

## 🙏 致谢

* [Koishi](https://koishi.chat/) - 机器人框架
* [yunzai · 闲心/xianxin-plugin](https://gitee.com/xianxincoder/xianxin-plugin/blob/master/apps/seecolor.js)

## 📄 License

MIT License © 2023