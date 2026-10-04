import * as THREE from 'three'

// Rain-and-thunder sky after https://codepen.io/ArvidW/pen/poKMrBR: a camera tilted up into
// a ceiling of smoke planes, lit from inside by one jumping, flickering point of lightning.

export const STORM_SKY = 0x030407

const cloudVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`

const cloudFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFlashPos;
uniform float uFlash;
uniform float uOpacity;
uniform vec3 uSky;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  float alpha = tex.a * uOpacity;
  if (alpha < 0.004) discard;

  // Unlit smoke stays a faint grey-blue so the sky has depth between strikes.
  vec3 color = tex.rgb * vec3(0.012, 0.013, 0.02);

  // Per-pixel falloff from the bolt: a local patch blazes, the rest of the deck stays dark.
  float d = distance(vWorld, uFlashPos);
  float reach = pow(max(0.0, 1.0 - d / 520.0), 1.35);
  float light = uFlash * reach * 2.2;
  vec3 bolt = mix(vec3(0.02, 0.16, 1.0), vec3(0.3, 1.0, 0.95), smoothstep(0.7, 1.8, light));
  color += tex.rgb * bolt * light * 3.0;

  float fog = 1.0 - exp(-pow(0.0021 * vDepth, 2.0));
  color = mix(color, uSky, fog);
  gl_FragColor = vec4(color, alpha);
}
`

export function createStorm() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 1000)
  camera.position.z = 1
  camera.rotation.set(1.16, -0.12, 0.27)
  camera.updateMatrixWorld()

  const sky = new THREE.Color(STORM_SKY)
  const flashPos = new THREE.Vector3(200, 300, 100)
  const uniforms = {
    uFlashPos: { value: flashPos },
    uFlash: { value: 0 },
    uSky: { value: sky },
  }

  const rainCount = 15000
  const rainPositions = new Float32Array(rainCount * 3)
  for (let i = 0; i < rainCount; i += 1) {
    rainPositions[i * 3] = Math.random() * 400 - 200
    rainPositions[i * 3 + 1] = Math.random() * 500 - 250
    rainPositions[i * 3 + 2] = Math.random() * 400 - 200
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
  const rainMat = new THREE.PointsMaterial({ color: 0x9aa4b8, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false })
  const rain = new THREE.Points(rainGeo, rainMat)
  scene.add(rain)

  const clouds: THREE.Mesh[] = []
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}images/cloud-smoke.webp`, (texture) => {
    const geometry = new THREE.PlaneGeometry(500, 500)
    for (let p = 0; p < 25; p += 1) {
      const material = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uMap: { value: texture }, uOpacity: { value: 0.6 } },
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
      })
      const cloud = new THREE.Mesh(geometry, material)
      cloud.position.set(Math.random() * 800 - 400, 500, Math.random() * 500 - 450)
      cloud.rotation.set(1.16, -0.12, Math.random() * Math.PI * 2)
      clouds.push(cloud)
      scene.add(cloud)
    }
  })

  // The reference rolls its dice once per frame at 60 Hz; a fixed tick keeps that rhythm
  // on 120 Hz screens too.
  let power = 0
  let clock = 0
  const tick = () => {
    if (Math.random() > 0.94 || power > 100) {
      if (power < 100) {
        flashPos.set(Math.random() * 700 - 300, 300 + Math.random() * 200, 100 - Math.random() * 300)
      }
      power = 50 + Math.random() * 500
    } else {
      power *= 0.9
    }
    clouds.forEach((cloud) => {
      cloud.rotation.z -= 0.002
    })
    rain.position.z -= 0.222
    if (rain.position.z < -200) rain.position.z = 0
  }

  const screen = new THREE.Vector3()
  const flashScreen = new THREE.Vector2()

  const update = (dt: number) => {
    clock += Math.min(dt, 0.1)
    while (clock >= 1 / 60) {
      clock -= 1 / 60
      tick()
    }
    const flash = power / 550
    uniforms.uFlash.value = flash
    screen.copy(flashPos).project(camera)
    flashScreen.set(THREE.MathUtils.clamp(screen.x, -1.4, 1.4), THREE.MathUtils.clamp(screen.y, -1.4, 1.4))
    return { flash, screen: flashScreen }
  }

  const reset = () => {
    power = 0
    uniforms.uFlash.value = 0
  }

  const resize = (aspect: number) => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, update, reset, resize }
}
