// Whole-character recognition for the Find tab's pad. Both classifiers run for every locale:
// DaKanji supplies Japanese results including kana, and GlyphWeave supplies its Chinese and Latin
// classes. Each model and ONNX Runtime load on the first drawing, so pages that never draw fetch
// neither.
import daKanjiUrl from '../model/dakanji-character-classifier.onnx?url'
import daKanjiLabelsUrl from '../model/dakanji-labels.txt?url'
import glyphWeaveUrl from '../model/glyphweave-character-classifier.onnx?url'
import glyphWeaveLabelsUrl from '../model/glyphweave-labels.txt?url'

const SIDE = 128

/** @typedef {{ x: number, y: number }} Point */

/** @type {Promise<{ session: import('onnxruntime-web').InferenceSession, labels: string[], ort: typeof import('onnxruntime-web') }> | null} */
let daKanji = null
/** @type {Promise<{ session: import('onnxruntime-web').InferenceSession, labels: string[], ort: typeof import('onnxruntime-web') }> | null} */
let glyphWeave = null

/** @param {string} modelUrl @param {string} labelsUrl */
async function load(modelUrl, labelsUrl) {
  const ort = await import('onnxruntime-web/wasm')
  ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`
  ort.env.wasm.numThreads = 1
  const [session, labelsText] = await Promise.all([
    ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] }),
    fetch(labelsUrl).then(response => response.text()),
  ])
  return { session, labels: Array.from(labelsText.trim()), ort }
}

function daKanjiModel() {
  return daKanji ??= load(daKanjiUrl, daKanjiLabelsUrl).catch(error => { daKanji = null; throw error })
}

function glyphWeaveModel() {
  return glyphWeave ??= load(glyphWeaveUrl, glyphWeaveLabelsUrl).catch(error => { glyphWeave = null; throw error })
}

/** @param {number[]} probabilities @param {string[]} labels @param {number} limit */
function top(probabilities, labels, limit) {
  return Array.from(probabilities.keys())
    .sort((a, b) => probabilities[b] - probabilities[a])
    .slice(0, limit)
    .map(index => labels[index])
    .filter(Boolean)
}

/** @param {Point[][]} strokes */
function drawDaKanji(strokes) {
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
  return input
}

/** @param {Point[][]} strokes */
function drawGlyphWeave(strokes) {
  const SOURCE = 256
  const source = document.createElement('canvas')
  source.width = source.height = SOURCE
  const context = /** @type {CanvasRenderingContext2D} */ (source.getContext('2d'))
  context.fillStyle = '#fff'
  context.fillRect(0, 0, SOURCE, SOURCE)
  context.strokeStyle = '#000'
  context.lineWidth = 8
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const at = ([x, y]) => [16 + x / 100 * (SOURCE - 32), 16 + y / 100 * (SOURCE - 32)]
  for (const stroke of strokes) {
    if (!stroke.length) continue
    context.beginPath()
    context.moveTo(...at([stroke[0].x, stroke[0].y]))
    if (stroke.length === 1) context.lineTo(...at([stroke[0].x + 0.1, stroke[0].y]))
    for (const point of stroke.slice(1)) context.lineTo(...at([point.x, point.y]))
    context.stroke()
  }
  const pixels = context.getImageData(0, 0, SOURCE, SOURCE).data
  let left = SOURCE, right = -1, top = SOURCE, bottom = -1
  for (let y = 0; y < SOURCE; y++) {
    for (let x = 0; x < SOURCE; x++) {
      if (pixels[(y * SOURCE + x) * 4] >= 210) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  const inner = Math.round(SIDE * 0.76)
  const ratio = Math.min(inner / (right - left + 1), inner / (bottom - top + 1))
  const width = Math.max(1, Math.round((right - left + 1) * ratio))
  const height = Math.max(1, Math.round((bottom - top + 1) * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  const target = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
  target.fillStyle = '#fff'
  target.fillRect(0, 0, SIDE, SIDE)
  target.imageSmoothingEnabled = true
  target.drawImage(source, left, top, right - left + 1, bottom - top + 1,
    Math.round((SIDE - width) / 2), Math.round((SIDE - height) / 2), width, height)
  const gray = target.getImageData(0, 0, SIDE, SIDE).data
  const input = new Float32Array(SIDE * SIDE)
  for (let i = 0; i < input.length; i++) input[i] = 1 - gray[i * 4] / 127.5
  return input
}

/** @param {Point[][]} strokes */
async function japaneseResults(strokes) {
  const { session, labels, ort } = await daKanjiModel()
  const output = await session.run({ image: new ort.Tensor('float32', drawDaKanji(strokes), [1, 1, SIDE, SIDE]) })
  return top(output.probs.data, labels, 24)
}

/** @param {Point[][]} strokes */
async function chineseResults(strokes) {
  const { session, labels, ort } = await glyphWeaveModel()
  const input = drawGlyphWeave(strokes)
  if (!input) return []
  const output = await session.run({ image: new ort.Tensor('float32', input, [1, 1, SIDE, SIDE]) })
  return top(output.logits.data, labels, 24)
}

/** @param {Point[][]} strokes */
export async function recognizeDrawing(strokes) {
  const models = await Promise.allSettled([japaneseResults(strokes), chineseResults(strokes)])
  const failed = models.filter(result => result.status === 'rejected')
  if (failed.length === models.length) throw failed[0].reason
  const japanese = models[0].status === 'fulfilled' ? models[0].value : []
  const chinese = models[1].status === 'fulfilled' ? models[1].value : []
  const merged = []
  for (let i = 0; i < Math.max(japanese.length, chinese.length); i++) {
    if (japanese[i]) merged.push(japanese[i])
    if (chinese[i]) merged.push(chinese[i])
  }
  return [...new Set(merged)]
}
