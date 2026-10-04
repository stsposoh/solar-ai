import * as THREE from 'three'

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const frag = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCursor;
uniform float uCursorRadius;
uniform float uCount;
uniform float uBlend;

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 screenToWorld(vec2 n) {
  vec2 uv = n * 2.0 - 1.0;
  uv.x *= uResolution.x / max(uResolution.y, 1.0);
  return vec3(uv * 2.0, 0.0);
}

float scene(vec3 pos) {
  float field = 80.0;
  float t = uTime;
  for (int i = 0; i < 14; i++) {
    if (float(i) >= uCount) break;
    float fi = float(i);
    float speed = 0.28 + fi * 0.11;
    float radius = 0.16 + mod(fi, 3.0) * 0.055;
    float orbit = 0.55 + mod(fi * 1.7, 3.0) * 0.22;
    float phase = fi * 1.13;
    vec3 center = vec3(
      sin(t * speed + phase) * orbit,
      cos(t * speed * 0.82 + phase * 1.2) * orbit * 0.72,
      sin(t * speed * 0.45 + phase) * 0.28
    );
    if (i == 0) center = screenToWorld(vec2(0.12, 0.78)) + vec3(sin(t * 0.4) * 0.08, cos(t * 0.33) * 0.06, 0.0);
    if (i == 1) center = screenToWorld(vec2(0.86, 0.22)) + vec3(cos(t * 0.35) * 0.07, sin(t * 0.29) * 0.05, 0.0);
    vec3 toCursor = uCursor - center;
    float gap = length(toCursor);
    float merge = 1.15;
    float k = 0.06;
    if (gap < merge && gap > 0.001) {
      float pull = (1.0 - gap / merge);
      center += normalize(toCursor) * pull * 0.32;
      k = mix(0.06, uBlend, pull * pull);
    }
    field = smin(field, sdSphere(pos - center, radius), k);
  }
  field = smin(field, sdSphere(pos - uCursor, uCursorRadius), uBlend);
  return field;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

float march(vec3 ro, vec3 rd, out float closest) {
  float t = 0.0;
  closest = 80.0;
  for (int i = 0; i < 52; i++) {
    float d = scene(ro + rd * t);
    closest = min(closest, d);
    if (d < 0.0008) return t;
    if (t > 6.0) break;
    t += d * 0.72;
  }
  return -1.0;
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = normalAt(p);
  vec3 light = normalize(vec3(-0.35, 0.7, 0.85));
  float diff = max(dot(n, light), 0.0);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
  vec3 color = vec3(0.72, 0.08, 0.05) * (0.22 + diff * 0.95);
  color += vec3(1.0, 0.55, 0.42) * fres * 0.55;
  color += vec3(1.0, 0.22, 0.16) * pow(max(dot(n, light), 0.0), 28.0) * 0.35;
  return color;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  vec3 ro = vec3(uv * 2.0, -1.15);
  vec3 rd = vec3(0.0, 0.0, 1.0);
  float closest;
  float t = march(ro, rd, closest);
  vec3 bg = vec3(0.027, 0.031, 0.039);
  float dist = length(ro.xy - uCursor.xy);
  float halo = pow(1.0 - smoothstep(0.0, 0.62, dist), 2.2);
  vec3 glow = vec3(1.0, 0.28, 0.18) * halo * 0.62;
  bg += glow;
  float px = 2.4 / max(uResolution.y, 1.0);
  float cover = 1.0 - smoothstep(0.0, px * 3.2, closest);
  if (t < 0.0) {
    gl_FragColor = vec4(mix(bg, vec3(0.55, 0.07, 0.05), cover * 0.55), 1.0);
    return;
  }
  vec3 color = mix(bg, shade(ro, rd, t), max(cover, 0.88));
  color += glow * 0.16;
  gl_FragColor = vec4(color, 1.0);
}
`

export function createMetaballs(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x07080a, 1)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCursor: { value: new THREE.Vector3(0, 0, 0) },
      uCursorRadius: { value: 0.06 },
      uCount: { value: 5 },
      uBlend: { value: 0.28 },
    },
    vertexShader: vert,
    fragmentShader: frag,
  })
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))

  const pointer = { x: 0.5, y: 0.5 }
  const cursor = new THREE.Vector3()
  const cursorTarget = new THREE.Vector3()
  let radius = 0.06
  let fade = 0

  const toWorld = (nx: number, ny: number) => {
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1)
    return new THREE.Vector3((nx * 2 - 1) * aspect * 2, (ny * 2 - 1) * 2, 0)
  }

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width < 2 || height < 2) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.setSize(width, height, false)
    material.uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio())
  }

  const setPointer = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = (clientX - rect.left) / Math.max(rect.width, 1)
    pointer.y = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
  }

  const update = (time: number, presence: number, progress: number, hovering: boolean) => {
    fade += ((presence > 0.02 ? presence : 0) - fade) * 0.12
    canvas.style.opacity = fade.toFixed(3)
    if (fade < 0.02) return
    cursorTarget.copy(toWorld(pointer.x, pointer.y))
    cursor.lerp(cursorTarget, hovering ? 0.18 : 0.06)
    const count = 5 + Math.floor(progress * 8)
    const near = cursor.distanceTo(cursorTarget) < 2.2
    const want = hovering && near ? 0.09 : 0.06
    radius += (want - radius) * 0.08
    material.uniforms.uTime.value = time
    material.uniforms.uCursor.value.copy(cursor)
    material.uniforms.uCursorRadius.value = radius
    material.uniforms.uCount.value = count
    renderer.render(scene, camera)
  }

  resize()
  return { resize, setPointer, update }
}
