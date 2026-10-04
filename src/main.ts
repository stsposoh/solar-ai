import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createWorld, type Glance, type ModelStatus } from './scene'
import { createWeb } from './web'
import { createDevice } from './device'
import { createMetaballs } from './metaballs'
import { createCases } from './cases'
import { createKinetic } from './kinetic'
import { createGallery } from './gallery'

gsap.registerPlugin(ScrollTrigger)

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`Missing ${selector}`)
  return el
}

type Travel = { p: number; presence: number; rect: DOMRect }

function travel(el: HTMLElement): Travel {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  const p = clamp(-rect.top / Math.max(el.offsetHeight - vh, vh), 0, 1)
  const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0)
  const presence = clamp(visible / Math.min(el.offsetHeight, vh), 0, 1)
  return { p, presence, rect }
}

function inside(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

// Run once, a little before the element scrolls into view.
function whenNear(el: Element, margin: string, run: () => void) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      run()
    },
    { rootMargin: margin },
  )
  observer.observe(el)
}

// Seeking a video every frame queues decodes faster than the browser can finish them.
// Keep one seek in flight and jump straight to the latest target when it lands.
function createScrubber(video: HTMLVideoElement) {
  let busy = false
  let target = 0
  const seek = (time: number) => {
    target = time
    if (busy || Math.abs(video.currentTime - time) < 1 / 60) return
    busy = true
    video.addEventListener(
      'seeked',
      () => {
        busy = false
        if (Math.abs(video.currentTime - target) >= 1 / 60) seek(target)
      },
      { once: true },
    )
    video.currentTime = time
  }
  return seek
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
    const cx = width * 0.5
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
  const scrubReel = createScrubber(video)
  const scrubCats = createScrubber(catsVideo)
  const heroEl = must<HTMLElement>('#top')
  const dualityEl = must<HTMLElement>('#duality')
  const morphEl = must<HTMLElement>('#morph')
  const servicesEl = must<HTMLElement>('#services')
  const materialEl = must<HTMLElement>('#material')
  const processEl = must<HTMLElement>('#process')
  const objectEl = must<HTMLElement>('#object')
  const closeEl = must<HTMLElement>('#contact')
  const wowEl = must<HTMLElement>('#wow')
  const feelEl = must<HTMLElement>('#feel')
  const casesEl = must<HTMLElement>('#work')
  const corridorEl = must<HTMLElement>('#corridor')
  const abyssEl = must<HTMLElement>('#abyss')
  const awardsEl = must<HTMLElement>('#awards')
  const industriesEl = must<HTMLElement>('#industries')
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
  const kinetic = createKinetic(feelEl)
  const cases = createCases(must<HTMLCanvasElement>('#cases'))
  const caseItems = [...casesEl.querySelectorAll<HTMLElement>('[data-case]')]
  const corridorTrack = must<HTMLElement>('#corridor-track')
  const corridorCards = [...corridorEl.querySelectorAll<HTMLElement>('.corridor-card')]
  const captions = [...cinemaEl.querySelectorAll<HTMLElement>('[data-caption]')]
  const catLines = [...catsEl.querySelectorAll<HTMLElement>('[data-start]')]
  const steps = [...processEl.querySelectorAll<HTMLElement>('[data-step]')]
  const phases = [...objectEl.querySelectorAll<HTMLElement>('[data-phase]')]
  const morphSteps = [...morphEl.querySelectorAll<HTMLElement>('[data-morph]')]
  const looks = [...materialEl.querySelectorAll<HTMLElement>('[data-look]')]
  const reelTime = must<HTMLElement>('#reel-time')
  const phaseLabel = must<HTMLElement>('#phase-label')
  const industryStage = must<HTMLElement>('.industries-stage')
  const industryTitle = must<HTMLElement>('.industries-title')
  const industryCards = [...industryStage.querySelectorAll<HTMLElement>('.ind-card')]
  const gallery = createGallery(industryCards)

  let models: ModelStatus = { camera: false, boombox: false }
  const web = createWeb()
  const world = createWorld(canvas, web.canvas, (status) => {
    models = status
    if (!status.boombox) {
      const second = objectEl.querySelector<HTMLElement>('[data-phase="1"]')
      if (second) second.textContent = 'Keep scrolling. The same object finishes the turn in the light.'
    }
  })
  world.addOverlay(gallery.render)

  whenNear(objectEl, '250% 0px', world.loadModels)
  whenNear(cinemaEl, '150% 0px', () => { video.preload = 'auto' })
  whenNear(catsEl, '150% 0px', () => { catsVideo.preload = 'auto' })
  // The tubes cursor ships its own WebGPU build of three, so it only loads when needed.
  whenNear(servicesEl, '150% 0px', () => {
    void import('./tubes').then(({ createTubes }) => createTubes(must<HTMLCanvasElement>('#tubes')))
  })

  const pointer = { x: 0, y: 0, clientX: -9999, clientY: -9999 }
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    pointer.clientX = event.clientX
    pointer.clientY = event.clientY
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

  const corridorSpan = () => Math.max(0, corridorTrack.scrollWidth - window.innerWidth)
  gsap.to(corridorTrack, {
    x: () => -corridorSpan(),
    ease: 'none',
    scrollTrigger: {
      trigger: '#corridor',
      start: 'top top',
      end: () => `+=${corridorSpan() * 1.15}`,
      pin: '.corridor-pin',
      scrub: 0.9,
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

  const toggleOne = (items: HTMLElement[], active: number) => {
    items.forEach((el, index) => el.classList.toggle('is-on', index === active))
  }

  let last = -1
  let reelLabel = ''
  let feelSet = -1
  const step = (time: number) => {
    const dt = last < 0 ? 0.016 : time - last
    last = time
    const vh = window.innerHeight
    const vw = window.innerWidth

    // Read phase: every layout query for the frame happens before any style write,
    // so the browser lays out once instead of once per section.
    const hero = travel(heroEl)
    const duality = travel(dualityEl)
    const morph = travel(morphEl)
    const services = travel(servicesEl)
    const material = travel(materialEl)
    const process = travel(processEl)
    const object = travel(objectEl)
    const close = travel(closeEl)
    const wow = travel(wowEl)
    const feel = travel(feelEl)
    const casesTravel = travel(casesEl)
    const abyss = travel(abyssEl)
    const corridor = travel(corridorEl)
    const awards = travel(awardsEl)
    const industries = travel(industriesEl)
    const cinema = travel(cinemaEl)
    const cats = travel(catsEl)
    const manifesto = travel(manifestoEl)
    const thread = travel(threadEl)
    const manifestoTop = manifestoEl.getBoundingClientRect().top
    const board = servicesBoard.getBoundingClientRect()
    const serviceRects = services.presence > 0 ? serviceBlocks.map((article) => article.getBoundingClientRect()) : []
    const corridorRects = corridor.presence > 0 ? corridorCards.map((card) => card.getBoundingClientRect()) : []
    const industryRects = industries.presence > 0 ? industryCards.map((card) => card.getBoundingClientRect()) : []
    const titleRight = industries.presence > 0 ? industryTitle.getBoundingClientRect().right : 0
    const statRects = thread.presence > 0 ? statItems.map((item) => item.getBoundingClientRect()) : []
    const scrollMax = document.documentElement.scrollHeight - vh
    const scrollY = window.scrollY

    const voidArrive = clamp((vh - abyss.rect.top) / vh, 0, 1)
    const voidLive = abyss.rect.top < vh ? 1 : abyss.presence
    const leave = clamp((vh - thread.rect.bottom) / (vh * 0.9), 0, 1)
    const cover = Math.max(0, thread.presence * (1 - leave))
    const hidden = Math.max(services.presence, cinema.presence, casesTravel.presence, awards.presence, cats.presence, industries.presence)
    const backdrop = Math.max(
      hero.presence,
      thread.presence,
      duality.presence,
      morph.presence,
      wow.presence,
      feel.presence,
      material.presence,
      process.presence,
      object.presence,
      industries.presence,
      abyss.presence,
      corridor.presence,
      close.presence,
    )

    // Write phase.
    const overThread = inside(thread.rect, pointer.clientX, pointer.clientY)
    if (overThread) goo.setPointer(pointer.clientX, pointer.clientY)
    goo.update(time, cover, thread.p, overThread)
    servicesBoard.classList.toggle('is-tubes', inside(board, pointer.clientX, pointer.clientY))

    const glance: Glance = {
      hero: hero.presence,
      duality: duality.presence,
      process: process.presence,
      object: object.presence,
      close: close.presence,
      wow: wow.presence,
      void: voidLive,
      feel: feel.presence,
      cases: casesTravel.presence,
      corridor: corridor.presence,
      thread: thread.presence,
      morph: morph.presence,
      morphP: morph.p,
      blob: material.presence,
      blobP: material.p,
      industries: industries.presence,
      cover: hidden,
      energy: Math.abs(lenis.velocity) / 30,
      render: backdrop > 0,
      heroP: hero.p,
      dualityP: duality.p,
      processP: process.p,
      objectP: object.p,
      objectLeave: clamp((vh - object.rect.bottom) / vh, 0, 1),
      closeP: close.p,
      wowP: wow.p,
      voidP: abyss.p,
      voidArrive,
      pointerX: pointer.x,
      pointerY: pointer.y,
      time,
      dt,
    }
    if (hero.presence > 0) web.update()
    world.setWebOpacity(hero.presence)
    if (industries.presence > 0) {
      const fades = gallery.update({
        rects: industryRects,
        pointerX: pointer.clientX,
        pointerY: pointer.clientY,
        velocity: lenis.velocity,
        time,
        dt,
        fadeX: titleRight,
      })
      industryCards.forEach((card, index) => card.style.setProperty('--fade', fades[index].toFixed(3)))
    } else {
      gallery.update({ rects: [], pointerX: 0, pointerY: 0, velocity: 0, time, dt, fadeX: 0 })
    }
    world.update(glance)

    if (feel.presence > 0 || feelSet !== 0) {
      kinetic.set(feel.p)
      feelSet = feel.presence > 0 ? 1 : 0
    }
    cases.update(casesTravel.p, casesTravel.presence > 0.04, pointer.x, pointer.y)
    toggleOne(caseItems, Math.min(3, Math.floor(casesTravel.p * 3.99)))
    toggleOne(morphSteps, Math.round(clamp(morph.p, 0, 0.9999) * (morphSteps.length - 1)))
    toggleOne(looks, Math.round(clamp(material.p, 0, 1) * (looks.length - 1)))

    if (wow.presence > 0.05) {
      wowEl.style.setProperty('--lx', `${(((pointer.clientX - wow.rect.left) / Math.max(wow.rect.width, 1)) * 100).toFixed(1)}%`)
      wowEl.style.setProperty('--ly', `${(((pointer.clientY - wow.rect.top) / Math.max(wow.rect.height, 1)) * 100).toFixed(1)}%`)
    }
    if (close.presence > 0.05) {
      closeEl.style.setProperty('--lx', `${(((pointer.clientX - close.rect.left) / Math.max(close.rect.width, 1)) * 100).toFixed(1)}%`)
      closeEl.style.setProperty('--ly', `${(((pointer.clientY - close.rect.top) / Math.max(close.rect.height, 1)) * 100).toFixed(1)}%`)
    }
    corridorRects.forEach((box, index) => {
      const nx = ((box.left + box.width / 2) / vw) * 2 - 1
      corridorCards[index].style.transform = `rotateY(${(-20 - nx * 12).toFixed(2)}deg) translateZ(${(-70 + Math.abs(nx) * 36).toFixed(0)}px)`
    })

    progress.style.transform = `scaleX(${scrollMax > 0 ? scrollY / scrollMax : 0})`
    nav.classList.toggle('is-ink', cinema.presence > 0.55 || cats.presence > 0.4)

    const rise = clamp((vh * 0.78 - manifestoTop) / (vh * 0.42), 0, 1)
    manifestoEl.style.setProperty('--rise', rise.toFixed(3))
    const line = Math.min(lines.length - 1, Math.floor(manifesto.p * lines.length))
    lines.forEach((el, index) => {
      const showFirst = index === 0 && line === 0 && rise > 0.04
      el.classList.toggle('is-on', showFirst || (index === line && index > 0 && manifesto.presence > 0.05))
    })

    const deviceProgress = clamp((vh * 0.35 - board.top) / Math.max(board.height - vh, 1), 0, 1)
    device.update(deviceProgress, board.bottom > 0 && board.top < vh)
    serviceRects.forEach((rect, index) => {
      serviceBlocks[index].classList.toggle('is-live', rect.top < vh * 0.46 && rect.bottom > vh * 0.46)
    })

    if (threadLength > 1 && thread.presence > 0) {
      const root = thread.rect
      const along = clamp((vh * 0.42 - root.top) / Math.max(root.height - vh * 0.2, 1), 0, 1)
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
      const lit = along > 0.012 && along < 0.992 && screenY > 24 && screenY < vh - 16
      threadHead.style.opacity = lit ? '1' : '0'
      threadHalo.style.opacity = lit ? '0.9' : '0'
      statRects.forEach((rect, index) => {
        const x = rect.left - root.left + rect.width / 2
        const y = rect.top - root.top + rect.height * 0.34
        statItems[index].classList.toggle('is-hot', lit && Math.hypot(point.x - x, point.y - y) < 150)
      })
    }

    dualityEl.dataset.beat = String(Math.min(2, Math.floor(duality.p * 3)))
    toggleOne(steps, Math.min(steps.length - 1, Math.floor(process.p * steps.length)))

    const phase = models.camera && models.boombox && object.p >= 0.52 ? 1 : 0
    phases.forEach((el) => el.classList.toggle('is-on', Number(el.dataset.phase) === phase))
    phaseLabel.textContent = phase === 0 ? '01  Camera' : '02  Signal'

    toggleOne(captions, Math.min(captions.length - 1, Math.floor(cinema.p * captions.length)))
    if (video.duration && cinema.presence > 0.05) {
      scrubReel(Math.min(video.duration - 0.05, Math.max(0.04, cinema.p * video.duration)))
      const label = `${(cinema.p * video.duration).toFixed(1)}s`
      if (label !== reelLabel) reelTime.textContent = reelLabel = label
    }

    if (catsVideo.duration && cats.presence > 0.05) {
      scrubCats(Math.min(catsVideo.duration - 0.05, Math.max(0, cats.p * catsVideo.duration)))
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

  const resizeAll = () => {
    world.resize()
    web.resize()
    device.resize()
    goo.resize()
    cases.resize()
    gallery.resize(window.innerWidth, window.innerHeight)
    layoutThread()
    ScrollTrigger.refresh()
  }
  window.addEventListener('resize', resizeAll)
  window.addEventListener('load', () => {
    layoutThread()
    ScrollTrigger.refresh()
  })
  void document.fonts.ready.then(() => {
    layoutThread()
    ScrollTrigger.refresh()
  })
  gallery.resize(window.innerWidth, window.innerHeight)
  layoutThread()
}

const wide = window.matchMedia('(min-width: 961px)')
if (wide.matches) boot()
else wide.addEventListener('change', () => { if (wide.matches) boot() }, { once: true })
