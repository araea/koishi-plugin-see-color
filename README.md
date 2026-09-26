# 给我点颜色看看

Koishi 找不同游戏：在同色方格中找出唯一的异色块。

## 安装

```sh
yarn add koishi-plugin-see-color
```

在 Koishi 中启用，并安装 `database` 与 `puppeteer` 服务。

## 指令

| 指令 | 说明 |
| --- | --- |
| `color` | 查看帮助 |
| `color.开始` | 开始游戏 |
| `color.猜 <行 列或块号>` | 猜测异色块 |
| `color.结束` | 结束游戏并公布答案 |
| `color.排行榜 [数量]` | 查看积分排行 |

对局中直接发送 `行 列`（如 `2 1`）即可猜测；单独的块号只在 `color.猜` 里接受，免得误触日常聊天。对局进行中再发 `color.开始` 会重新贴出当前这一题。猜对后方格边长增加，猜错不扣分。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
