// Soft synthesized chimes — no audio files to ship.

let ctx: AudioContext | null = null

function audio() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, gain = 0.08) {
  const a = audio()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, a.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.05)
}

export const sounds = {
  reminder() {
    tone(659, 0, 0.5)
    tone(880, 0.18, 0.7)
  },
  step() {
    tone(784, 0, 0.25, 0.05)
  },
  complete() {
    tone(523, 0, 0.4)
    tone(659, 0.12, 0.4)
    tone(784, 0.24, 0.8)
  },
}
