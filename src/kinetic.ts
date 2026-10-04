function ease(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export function createKinetic(root: HTMLElement) {
  const chars: { el: HTMLElement; x: number; y: number; z: number; rx: number; ry: number; r: number }[] = []
  const lines = [...root.querySelectorAll<HTMLElement>('[data-kinetic]')]
  lines.forEach((line) => {
    const text = line.textContent ?? ''
    line.textContent = ''
    line.setAttribute('aria-label', text)
    ;[...text].forEach((letter) => {
      const span = document.createElement('span')
      span.className = 'feel-char'
      span.textContent = letter === ' ' ? '\u00a0' : letter
      const x = (Math.random() - 0.5) * 420
      const y = (Math.random() - 0.5) * 280
      const z = -200 - Math.random() * 900
      const rx = (Math.random() - 0.5) * 160
      const ry = (Math.random() - 0.5) * 160
      const r = (Math.random() - 0.5) * 72
      line.append(span)
      chars.push({ el: span, x, y, z, rx, ry, r })
    })
  })

  const set = (progress: number) => {
    // Letters gather once and stay put; only scrolling back up scatters them again.
    const assembled = ease((progress - 0.08) / 0.32)
    chars.forEach((char) => {
      const k = 1 - assembled
      char.el.style.transform = `translate3d(${char.x * k}px, ${char.y * k}px, ${char.z * k}px) rotateX(${char.rx * k}deg) rotateY(${char.ry * k}deg) rotate(${char.r * k}deg)`
      char.el.style.opacity = String(0.2 + assembled * 0.8)
    })
  }

  set(0)
  return { set }
}
