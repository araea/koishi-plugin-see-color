# koishi-plugin-see-color

找色块游戏

## 安装

```sh
yarn add koishi-plugin-see-color
```

在 Koishi 配置中启用，并提供 database 与 puppeteer 服务。

## 指令

| 指令 | 说明 |
| --- | --- |
| `color` | 帮助 |
| `color.开始` | 开始一局 |
| `color.猜 <行 列 或 块号>` | 猜测色块 |
| `color.结束` | 结束并公布答案 |
| `color.排行榜 [数量]` | 排行 |

猜对后色块边长增加，猜错不扣分。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
