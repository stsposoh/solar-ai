import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createWorld, type Glance, type ModelStatus } from './scene'
import { createWeb } from './web'
import { createDevice } from './device'
import { createMetaballs } from './metaballs'

gsap.registerPlugin(ScrollTrigger)

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`Missing ${selector}`)
  return el
}

function travel(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  const p = clamp(-rect.top / Math.max(el.offsetHeight - vh, vh), 0, 1)
  const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0)
  const presence = clamp(visible / Math.min(el.offsetHeight, vh), 0, 1)
  return { p, presence }
}

function catmullRom(points: { x: number; y: number }[], tension = 6) {
  const [first] = points
  if (!first || points.length < 2) return ''
  const parts = [`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / tension
    const c1y = p1.y + (p2.y - p0.y) / tension
    const c2x = p2.x - (p3.x - p1.x) / tension
    const c2y = p2.y - (p3.y - p1.y) / tension
    parts.push(`C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
  }
  return parts.join(' ')
}

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps: number) {
  const points: { x: number; y: number }[] = []
  for (let step = 0; step <= steps; step++) {
    const angle = a0 + ((a1 - a0) * step) / steps
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry })
  }
  return points
}

function serpentine(width: number, y0: number, y1: number) {
  const sweeps = 3
  const points: { x: number; y: number }[] = []
  for (let index = 0; index < sweeps; index++) {
    const top = y0 + ((y1 - y0) * index) / sweeps
    const bottom = y0 + ((y1 - y0) * (index + 1)) / sweeps
    const span = bottom - top
    const forward = index % 2 === 0
    const dir = forward ? 1 : -1
    const cx = width * (forward ? 0.5 : 0.5)
    const cy = top + span * 0.46
    const rx = Math.min(width * 0.2, span * 0.42)
    const ry = rx * 0.92
    const a0 = forward ? Math.PI : 0
    const a1 = a0 + dir * Math.PI * 1.45
    if (index === 0) points.push({ x: forward ? 0 : width, y: top + span * 0.12 })
    points.push({ x: cx - dir * rx * 1.55, y: cy - ry * 0.15 })
    points.push(...arc(cx, cy, rx, ry, a0, a1, 14))
    points.push({ x: cx + dir * rx * 1.7, y: cy + span * 0.18 })
    points.push({ x: forward ? width : 0, y: bottom - span * 0.04 })
  }
  return points
}

function boot() {
  const canvas = must<HTMLCanvasElement>('#webgl')
  const nav = must<HTMLElement>('.nav')
  const progress = must<HTMLElement>('#progress')
  const video = must<HTMLVideoElement>('#reel')
  const catsVideo = must<HTMLVideoElement>('#cats-reel')
  let catsBusy = false
  let catsTarget = 0
  const scrubCats = (time: number) => {
    catsTarget = time
    if (catsBusy || Math.abs(catsVideo.currentTime - time) < 1 / 60) return
    catsBusy = true
    catsVideo.addEventListener(
      'seeked',
      () => {
        catsBusy = false
        if (Math.abs(catsVideo.currentTime - catsTarget) >= 1 / 60) scrubCats(catsTarget)
      },
      { once: true },
    )
    catsVideo.currentTime = time
  }
  const heroEl = must<HTMLElement>('#top')
  const dualityEl = must<HTMLElement>('#duality')
  const processEl = must<HTMLElement>('#process')
  const objectEl = must<HTMLElement>('#object')
  const closeEl = must<HTMLElement>('#contact')
  const wowEl = must<HTMLElement>('#wow')
  const cinemaEl = must<HTMLElement>('#showreel')
  const catsEl = must<HTMLElement>('#cats')
  const manifestoEl = must<HTMLElement>('#manifesto')
  const threadEl = must<HTMLElement>('#thread')
  const threadSvg = must<SVGSVGElement>('#thread-svg')
  const threadTrack = must<SVGPathElement>('#thread-track')
  const threadGlow = must<SVGPathElement>('#thread-glow')
  const threadDraw = must<SVGPathElement>('#thread-draw')
  const threadHead = must<SVGCircleElement>('#thread-head')
  const threadHalo = must<SVGCircleElement>('#thread-halo')
  const threadGrad = must<SVGLinearGradientElement>('#thread-grad')
  const statItems = [...threadEl.querySelectorAll<HTMLElement>('.stats li')]
  let threadLength = 0

  const layoutThread = () => {
    const width = threadEl.clientWidth
    const height = threadEl.offsetHeight
    if (width < 10 || height < 10) return
    threadSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    threadGrad.setAttribute('y2', String(height))
    const root = threadEl.getBoundingClientRect()

    const statPoints: { x: number; y: number }[] = []
    statItems.forEach((item, index) => {
      const num = item.querySelector('strong') ?? item
      const rect = num.getBoundingClientRect()
      const x = rect.left - root.left + rect.width / 2
      const y = rect.top - root.top + rect.height * 0.55
      if (index === 0) statPoints.push({ x: x - 120, y: y - 180 })
      statPoints.push({ x: x - 36, y })
      statPoints.push({ x, y })
      statPoints.push({ x: x + 36, y })
      const next = statItems[index + 1]
      if (!next) return
      const nextNum = next.querySelector('strong') ?? next
      const nextRect = nextNum.getBoundingClientRect()
      const nextX = nextRect.left - root.left + nextRect.width / 2
      statPoints.push({
        x: (x + nextX) / 2,
        y: y + (index % 2 === 0 ? 170 : -150),
      })
    })

    const lead = statPoints[0]
    const ribbons = lead ? serpentine(width, window.innerHeight * 0.34, lead.y - 80) : []
    if (lead && ribbons.length) {
      const last = ribbons[ribbons.length - 1]
      ribbons.push(
        { x: last.x * 0.62 + lead.x * 0.38, y: last.y + (lead.y - last.y) * 0.42 },
        { x: lead.x + (last.x - lead.x) * 0.22, y: lead.y - 36 },
      )
    }
    const d = catmullRom([...ribbons, ...statPoints], 6)
    threadTrack.setAttribute('d', d)
    threadGlow.setAttribute('d', d)
    threadDraw.setAttribute('d', d)
    threadLength = threadDraw.getTotalLength()
    threadGlow.style.strokeDasharray = `${threadLength}`
    threadDraw.style.strokeDasharray = `${threadLength}`
  }

  const lines = [...manifestoEl.querySelectorAll<HTMLElement>('[data-line]')]
  const serviceBlocks = [...document.querySelectorAll<HTMLElement>('.service')]
  const servicesBoard = must<HTMLElement>('.services-board')
  const device = createDevice(must<HTMLCanvasElement>('#device'))
  const goo = createMetaballs(must<HTMLCanvasElement>('#goo'))
  let gooHover = false
  const captions = [...cinemaEl.querySelectorAll<HTMLElement>('[data-caption]')]
  const catLines = [...catsEl.querySelectorAll<HTMLElement>('[data-start]')]
  const steps = [...processEl.querySelectorAll<HTMLElement>('[data-step]')]
  const phases = [...objectEl.querySelectorAll<HTMLElement>('[data-phase]')]
  const reelTime = must<HTMLElement>('#reel-time')
  const phaseLabel = must<HTMLElement>('#phase-label')

  let models: ModelStatus = { camera: false, boombox: false }
  const web = createWeb()
  const world = createWorld(canvas, web.canvas, (status) => {
    models = status
    if (!status.boombox) {
      const second = objectEl.querySelector<HTMLElement>('[data-phase="1"]')
      if (second) second.textContent = 'Keep scrolling. The same object finishes the turn in the light.'
    }
  })

  const pointer = { x: 0, y: 0 }
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    const box = threadEl.getBoundingClientRect()
    gooHover =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    if (gooHover) goo.setPointer(event.clientX, event.clientY)
  })

  const lenis = new Lenis({
    autoRaf: false,
    duration: 1.12,
    smoothWheel: true,
    wheelMultiplier: 0.92,
  })
  lenis.on('scroll', ScrollTrigger.update)
  ;(window as unknown as { lenis: Lenis }).lenis = lenis

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href')
      const target = id ? document.querySelector<HTMLElement>(id) : null
      if (!target) return
      event.preventDefault()
      lenis.scrollTo(target, { offset: 0 })
    })
  })

  const industryStage = must<HTMLElement>('.industries-stage')
  const industryCards = [...industryStage.querySelectorAll<HTMLElement>('.ind-card')]
  const tiltCard = (card: HTMLElement, event: PointerEvent | null) => {
    if (!event) {
      card.style.setProperty('--tilt-x', '0deg')
      card.style.setProperty('--tilt-y', '0deg')
      card.style.setProperty('--shift-x', '0px')
      card.style.setProperty('--shift-y', '0px')
      return
    }
    const rect = card.getBoundingClientRect()
    const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width
    const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height
    const near = Math.hypot(dx, dy) < 1.05
    card.style.setProperty('--tilt-x', near ? `${(-dy * 7).toFixed(2)}deg` : '0deg')
    card.style.setProperty('--tilt-y', near ? `${(dx * 9).toFixed(2)}deg` : '0deg')
    card.style.setProperty('--shift-x', near ? `${(-dx * 14).toFixed(1)}px` : '0px')
    card.style.setProperty('--shift-y', near ? `${(-dy * 10).toFixed(1)}px` : '0px')
  }
  industryStage.addEventListener('pointermove', (event) => {
    industryCards.forEach((card) => tiltCard(card, event))
  })
  industryStage.addEventListener('pointerleave', () => {
    industryCards.forEach((card) => tiltCard(card, null))
  })

  const track = must<HTMLElement>('#industries-track')
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 48)
  gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '#industries',
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: '.industries-stage',
      scrub: 0.85,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  })

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        revealObserver.unobserve(entry.target)
      })
    },
    { threshold: 0.18 },
  )
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))

  video.addEventListener('loadeddata', () => {
    if (video.currentTime < 0.04) video.currentTime = 0.04
  })

  let last = -1
  const step = (time: number) => {
    const dt = last < 0 ? 0.016 : time - last
    last = time

    const hero = travel(heroEl)
    const duality = travel(dualityEl)
    const process = travel(processEl)
    const object = travel(objectEl)
    const close = travel(closeEl)
    const wow = travel(wowEl)
    const cinema = travel(cinemaEl)
    const cats = travel(catsEl)
    const manifesto = travel(manifestoEl)
    const thread = travel(threadEl)
    const threadBox = threadEl.getBoundingClientRect()
    const leave = clamp((window.innerHeight - threadBox.bottom) / (window.innerHeight * 0.9), 0, 1)
    const cover = Math.max(0, thread.presence * (1 - leave))
    threadEl.style.setProperty('--veil', cover.toFixed(3))
    goo.update(time, cover, thread.p, gooHover)

    const glance: Glance = {
      hero: hero.presence,
      duality: duality.presence,
      process: process.presence,
      object: object.presence,
      close: close.presence,
      wow: wow.presence,
      thread: cover,
      heroP: hero.p,
      dualityP: duality.p,
      processP: process.p,
      objectP: object.p,
      closeP: close.p,
      wowP: wow.p,
      pointerX: pointer.x,
      pointerY: pointer.y,
      time,
      dt,
    }
    web.update()
    world.setWebOpacity(hero.presence)
    world.update(glance)

    const max = document.documentElement.scrollHeight - window.innerHeight
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`
    nav.classList.toggle('is-ink', cinema.presence > 0.55 || cats.presence > 0.4)

    const rise = clamp((window.innerHeight * 0.78 - manifestoEl.getBoundingClientRect().top) / (window.innerHeight * 0.42), 0, 1)
    manifestoEl.style.setProperty('--rise', rise.toFixed(3))
    const line = Math.min(lines.length - 1, Math.floor(manifesto.p * lines.length))
    lines.forEach((el, index) => {
      const showFirst = index === 0 && line === 0 && rise > 0.04
      el.classList.toggle('is-on', showFirst || (index === line && index > 0 && manifesto.presence > 0.05))
    })

    const board = servicesBoard.getBoundingClientRect()
    const deviceProgress = clamp((window.innerHeight * 0.35 - board.top) / Math.max(board.height - window.innerHeight, 1), 0, 1)
    const deviceVisible = board.bottom > 0 && board.top < window.innerHeight
    device.update(deviceProgress, deviceVisible)
    serviceBlocks.forEach((article) => {
      const rect = article.getBoundingClientRect()
      article.classList.toggle('is-live', rect.top < window.innerHeight * 0.46 && rect.bottom > window.innerHeight * 0.46)
    })

    if (threadLength > 1) {
      const root = threadEl.getBoundingClientRect()
      const along = clamp((window.innerHeight * 0.42 - root.top) / Math.max(threadEl.offsetHeight - window.innerHeight * 0.2, 1), 0, 1)
      const drawn = threadLength * along
      const offset = String(threadLength - drawn)
      threadGlow.style.strokeDashoffset = offset
      threadDraw.style.strokeDashoffset = offset
      const point = threadDraw.getPointAtLength(Math.max(0.01, Math.min(drawn, threadLength - 0.01)))
      threadHead.setAttribute('cx', String(point.x))
      threadHead.setAttribute('cy', String(point.y))
      threadHalo.setAttribute('cx', String(point.x))
      threadHalo.setAttribute('cy', String(point.y))
      const screenY = point.y + root.top
      const lit = along > 0.012 && along < 0.992 && screenY > 24 && screenY < window.innerHeight - 16
      threadHead.style.opacity = lit ? '1' : '0'
      threadHalo.style.opacity = lit ? '0.9' : '0'
      statItems.forEach((item) => {
        const rect = item.getBoundingClientRect()
        const x = rect.left - root.left + rect.width / 2
        const y = rect.top - root.top + rect.height * 0.34
        item.classList.toggle('is-hot', lit && Math.hypot(point.x - x, point.y - y) < 150)
      })
    }

    const beat = Math.min(2, Math.floor(duality.p * 3))
    dualityEl.dataset.beat = String(beat)

    const stepIndex = Math.min(steps.length - 1, Math.floor(process.p * steps.length))
    steps.forEach((el, index) => el.classList.toggle('is-on', index === stepIndex))

    const phase = models.camera && models.boombox && object.p >= 0.52 ? 1 : 0
    phases.forEach((el) => el.classList.toggle('is-on', Number(el.dataset.phase) === phase))
    phaseLabel.textContent = phase === 0 ? '01  Camera' : '02  Signal'

    const caption = Math.min(captions.length - 1, Math.floor(cinema.p * captions.length))
    captions.forEach((el, index) => el.classList.toggle('is-on', index === caption))
    if (video.duration && cinema.presence > 0.05) {
      const target = Math.min(video.duration - 0.05, Math.max(0.04, cinema.p * video.duration))
      if (Math.abs(video.currentTime - target) > 0.045) video.currentTime = target
      reelTime.textContent = `${(cinema.p * video.duration).toFixed(1)}s`
    }

    if (catsVideo.duration && cats.presence > 0.05) {
      const target = Math.min(catsVideo.duration - 0.05, Math.max(0, cats.p * catsVideo.duration))
      scrubCats(target)
      const moment = cats.p * catsVideo.duration
      catLines.forEach((el) => {
        const start = Number(el.dataset.start)
        const end = Number(el.dataset.end ?? catsVideo.duration)
        el.classList.toggle('is-on', moment >= start && moment < end)
      })
    } else {
      catLines.forEach((el) => el.classList.remove('is-on'))
    }

    document.body.classList.add('is-ready')
  }

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000)
    step(time)
  })
  gsap.ticker.lagSmoothing(0)

  window.addEventListener('resize', () => {
    world.resize()
    web.resize()
    device.resize()
    goo.resize()
    layoutThread()
    ScrollTrigger.refresh()
  })
  window.addEventListener('load', () => {
    layoutThread()
    ScrollTrigger.refresh()
  })
  void document.fonts.ready.then(() => {
    layoutThread()
    ScrollTrigger.refresh()
  })
  layoutThread()
}

const wide = window.matchMedia('(min-width: 961px)')
if (wide.matches) boot()
else wide.addEventListener('change', () => { if (wide.matches) boot() }, { once: true })
