import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const VIEW = { width: 2048, height: 731 }
const DEPTH = 0.34
const BEVEL_SIZE = 0.14
const BEVEL_THICKNESS = 0.1
const SLOPE = 0.9
const SCALE = 1.77
const TWIST = -0.049
const SIZE = 2.45

type Command = [string, ...number[]]

const ARM: Command[] = [
  ['M', 562, 242],
  ['L', 808.754, 242],
  ['L', 620, 53.246],
  ['L', 694.246, -21],
  ['L', 883, 167.754],
  ['L', 883, -79],
  ['L', 988, -79],
  ['L', 988, 175],
  ['C', 988, 270.002, 911.002, 347, 816, 347],
  ['L', 562, 347],
  ['Z'],
]

const MIRRORS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]

function ribbonCommands(sx: number, sy: number): Command[] {
  const cos = Math.cos(TWIST)
  const sin = Math.sin(TWIST)
  return ARM.map(([command, ...coords]) => {
    const next: Command = [command]
    for (let i = 0; i < coords.length; i += 2) {
      const mx = 1024 + (coords[i] - 1024) * sx
      const my = 377.5 + (coords[i + 1] - 377.5) * sy
      const x = mx - 1024
      const y = my - 377.5
      next.push(1024 + SCALE * (x * cos - y * sin), 449.175 + SCALE * (x * sin + y * cos))
    }
    return next
  })
}

function toShape(commands: Command[]) {
  const shape = new THREE.Shape()
  for (const [command, ...coords] of commands) {
    const point = coords.map((value, index) =>
      index % 2 ? (VIEW.height / 2 - value) / 100 : (value - VIEW.width / 2) / 100,
    )
    if (command === 'M') shape.moveTo(point[0], point[1])
    else if (command === 'L') shape.lineTo(point[0], point[1])
    else if (command === 'C') shape.bezierCurveTo(point[0], point[1], point[2], point[3], point[4], point[5])
    else if (command === 'Z') shape.closePath()
  }
  return shape
}

function extrude(commands: Command[]) {
  const geometry = new THREE.ExtrudeGeometry(toShape(commands), {
    depth: DEPTH,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: 2,
  })
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const remain = DEPTH + BEVEL_THICKNESS - z
    position.setXYZ(i, x + remain * 0.08, y + remain * SLOPE, z)
  }
  geometry.translate(0, 0.83675, 0)
  geometry.deleteAttribute('uv')
  return geometry
}

export function createLogoGeometry() {
  const parts = MIRRORS.map(([sx, sy]) => extrude(ribbonCommands(sx, sy)))
  const geometry = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  if (!geometry) throw new Error('Logo merge failed')
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox ?? new THREE.Box3()
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scale = SIZE / Math.max(size.x, size.y, size.z)
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.scale(scale, scale, scale)
  return geometry
}

export function createSolarLogo(envMap: THREE.Texture) {
  const geometry = createLogoGeometry()
  const material = new THREE.MeshPhysicalMaterial({
    color: '#18080a',
    metalness: 1,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMap,
    envMapIntensity: 1.7,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.layers.set(1)
  const spin = new THREE.Group()
  spin.add(mesh)
  return spin
}
