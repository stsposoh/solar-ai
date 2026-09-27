import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createScreenCanvas } from './screens'

export type Glance = {
  hero: number
  duality: number
  process: number
  object: number
  close: number
  wow: number
  heroP: number
  dualityP: number
  processP: number
  objectP: number
  closeP: number
  wowP: number
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
  panels: number
  product: number
}

const SHOTS: Record<'rest' | 'hero' | 'duality' | 'process' | 'wow' | 'object' | 'close', Shot> = {
  rest: { cam: [0.1, 0.15, 6.6], look: [0.55, 0.45, 0], mark: [1.15, 0.62, 0], markScale: 0.62, panels: 0, product: 0 },
  hero: { cam: [0.15, 0.02, 6.2], look: [0.95, 0.38, 0], mark: [1.35, 0.42, 0], markScale: 0.86, panels: 0, product: 0 },
  duality: { cam: [0, 0.04, 5.9], look: [0, 0.28, 0], mark: [0, 0.28, 0], markScale: 0.78, panels: 0, product: 0 },
  process: { cam: [-0.35, 0.18, 8.2], look: [0.15, 0.02, 0], mark: [-4, 0, 0], markScale: 0.3, panels: 0, product: 0 },
  wow: { cam: [0.15, 0.04, 7.2], look: [0.55, 0, 0], mark: [-7, 0.6, -2], markScale: 0, panels: 0, product: 0 },
  object: { cam: [-0.35, 0.18, 5.8], look: [1.25, 0, 0], mark: [-3.6, -0.4, 0], markScale: 0, panels: 0, product: 1 },
  close: { cam: [0.1, 0.12, 6.4], look: [0.35, 0.15, 0], mark: [0.55, 0.22, 0], markScale: 0.5, panels: 0, product: 0 },
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

function capsuleShape(width: number, length: number) {
  const radius = width / 2
  const half = Math.max(length / 2 - radius, 0.001)
  const shape = new THREE.Shape()
  shape.moveTo(radius, -half)
  shape.lineTo(radius, half)
  shape.absarc(0, half, radius, 0, Math.PI, false)
  shape.lineTo(-radius, -half)
  shape.absarc(0, -half, radius, Math.PI, Math.PI * 2, false)
  return shape
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

function makeMark(envMap: THREE.Texture) {
  const spin = new THREE.Group()
  const metal = new THREE.MeshPhysicalMaterial({
    color: '#18080a',
    metalness: 1,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMap,
    envMapIntensity: 1.85,
    reflectivity: 1,
  })

  const petal = new THREE.ExtrudeGeometry(capsuleShape(0.4, 1.02), {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.055,
    bevelSegments: 2,
    curveSegments: 24,
  })
  petal.translate(0, 0, -0.34)

  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group()
    arm.rotation.z = (i * Math.PI) / 3
    const mesh = new THREE.Mesh(petal, metal)
    mesh.position.y = 0.58
    mesh.layers.set(1)
    arm.add(mesh)
    spin.add(arm)
  }

  return spin
}

function makePanels(renderer: THREE.WebGLRenderer) {
  const group = new THREE.Group()
  const layouts = [
    { x: 2.55, y: 0.35, z: 0.2, ry: -0.55, w: 1.45, h: 0.9, kind: 0 },
    { x: 3.45, y: -0.15, z: -0.35, ry: -0.7, w: 1.15, h: 0.74, kind: 1 },
    { x: 2.85, y: -0.85, z: 0.55, ry: -0.4, w: 1.25, h: 0.78, kind: 2 },
    { x: 3.7, y: 0.75, z: 0.05, ry: -0.85, w: 0.55, h: 1.0, kind: 3 },
    { x: 2.15, y: 1.05, z: -0.45, ry: -0.35, w: 1.05, h: 0.66, kind: 4 },
  ]
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const bases: { mesh: THREE.Mesh; y: number; z: number }[] = []

  layouts.forEach((layout) => {
    const canvas = createScreenCanvas(layout.kind)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = maxAniso
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.42,
      metalness: 0.04,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: tex,
      emissiveIntensity: 0.18,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(layout.w, layout.h), material)
    mesh.position.set(layout.x, layout.y, layout.z)
    mesh.rotation.y = layout.ry
    mesh.rotation.x = -0.06
    group.add(mesh)
    bases.push({ mesh, y: layout.y, z: layout.z })
  })

  return { group, bases }
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
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setClearColor(0x07080a, 1)
  RectAreaLightUniformsLib.init()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#07080a')
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
  const markSpin = makeMark(markRoom(renderer))
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
  markPivot.add(markKey, markRim, markFill)

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

  const sheetGeo = new THREE.PlaneGeometry(1.7, 2.7, 40, 52)
  const sheetBase = new Float32Array(sheetGeo.attributes.position.array)
  const sheetMat = new THREE.MeshPhysicalMaterial({
    color: '#14080b',
    metalness: 1,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: '#ff2a18',
    emissiveIntensity: 0.05,
    side: THREE.DoubleSide,
  })
  const sheet = new THREE.Mesh(sheetGeo, sheetMat)
  sheet.position.set(2.15, 0.05, 0)
  sheet.visible = false
  const sheetLight = new THREE.PointLight('#ff3a28', 0, 8, 1.5)
  sheetLight.position.set(0.6, 0.8, 3.4)
  sheet.add(sheetLight)
  scene.add(sheet)

  const panels = makePanels(renderer)
  panels.group.visible = false
  scene.add(panels.group)

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

  loadModel('/models/camera.glb', cameraHolder, 2.35, 'camera')
  loadModel('/models/boombox.glb', boomHolder, 1.55, 'boombox')

  const composerTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, composerTarget)
  composer.addPass(new RenderPass(scene, camera))
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
      { w: Math.max(0, 1 - (g.hero + g.duality + g.process + g.wow + g.object + g.close)), shot: SHOTS.rest },
      { w: g.hero, shot: SHOTS.hero },
      { w: g.duality, shot: SHOTS.duality },
      { w: g.process, shot: SHOTS.process },
      { w: g.wow, shot: SHOTS.wow },
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
    const markScale =
      mixScalar(weights.map((entry) => ({ w: entry.w, v: entry.shot.markScale }))) *
      (0.94 + 0.06 * smoothstep(0, 1.05, elapsed))
    const panelAmt = mixScalar(weights.map((entry) => ({ w: entry.w, v: entry.shot.panels })))
    const productAmt = mixScalar(weights.map((entry) => ({ w: entry.w, v: entry.shot.product })))

    if (!primed) {
      camera.position.copy(camTarget)
      lookCur.copy(lookTarget)
      markPivot.position.copy(markTarget)
      markPivot.scale.setScalar(Math.max(markScale, 0.001))
      primed = true
    } else {
      camera.position.lerp(camTarget, k)
      lookCur.lerp(lookTarget, k)
      markPivot.position.lerp(markTarget, k)
      const current = markPivot.scale.x
      const next = current + (markScale - current) * k
      markPivot.scale.setScalar(Math.max(next, 0.001))
    }
    camera.lookAt(lookCur)
    markKey.lookAt(markPivot.position)
    markRim.lookAt(markPivot.position)

    const dualityBeat = g.duality > 0.45 ? Math.min(2, Math.floor(Math.min(1, Math.max(0, g.dualityP)) * 3)) : 0
    const yawTarget = dualityBeat === 1 ? -0.78 : dualityBeat === 2 ? 0.82 : 0
    dualityYaw += (yawTarget - dualityYaw) * (1 - Math.exp(-2.8 * dt))
    markTilt.rotation.x = 0.48 + smoothPointer.y * -0.04
    markTilt.rotation.y = -0.34 + smoothPointer.x * 0.05 + dualityYaw
    markSpin.rotation.z = elapsed * 0.11 + g.heroP * 0.35 + g.dualityP * 0.85 + g.processP * 0.4

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

    panels.group.visible = panelAmt > 0.04
    panels.bases.forEach((item, index) => {
      item.mesh.position.y = item.y + Math.sin(elapsed * 0.45 + index) * 0.035 + (g.processP - 0.5) * (0.18 + index * 0.04)
      item.mesh.position.z = item.z + (g.processP - 0.5) * 0.55
    })
    panels.group.scale.setScalar(0.82 + panelAmt * 0.18)

    const showProduct = productAmt > 0.04 && (status.camera || status.boombox)
    product.visible = showProduct
    product.scale.setScalar(productAmt)
    product.position.set(1.35, -0.05, 0)
    product.rotation.y = g.objectP * Math.PI * 2.15 + smoothPointer.x * 0.35
    product.rotation.x = smoothPointer.y * -0.12

    const swap = status.camera && status.boombox ? smoothstep(0.42, 0.62, g.objectP) : status.boombox ? 1 : 0
    cameraHolder.position.x = -swap * 3.4
    boomHolder.position.x = (1 - swap) * 3.4
    cameraHolder.visible = status.camera && swap < 0.985
    boomHolder.visible = status.boombox && swap > 0.015

    productKey.intensity = showProduct ? 36 * productAmt : 0
    productKey.target.position.copy(product.position)

    const sheetShow = g.wow
    sheet.visible = sheetShow > 0.2
    sheet.scale.setScalar(0.4 + sheetShow * 0.6)
    sheetLight.intensity = 22 * sheetShow
    sheetMat.emissiveIntensity = 0.04 + sheetShow * 0.04
    if (sheet.visible) {
      const amp = 0.48
      const positions = sheetGeo.attributes.position
      for (let i = 0; i < positions.count; i++) {
        const x = sheetBase[i * 3]
        const y = sheetBase[i * 3 + 1]
        const fold = Math.sin(x * 1.7 + elapsed * 0.75)
        const bow = Math.cos(y * 1.15 - elapsed * 0.5) * 0.55
        const ripple = Math.sin(x * 5 + y * 2 + elapsed) * 0.08
        positions.setXYZ(
          i,
          x + Math.sin(y * 1.1 + elapsed * 0.5) * 0.12 * amp,
          y + Math.cos(x * 1.6 - elapsed * 0.4) * 0.05 * amp,
          (fold + bow + ripple) * amp,
        )
      }
      positions.needsUpdate = true
      sheetGeo.computeVertexNormals()
      sheet.rotation.y = -0.28 + Math.sin(elapsed * 0.3) * 0.06 + g.pointerX * 0.08
      sheet.rotation.x = Math.sin(elapsed * 0.22) * 0.04 + g.pointerY * -0.05
    }

    webTex.needsUpdate = true
    webPlane.visible = webMat.opacity > 0.01
    composer.render()
  }

  const setWebOpacity = (opacity: number) => {
    webMat.opacity = opacity
  }

  resize()

  return { update, resize, setWebOpacity }
}
