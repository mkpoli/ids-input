// Whole-character recognition for the Find tab's pad, over DaKanji's single-character classifier
// (MIT; see demo/model). The model and runtime load on the first drawing, so pages that never draw
// do not fetch them.
import modelUrl from '../model/dakanji-character-classifier.onnx?url'
import labelsUrl from '../model/dakanji-labels.txt?url'

const SIDE = 128

/** @typedef {{ x: number, y: number }} Point */

/** @type {Promise<{ session: import('onnxruntime-web').InferenceSession, labels: string[], ort: typeof import('onnxruntime-web') }> | null} */
let loading = null

function load() {
  if (loading) return loading
  loading = (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`
    ort.env.wasm.numThreads = 1
    const [session, labelsText] = await Promise.all([
      ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] }),
      fetch(labelsUrl).then(response => response.text()),
    ])
    return { session, labels: Array.from(labelsText.trim()), ort }
  })().catch(error => { loading = null; throw error })
  return loading
}

/**
 * The model's closest characters for a drawing. Coordinates are percentages of the pad, as the
 * pad stores them.
 * @param {Point[][]} strokes
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function recognizeDrawing(strokes, limit = 24) {
  const { session, labels, ort } = await load()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
  context.fillStyle = '#000'
  context.fillRect(0, 0, SIDE, SIDE)
  context.strokeStyle = '#fff'
  context.lineWidth = 5
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const at = ([x, y]) => [8 + x / 100 * 112, 8 + y / 100 * 112]
  for (const stroke of strokes) {
    if (!stroke.length) continue
    context.beginPath()
    context.moveTo(...at([stroke[0].x, stroke[0].y]))
    if (stroke.length === 1) context.lineTo(...at([stroke[0].x + 0.1, stroke[0].y]))
    for (const point of stroke.slice(1)) context.lineTo(...at([point.x, point.y]))
    context.stroke()
  }
  const pixels = context.getImageData(0, 0, SIDE, SIDE).data
  const input = new Float32Array(SIDE * SIDE)
  for (let i = 0; i < input.length; i++) input[i] = pixels[i * 4]
  const output = await session.run({ image: new ort.Tensor('float32', input, [1, 1, SIDE, SIDE]) })
  const probabilities = output.probs.data
  return Array.from(probabilities.keys()).sort((a, b) => probabilities[b] - probabilities[a])
    .slice(0, limit).map(index => labels[index]).filter(Boolean)
}
