# 给我点颜色看看

Koishi 插件：在群里玩找异色块的拼眼力小游戏，支持积分排行

[![GitHub](https://img.shields.io/badge/GitHub-araea%2Fkoishi--plugin--see--color-181717?logo=github&logoColor=white)](https://github.com/araea/koishi-plugin-see-color)
[![npm](https://img.shields.io/npm/v/koishi-plugin-see-color?logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/koishi-plugin-see-color)

## 安装

```sh
npm i koishi-plugin-see-color
```

启用插件，并安装 `database` 与 `puppeteer` 服务。`puppeteer` 依赖 Chromium，需在本机安装可被其调用的 Chromium。

## 快速使用

| 指令 | 说明 |
| --- | --- |
| `color` | 查看帮助，别名 `seeColor` |
| `color.开始` | 开始一局 |
| `color.猜 <行 列 \| 块号>` | 猜测异色块 |
| `color.结束` | 结束本局并公布答案 |
| `color.排行榜 [数量]` | 查看积分排行 |

对局中直接发送 `行 列`（如 `2 1`）即可猜测，无需指令前缀。单独的块号只在 `color.猜` 中接受。对局进行中再发 `color.开始` 会重新贴出当前题目。猜对后方格边长加一，猜错不扣分。

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `initialLevel` | number | `2` | 初始网格边长（2 表示 2×2），每猜对一次加一 |
| `blockGuessTimeLimitInSeconds` | number | `0` | 单次猜测的时间限制（秒），0 表示不限时 |
| `blockSize` | number | `50` | 每个色块的边长（像素），最小 8 |
| `spacingBetweenGrids` | number | `10` | 色块之间的间距（像素） |
| `enableDirectInput` | boolean | `true` | 对局中直接发送 `行 列` 即可猜测 |
| `shouldInterruptMiddlewareChainAfterTriggered` | boolean | `true` | 猜测触发后中断中间件链，避免被其他插件重复处理 |
| `retractDelay` | number | `0` | 自动撤回延迟（秒），0 表示不撤回 |

## 限制 / 风险

固定输出 PNG，以避免有损压缩造成色差。Chromium 不可用或渲染失败时，本局中止，需重新 `color.开始`。

## 链接

- [设计系统](DESIGN_SYSTEM.md)
- [MIT](LICENSE-MIT) / [Apache-2.0](LICENSE-APACHE)
