import * as THREE from 'three'
import { createScreenCanvas } from './screens'

const vertex = `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const fragment = `
uniform sampler2D uMap;
uniform vec2 uMouse;
uniform float uAmp;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec2 delta = vWorld.xy - uMouse;
  float fall = exp(-dot(delta, delta) * 1.15);
  float g = fall * uAmp;
  vec2 uv = clamp(vUv + delta * g * 0.055, 0.0, 1.0);
  vec4 base = texture2D(uMap, uv);
  vec4 red = texture2D(uMap, uv + vec2(0.005, 0.0) * g);
  vec4 blue = texture2D(uMap, uv - vec2(0.005, 0.0) * g);
  vec3 color = vec3(red.r, base.g, blue.b);
  float rim = pow(1.0 - abs(vUv.x - 0.5) * 1.6, 2.0) * 0.12;
  gl_FragColor = vec4(color + vec3(0.55, 0.78, 1.0) * rim, 1.0);
}
`

const LABELS = ['WOW site', 'Product', 'Shop', 'Corporate']

export function createCases(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
  camera.position.set(0, 0.12, 5.4)

  const mouse = new THREE.Vector2()
  const gap = 3.2
  const group = new THREE.Group()
  scene.add(group)

  const materials: THREE.ShaderMaterial[] = []
  LABELS.forEach((_, index) => {
    const picture = createScreenCanvas(index === 3 ? 4 : index)
    const map = new THREE.CanvasTexture(picture)
    map.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uMouse: { value: mouse },
        uAmp: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    })
    materials.push(material)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.62), material)
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(2.68, 1.74),
      new THREE.MeshBasicMaterial({ color: '#0c0e12' }),
    )
    frame.position.z = -0.03
    const pane = new THREE.Group()
    pane.add(frame, screen)
    pane.position.set(index * gap, (index % 2) * 0.12 - 0.06, -index * 0.18)
    pane.rotation.y = -0.22 + index * 0.04
    pane.rotation.x = -0.04
    group.add(pane)
  })

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width < 2 || height < 2) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const update = (progress: number, visible: boolean, pointerX: number, pointerY: number) => {
    if (!visible) return
    const x = progress * gap * (LABELS.length - 1)
    // Keep the active screen right of the copy column.
    const eye = x - 0.82
    camera.position.x = eye
    camera.position.y = 0.1 + Math.sin(progress * Math.PI) * 0.08
    camera.lookAt(eye + 0.18, 0.02, -0.2)
    mouse.set(eye + pointerX * 2.5, -pointerY * 1.55)
    const amp = 0.55 + Math.abs(pointerX) * 0.35
    materials.forEach((material) => {
      material.uniforms.uAmp.value = amp
    })
    renderer.render(scene, camera)
  }

  resize()
  return { update, resize, labels: LABELS }
}
