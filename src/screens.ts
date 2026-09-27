function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function chrome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#9eb0c4'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#f4f7fb'
  round(ctx, 18, 18, w - 36, h - 36, 18)
  ctx.fill()
  ctx.fillStyle = '#ff4d3c'
  ctx.beginPath()
  ctx.arc(48, 46, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7ad7ff'
  ctx.beginPath()
  ctx.arc(70, 46, 7, 0, Math.PI * 2)
  ctx.fill()
}

function drawMarketing(ctx: CanvasRenderingContext2D, w: number, h: number) {
  chrome(ctx, w, h)
  ctx.fillStyle = '#d7e4f2'
  round(ctx, 56, 96, w * 0.42, h - 150, 16)
  ctx.fill()
  ctx.fillStyle = '#7eb6e8'
  round(ctx, 78, 130, w * 0.28, 18, 8)
  ctx.fill()
  ctx.fillStyle = '#c5d4e4'
  round(ctx, 78, 170, w * 0.22, 10, 5)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  round(ctx, w * 0.5, 110, w * 0.38, 70, 12)
  ctx.fill()
  round(ctx, w * 0.5, 196, w * 0.38, h - 280, 12)
  ctx.fill()
  ctx.fillStyle = '#ff5a48'
  round(ctx, w * 0.5 + 18, 128, 92, 32, 16)
  ctx.fill()
}

function drawDashboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  chrome(ctx, w, h)
  const bars = [0.45, 0.7, 0.55, 0.86, 0.62, 0.78]
  bars.forEach((v, i) => {
    const bh = (h - 220) * v
    ctx.fillStyle = i % 2 === 0 ? '#7ad7ff' : '#ff5a48'
    round(ctx, 70 + i * ((w - 160) / bars.length), h - 90 - bh, 36, bh, 8)
    ctx.fill()
  })
  ctx.fillStyle = '#ffffff'
  round(ctx, w * 0.62, 100, w * 0.28, 120, 14)
  ctx.fill()
  ctx.fillStyle = '#d5e4f2'
  round(ctx, w * 0.62 + 16, 124, w * 0.18, 12, 6)
  ctx.fill()
}

function drawShop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  chrome(ctx, w, h)
  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cw = (w - 120) / 3
    const x = 52 + col * cw
    const y = 100 + row * ((h - 150) / 2)
    ctx.fillStyle = '#ffffff'
    round(ctx, x, y, cw - 16, (h - 180) / 2, 14)
    ctx.fill()
    ctx.fillStyle = i === 1 ? '#ff5a48' : '#d5e6f5'
    round(ctx, x + 14, y + 14, cw - 44, 70, 10)
    ctx.fill()
  }
}

function drawPhone(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#dfe8f1'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#f8fafc'
  round(ctx, 36, 28, w - 72, h - 56, 36)
  ctx.fill()
  ctx.fillStyle = '#101216'
  round(ctx, w / 2 - 46, 44, 92, 16, 8)
  ctx.fill()
  ctx.fillStyle = '#e7eef6'
  round(ctx, 64, 110, w - 128, 180, 16)
  ctx.fill()
  ctx.fillStyle = '#7ad7ff'
  round(ctx, 64, 320, w - 128, 18, 8)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#ffffff'
    round(ctx, 64, 370 + i * 78, w - 128, 64, 12)
    ctx.fill()
    ctx.fillStyle = i === 0 ? '#ff5a48' : '#c5d5e4'
    ctx.beginPath()
    ctx.arc(96, 402 + i * 78, 12, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawArticle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  chrome(ctx, w, h)
  ctx.fillStyle = '#101216'
  ctx.font = '700 54px sans-serif'
  ctx.fillText('Solar', 70, 160)
  ctx.fillStyle = '#9aabbc'
  round(ctx, 70, 190, w * 0.45, 14, 7)
  ctx.fill()
  round(ctx, 70, 216, w * 0.38, 14, 7)
  ctx.fill()
  ctx.fillStyle = '#d7e6f4'
  round(ctx, w * 0.58, 110, w * 0.32, h - 200, 16)
  ctx.fill()
  ctx.fillStyle = '#ff5a48'
  round(ctx, 70, h - 150, 140, 40, 20)
  ctx.fill()
}

const drawers = [drawMarketing, drawDashboard, drawShop, drawPhone, drawArticle]

export function createScreenCanvas(kind: number): HTMLCanvasElement {
  const portrait = kind === 3
  const canvas = document.createElement('canvas')
  canvas.width = portrait ? 760 : 1200
  canvas.height = portrait ? 1400 : 760
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  drawers[kind]?.(ctx, canvas.width, canvas.height)
  return canvas
}
