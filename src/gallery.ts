import * as THREE from 'three'

const vertex = /* glsl */ `
uniform float uBend;
uniform float uSkew;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // The card bows like paper dragged through air, then springs back.
  p.y += sin(uv.x * 3.14159265) * uBend;
  p.x += (uv.y - 0.5) * uSkew;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;
uniform vec2 uImage;
uniform vec2 uMouse;
uniform vec2 uOrigin;
uniform float uHover;
uniform float uTime;
uniform float uShift;
uniform float uFadeX;
uniform float uReady;
varying vec2 vUv;

vec2 cover(vec2 uv) {
  float rs = uSize.x / uSize.y;
  float ri = uImage.x / max(uImage.y, 1.0);
  vec2 s = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
  return (uv - 0.5) * s + 0.5;
}

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 toMouse = px - uMouse;
  float d = length(toMouse);
  vec2 dir = d > 0.001 ? toMouse / d : vec2(0.0);
  float wave = sin(d * 0.05 - uTime * 6.0) * exp(-d * 0.0075) * uHover;

  vec2 uv = (vUv - 0.5) / (1.1 + 0.05 * uHover) + 0.5;
  uv += vec2(dir.x, -dir.y) * wave * 0.022;
  uv += vec2(uMouse.x / uSize.x - 0.5, 0.5 - uMouse.y / uSize.y) * -0.035 * uHover;
  vec2 cuv = cover(uv);

  float split = min(abs(uShift) * 0.0009, 0.018) + abs(wave) * 0.008;
  vec3 color = vec3(
    texture2D(uMap, cuv + vec2(split, 0.0)).r,
    texture2D(uMap, cuv).g,
    texture2D(uMap, cuv - vec2(split, 0.0)).b
  );
  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(grey), color, 0.3 + 0.7 * uHover);
  color *= 0.78 + 0.22 * uHover;
  color += vec3(1.0, 0.3, 0.2) * max(wave, 0.0) * 0.1;
  color = mix(vec3(0.078, 0.09, 0.11), color, uReady);

  float edge = roundedBox(px - uSize * 0.5, uSize * 0.5, 18.0);
  float alpha = 1.0 - smoothstep(-1.0, 1.0, edge);
  alpha *= smoothstep(uFadeX - 40.0, uFadeX + 60.0, uOrigin.x + px.x);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`

export type GalleryFrame = {
  rects: DOMRect[]
  pointerX: number
  pointerY: number
  velocity: number
  time: number
  dt: number
  fadeX: number
}

export function createGallery(cards: HTMLElement[]) {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10)
  const geometry = new THREE.PlaneGeometry(1, 1, 32, 8)
  const loader = new THREE.TextureLoader()

  const items = cards.map((card) => {
    const img = card.querySelector('img')
    const uniforms = {
      uMap: { value: null as THREE.Texture | null },
      uSize: { value: new THREE.Vector2(1, 1) },
      uImage: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-9999, -9999) },
      uOrigin: { value: new THREE.Vector2() },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uShift: { value: 0 },
      uFadeX: { value: 0 },
      uReady: { value: 0 },
      uBend: { value: 0 },
      uSkew: { value: 0 },
    }
    if (img) {
      loader.load(img.currentSrc || img.src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.generateMipmaps = true
        uniforms.uMap.value = texture
        uniforms.uImage.value.set(texture.image.width, texture.image.height)
      })
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { mesh, uniforms, text: card.querySelector<HTMLElement>('div') }
  })

  let shift = 0
  let live = false

  const resize = (width: number, height: number) => {
    camera.right = width
    camera.bottom = -height
    camera.updateProjectionMatrix()
  }

  const update = (frame: GalleryFrame) => {
    const dt = Math.min(frame.dt, 0.05)
    shift += (frame.velocity - shift) * (1 - Math.exp(-8 * dt))
    live = false
    items.forEach((item, index) => {
      const rect = frame.rects[index]
      const onScreen = rect && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight
      item.mesh.visible = Boolean(onScreen)
      if (!rect || !onScreen) return
      live = true
      const u = item.uniforms
      item.mesh.position.set(rect.left + rect.width / 2, -(rect.top + rect.height / 2), 0)
      item.mesh.scale.set(rect.width, rect.height, 1)
      u.uSize.value.set(rect.width, rect.height)
      u.uOrigin.value.set(rect.left, rect.top)
      const mx = frame.pointerX - rect.left
      const my = frame.pointerY - rect.top
      const inside = mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height
      u.uHover.value += ((inside ? 1 : 0) - u.uHover.value) * (1 - Math.exp(-6 * dt))
      if (inside || u.uHover.value > 0.01) u.uMouse.value.set(mx, my)
      u.uTime.value = frame.time
      u.uShift.value = shift
      u.uFadeX.value = frame.fadeX
      u.uReady.value += ((u.uMap.value ? 1 : 0) - u.uReady.value) * (1 - Math.exp(-4 * dt))
      const lag = 1 + index * 0.05
      u.uBend.value = THREE.MathUtils.clamp(-shift * 0.0028 * lag, -0.08, 0.08)
      u.uSkew.value = THREE.MathUtils.clamp(shift * 0.0012, -0.05, 0.05)
    })
    return items.map((_, index) => {
      const rect = frame.rects[index]
      if (!rect) return 1
      return THREE.MathUtils.clamp((rect.left - (frame.fadeX - 60)) / 120, 0, 1)
    })
  }

  const render = (renderer: THREE.WebGLRenderer) => {
    if (!live) return
    renderer.render(scene, camera)
  }

  return { update, render, resize, items }
}
