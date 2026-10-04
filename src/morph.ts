import * as THREE from 'three'
import { GPUComputationRenderer, type Variable } from 'three/addons/misc/GPUComputationRenderer.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { createLogoGeometry } from './logo'

const SIZE = 256
export const MORPH_COUNT = SIZE * SIZE

const noise = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

const velocityShader = /* glsl */ `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uBlend;
uniform float uTime;
uniform float uDt;
uniform float uChaos;
uniform vec3 uCursor;
uniform float uCursorOn;
${noise}

vec3 field(vec3 p) {
  return vec3(snoise(p), snoise(p + vec3(31.4, 7.1, 2.9)), snoise(p + vec3(-5.3, 19.7, 41.2)));
}

vec3 curl(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 px0 = field(p - dx);
  vec3 px1 = field(p + dx);
  vec3 py0 = field(p - dy);
  vec3 py1 = field(p + dy);
  vec3 pz0 = field(p - dz);
  vec3 pz1 = field(p + dz);
  float x = (py1.z - py0.z) - (pz1.y - pz0.y);
  float y = (pz1.x - pz0.x) - (px1.z - px0.z);
  float z = (px1.y - px0.y) - (py1.x - py0.x);
  return vec3(x, y, z) / (2.0 * e);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(tPos, uv).xyz;
  vec3 vel = texture2D(tVel, uv).xyz;
  vec4 a = texture2D(uFrom, uv);
  vec4 b = texture2D(uTo, uv);
  float seed = a.w;

  // Each particle leaves on its own beat, so the shape peels instead of popping.
  float k = smoothstep(0.0, 1.0, clamp((uBlend - seed * 0.45) / 0.55, 0.0, 1.0));
  vec3 target = mix(a.xyz, b.xyz, k);
  float transit = sin(3.14159265 * k);

  float stiffness = 16.0 + seed * 10.0;
  vel += (target - pos) * stiffness * uDt;
  vel += curl(pos * 0.62 + vec3(0.0, uTime * 0.09, 0.0)) * (uChaos + transit * 2.4) * uDt * 3.0;

  vec3 away = pos - uCursor;
  float reach = length(away.xy);
  float push = uCursorOn * pow(max(0.0, 1.0 - reach / 0.6), 2.0);
  vel += normalize(away + vec3(0.0, 0.0, 0.0001)) * push * 16.0 * uDt;

  vel *= exp(-7.0 * uDt);
  gl_FragColor = vec4(vel, 1.0);
}
`

const positionShader = /* glsl */ `
uniform float uDt;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(tPos, uv);
  vec3 vel = texture2D(tVel, uv).xyz;
  gl_FragColor = vec4(pos.xyz + vel * uDt, pos.w);
}
`

const pointVertex = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform float uSize;
uniform float uPixel;
uniform float uBrand;
attribute vec2 ref;
varying float vSpeed;
varying float vSeed;
void main() {
  vec3 pos = texture2D(uPos, ref).xyz;
  vSpeed = length(texture2D(uVel, ref).xyz);
  vSeed = fract(sin(dot(ref, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uSize * uPixel * (0.55 + vSeed * 0.9) * (1.0 + uBrand * 0.55) / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const pointFragment = /* glsl */ `
uniform float uOpacity;
uniform float uBrand;
varying float vSpeed;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  vec3 hot = vec3(1.0, 0.3, 0.2);
  vec3 cool = vec3(0.5, 0.86, 1.0);
  vec3 color = mix(hot, cool, smoothstep(0.5, 2.2, vSpeed + vSeed * 0.35));
  color = mix(color, vec3(1.0, 0.95, 0.92), smoothstep(2.0, 4.0, vSpeed) * 0.7 + step(0.97, vSeed) * 0.6);
  // Settled into the mark, the cloud takes the logo's red; stragglers still in flight stay lighter.
  // Values are linear and get sRGB-encoded on output, which lifts small green/blue a lot;
  // these land on the logo's #ff2418 once encoded and stacked additively.
  vec3 brand = mix(vec3(1.0, 0.006, 0.003), vec3(1.0, 0.045, 0.02), vSeed * 0.35 + smoothstep(0.6, 2.4, vSpeed) * 0.65);
  color = mix(color, brand, uBrand);
  gl_FragColor = vec4(color, core * uOpacity * (0.75 + vSeed * 0.25) * (1.0 + uBrand * 0.6));
}
`

function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * Math.cos(2 * Math.PI * Math.random())
}

function surfacePoints(geometry: THREE.BufferGeometry) {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build()
  const point = new THREE.Vector3()
  return (out: Float32Array, index: number) => {
    sampler.sample(point)
    out[index] = point.x
    out[index + 1] = point.y
    out[index + 2] = point.z
  }
}

function makeTargets() {
  const seeds = new Float32Array(MORPH_COUNT)
  for (let i = 0; i < MORPH_COUNT; i++) seeds[i] = Math.random()

  const build = (fill: (data: Float32Array, i: number, n: number) => void) => {
    const data = new Float32Array(MORPH_COUNT * 4)
    for (let i = 0; i < MORPH_COUNT; i++) {
      fill(data, i * 4, i)
      data[i * 4 + 3] = seeds[i]
    }
    const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType)
    texture.needsUpdate = true
    return texture
  }

  const cloud = build((data, o) => {
    data[o] = gaussian() * 0.85
    data[o + 1] = gaussian() * 0.6
    data[o + 2] = gaussian() * 0.55
  })

  const golden = Math.PI * (3 - Math.sqrt(5))
  const sphere = build((data, o, i) => {
    const y = 1 - (i / (MORPH_COUNT - 1)) * 2
    const ring = Math.sqrt(1 - y * y)
    const theta = golden * i
    const shell = 1.18 + (Math.random() < 0.82 ? 0 : Math.random() * 0.22)
    data[o] = Math.cos(theta) * ring * shell
    data[o + 1] = y * shell
    data[o + 2] = Math.sin(theta) * ring * shell
  })

  const knotGeo = new THREE.TorusKnotGeometry(0.82, 0.24, 280, 32, 2, 3)
  const knotSample = surfacePoints(knotGeo)
  const knot = build((data, o) => knotSample(data, o))
  knotGeo.dispose()

  const logoGeo = createLogoGeometry()
  logoGeo.scale(1.02, 1.02, 1.02)
  const logoSample = surfacePoints(logoGeo)
  const logo = build((data, o) => logoSample(data, o))
  logoGeo.dispose()

  return [cloud, sphere, knot, logo]
}

export type MorphFrame = {
  time: number
  dt: number
  progress: number
  presence: number
  cursor: THREE.Vector3
  cursorOn: number
}

export function createMorph(renderer: THREE.WebGLRenderer) {
  const targets = makeTargets()
  const gpu = new GPUComputationRenderer(SIZE, SIZE, renderer)

  const pos0 = gpu.createTexture()
  pos0.image.data?.set(targets[0].image.data as Float32Array)
  const vel0 = gpu.createTexture()

  const velVar: Variable = gpu.addVariable('tVel', velocityShader, vel0)
  const posVar: Variable = gpu.addVariable('tPos', positionShader, pos0)
  gpu.setVariableDependencies(velVar, [posVar, velVar])
  gpu.setVariableDependencies(posVar, [posVar, velVar])

  const velUniforms = velVar.material.uniforms
  velUniforms.uFrom = { value: targets[0] }
  velUniforms.uTo = { value: targets[1] }
  velUniforms.uBlend = { value: 0 }
  velUniforms.uTime = { value: 0 }
  velUniforms.uDt = { value: 0.016 }
  velUniforms.uChaos = { value: 1 }
  velUniforms.uCursor = { value: new THREE.Vector3(99, 99, 0) }
  velUniforms.uCursorOn = { value: 0 }
  posVar.material.uniforms.uDt = { value: 0.016 }

  const error = gpu.init()
  if (error) console.warn('Morph compute failed', error)

  const refs = new Float32Array(MORPH_COUNT * 2)
  for (let i = 0; i < MORPH_COUNT; i++) {
    refs[i * 2] = ((i % SIZE) + 0.5) / SIZE
    refs[i * 2 + 1] = (Math.floor(i / SIZE) + 0.5) / SIZE
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MORPH_COUNT * 3), 3))
  geometry.setAttribute('ref', new THREE.BufferAttribute(refs, 2))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPos: { value: null },
      uVel: { value: null },
      uSize: { value: 8.5 },
      uPixel: { value: renderer.getPixelRatio() },
      uOpacity: { value: 0 },
      uBrand: { value: 0 },
    },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  const group = new THREE.Group()
  group.add(points)
  group.visible = false

  let spin = 0
  let stage = -1

  const update = (frame: MorphFrame) => {
    const live = frame.presence > 0.01
    group.visible = live
    if (!live) return

    const dt = Math.min(Math.max(frame.dt, 1 / 240), 1 / 30)
    const segments = targets.length - 1
    const along = Math.min(0.9999, Math.max(0, frame.progress)) * segments
    const index = Math.floor(along)
    const local = along - index
    if (index !== stage) {
      stage = index
      velUniforms.uFrom.value = targets[index]
      velUniforms.uTo.value = targets[index + 1]
    }
    const blend = THREE.MathUtils.smoothstep(local, 0.18, 0.82)
    velUniforms.uBlend.value = blend
    velUniforms.uTime.value = frame.time
    velUniforms.uDt.value = dt
    velUniforms.uChaos.value = 0.12 + Math.max(0, 1 - along) * 0.9
    velUniforms.uCursor.value.copy(frame.cursor)
    velUniforms.uCursorOn.value = frame.cursorOn
    posVar.material.uniforms.uDt.value = dt
    gpu.compute()

    material.uniforms.uPos.value = gpu.getCurrentRenderTarget(posVar).texture
    material.uniforms.uVel.value = gpu.getCurrentRenderTarget(velVar).texture
    material.uniforms.uPixel.value = renderer.getPixelRatio()
    material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(frame.presence, 0.05, 0.6)

    // Spin while the shape is abstract, then settle face-on when it becomes the mark.
    const settle = THREE.MathUtils.smoothstep(along, 2.2, 2.85)
    material.uniforms.uBrand.value = THREE.MathUtils.smoothstep(along, 2.35, 2.9)
    spin += dt * 0.22 * (1 - settle)
    if (settle === 0 && spin > Math.PI) spin -= Math.PI * 2
    group.rotation.y = spin * (1 - settle)
    group.rotation.x = 0.18 * (1 - settle)
  }

  return { group, update, stages: targets.length }
}
