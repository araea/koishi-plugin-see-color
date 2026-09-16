import { Context, Random } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import type { Config } from './config'
import { baseline, components, EMPHASIZED_WEIGHT, MONO_STACK, scheme, SHAPE, TYPE } from './m3'

/*
 * 这张图的主体是待辨认的色块，任何主题色叠上去都会干扰判断，
 * 所以设计系统只管外围：底色、行列号的字阶与留白。色块本身一律不碰。
 */
const SCHEME = scheme(210)

/** 圆角梯子，由小到大。名字写成变量后缀形式，与 systemVars() 的 kebab 命名一致。 */
const CORNERS = [['small', SHAPE.small], ['medium', SHAPE.medium], ['large', SHAPE.large]] as const

/** 字阶梯子：十五档去重后由小到大。 */
const TYPE_SIZES = [...new Set(Object.values(TYPE).map((step) => step.size))].sort((a, b) => a - b)

/** 从刻度里取离 `value` 最近的一档；两档等距时取小的那一档。 */
function nearest<T>(steps: readonly T[], value: number, at: (step: T) => number) {
  return steps.reduce((best, step) => Math.abs(at(step) - value) < Math.abs(at(best) - value) ? step : best)
}

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

  // 圆角按块大小走形状刻度：小块用 small，大块最多到 large，
  // 再大就会啃掉可辨认的色面
  const corner = nearest(CORNERS, blockSize * 0.18, (step) => step[1])[0]
  // 行列号是次级标签：字号取字阶上最近的一档，字重与字距取 label 档
  const labelSize = nearest(TYPE_SIZES, Math.max(TYPE.labelMedium.size, blockSize * 0.42), (step) => step)

  const cells = Array.from({ length: n * n }, (_, i) =>
    `<i style="left:${at(i % n)}px;top:${at((i / n) | 0)}px;background:${i === diffIndex ? diff : base}"></i>`)
  const labels = Array.from({ length: n }, (_, i) =>
    `<b style="left:${at(i)}px;top:0">${i + 1}</b><b style="left:0;top:${at(i)}px">${i + 1}</b>`)

  return { size, source: `<style>
  ${baseline(SCHEME)}${components()}
  main{position:relative;width:${size}px;height:${size}px}
  i,b{position:absolute;display:block;width:${blockSize}px;height:${blockSize}px}
  i{border-radius:var(--md-sys-shape-corner-${corner})}
  b{
    display:flex;align-items:center;justify-content:center;
    color:var(--md-sys-color-on-surface-variant);
    font-family:${MONO_STACK};
    font-size:${labelSize}px;font-weight:${EMPHASIZED_WEIGHT.label};letter-spacing:${TYPE.labelMedium.tracking}px;
    font-variant-numeric:tabular-nums;
  }
</style><main class="m3-surface">${cells.join('')}${labels.join('')}</main>` }
}

/**
 * 渲染一张网格图，其中第 `diffIndex` 块（从 0 开始）与众不同。
 *
 * 固定输出 PNG：色差游戏的推进依赖颜色准确，JPEG 的有损压缩会让色块失真。
 */
export async function renderGrid(ctx: Context, config: Config, n: number, diffIndex: number) {
  const { size, source } = html(config, n, diffIndex)
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(source)
    return await (await page.$('main')).screenshot({ type: 'png' })
  } finally {
    await page.close()
  }
}
