import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1728, height: 1000 } })
const logs = []
page.on('pageerror', (error) => logs.push(`PAGE ${error.message}`))
page.on('response', (response) => {
  if (response.status() >= 400) logs.push(`${response.status()} ${response.url()}`)
})

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await mkdir('shots', { recursive: true })

const shots = [
  ['services', '#services .service'],
  ['process', '#process'],
]

for (const [name, target] of shots) {
  if (target) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      const lenis = window.lenis
      if (!el || !lenis) return
      lenis.scrollTo(el, { immediate: true })
    }, target)
  }
  if (name === 'showreel') {
    await page.evaluate(() => {
      const el = document.querySelector('#showreel')
      if (!el) return
      const travel = el.offsetHeight - window.innerHeight
      window.scrollTo(0, el.offsetTop + travel * 0.45)
    })
  }
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `shots/${name}.png` })
  console.log('shot', name)
}

const info = await page.evaluate(() => {
  const h1 = document.querySelector('.hero h1')
  const box = h1?.getBoundingClientRect()
  return {
    w: innerWidth,
    models: document.body.dataset,
    video: document.querySelector('#reel')?.readyState,
    h1: box ? { x: box.x, w: box.width, y: box.y } : null,
  }
})
console.log(JSON.stringify(info, null, 2))
console.log(logs.join('\n') || 'no console errors')
await browser.close()
