import { Context, Random } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import type { Config } from './config'

/** 把 0 ~ 1 的分量转成两位十六进制。 */
function channel(scale: number) {
  const value = Math.min(255, Math.max(0, Math.floor(scale * 256)))
  return value.toString(16).padStart(2, '0')
}

/** HSV -> #rrggbb，h ∈ [0, 360)，s / v ∈ [0, 1]。 */
export function hsv(h: number, s = 1, v = 1) {
  const m = v - v * s
  const c = v
  const x = v * s * (1 - Math.abs((h / 60) % 2 - 1)) + m
  const wheel = [[c, x, m], [x, c, m], [m, c, x], [m, x, c], [x, m, c], [c, m, x]]
  const [r, g, b] = wheel[Math.floor(h / 60) % 6]
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

const sign = () => Random.int(2) * 2 - 1

/** 随机往上或往下偏移，越界时改向另一侧，保证结果仍落在 [0, 1]。 */
function offset(value: number, delta: number) {
  return delta * (value + delta > 1 ? -1 : value - delta < 0 ? 1 : sign())
}

/**
 * 生成一对肉眼难以分辨的颜色。
 * 网格越大越难：色相 / 饱和度 / 明度的偏移量随难度指数衰减。
 */
export function createPalette(n: number) {
  const h = Random.real(360)
  const s = Random.real(0.2, 1)
  const v = Random.real(0.2, 1)

  // 把总偏移量按随机比例分配给三个维度
  const weightH = Random.real(0.1, 0.4)
  const rest = 1 - weightH
  const weightS = Random.real(rest * 0.2, rest * 0.8)
  const weightV = rest - weightS

  // 难度在 6 ~ 12 之间循环：网格越大越难，满一轮后色差重新放宽，让对局可以一直玩下去
  const level = (n % 7) + 6
  const deltaS = offset(s, weightS * 0.5 * Math.exp(-0.1 * level))
  const deltaV = offset(v, weightV * 0.2 * Math.exp(-0.1 * level))

  // 颜色越亮越饱和，色相差越不易察觉，故除以总亮度做补偿
  const deltaH = weightH * 30 * Math.exp(-0.2 * level) * sign() / (s + v + deltaS / 2 + deltaV / 2)

  return {
    base: hsv(h, s, v),
    diff: hsv((h + deltaH + 360) % 360, s + deltaS, v + deltaV),
  }
}

function html(config: Config, n: number, diffIndex: number) {
  const { blockSize, spacingBetweenGrids: gap } = config
  const { base, diff } = createPalette(n)
  const margin = blockSize // 四周留出一圈用于标注行列号
  const size = n * blockSize + (n - 1) * gap + margin * 2
  const at = (i: number) => i * (blockSize + gap) + margin

  const cells = Array.from({ length: n * n }, (_, i) =>
    `<i style="left:${at(i % n)}px;top:${at((i / n) | 0)}px;background:${i === diffIndex ? diff : base}"></i>`)
  const labels = Array.from({ length: n }, (_, i) =>
    `<b style="left:${at(i)}px;top:0">${i + 1}</b><b style="left:0;top:${at(i)}px">${i + 1}</b>`)

  return { size, source: `<style>
  *{margin:0;box-sizing:border-box}
  body{background:#fff}
  main{position:relative;width:${size}px;height:${size}px}
  i,b{position:absolute;display:block;width:${blockSize}px;height:${blockSize}px}
  b{color:#333;font:${Math.max(12, Math.round(blockSize * 0.6))}px/${blockSize}px system-ui,sans-serif;text-align:center}
</style><main>${cells.join('')}${labels.join('')}</main>` }
}

/** 渲染一张网格图，其中第 `diffIndex` 块（从 0 开始）与众不同。 */
export async function renderGrid(ctx: Context, config: Config, n: number, diffIndex: number) {
  const { size, source } = html(config, n, diffIndex)
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(source)
    return await (await page.$('main')).screenshot(config.isCompressPicture
      ? { type: 'jpeg', quality: config.pictureQuality ?? 80 }
      : { type: 'png' })
  } finally {
    await page.close()
  }
}
