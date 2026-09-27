type Node = {
  hx: number
  hy: number
  x: number
  y: number
  vx: number
  vy: number
}

const REACH = 240

export function createWeb() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D context')

  let nodes: Node[] = []
  let links: [number, number][] = []
  const mouse = { x: -9999, y: -9999 }
  const smooth = { x: -9999, y: -9999 }
  let seen = false

  const resize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6)
    canvas.width = Math.max(1, Math.floor(width * ratio))
    canvas.height = Math.max(1, Math.floor(height * ratio))
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    const cx = width * 0.5
    const cy = height * 0.46
    const outer = Math.hypot(width, height) * 0.56
    const rings = 14
    const spokes = 32
    nodes = [{ hx: cx, hy: cy, x: cx, y: cy, vx: 0, vy: 0 }]
    links = []

    for (let ring = 1; ring <= rings; ring++) {
      const radius = (outer * ring) / rings
      const start = nodes.length
      for (let spoke = 0; spoke < spokes; spoke++) {
        const angle = (spoke / spokes) * Math.PI * 2 - Math.PI / 2
        const hx = cx + Math.cos(angle) * radius
        const hy = cy + Math.sin(angle) * radius
        nodes.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0 })
      }
      for (let spoke = 0; spoke < spokes; spoke++) {
        const current = start + spoke
        const next = start + ((spoke + 1) % spokes)
        const inner = ring === 1 ? 0 : start - spokes + spoke
        links.push([current, next], [inner, current])
      }
    }
  }

  window.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX
    mouse.y = event.clientY
    if (!seen) {
      smooth.x = mouse.x
      smooth.y = mouse.y
      seen = true
    }
  })
  window.addEventListener('pointerleave', () => {
    mouse.x = -9999
    mouse.y = -9999
    seen = false
  })

  const update = () => {
    smooth.x += (mouse.x - smooth.x) * 0.14
    smooth.y += (mouse.y - smooth.y) * 0.14

    for (const node of nodes) {
      const dx = smooth.x - node.hx
      const dy = smooth.y - node.hy
      const dist = Math.hypot(dx, dy)
      let tx = node.hx
      let ty = node.hy
      if (dist < REACH) {
        const pull = (1 - dist / REACH) ** 1.6
        tx = node.hx + dx * pull * 0.62
        ty = node.hy + dy * pull * 0.62
      }
      node.vx += (tx - node.x) * 0.085
      node.vy += (ty - node.y) * 0.085
      node.vx *= 0.76
      node.vy *= 0.76
      node.x += node.vx
      node.y += node.vy
    }

    const width = window.innerWidth
    const height = window.innerHeight
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 1

    for (const [ia, ib] of links) {
      const a = nodes[ia]
      const b = nodes[ib]
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const near = Math.hypot(midX - smooth.x, midY - smooth.y)
      const hot = near < REACH ? 1 - near / REACH : 0
      ctx.strokeStyle = hot > 0.08 ? `rgba(255, 92, 74, ${0.16 + hot * 0.55})` : 'rgba(168, 168, 172, 0.11)'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    for (const node of nodes) {
      const near = Math.hypot(node.x - smooth.x, node.y - smooth.y)
      const hot = near < REACH ? 1 - near / REACH : 0
      ctx.fillStyle = hot > 0.2 ? `rgba(255, 92, 74, ${0.45 + hot * 0.5})` : 'rgba(168, 168, 172, 0.22)'
      ctx.beginPath()
      ctx.arc(node.x, node.y, hot > 0.35 ? 2.3 : 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  resize()
  return { update, resize, canvas }
}
