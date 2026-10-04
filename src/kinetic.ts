function ease(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export function createKinetic(root: HTMLElement) {
  const chars: { el: HTMLElement; x: number; y: number; r: number }[] = []
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
      const r = (Math.random() - 0.5) * 72
      line.append(span)
      chars.push({ el: span, x, y, r })
    })
  })

  const set = (progress: number) => {
    const assembled =
      progress < 0.58
        ? ease((progress - 0.08) / 0.32)
        : 1 - ease((progress - 0.7) / 0.24)
    chars.forEach((char) => {
      const k = 1 - assembled
      char.el.style.transform = `translate3d(${char.x * k}px, ${char.y * k}px, 0) rotate(${char.r * k}deg)`
      char.el.style.opacity = String(0.2 + assembled * 0.8)
    })
  }

  set(0)
  return { set }
}
