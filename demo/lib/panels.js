// Keep the requested widths when the window grows again; only the displayed widths are constrained.
export const MIN_INPUT = 300, MIN_MIDDLE = 280, MIN_OUTPUT = 340
/** @param {unknown} value */
export const storedWidth = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
/** @param {number} width @param {number | null} input @param {number | null} output */
export function columnWidths(width, input, output) {
  const desktop = width >= 1280
  const available = Math.max(800, width - 32 - (desktop ? 32 : 16))
  const inputDefault = desktop ? 380 : 360
  let left = Math.min(available - MIN_MIDDLE - (desktop ? MIN_OUTPUT : 0), Math.max(MIN_INPUT, input ?? inputDefault))
  let right = desktop ? Math.min(available - MIN_MIDDLE - MIN_INPUT, Math.max(MIN_OUTPUT, output ?? 400)) : 0
  if (desktop && left + right > available - MIN_MIDDLE) {
    const room = available - MIN_MIDDLE - MIN_INPUT - MIN_OUTPUT
    const extra = left - MIN_INPUT + right - MIN_OUTPUT
    left = MIN_INPUT + (left - MIN_INPUT) * room / extra
    right = MIN_OUTPUT + (right - MIN_OUTPUT) * room / extra
  }
  left = Math.floor(left); right = Math.floor(right)
  return { input: left, output: right, inputMax: available - MIN_MIDDLE - right, outputMax: available - MIN_MIDDLE - left, desktop }
}
