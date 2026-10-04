// @ts-expect-error original CodePen bundle has no types
import TubesCursor from './vendor/tubes1.min.js'

export function createTubes(canvas: HTMLCanvasElement) {
  return TubesCursor(canvas, {
    tubes: {
      colors: ['#f967fb', '#53bc28', '#6958d5'],
      lights: {
        intensity: 200,
        colors: ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5'],
      },
    },
  })
}
