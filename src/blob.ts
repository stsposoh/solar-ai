import * as THREE from 'three'

const DETAIL = 64

const warpChunk = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uTwist;
uniform float uPoke;
uniform vec3 uPokeDir;

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

vec3 warp(vec3 p) {
  float a = p.y * uTwist;
  float c = cos(a);
  float s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec3 n = normalize(p);
  float d = snoise(p * uFreq + vec3(0.0, uTime * 0.32, uTime * 0.18)) * uAmp;
  d += snoise(p * uFreq * 2.4 - vec3(uTime * 0.22)) * uAmp * 0.32;
  float reach = pow(max(dot(n, uPokeDir), 0.0), 7.0);
  d += reach * uPoke;
  return p + n * d;
}
`

const normalChunk = /* glsl */ `
vec3 warped = warp(position);
vec3 side = abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
vec3 tangentDir = normalize(cross(normal, side));
vec3 bitangentDir = normalize(cross(normal, tangentDir));
vec3 warpedT = warp(normalize(position + tangentDir * 0.012));
vec3 warpedB = warp(normalize(position + bitangentDir * 0.012));
vec3 objectNormal = normalize(cross(warpedT - warped, warpedB - warped));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`

type Look = {
  color: THREE.Color
  emissive: THREE.Color
  emissiveIntensity: number
  metalness: number
  roughness: number
  iridescence: number
  amp: number
  freq: number
  twist: number
}

const LOOKS: Look[] = [
  { color: new THREE.Color('#f2f5f8'), emissive: new THREE.Color('#000000'), emissiveIntensity: 0, metalness: 1, roughness: 0.05, iridescence: 0, amp: 0.2, freq: 1.05, twist: 0 },
  { color: new THREE.Color('#dfe9ff'), emissive: new THREE.Color('#0a1a2a'), emissiveIntensity: 0.4, metalness: 0.75, roughness: 0.1, iridescence: 1, amp: 0.3, freq: 1.55, twist: 1.25 },
  { color: new THREE.Color('#ff4d3c'), emissive: new THREE.Color('#ff2414'), emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.2, iridescence: 0.2, amp: 0.42, freq: 2.25, twist: -0.6 },
]

export type BlobFrame = {
  time: number
  dt: number
  progress: number
  presence: number
  energy: number
  cursor: THREE.Vector3
  cursorOn: number
}

export function createBlob() {
  const geometry = new THREE.IcosahedronGeometry(1, DETAIL)
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: LOOKS[0].amp },
    uFreq: { value: LOOKS[0].freq },
    uTwist: { value: 0 },
    uPoke: { value: 0 },
    uPokeDir: { value: new THREE.Vector3(0, 0, 1) },
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: LOOKS[0].color.clone(),
    metalness: 1,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: 0,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [120, 720],
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${warpChunk}`)
      .replace('#include <beginnormal_vertex>', normalChunk)
      .replace('#include <begin_vertex>', 'vec3 transformed = warped;')
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const group = new THREE.Group()
  group.add(mesh)
  group.visible = false

  const poke = new THREE.Vector3(0, 0, 1)
  const want = new THREE.Vector3()
  const unspin = new THREE.Euler()
  const up = new THREE.Vector3(0, 1, 0)
  let pokeAmt = 0
  let energy = 0
  let spin = 0

  const look = (progress: number) => {
    const along = Math.min(0.9999, Math.max(0, progress)) * (LOOKS.length - 1)
    const index = Math.floor(along)
    const t = THREE.MathUtils.smoothstep(along - index, 0.25, 0.75)
    return { a: LOOKS[index], b: LOOKS[index + 1], t }
  }

  const update = (frame: BlobFrame) => {
    const live = frame.presence > 0.01
    group.visible = live
    if (!live) return
    const dt = Math.min(frame.dt, 0.05)

    const { a, b, t } = look(frame.progress)
    material.color.copy(a.color).lerp(b.color, t)
    material.emissive.copy(a.emissive).lerp(b.emissive, t)
    material.emissiveIntensity = THREE.MathUtils.lerp(a.emissiveIntensity, b.emissiveIntensity, t)
    material.metalness = THREE.MathUtils.lerp(a.metalness, b.metalness, t)
    material.roughness = THREE.MathUtils.lerp(a.roughness, b.roughness, t)
    material.iridescence = THREE.MathUtils.lerp(a.iridescence, b.iridescence, t)

    // Fast scrolling agitates the surface; it calms down on its own.
    energy += (Math.min(frame.energy, 3) - energy) * (1 - Math.exp(-5 * dt))
    uniforms.uTime.value = frame.time
    uniforms.uAmp.value = THREE.MathUtils.lerp(a.amp, b.amp, t) + energy * 0.08
    uniforms.uFreq.value = THREE.MathUtils.lerp(a.freq, b.freq, t)
    uniforms.uTwist.value = THREE.MathUtils.lerp(a.twist, b.twist, t) + Math.sin(frame.time * 0.4) * 0.15

    want.set(frame.cursor.x, frame.cursor.y, 0.95).normalize()
    poke.lerp(want, 1 - Math.exp(-7 * dt)).normalize()
    pokeAmt += (frame.cursorOn * 0.5 - pokeAmt) * (1 - Math.exp(-4 * dt))
    uniforms.uPoke.value = pokeAmt
    uniforms.uPokeDir.value.copy(poke)

    spin += dt * (0.12 + energy * 0.2)
    mesh.rotation.y = spin
    mesh.rotation.x = Math.sin(frame.time * 0.21) * 0.25
    // Poke direction is in mesh space, so undo the spin for it.
    unspin.set(-mesh.rotation.x, 0, 0)
    uniforms.uPokeDir.value.applyEuler(unspin).applyAxisAngle(up, -spin)

    const grow = THREE.MathUtils.smoothstep(frame.presence, 0.4, 0.9)
    group.scale.setScalar(Math.max(0.001, grow * 0.84))
  }

  return { group, update }
}
