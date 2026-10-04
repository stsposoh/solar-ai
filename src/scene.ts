import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createSolarLogo } from './logo'
import { createMorph } from './morph'
import { createBlob } from './blob'
import { createStorm, STORM_SKY } from './storm'

export type Glance = {
  hero: number
  duality: number
  process: number
  object: number
  close: number
  wow: number
  void: number
  feel: number
  cases: number
  corridor: number
  thread: number
  morph: number
  morphP: number
  blob: number
  blobP: number
  industries: number
  cover: number
  energy: number
  render: boolean
  heroP: number
  dualityP: number
  processP: number
  objectP: number
  objectLeave: number
  closeP: number
  wowP: number
  voidP: number
  voidArrive: number
  pointerX: number
  pointerY: number
  time: number
  dt: number
}

type Shot = {
  cam: [number, number, number]
  look: [number, number, number]
  mark: [number, number, number]
  markScale: number
  product: number
}

const SHOTS: Record<'rest' | 'hero' | 'thread' | 'duality' | 'morph' | 'blob' | 'process' | 'wow' | 'void' | 'object' | 'close', Shot> = {
  rest: { cam: [0.1, 0.15, 6.6], look: [0.55, 0.45, 0], mark: [1.15, 0.62, 0], markScale: 0.62, product: 0 },
  hero: { cam: [0.15, 0.02, 6.2], look: [0.95, 0.38, 0], mark: [1.35, 0.42, 0], markScale: 0.86, product: 0 },
  // Leaving the hero, the mark drifts down and to the right into the studio section.
  thread: { cam: [0.15, 0.02, 6.2], look: [0.95, 0.38, 0], mark: [2.55, -0.55, 0], markScale: 0.6, product: 0 },
  duality: { cam: [0, 0.04, 5.9], look: [0, 0.28, 0], mark: [0, 0.28, 0], markScale: 0.78, product: 0 },
  morph: { cam: [0.2, 0.05, 6.4], look: [0.75, 0, 0], mark: [-3.4, 0.2, 0], markScale: 0, product: 0 },
  blob: { cam: [0.25, 0.02, 6.1], look: [0.8, 0, 0], mark: [-3.4, 0.2, 0], markScale: 0, product: 0 },
  process: { cam: [-0.35, 0.18, 8.2], look: [0.15, 0.02, 0], mark: [-4, 0, 0], markScale: 0.3, product: 0 },
  wow: { cam: [0.85, 0.02, 6.5], look: [1.7, 0.02, 0], mark: [2.72, 0.02, 0], markScale: 0.98, product: 0 },
  void: { cam: [0, 0, 5.8], look: [0, 0, 0], mark: [3.7, -2.6, 0.7], markScale: 0.08, product: 0 },
  object: { cam: [-0.35, 0.18, 5.8], look: [1.25, 0, 0], mark: [-3.6, -0.4, 0], markScale: 0, product: 1 },
  close: { cam: [0.05, 0.08, 6.2], look: [0.85, 0.1, 0], mark: [2.48, 0.12, 0.08], markScale: 1.46, product: 0 },
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function mixScalar(parts: { w: number; v: number }[]) {
  const sum = parts.reduce((s, p) => s + p.w, 0)
  if (sum <= 0.0001) return parts[0]?.v ?? 0
  return parts.reduce((s, p) => s + p.v * (p.w / sum), 0)
}

function blendVec(parts: { w: number; v: [number, number, number] }[], target: THREE.Vector3) {
  const sum = parts.reduce((s, p) => s + p.w, 0)
  target.set(0, 0, 0)
  if (sum <= 0.0001) {
    const v = parts[0]?.v ?? [0, 0, 0]
    target.set(v[0], v[1], v[2])
    return
  }
  for (const p of parts) {
    const k = p.w / sum
    target.x += p.v[0] * k
    target.y += p.v[1] * k
    target.z += p.v[2] * k
  }
}

const SOLAR_FONT: Record<string, string[]> = {
  S: ['.###.', '#....', '#....', '.###.', '....#', '....#', '.###.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
}

function unitNoise(index: number, salt: number) {
  const n = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function solarForm() {
  const pitch = 0.155
  const advance = pitch * 5 + 0.08
  const targets: THREE.Vector3[] = []
  const letterOf: number[] = []
  const slot: number[] = []
  const glyphs = ['S', 'O', 'L', 'A', 'R']
  glyphs.forEach((glyph, letter) => {
    const rows = SOLAR_FONT[glyph]
    const dots: { col: number; row: number }[] = []
    rows.forEach((row, rowIndex) => {
      for (let col = 0; col < row.length; col++) {
        if (row[col] === '#') dots.push({ col, row: rowIndex })
      }
    })
    dots.forEach((dot, order) => {
      targets.push(new THREE.Vector3(letter * advance + dot.col * pitch, (3 - dot.row) * pitch, 0))
      letterOf.push(letter)
      slot.push(dots.length < 2 ? 0 : order / (dots.length - 1))
    })
  })
  const minX = Math.min(...targets.map((point) => point.x))
  const maxX = Math.max(...targets.map((point) => point.x))
  const midX = (minX + maxX) / 2
  const fit = 0.92
  targets.forEach((point) => {
    point.x = (point.x - midX) * fit
    point.y *= fit
  })
  const scatter = targets.map((_, index) => {
    const x = (unitNoise(index, 1) - 0.5) * 3.35
    const y = 0.72 + unitNoise(index, 2) * 0.7
    const z = (unitNoise(index, 3) - 0.5) * 0.7
    return new THREE.Vector3(x, y, z)
  })
  return { targets, letterOf, slot, scatter }
}

function environment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  const wall = (color: string, position: [number, number, number], size: [number, number]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    )
    mesh.position.set(position[0], position[1], position[2])
    mesh.lookAt(0, 0, 0)
    env.add(mesh)
  }
  wall('#1c2433', [0, 0, -6], [18, 18])
  wall('#d5e4f2', [0, 0.8, 5], [10, 7])
  wall('#0a6f8c', [-5.2, 0.4, 0.2], [8, 9])
  wall('#d8f6ff', [-2.4, 1.2, 2.2], [0.7, 4])
  wall('#8a241c', [5.2, -0.2, 0.2], [8, 9])
  wall('#ff8d7e', [2.5, 0.2, 2.2], [0.55, 3.6])
  wall('#3a4252', [0, 5.2, 0], [14, 14])
  wall('#12141a', [0, -5.2, 0], [14, 14])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const map = pmrem.fromScene(env, 0).texture
  pmrem.dispose()
  return map
}

function fitObject(root: THREE.Object3D, target: number) {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = target / maxDim
  root.scale.setScalar(scale)
  root.position.copy(center).multiplyScalar(-scale)
}

function markRoom(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  const wall = (color: string, position: [number, number, number], size: [number, number]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    )
    mesh.position.set(position[0], position[1], position[2])
    mesh.lookAt(0, 0, 0)
    env.add(mesh)
  }
  wall('#070607', [0, 0, -5], [14, 14])
  wall('#090708', [0, 0, 5], [14, 14])
  wall('#050305', [0, 5, 0], [14, 14])
  wall('#050305', [0, -5, 0], [14, 14])
  wall('#ff2418', [-3.4, 0.2, 1.6], [4.2, 6])
  wall('#ffd0c6', [-1.1, 1.4, 2.4], [0.28, 3.2])
  wall('#ff3a2c', [3.1, -0.8, 1.8], [2.4, 3.4])
  wall('#6a100e', [0.2, -2.4, 2], [6, 0.35])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const map = pmrem.fromScene(env, 0).texture
  pmrem.dispose()
  return map
}

export type ModelStatus = { camera: boolean; boombox: boolean }

export function createWorld(
  canvas: HTMLCanvasElement,
  webCanvas: HTMLCanvasElement,
  onModels?: (status: ModelStatus) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setClearColor(0x07080a, 1)
  RectAreaLightUniformsLib.init()

  const scene = new THREE.Scene()
  const sceneBackground = new THREE.Color('#07080a')
  scene.background = sceneBackground
  scene.environment = environment(renderer)
  scene.environmentIntensity = 1.65

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80)
  camera.position.set(0.05, 0.25, 6.5)
  camera.layers.enable(1)

  const webTex = new THREE.CanvasTexture(webCanvas)
  webTex.colorSpace = THREE.SRGBColorSpace
  const webMat = new THREE.MeshBasicMaterial({
    map: webTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const webPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), webMat)
  webPlane.frustumCulled = false
  const webDist = 28
  webPlane.position.z = -webDist
  camera.add(webPlane)
  scene.add(camera)

  const fitWeb = () => {
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * webDist
    webPlane.scale.set(height * camera.aspect, height, 1)
  }

  const markPivot = new THREE.Group()
  const markTilt = new THREE.Group()
  markTilt.rotation.set(0.48, -0.34, 0)
  const markSpin = createSolarLogo(markRoom(renderer))
  markTilt.add(markSpin)
  markPivot.add(markTilt)
  scene.add(markPivot)

  const coolPoint = new THREE.PointLight('#7ad7ff', 90, 0, 2)
  coolPoint.position.set(-3.1, 0.8, 2.6)
  const hotPoint = new THREE.PointLight('#ff4d3c', 80, 0, 2)
  hotPoint.position.set(3.2, -0.4, 2.5)
  const key = new THREE.DirectionalLight('#f7fbff', 3.2)
  key.position.set(0.2, 1.6, 6)
  const fill = new THREE.HemisphereLight('#d5e6f5', '#07080a', 0.85)
  scene.add(fill)
  const coolRect = new THREE.RectAreaLight('#8ee4ff', 18, 5, 1.1)
  coolRect.position.set(-2.4, 0.6, 2.2)
  coolRect.lookAt(0, 0, 0)
  const hotRect = new THREE.RectAreaLight('#ff5a48', 16, 4.2, 1)
  hotRect.position.set(2.5, -0.2, 2.1)
  hotRect.lookAt(0, 0, 0)
  scene.add(coolPoint, hotPoint, key, coolRect, hotRect)

  const markKey = new THREE.RectAreaLight('#ff2418', 110, 2.4, 4.2)
  markKey.position.set(-1.7, 0.2, 1.45)
  markKey.layers.set(1)
  const markRim = new THREE.RectAreaLight('#ffe4dc', 46, 0.22, 3.2)
  markRim.position.set(1.55, 0.15, 1.25)
  markRim.layers.set(1)
  const markFill = new THREE.PointLight('#ff1a12', 14, 0, 2)
  markFill.position.set(-0.35, 1.15, 1.9)
  markFill.layers.set(1)
  const handLight = new THREE.PointLight('#7ad7ff', 0, 6.5, 1.8)
  handLight.layers.set(1)
  markPivot.add(markKey, markRim, markFill, handLight)

  const solar = solarForm()
  const formCount = solar.targets.length
  const formGeo = new THREE.SphereGeometry(0.066, 48, 32)
  const formMat = new THREE.MeshPhysicalMaterial({
    color: '#140709',
    metalness: 1,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    emissive: '#ff2a18',
    emissiveIntensity: 0.18,
  })
  const form = new THREE.Group()
  const formPieces: THREE.Mesh[] = []
  for (let i = 0; i < formCount; i++) {
    const piece = new THREE.Mesh(formGeo, formMat)
    piece.position.copy(solar.scatter[i])
    form.add(piece)
    formPieces.push(piece)
  }
  form.position.set(1.48, -0.02, 0.15)
  form.visible = false
  const formLight = new THREE.PointLight('#ff3a28', 0, 7, 1.6)
  formLight.position.set(0.2, 0.4, 1.8)
  form.add(formLight)
  scene.add(form)

  const STAR_COUNT = 2600
  const starPos = new Float32Array(STAR_COUNT * 3)
  const starSeed = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const radius = 0.8 + Math.random() * 16
    const angle = Math.random() * Math.PI * 2
    starSeed[i * 3] = Math.cos(angle) * radius
    starSeed[i * 3 + 1] = Math.sin(angle) * radius
    starSeed[i * 3 + 2] = -Math.random() * 96
    starPos[i * 3] = starSeed[i * 3]
    starPos[i * 3 + 1] = starSeed[i * 3 + 1]
    starPos[i * 3 + 2] = starSeed[i * 3 + 2]
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: '#e8f4ff',
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  stars.visible = false
  scene.add(stars)

  const storm = createStorm()
  // Lightning also has to land on the mark: a broad soft panel for the metal to mirror,
  // plus a point for a hard glint, both placed on the side of the screen the bolt is on.
  const boltPanel = new THREE.RectAreaLight('#3d8cff', 0, 6, 5)
  const boltPoint = new THREE.PointLight('#8fe8ff', 0, 9, 1.6)
  scene.add(boltPanel, boltPoint)

  const BURST_COUNT = 220
  const bursts = Array.from({ length: 5 }, () => {
    const positions = new Float32Array(BURST_COUNT * 3)
    const dirs = new Float32Array(BURST_COUNT * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: '#e8f4ff',
    })
    const mesh = new THREE.Points(geometry, material)
    mesh.visible = false
    scene.add(mesh)
    return { mesh, positions, dirs, material, life: 0, active: false }
  })
  let burstWait = 0.4

  const igniteBurst = () => {
    const burst = bursts.find((item) => !item.active)
    if (!burst) return
    const radius = 1.2 + Math.random() * 7
    const angle = Math.random() * Math.PI * 2
    const ox = Math.cos(angle) * radius
    const oy = Math.sin(angle) * radius
    const oz = -2 - Math.random() * 26
    for (let i = 0; i < BURST_COUNT; i += 1) {
      burst.positions[i * 3] = ox
      burst.positions[i * 3 + 1] = oy
      burst.positions[i * 3 + 2] = oz
      burst.dirs[i * 3] = (Math.random() - 0.5) * 7.2
      burst.dirs[i * 3 + 1] = (Math.random() - 0.5) * 7.2
      burst.dirs[i * 3 + 2] = (Math.random() - 0.5) * 7.2
    }
    burst.material.color.set('#e8f4ff')
    burst.material.opacity = 1
    burst.life = 0
    burst.active = true
    burst.mesh.visible = true
    burst.mesh.geometry.attributes.position.needsUpdate = true
  }

  const morph = createMorph(renderer)
  morph.group.position.set(1.45, 0, 0)
  morph.group.scale.setScalar(0.86)
  scene.add(morph.group)

  const blob = createBlob()
  blob.group.position.set(1.5, 0, 0)
  scene.add(blob.group)

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const hit = new THREE.Vector3()
  const morphCursor = new THREE.Vector3()
  const blobCursor = new THREE.Vector3()
  let pointerSeen = false
  const overlays: ((renderer: THREE.WebGLRenderer) => void)[] = []

  const product = new THREE.Group()
  product.visible = false
  const cameraHolder = new THREE.Group()
  const boomHolder = new THREE.Group()
  product.add(cameraHolder, boomHolder)
  scene.add(product)

  const productKey = new THREE.SpotLight('#fff6ee', 0, 14, 0.55, 0.45, 1)
  productKey.position.set(3.4, 3.2, 4.2)
  productKey.target.position.set(1.3, 0, 0)
  scene.add(productKey, productKey.target)

  const status: ModelStatus = { camera: false, boombox: false }
  const loader = new GLTFLoader()

  const loadModel = (url: string, holder: THREE.Group, size: number, flag: 'camera' | 'boombox') => {
    loader.load(
      url,
      (gltf) => {
        fitObject(gltf.scene, size)
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((material) => {
            if ('envMapIntensity' in material) {
              ;(material as THREE.MeshStandardMaterial).envMapIntensity = 1.2
            }
          })
        })
        holder.add(gltf.scene)
        status[flag] = true
        onModels?.({ ...status })
      },
      undefined,
      (error) => {
        console.warn(`Model failed: ${url}`, error)
        onModels?.({ ...status })
      },
    )
  }

  let modelsRequested = false
  const loadModels = () => {
    if (modelsRequested) return
    modelsRequested = true
    loadModel('/models/camera.glb', cameraHolder, 2.35, 'camera')
    loadModel('/models/boombox.glb', boomHolder, 1.55, 'boombox')
  }

  const composerTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, composerTarget)
  const stormPass = new RenderPass(storm.scene, storm.camera, undefined, new THREE.Color(STORM_SKY), 1)
  stormPass.enabled = false
  const mainPass = new RenderPass(scene, camera)
  composer.addPass(stormPass)
  composer.addPass(mainPass)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.1, 0.28, 0.97)
  composer.addPass(bloom)

  const camTarget = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const lookCur = new THREE.Vector3(0.4, 0.15, 0)
  const markTarget = new THREE.Vector3()
  let primed = false
  let start = -1
  let dualityYaw = 0
  const smoothPointer = { x: 0, y: 0 }

  const resize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6)
    renderer.setPixelRatio(pixelRatio)
    composer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    bloom.resolution.set(width, height)
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
    storm.resize(camera.aspect)
    fitWeb()
  }

  const update = (g: Glance) => {
    if (start < 0) start = g.time
    const elapsed = g.time - start
    const dt = Math.min(g.dt, 0.05)
    const k = 1 - Math.exp(-6 * dt)

    smoothPointer.x += (g.pointerX - smoothPointer.x) * 0.08
    smoothPointer.y += (g.pointerY - smoothPointer.y) * 0.08

    const weights = [
      { w: Math.max(0, 1 - (g.hero + g.thread + g.duality + g.morph + g.blob + g.process + g.wow + g.void + g.object + g.close + g.cover)), shot: SHOTS.rest },
      { w: g.hero, shot: SHOTS.hero },
      { w: g.thread, shot: SHOTS.thread },
      { w: g.duality, shot: SHOTS.duality },
      { w: g.morph, shot: SHOTS.morph },
      { w: g.blob, shot: SHOTS.blob },
      { w: g.process, shot: SHOTS.process },
      { w: g.wow, shot: SHOTS.wow },
      { w: g.void * 3.4, shot: SHOTS.void },
      { w: g.object, shot: SHOTS.object },
      { w: g.close, shot: SHOTS.close },
    ]
    const parts = weights.map((entry) => ({ w: entry.w, v: entry.shot.cam }))
    blendVec(parts, camTarget)
    blendVec(
      weights.map((entry) => ({ w: entry.w, v: entry.shot.look })),
      lookTarget,
    )
    blendVec(
      weights.map((entry) => ({ w: entry.w, v: entry.shot.mark })),
      markTarget,
    )
    const voidShow = g.void
    const fall = Math.pow(smoothstep(0.42, 1, g.voidP), 1.15)
    let markScale =
      mixScalar(weights.map((entry) => ({ w: entry.w, v: entry.shot.markScale }))) *
      (0.94 + 0.06 * smoothstep(0, 1.05, elapsed)) *
      (1 - smoothstep(0.6, 1, g.thread) * (1 - voidShow))
    const productAmt = mixScalar(weights.map((entry) => ({ w: entry.w, v: entry.shot.product })))
    if (voidShow > 0.04) {
      const arrive = g.voidArrive
      markTarget.set(3.7 * (1 - arrive), -2.6 * (1 - arrive), 0.7 - arrive * 0.35 - fall * 36)
      markScale = 0.06 + arrive * (0.78 * (1 - fall * 0.08) - 0.06)
      const closeAmt = Math.max(g.close, g.closeP > 0.92 ? 1 : 0)
      if (closeAmt > 0.01) {
        markTarget.set(
          markTarget.x + (2.48 - markTarget.x) * closeAmt,
          markTarget.y + (0.12 - markTarget.y) * closeAmt,
          markTarget.z + (0.08 - markTarget.z) * closeAmt,
        )
        markScale += (1.46 - markScale) * closeAmt
      }
    }
    markScale *= 1 - smoothstep(0.3, 0.8, Math.max(g.feel, g.cases, g.cover, g.morph, g.blob))
    if (voidShow > 0.04) {
      const hideCorridor = (1 - Math.max(g.close, g.closeP > 0.92 ? 1 : 0)) * g.corridor
      markScale *= 1 - hideCorridor
    }

    const closeAmt = Math.max(g.close, g.closeP > 0.92 ? 1 : 0)
    const moveK = voidShow > 0.04 && closeAmt < 0.02 ? 1 : k
    if (!primed) {
      camera.position.copy(camTarget)
      lookCur.copy(lookTarget)
      markPivot.position.copy(markTarget)
      markPivot.scale.setScalar(Math.max(markScale, 0.001))
      primed = true
    } else {
      camera.position.lerp(camTarget, moveK)
      lookCur.lerp(lookTarget, moveK)
      markPivot.position.lerp(markTarget, moveK)
      const current = markPivot.scale.x
      const next = current + (markScale - current) * moveK
      markPivot.scale.setScalar(Math.max(next, 0.001))
    }
    markPivot.visible = markScale > 0.05
    camera.lookAt(lookCur)
    markKey.lookAt(markPivot.position)
    markRim.lookAt(markPivot.position)
    const handAmt = Math.max(g.wow, g.close * 0.9) * (1 - Math.max(g.feel, g.cases))
    const handMix = smoothPointer.x * 0.5 + 0.5
    handLight.intensity = 70 * handAmt
    handLight.color.setRGB(0.48 + 0.52 * handMix, 0.62 - 0.18 * handMix, 1 - 0.62 * handMix)
    handLight.position.set(smoothPointer.x * 2.35, smoothPointer.y * 1.7, 1.75)

    const dualityBeat = g.duality > 0.45 ? Math.min(2, Math.floor(Math.min(1, Math.max(0, g.dualityP)) * 3)) : 0
    const yawTarget = dualityBeat === 1 ? -0.3 : dualityBeat === 2 ? 0.32 : 0
    dualityYaw += (yawTarget - dualityYaw) * (1 - Math.exp(-2.8 * dt))
    // Duality beats: the turned mark catches cold light on the left, warm light on the right.
    const side = THREE.MathUtils.clamp(dualityYaw / 0.31, -1, 1)
    const sideAmt = smoothstep(0.3, 0.8, g.duality) * Math.abs(side) * (1 - handAmt)
    if (sideAmt > 0.01) {
      handLight.intensity = 85 * sideAmt
      if (side < 0) handLight.color.set('#7ad7ff')
      else handLight.color.set('#ffb4a2')
      handLight.position.set(side * -1.1, 0.7, 1.7)
    }
    if (voidShow > 0.08) {
      markTilt.rotation.x = Math.sin(elapsed * 0.22) * 0.2
      markTilt.rotation.y = Math.cos(elapsed * 0.18) * 0.22
      markTilt.rotation.z = Math.sin(elapsed * 0.15) * 0.08
      markSpin.rotation.x = 0
      markSpin.rotation.y = 0
      markSpin.rotation.z = elapsed * 0.06
    } else {
      markPivot.rotation.set(0, 0, 0)
      markTilt.rotation.x = 0.48 + smoothPointer.y * -0.04
      markTilt.rotation.y = -0.34 + smoothPointer.x * 0.05 + dualityYaw
      markTilt.rotation.z = 0
      markSpin.rotation.x = 0
      markSpin.rotation.y = 0
      markSpin.rotation.z = elapsed * 0.11 + g.heroP * 0.35 + g.dualityP * 0.85 + g.processP * 0.4 + g.wowP * 0.55
    }

    const coolBoost = g.duality > 0.25 ? 1.2 - g.dualityP * 0.75 : 1
    const hotBoost = g.duality > 0.25 ? 0.35 + g.dualityP * 0.95 : 1
    coolPoint.intensity = 90 * coolBoost
    hotPoint.intensity = 80 * hotBoost
    coolRect.intensity = 18 * coolBoost
    hotRect.intensity = 16 * hotBoost
    coolPoint.position.x = -3.1 + Math.sin(elapsed * 0.4) * 0.25
    hotPoint.position.y = -0.4 + Math.cos(elapsed * 0.33) * 0.2

    const formShow = g.process
    form.visible = formShow > 0.2
    form.scale.setScalar(0.2 + formShow * 0.8)
    formLight.intensity = 28 * formShow
    formMat.emissiveIntensity = 0.12 + Math.sin(elapsed * 1.6) * 0.05
    if (form.visible) {
      const formed = g.processP * 5
      form.rotation.y = -0.12
      form.rotation.x = 0
      formPieces.forEach((piece, index) => {
        const local = formed - solar.letterOf[index]
        const blend = smoothstep(0, 1, (local - solar.slot[index] * 0.28) / 0.72)
        const from = solar.scatter[index]
        const to = solar.targets[index]
        const wobble = Math.sin(elapsed * 1.5 + index * 0.7) * 0.028 * (1 - blend)
        piece.position.set(
          from.x + (to.x - from.x) * blend,
          from.y + (to.y - from.y) * blend + wobble,
          from.z + (to.z - from.z) * blend,
        )
        const pulse = 1 + Math.sin(elapsed * 2.1 + index * 0.55) * 0.05 * (1 - blend * 0.85)
        piece.scale.setScalar(pulse)
      })
    }

    if (g.pointerX !== 0 || g.pointerY !== 0) pointerSeen = true
    ndc.set(g.pointerX, -g.pointerY)
    raycaster.setFromCamera(ndc, camera)
    const aimed = pointerSeen && raycaster.ray.intersectPlane(plane, hit) !== null
    if (g.morph > 0.01) {
      morph.group.updateMatrixWorld()
      if (aimed) morph.group.worldToLocal(morphCursor.copy(hit))
      morph.update({ time: g.time, dt, progress: g.morphP, presence: g.morph, cursor: morphCursor, cursorOn: aimed ? 1 : 0 })
    } else {
      morph.update({ time: g.time, dt, progress: g.morphP, presence: 0, cursor: morphCursor, cursorOn: 0 })
    }
    if (g.blob > 0.01 && aimed) {
      blobCursor.copy(hit).sub(blob.group.position)
    }
    const blobNear = aimed ? Math.max(0, 1 - Math.hypot(blobCursor.x, blobCursor.y) / 2.4) : 0
    blob.update({ time: g.time, dt, progress: g.blobP, presence: g.blob, energy: g.energy, cursor: blobCursor, cursorOn: blobNear })

    const showProduct = productAmt > 0.04 && (status.camera || status.boombox)
    product.visible = showProduct
    product.scale.setScalar(productAmt)
    // Once the section scrolls off, the product rides up with it instead of hovering over the next one.
    product.position.set(1.35, -0.05, 0)
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.distanceTo(product.position)
    product.position.y += g.objectLeave * viewHeight
    product.rotation.y = g.objectP * Math.PI * 2.15 + smoothPointer.x * 0.35
    product.rotation.x = smoothPointer.y * -0.12

    const swap = status.camera && status.boombox ? smoothstep(0.42, 0.62, g.objectP) : status.boombox ? 1 : 0
    cameraHolder.position.x = -swap * 3.4
    boomHolder.position.x = (1 - swap) * 3.4
    cameraHolder.visible = status.camera && swap < 0.985
    boomHolder.visible = status.boombox && swap > 0.015

    productKey.intensity = showProduct ? 36 * productAmt : 0
    productKey.target.position.copy(product.position)

    const voidOn = voidShow > 0.04
    stars.visible = voidOn
    if (voidOn) {
      const bolt = storm.update(dt)
      const reach = bolt.flash * voidShow * Math.min(1, markScale * 2)
      boltPanel.position.set(markPivot.position.x + bolt.screen.x * 1.8, markPivot.position.y + bolt.screen.y * 1.4 + 0.4, markPivot.position.z + 3.2)
      boltPanel.lookAt(markPivot.position)
      boltPanel.intensity = reach * 160
      boltPoint.position.copy(boltPanel.position)
      boltPoint.intensity = reach * 140
    } else {
      storm.reset()
      boltPanel.intensity = 0
      boltPoint.intensity = 0
    }
    ;(stars.material as THREE.PointsMaterial).opacity = voidShow * (0.45 + fall * 0.55)
    if (voidOn) {
      const rush = Math.pow(g.voidP, 2.6)
      const drift = (0.08 + rush * 26) * dt
      const pos = starGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < STAR_COUNT; i += 1) {
        let z = pos.getZ(i) + drift
        if (z > 4) z -= 100
        pos.setXYZ(i, starSeed[i * 3], starSeed[i * 3 + 1], z)
      }
      pos.needsUpdate = true
      burstWait -= dt
      if (burstWait <= 0) {
        igniteBurst()
        burstWait = 0.7 + Math.random() * 0.9
      }
    } else {
      burstWait = 0.2
    }
    bursts.forEach((burst) => {
      if (!burst.active) return
      burst.life += dt
      const done = burst.life > 1.45 || !voidOn
      if (done) {
        burst.active = false
        burst.mesh.visible = false
        burst.material.opacity = 0
        return
      }
      const speed = dt * (1.15 - burst.life * 0.35)
      for (let i = 0; i < BURST_COUNT; i += 1) {
        burst.positions[i * 3] += burst.dirs[i * 3] * speed
        burst.positions[i * 3 + 1] += burst.dirs[i * 3 + 1] * speed
        burst.positions[i * 3 + 2] += burst.dirs[i * 3 + 2] * speed
      }
      burst.material.opacity = Math.max(0, 1 - burst.life / 1.45)
      burst.mesh.geometry.attributes.position.needsUpdate = true
    })

    webPlane.visible = webMat.opacity > 0.01
    if (webPlane.visible) webTex.needsUpdate = true
    if (!g.render) return
    // The storm sky and the mark go through one composer, so lightning blooms and the mark
    // keeps the same look it has everywhere else on the page.
    stormPass.enabled = voidOn
    mainPass.clear = !voidOn
    mainPass.clearDepth = voidOn
    scene.background = voidOn ? null : sceneBackground
    composer.render()
    if (overlays.length) {
      renderer.autoClear = false
      renderer.setRenderTarget(null)
      overlays.forEach((draw) => draw(renderer))
      renderer.autoClear = true
    }
  }

  const addOverlay = (draw: (renderer: THREE.WebGLRenderer) => void) => {
    overlays.push(draw)
  }

  const setWebOpacity = (opacity: number) => {
    webMat.opacity = opacity
  }

  resize()

  return { update, resize, setWebOpacity, addOverlay, loadModels }
}
