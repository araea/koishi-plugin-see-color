koishi-plugin-see-color
=======================

[<img alt="github" src="https://img.shields.io/badge/github-araea/see_color-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-see-color)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-see-color.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-see-color)

Koishi 的找色块游戏插件。找到不同的色块。

## 使用

1. 启动 `puppeteer` 服务。
2. `seeColor.开始` 开一局，然后直接发送 `行 列`（如 `2 1`）或块号即可猜测。

## 指令

| 指令 | 说明 |
| --- | --- |
| `seeColor` | 查看帮助 |
| `seeColor.开始` | 开始一局 |
| `seeColor.猜 <行 列 \| 块号>` | 猜一次色块 |
| `seeColor.结束` | 结束本局并公布答案 |
| `seeColor.排行榜 [数量]` | 查看色榜 |

每猜对一次，网格边长加一、得分加上当前边长；猜错不扣分。默认无需输入指令，直接发数字就能猜。

## 致谢

- [Koishi](https://koishi.chat/)
- [longyong](https://forum.koishi.xyz/u/longyong/summary)
- [yunzai · 闲心/xianxin-plugin](https://gitee.com/xianxincoder/xianxin-plugin/blob/master/apps/seecolor.js)
- [koishi-plugin-color-bias](https://github.com/koishijs/koishi-plugin-color-bias/blob/main/src/state.ts)

## QQ 群

- 956758505

<br>

#### License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
