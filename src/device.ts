import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export function createDevice(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0).texture
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40)
  camera.position.set(0, 0, 5.15)

  const key = new THREE.DirectionalLight('#fff6f0', 2.6)
  key.position.set(2.4, 3.4, 4.2)
  const rim = new THREE.DirectionalLight('#9ad8ff', 1.3)
  rim.position.set(-2.8, 1.4, -1.6)
  scene.add(new THREE.AmbientLight('#ffffff', 0.45), key, rim)

  const pivot = new THREE.Group()
  scene.add(pivot)

  const screenTex = new THREE.Texture()
  screenTex.colorSpace = THREE.SRGBColorSpace
  screenTex.flipY = false
  screenTex.center.set(0.5, 0.5)
  screenTex.rotation = Math.PI
  const screenImage = new Image()
  screenImage.onload = () => {
    const picture = document.createElement('canvas')
    picture.width = screenImage.width
    picture.height = screenImage.height
    const draw = picture.getContext('2d')
    if (!draw) return
    draw.translate(screenImage.width, 0)
    draw.scale(-1, 1)
    draw.drawImage(screenImage, 0, 0)
    screenTex.image = picture
    screenTex.needsUpdate = true
  }
  screenImage.src = '/images/solar-screen.webp'

  new GLTFLoader().load('/models/iphone.glb', (gltf) => {
    const model = gltf.scene
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const name = mesh.name.toLowerCase()
      if (name.includes('scr')) {
        mesh.material = new THREE.MeshBasicMaterial({ map: screenTex })
        return
      }
      if (name.includes('glass') || name.includes('glsl')) {
        const source = mesh.material as THREE.MeshStandardMaterial
        const glass = source.clone()
        glass.transparent = true
        glass.opacity = 0.14
        glass.depthWrite = false
        mesh.material = glass
      }
    })
    const holder = new THREE.Group()
    holder.add(model)
    pivot.add(holder)

    const measure = () => {
      model.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model)
      return { box, size: box.getSize(new THREE.Vector3()) }
    }
    const tries = [
      new THREE.Euler(0, 0, 0),
      new THREE.Euler(Math.PI / 2, 0, 0),
      new THREE.Euler(-Math.PI / 2, 0, 0),
      new THREE.Euler(0, 0, Math.PI / 2),
      new THREE.Euler(0, 0, -Math.PI / 2),
    ]
    let best = tries[0]
    let bestHeight = 0
    for (const euler of tries) {
      model.rotation.copy(euler)
      const height = measure().size.y
      if (height > bestHeight) {
        bestHeight = height
        best = euler.clone()
      }
    }
    model.rotation.copy(best)
    const fitted = measure()
    const center = fitted.box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    holder.scale.setScalar(2.35 / Math.max(fitted.size.y, 0.001))

    const screen = model.getObjectByName('object.010_scr_0')
    if (screen) {
      holder.updateMatrixWorld(true)
      const phoneCenter = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3())
      const screenCenter = new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3())
      if (screenCenter.z < phoneCenter.z) holder.rotation.y = Math.PI
    }
  })

  const resize = () => {
    const width = Math.max(canvas.clientWidth, 1)
    const height = Math.max(canvas.clientHeight, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const ease = (value: number) => {
    const t = Math.min(1, Math.max(0, value))
    return t * t * (3 - 2 * t)
  }

  const update = (progress: number, visible: boolean) => {
    if (!visible) return
    let yaw = 0
    let pitch = 0.14
    if (progress < 0.42) {
      yaw = ease(progress / 0.42) * Math.PI
    } else if (progress < 0.7) {
      const t = ease((progress - 0.42) / 0.28)
      yaw = Math.PI
      pitch = 0.14 - t * 1.15
    } else {
      const t = ease((progress - 0.7) / 0.3)
      yaw = Math.PI * (1 - t)
      pitch = -1.01 + (0.14 - -1.01) * t
    }
    pivot.rotation.y = yaw
    pivot.rotation.x = pitch
    const front = Math.max(0, Math.cos(yaw)) * (1 - Math.min(1, Math.abs(pitch - 0.14)))
    camera.position.z = 6.3 - front * 1.15
    camera.lookAt(0, 0.02, 0)
    renderer.render(scene, camera)
  }

  resize()
  return { update, resize }
}
