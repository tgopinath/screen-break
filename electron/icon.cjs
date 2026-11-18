// Draws Screen Break's eye glyph into raw pixel buffers so the app ships no
// binary icon assets. Used for the tray icon (template on macOS) and to
// generate build/icon.png for packaging.

function eyeCoverage(u, v) {
  // u, v in a 16×16 design space centred on 0. Returns 0..1 ink coverage.
  const half = (x) => 5.4 * (1 - (x / 7.6) ** 2)
  let ink = 0
  const f = Math.abs(u) < 7.6 ? half(u) : -1
  const d = Math.abs(v) - f
  if (f > 0 && d < 0.15 && d > -1.45) ink = 1
  if (u * u + v * v <= 2.7 * 2.7) ink = 1
  return ink
}

/** BGRA bitmap of size×size; `rgb` colour of the glyph; optional rounded-square background. */
function drawIcon(size, { rgb = [0, 0, 0], bg = null, glyphScale = 1 } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const ss = 4 // supersampling
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let ink = 0
      let bgCov = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size // 0..1
          const y = (py + (sy + 0.5) / ss) / size
          const u = ((x - 0.5) * 16) / glyphScale
          const v = ((y - 0.5) * 16) / glyphScale
          ink += eyeCoverage(u, v)
          if (bg) {
            // rounded square with 22% radius
            const r = 0.22
            const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0)
            const dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0)
            if (dx * dx + dy * dy <= r * r) bgCov++
          }
        }
      }
      ink /= ss * ss
      bgCov /= ss * ss
      const i = (py * size + px) * 4
      if (bg) {
        // composite white-ish glyph over background
        const r = Math.round(bg[0] * (1 - ink) + rgb[0] * ink)
        const g = Math.round(bg[1] * (1 - ink) + rgb[1] * ink)
        const b = Math.round(bg[2] * (1 - ink) + rgb[2] * ink)
        buf[i] = b
        buf[i + 1] = g
        buf[i + 2] = r
        buf[i + 3] = Math.round(255 * bgCov)
      } else {
        buf[i] = rgb[2]
        buf[i + 1] = rgb[1]
        buf[i + 2] = rgb[0]
        buf[i + 3] = Math.round(255 * ink)
      }
    }
  }
  return buf
}

module.exports = { drawIcon }
